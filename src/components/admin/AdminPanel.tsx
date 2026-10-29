import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Layers,
  Users,
  BarChart3,
  Bell,
  Settings as SettingsIcon,
  Plus,
  Search,
  Menu,
  X,
  LogOut,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserCheck,
  Edit2,
  Trash2,
  RefreshCw,
  Mail,
  Zap,
  Phone,
  Shield,
  ChevronRight,
  TrendingUp,
  Percent,
  Check,
  Filter,
  Eye,
  MapPin,
  ExternalLink,
  Database,
  Copy
} from 'lucide-react';
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SETUP_SQL,
  testSupabaseConnection,
  bulkSyncAllToSupabase
} from '../../services/supabase.ts';
import {
  UserAccount,
  RestaurantTable,
  Reservation,
  CustomerProfile,
  RestaurantSettings,
  BlockedPeriod,
  OwnerNotification,
  TableStatus,
  ReservationStatus
} from '../../types/index.ts';
import {
  fetchOwnerAllData,
  fetchOwnerDaySummary,
  updateOwnerReservation,
  deleteOwnerReservation,
  deleteOwnerBlock,
  markOwnerNotificationsRead,
  gdprDeleteOwnerCustomer,
  saveOwnerSettings,
  ownerLogout
} from '../../services/api.ts';
import { INITIAL_TABLES, INITIAL_SETTINGS, getSettings, getReservations, getTodayStr, exportReservationsToCsv } from '../../services/storage.ts';
import { FloorPlanSVG } from '../FloorPlanSVG.tsx';
import { ManualReservationModal } from './ManualReservationModal.tsx';
import { TableDetailModal } from './TableDetailModal.tsx';
import { BlockPeriodModal } from './BlockPeriodModal.tsx';
import { GoogleSignInButton } from '../GoogleSignInButton.tsx';
import { GmailConfirmModal } from '../GmailConfirmModal.tsx';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from '../../services/googleAuth.ts';
import { sendGmailMessage, generateReservationHtmlEmail } from '../../services/gmail.ts';
import type { User as FirebaseUser } from 'firebase/auth';

interface AdminPanelProps {
  user: UserAccount;
  onLogout: () => void;
}

type AdminSection =
  | 'dashboard'
  | 'reservas'
  | 'mesas'
  | 'estatisticas'
  | 'configuracoes';

const N8N_WEBHOOK_URL = 'https://simaoramos.app.n8n.cloud/webhook/nova-reserva';

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout }) => {
  // Navigation & UI State
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Core Data States
  const [tables, setTables] = useState<RestaurantTable[]>(INITIAL_TABLES);
  const [reservations, setReservations] = useState<Reservation[]>(() => getReservations());
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(() => getSettings() || INITIAL_SETTINGS);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);

  // Selected Date Filter (Dashboard & Tables)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [dashboardDateFilter, setDashboardDateFilter] = useState<'hoje' | 'amanha' | 'semana' | 'personalizado'>('hoje');

  // Day Summary
  const [daySummary, setDaySummary] = useState<{
    totalReservations: number;
    expectedGuests: number;
    freeTables: number;
    occupiedTables: number;
    upcomingArrivals: Reservation[];
    unreadNotifications: number;
  }>({
    totalReservations: 0,
    expectedGuests: 0,
    freeTables: 12,
    occupiedTables: 0,
    upcomingArrivals: [],
    unreadNotifications: 0,
  });

  // Reservations View State
  const [reservationViewMode, setReservationViewMode] = useState<'tabela' | 'turnos'>('tabela');
  const [resSearchQuery, setResSearchQuery] = useState('');
  const [resStatusFilter, setResStatusFilter] = useState<string>('todas');
  const [resPaxFilter, setResPaxFilter] = useState<string>('todos');
  const [resDateFilter, setResDateFilter] = useState<'hoje' | 'amanha' | 'semana' | 'todas'>('hoje');

  // Customers View State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Statistics View State
  const [statsPeriod, setStatsPeriod] = useState<'7dias' | '30dias' | 'tudo'>('30dias');

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedTableForModal, setSelectedTableForModal] = useState<RestaurantTable | null>(null);

  // Google / Gmail Integration
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [selectedReservationForGmail, setSelectedReservationForGmail] = useState<Reservation | null>(null);
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [isSendingGmail, setIsSendingGmail] = useState(false);

  // Webhook Test State
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Supabase Database Integration State
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    hasTables: boolean;
    message: string;
    details?: Record<string, boolean>;
  } | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Push notifications permission
  const [pushEnabled, setPushEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );

  // Show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Supabase Handlers
  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    try {
      const res = await testSupabaseConnection();
      setSupabaseStatus(res);
      showToast(res.message);
    } catch {
      showToast('Erro ao contactar o Supabase.');
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await bulkSyncAllToSupabase(reservations, customers, settings);
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'Falha ao sincronizar com Supabase.');
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopiedSql(true);
      showToast('Script SQL copiado com sucesso!');
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  // Google Auth lifecycle
  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setGoogleUser(u),
      () => setGoogleUser(null)
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch all backend data
  const loadAll = async () => {
    try {
      const data = await fetchOwnerAllData();
      setTables(data.tables);
      setReservations(data.reservations);
      setCustomers(data.customers);
      setSettings((prev) => {
        if (!prev) return data.settings;
        if (activeSection === 'configuracoes') return prev;
        return data.settings;
      });
      setBlockedPeriods(data.blockedPeriods);
      setNotifications(data.notifications);

      const summary = await fetchOwnerDaySummary(selectedDate);
      setDaySummary(summary);
    } catch (err) {
      console.error('Erro ao carregar dados do proprietário:', err);
    }
  };

  useEffect(() => {
    loadAll();
    // 8-second polling for live updates
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Google OAuth Handlers
  const handleGoogleConnect = async () => {
    setIsGoogleConnecting(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
        showToast(`Conectado ao Gmail: ${res.user.email}`);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao autenticar com Google');
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    showToast('Desconectado do Gmail');
  };

  const handleOpenGmailConfirm = async (resItem: Reservation) => {
    const token = await getAccessToken();
    if (!token || !googleUser) {
      try {
        setIsGoogleConnecting(true);
        const authRes = await googleSignIn();
        if (authRes?.user) {
          setGoogleUser(authRes.user);
          setSelectedReservationForGmail(resItem);
          setShowGmailModal(true);
        }
      } catch (err: any) {
        showToast(err.message || 'Necessário autenticar com Google');
      } finally {
        setIsGoogleConnecting(false);
      }
      return;
    }
    setSelectedReservationForGmail(resItem);
    setShowGmailModal(true);
  };

  const handleConfirmSendGmail = async () => {
    if (!selectedReservationForGmail) return;
    setIsSendingGmail(true);
    try {
      const html = generateReservationHtmlEmail(selectedReservationForGmail);
      await sendGmailMessage({
        to: selectedReservationForGmail.customerEmail,
        subject: `Confirmação de Reserva Oficial · Qué Pasa (${selectedReservationForGmail.code})`,
        bodyText: `Olá ${selectedReservationForGmail.customerName},\n\nA sua mesa para ${selectedReservationForGmail.guests} pessoas no Qué Pasa está confirmada para ${selectedReservationForGmail.date} às ${selectedReservationForGmail.time} (Mesa ${selectedReservationForGmail.tableId}).\nTelefone do restaurante: 234 424 208.\n\nCais dos Mercantéis 14, Aveiro.`,
        bodyHtml: html,
      });
      showToast(`Email de confirmação enviado para ${selectedReservationForGmail.customerEmail}!`);
      setShowGmailModal(false);
      setSelectedReservationForGmail(null);
    } catch (err: any) {
      showToast(err.message || 'Falha ao enviar aviso pelo Gmail');
    } finally {
      setIsSendingGmail(false);
    }
  };

  // Test n8n Webhook
  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test_webhook',
          restaurant: 'Qué Pasa · Aveiro',
          timestamp: new Date().toISOString(),
          phone: '234 424 208',
          message: 'Teste de disparo de webhook do painel admin',
        }),
      });
      if (response.ok) {
        showToast('Webhook n8n disparado com sucesso!');
      } else {
        showToast(`Webhook respondeu status ${response.status}`);
      }
    } catch {
      showToast('Erro ao contactar webhook n8n');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Request browser push permissions
  const handleRequestPush = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setPushEnabled(true);
        showToast('Notificações no telemóvel ativadas!');
        new Notification('Qué Pasa · Aveiro', {
          body: 'Notificações ativas: receberá alertas instantâneos de novas reservas.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleLogout = async () => {
    await ownerLogout();
    onLogout();
  };

  // Format today's date in Portuguese
  const formattedToday = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('pt-PT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date());
    } catch {
      return getTodayStr();
    }
  }, []);

  // Compute table status map for floor plan
  const tableStatusMap = useMemo(() => {
    const map: Record<number, { status: TableStatus; currentReservation?: Reservation }> = {};
    const dayRes = reservations.filter(
      (r) => r.date === selectedDate && r.status !== 'cancelada' && r.status !== 'noshow'
    );

    tables.forEach((t) => {
      const hasBlock = blockedPeriods.some(
        (b) => b.date === selectedDate && (b.tableId === t.id || b.tableId === null)
      );
      if (hasBlock) {
        map[t.id] = { status: 'bloqueada' };
        return;
      }

      const matchRes = dayRes.find((r) => r.tableId === t.id || r.joinedTableId === t.id);
      if (matchRes) {
        if (matchRes.status === 'sentada') {
          map[t.id] = { status: 'sentada', currentReservation: matchRes };
        } else if (matchRes.status === 'chegou') {
          map[t.id] = { status: 'chegou', currentReservation: matchRes };
        } else if (matchRes.status === 'concluida') {
          map[t.id] = { status: 'a_limpar', currentReservation: matchRes };
        } else {
          map[t.id] = { status: 'reservada', currentReservation: matchRes };
        }
      } else {
        map[t.id] = { status: 'livre' };
      }
    });

    return map;
  }, [tables, reservations, selectedDate, blockedPeriods]);

  // Dashboard filtered reservations for the active day
  const todayReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, selectedDate]);

  // Pending reservations for today
  const pendingReservationsCount = useMemo(() => {
    return reservations.filter(
      (r) => r.date === selectedDate && (r.status === 'pendente' || r.status === 'confirmada')
    ).length;
  }, [reservations, selectedDate]);

  // Estimated occupancy rate for today (% of available 12 tables over 4 shifts = 48 seating opportunities)
  const occupancyRate = useMemo(() => {
    const activeToday = reservations.filter(
      (r) => r.date === selectedDate && r.status !== 'cancelada' && r.status !== 'noshow'
    );
    const totalSlotsPossible = 12 * 4; // 12 tables across 4 shifts (12:30, 14:00, 19:30, 21:00)
    const rate = Math.min(100, Math.round((activeToday.length / totalSlotsPossible) * 100));
    return rate;
  }, [reservations, selectedDate]);

  // Distribution by shift for today
  const shiftDistribution = useMemo(() => {
    const lunchSlots = ['12:30', '14:00'];
    const dinnerSlots = ['19:30', '21:00'];

    const getCount = (slot: string) =>
      reservations.filter(
        (r) => r.date === selectedDate && r.time === slot && r.status !== 'cancelada' && r.status !== 'noshow'
      ).length;

    return {
      lunch1: { time: '12:30', count: getCount('12:30') },
      lunch2: { time: '14:00', count: getCount('14:00') },
      dinner1: { time: '19:30', count: getCount('19:30') },
      dinner2: { time: '21:00', count: getCount('21:00') },
    };
  }, [reservations, selectedDate]);

  // All reservations with multi-filtering
  const filteredReservations = useMemo(() => {
    const today = getTodayStr();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    return reservations.filter((r) => {
      // Date filter
      if (resDateFilter === 'hoje' && r.date !== today) return false;
      if (resDateFilter === 'amanha' && r.date !== tomorrowStr) return false;
      if (resDateFilter === 'semana') {
        const resDate = new Date(r.date);
        const now = new Date();
        const diffDays = (resDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays < -1 || diffDays > 7) return false;
      }

      // Status filter
      if (resStatusFilter !== 'todas') {
        if (resStatusFilter === 'chegou') {
          if (!['chegou', 'concluida', 'sentada'].includes(r.status)) return false;
        } else if (resStatusFilter === 'cancelada') {
          if (r.status !== 'cancelada') return false;
        } else if (resStatusFilter === 'noshow') {
          if (r.status !== 'noshow') return false;
        } else if (r.status !== resStatusFilter) {
          return false;
        }
      }

      // Pax filter
      if (resPaxFilter === '1-2' && r.guests > 2) return false;
      if (resPaxFilter === '3-4' && (r.guests < 3 || r.guests > 4)) return false;
      if (resPaxFilter === '5+' && r.guests < 5) return false;

      // Search query
      if (resSearchQuery.trim()) {
        const q = resSearchQuery.toLowerCase();
        const matchesName = r.customerName.toLowerCase().includes(q);
        const matchesPhone = r.customerPhone.includes(q);
        const matchesCode = r.code.toLowerCase().includes(q);
        const matchesTable = `mesa ${r.tableId}`.includes(q);
        if (!matchesName && !matchesPhone && !matchesCode && !matchesTable) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.time.localeCompare(b.time);
    });
  }, [reservations, resDateFilter, resStatusFilter, resPaxFilter, resSearchQuery]);

  // Customers filtered
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, customerSearchQuery]);

  // Statistics calculation
  const statsData = useMemo(() => {
    let pool = [...reservations];
    const now = new Date();

    if (statsPeriod === '7dias') {
      pool = pool.filter((r) => {
        const diff = (now.getTime() - new Date(r.date).getTime()) / (1000 * 3600 * 24);
        return diff >= 0 && diff <= 7;
      });
    } else if (statsPeriod === '30dias') {
      pool = pool.filter((r) => {
        const diff = (now.getTime() - new Date(r.date).getTime()) / (1000 * 3600 * 24);
        return diff >= 0 && diff <= 30;
      });
    }

    const total = pool.length;
    const confirmedOrDone = pool.filter((r) => ['confirmada', 'chegou', 'sentada', 'concluida'].includes(r.status));
    const totalGuests = confirmedOrDone.reduce((acc, r) => acc + r.guests, 0);
    const avgGuests = confirmedOrDone.length ? (totalGuests / confirmedOrDone.length).toFixed(1) : '0';

    const cancelled = pool.filter((r) => r.status === 'cancelada').length;
    const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;

    const noShow = pool.filter((r) => r.status === 'noshow').length;
    const noShowRate = total ? Math.round((noShow / total) * 100) : 0;

    const recurringCustomers = customers.filter((c) => c.visitsCount > 1).length;
    const recurringRate = customers.length ? Math.round((recurringCustomers / customers.length) * 100) : 0;

    // Shift distribution
    const lunchCount = pool.filter((r) => r.time === '12:30' || r.time === '14:00').length;
    const dinnerCount = pool.filter((r) => r.time === '19:30' || r.time === '21:00').length;

    return {
      total,
      totalGuests,
      avgGuests,
      cancelled,
      cancelRate,
      noShow,
      noShowRate,
      recurringRate,
      lunchCount,
      dinnerCount,
    };
  }, [reservations, customers, statsPeriod]);

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // Status badge styling helper - Apenas Chegou, Cancelada ou Falta de Comparência
  const renderStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'chegou':
      case 'concluida':
      case 'sentada':
        return (
          <span className="font-sans font-bold text-[12px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Chegou
          </span>
        );
      case 'cancelada':
        return (
          <span className="font-sans font-bold text-[12px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
            Cancelada
          </span>
        );
      case 'noshow':
        return (
          <span className="font-sans font-bold text-[12px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
            Falta de Comparência
          </span>
        );
      case 'confirmada':
      case 'pendente':
      default:
        return (
          <span className="font-sans font-bold text-[12px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            Pendente
          </span>
        );
    }
  };

  // Section title mapping
  const sectionTitleMap: Record<AdminSection, string> = {
    dashboard: 'Dashboard',
    reservas: 'Reservas',
    mesas: 'Mesas e Ocupação',
    estatisticas: 'Estatísticas e Relatórios',
    configuracoes: 'Configurações',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-amber-500 text-neutral-950 px-4 py-2.5 rounded-xl font-sans font-bold text-sm shadow-2xl flex items-center gap-2 animate-fade-in border border-amber-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SIDEBAR (MENU LATERAL FIXO / MOBILE DRAWER)                             */}
      {/* ========================================================================= */}
      {/* Slide-over Backdrop (opens when 3 lines are clicked) */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        />
      )}

      {/* Menu Lateral de Páginas (Abre exclusivamente ao clicar nos 3 traços no canto superior direito) */}
      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-72 sm:w-80 bg-white border-l border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-neutral-950 font-serif-display font-normal text-xl flex items-center justify-center shrink-0 shadow-xs">
              QP
            </div>
            <div className="min-w-0">
              <h1 className="font-serif-display text-lg text-slate-900 font-normal leading-tight truncate">
                Qué Pasa
              </h1>
              <p className="font-sans font-normal text-[11px] text-slate-500 truncate">
                Menu de Páginas · Aveiro
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Fechar Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Button inside Menu */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => {
              setEditingReservation(null);
              setShowManualModal(true);
              setIsSidebarOpen(false);
            }}
            className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Reserva</span>
          </button>
        </div>

        {/* Navigation Items (Order explicitly requested) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 font-sans text-sm">
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('dashboard');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeSection === 'dashboard'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </div>
          </button>

          {/* 2. Reservas */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('reservas');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeSection === 'reservas'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>Reservas</span>
            </div>
            {reservations.length > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums ${
                  activeSection === 'reservas'
                    ? 'bg-neutral-950/20 text-neutral-950'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {reservations.length}
              </span>
            )}
          </button>

          {/* 3. Mesas e Ocupação */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('mesas');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeSection === 'mesas'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 shrink-0" />
              <span>Mesas e Ocupação</span>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums ${
                activeSection === 'mesas'
                  ? 'bg-neutral-950/20 text-neutral-950'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              12
            </span>
          </button>

          {/* 4. Estatísticas e Relatórios */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('estatisticas');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeSection === 'estatisticas'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Estatísticas e Relatórios</span>
            </div>
          </button>

          {/* 5. Configurações */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('configuracoes');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeSection === 'configuracoes'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>Configurações</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer: Admin Profile (NO DARK MODE TOGGLE) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-xs font-bold text-amber-900 shrink-0">
                GA
              </div>
              <div className="min-w-0">
                <span className="font-sans font-bold text-xs text-slate-900 block truncate">
                  Gerência
                </span>
                <span className="font-sans font-normal text-[11px] text-slate-500 block truncate">
                  {user.username || 'dono@barbaazul.pt'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Terminar Sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTAINER (BARRA SUPERIOR + CONTEÚDO PRINCIPAL)                    */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* BARRA SUPERIOR (TOP BAR) - TÍTULO DA SECÇÃO + NOTIFICAÇÕES + 3 BARRAS */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shadow-xs">
          {/* Left: Título da secção ativa */}
          <h2 className="font-serif-display text-2xl sm:text-[28px] text-slate-900 font-normal leading-tight tracking-tight">
            {sectionTitleMap[activeSection] || 'Dashboard'}
          </h2>

          {/* Right: Notificações à esquerda das 3 barras + Menu de Páginas */}
          <div className="flex items-center gap-2">
            {/* Notificações com Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationsDropdown((prev) => !prev)}
                className="relative p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 transition-all cursor-pointer border border-slate-200 flex items-center justify-center shrink-0 shadow-xs"
                title="Notificações"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5 text-slate-700" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Popover flutuante de Notificações */}
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl z-50 overflow-hidden font-sans">
                  <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-600" />
                      <h4 className="font-bold text-sm text-slate-900">Notificações</h4>
                      {unreadNotificationsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                          {unreadNotificationsCount} novas
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markOwnerNotificationsRead();
                          showToast('Notificações marcadas como vistas');
                          loadAll();
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        Marcar como visto
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        Sem notificações no momento.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={`top-notif-${n.id}`}
                          className={`p-3.5 text-xs space-y-1 transition-colors ${
                            !n.isRead ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{n.title}</span>
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Menu de Páginas (3 barras) */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 transition-all cursor-pointer border border-slate-200 flex items-center justify-center shrink-0 shadow-xs"
              title="Abrir Menu de Páginas"
              aria-label="Abrir Menu de Páginas"
            >
              <div className="w-5 h-4 flex flex-col justify-between items-center py-0.5" aria-hidden="true">
                <span className="w-full h-0.5 bg-slate-800 rounded-full transition-all"></span>
                <span className="w-full h-0.5 bg-slate-800 rounded-full transition-all"></span>
                <span className="w-full h-0.5 bg-slate-800 rounded-full transition-all"></span>
              </div>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 3. CONTEÚDO PRINCIPAL (RENDERIZADO PELA SECÇÃO SELECIONADA)                */}
        {/* ========================================================================= */}
        <main className="flex-1 p-3.5 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* ======================================================================= */}
          {/* SECÇÃO: DASHBOARD PRINCIPAL                                             */}
          {/* ======================================================================= */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Date Filters Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-sans font-bold text-xs text-slate-400 uppercase tracking-wider mr-1">
                    Filtrar:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardDateFilter('hoje');
                      setSelectedDate(getTodayStr());
                    }}
                    className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-colors cursor-pointer ${
                      dashboardDateFilter === 'hoje'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardDateFilter('amanha');
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setSelectedDate(d.toISOString().split('T')[0]);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-colors cursor-pointer ${
                      dashboardDateFilter === 'amanha'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardDateFilter('personalizado')}
                    className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-colors cursor-pointer ${
                      dashboardDateFilter === 'personalizado'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setDashboardDateFilter('personalizado');
                    }}
                    className="px-3 py-1.5 text-xs font-sans font-medium tabular-nums bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* 3 Indicadores Principais (KPIs) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* 1. Reservas de hoje */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-bold text-[13px] uppercase tracking-wider text-slate-500">
                      Reservas do Dia
                    </span>
                    <CalendarDays className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="font-sans font-bold text-[32px] tabular-nums text-slate-900 leading-none">
                    {todayReservations.filter((r) => r.status !== 'cancelada').length}
                  </div>
                  <p className="font-sans font-normal text-xs text-slate-400">
                    Marcações ativas para o dia
                  </p>
                </div>

                {/* 2. Total de clientes esperados */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-bold text-[13px] uppercase tracking-wider text-slate-500">
                      Clientes Esperados
                    </span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="font-sans font-bold text-[32px] tabular-nums text-emerald-700 leading-none">
                    {todayReservations
                      .filter((r) => r.status !== 'cancelada' && r.status !== 'noshow')
                      .reduce((acc, r) => acc + r.guests, 0)}
                  </div>
                  <p className="font-sans font-normal text-xs text-slate-400">
                    Total de clientes esperados hoje
                  </p>
                </div>

                {/* 3. Taxa de ocupação prevista */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-bold text-[13px] uppercase tracking-wider text-slate-500">
                      Ocupação Prevista
                    </span>
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="font-sans font-bold text-[32px] tabular-nums text-purple-700 leading-none">
                    {occupancyRate}%
                  </div>
                  <p className="font-sans font-normal text-xs text-slate-400">
                    Capacidade total da sala nos 4 turnos
                  </p>
                </div>
              </div>

              {/* Área Principal & Área Secundária */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ÁREA PRINCIPAL: Reservas do Dia com opções de Assinalar Chegou ou Cancelar */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-sans font-bold text-lg text-slate-900">
                          Reservas do Dia ({selectedDate})
                        </h3>
                        <p className="font-sans font-normal text-xs text-slate-500">
                          Todas as reservas do dia com ações rápidas para assinalar chegada ou cancelar.
                        </p>
                      </div>
                      <span className="font-sans font-bold text-xs uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        {todayReservations.length} reservas
                      </span>
                    </div>

                    {todayReservations.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 font-sans text-sm">
                        Não existem reservas agendadas para esta data.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {todayReservations.map((res) => (
                          <div
                            key={res.id}
                            className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-sans font-bold text-base text-slate-900 truncate">
                                  {res.customerName}
                                </span>
                                {renderStatusBadge(res.status)}
                              </div>
                              <div className="font-sans font-medium text-xs text-slate-500 flex items-center gap-2 tabular-nums flex-wrap">
                                <span className="text-amber-700 font-bold">Mesa {res.tableId}</span>
                                <span>•</span>
                                <span>{res.time} ({res.durationMinutes}m)</span>
                                <span>•</span>
                                <span>{res.guests} pax</span>
                                <span>•</span>
                                <span>{res.customerPhone}</span>
                              </div>
                              {res.specialRequests.length > 0 && (
                                <p className="text-xs text-amber-800 italic">
                                  Pedidos: {res.specialRequests.join(', ')}
                                </p>
                              )}
                            </div>

                            {/* Ações Rápidas: Chegou (conclui logo), Cancelar e Editar */}
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {/* 1. Botão Chegou - Conclui logo sem passos intermédios */}
                              {res.status !== 'concluida' && res.status !== 'cancelada' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateOwnerReservation(res.id, { status: 'concluida' });
                                    showToast(`Chegada registada: reserva de ${res.customerName} concluída!`);
                                    loadAll();
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-sans font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                                  title="Marcar como Chegou (Fica logo concluída)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Chegou</span>
                                </button>
                              )}

                              {/* 2. Botão Cancelar caso o cliente ligue a cancelar */}
                              {res.status !== 'cancelada' && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await updateOwnerReservation(res.id, { status: 'cancelada' });
                                    showToast(`Reserva de ${res.customerName} cancelada`);
                                    loadAll();
                                  }}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-300 hover:border-rose-400 font-sans font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                                  title="Cancelar reserva"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Cancelar</span>
                                </button>
                              )}

                              {/* 3. Botão Editar Reserva */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReservation(res);
                                  setShowManualModal(true);
                                }}
                                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 cursor-pointer shadow-xs"
                                title="Editar Reserva"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ÁREA SECUNDÁRIA: Apenas Distribuição por Horário mantida */}
                <div className="space-y-4">
                  {/* Distribuição por Turno */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-4 shadow-xs">
                    <h3 className="font-sans font-bold text-base text-slate-900">
                      Distribuição por Horário ({selectedDate})
                    </h3>

                    <div className="space-y-3 font-sans">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-amber-700">Almoço · 12:30</span>
                          <span className="tabular-nums font-semibold text-slate-700">{shiftDistribution.lunch1.count} / 12 mesas</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (shiftDistribution.lunch1.count / 12) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-amber-700">Almoço · 14:00</span>
                          <span className="tabular-nums font-semibold text-slate-700">{shiftDistribution.lunch2.count} / 12 mesas</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (shiftDistribution.lunch2.count / 12) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-sky-700">Jantar · 19:30</span>
                          <span className="tabular-nums font-semibold text-slate-700">{shiftDistribution.dinner1.count} / 12 mesas</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (shiftDistribution.dinner1.count / 12) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-sky-700">Jantar · 21:00</span>
                          <span className="tabular-nums font-semibold text-slate-700">{shiftDistribution.dinner2.count} / 12 mesas</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (shiftDistribution.dinner2.count / 12) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* SECÇÃO: GESTÃO DE RESERVAS                                              */}
          {/* ======================================================================= */}
          {activeSection === 'reservas' && (
            <div className="space-y-4">
              {/* Toolbar & Filters */}
              <div className="bg-white p-4 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-3 font-sans shadow-xs">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Pesquisar por cliente, telemóvel, código ou mesa..."
                      value={resSearchQuery}
                      onChange={(e) => setResSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Actions: View Toggle + Export + New */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setReservationViewMode('tabela')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          reservationViewMode === 'tabela'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tabela
                      </button>
                      <button
                        type="button"
                        onClick={() => setReservationViewMode('turnos')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          reservationViewMode === 'turnos'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Turnos
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={exportReservationsToCsv}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Exportar para Excel / CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Date Filter */}
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Data:</span>
                  <button
                    type="button"
                    onClick={() => setResDateFilter('hoje')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      resDateFilter === 'hoje'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setResDateFilter('amanha')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      resDateFilter === 'amanha'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setResDateFilter('semana')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      resDateFilter === 'semana'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    Esta Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setResDateFilter('todas')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      resDateFilter === 'todas'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    Todas
                  </button>

                  <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

                  {/* Status Filter */}
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Estado:</span>
                  <select
                    value={resStatusFilter}
                    onChange={(e) => setResStatusFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="todas">Todos os Estados</option>
                    <option value="chegou">Chegou</option>
                    <option value="cancelada">Cancelada</option>
                    <option value="noshow">Falta de Comparência</option>
                  </select>

                  {/* Pax Filter */}
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Pax:</span>
                  <select
                    value={resPaxFilter}
                    onChange={(e) => setResPaxFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="todos">Todos</option>
                    <option value="1-2">1-2 Pessoas</option>
                    <option value="3-4">3-4 Pessoas</option>
                    <option value="5+">5+ Pessoas</option>
                  </select>
                </div>
              </div>

              {/* VISTA 1: TABELA (Desktop Table + Mobile Cards) */}
              {reservationViewMode === 'tabela' && (
                <>
                  {/* Mobile Cards View (< 768px) */}
                  <div className="md:hidden space-y-3 font-sans">
                    {filteredReservations.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                        Nenhuma reserva encontrada com os filtros selecionados.
                      </div>
                    ) : (
                      filteredReservations.map((res) => (
                        <div
                          key={`res-card-${res.id}`}
                          className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-sans font-bold text-base text-slate-900">{res.customerName}</div>
                              <div className="font-sans font-medium text-xs text-slate-500 tabular-nums">
                                {res.customerPhone}
                              </div>
                            </div>
                            {renderStatusBadge(res.status)}
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                            <div>
                              <span className="text-slate-400 text-[11px] block font-medium">Mesa</span>
                              <span className="font-sans font-bold text-amber-700">Mesa {res.tableId}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[11px] block font-medium">Data & Hora</span>
                              <span className="font-sans font-medium tabular-nums text-slate-800">
                                {res.date} · {res.time}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[11px] block font-medium">Pessoas</span>
                              <span className="font-sans font-medium tabular-nums text-slate-800">{res.guests} pax</span>
                            </div>
                          </div>

                          {res.specialRequests.length > 0 && (
                            <div className="text-xs text-slate-700 bg-amber-50/60 border border-amber-200/60 p-2 rounded-lg">
                              <strong>Pedidos:</strong> {res.specialRequests.join(', ')}
                            </div>
                          )}

                          {/* Mobile Action Buttons: Apenas Editar */}
                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReservation(res);
                                setShowManualModal(true);
                              }}
                              className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-sans font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table View (>= 768px) */}
                  <div className="hidden md:block bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs font-sans">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-sans text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 font-sans font-bold text-[12px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3.5">Cliente</th>
                            <th className="px-4 py-3.5">Data & Hora</th>
                            <th className="px-4 py-3.5">Mesa</th>
                            <th className="px-4 py-3.5">Pax</th>
                            <th className="px-4 py-3.5">Estado</th>
                            <th className="px-4 py-3.5">Observações</th>
                            <th className="px-4 py-3.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans font-normal text-sm">
                          {filteredReservations.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-slate-400">
                                Nenhuma reserva encontrada.
                              </td>
                            </tr>
                          ) : (
                            filteredReservations.map((res) => (
                              <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3.5">
                                  <div className="font-sans font-bold text-slate-900">{res.customerName}</div>
                                  <div className="font-sans font-medium text-xs text-slate-500 tabular-nums">
                                    {res.customerPhone}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="font-sans font-medium text-slate-800 tabular-nums">{res.date}</div>
                                  <div className="font-sans font-medium text-xs text-slate-500 tabular-nums">
                                    {res.time} ({res.durationMinutes}m)
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 font-sans font-bold text-amber-700">
                                  Mesa {res.tableId}
                                </td>
                                <td className="px-4 py-3.5 font-sans font-medium tabular-nums text-slate-700">
                                  {res.guests} pax
                                </td>
                                <td className="px-4 py-3.5">
                                  {renderStatusBadge(res.status)}
                                </td>
                                <td className="px-4 py-3.5 max-w-xs truncate text-slate-500 text-xs">
                                  {res.specialRequests.join(', ') || res.internalNotes || '—'}
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingReservation(res);
                                        setShowManualModal(true);
                                      }}
                                      className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-sans font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-1.5"
                                      title="Editar Reserva"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>Editar</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* VISTA 2: CALENDÁRIO / TURNOS */}
              {reservationViewMode === 'turnos' && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 space-y-5 font-sans shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-sans font-bold text-base text-slate-900">
                        Vista por Turnos ({selectedDate})
                      </h3>
                      <p className="font-sans font-normal text-xs text-slate-500">
                        Ocupação detalhada das mesas por turno de almoço e jantar.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['12:30', '14:00', '19:30', '21:00'].map((slotTime) => {
                      const slotRes = reservations.filter(
                        (r) => r.date === selectedDate && r.time === slotTime && r.status !== 'cancelada'
                      );
                      const isLunch = slotTime.startsWith('12') || slotTime.startsWith('14');

                      return (
                        <div
                          key={`slot-col-${slotTime}`}
                          className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                            <div>
                              <span className={`font-bold text-xs uppercase px-2 py-0.5 rounded ${
                                isLunch ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-sky-100 text-sky-900 border border-sky-200'
                              }`}>
                                {isLunch ? 'Almoço' : 'Jantar'}
                              </span>
                              <div className="font-bold text-lg text-slate-900 tabular-nums mt-1">{slotTime}</div>
                            </div>
                            <span className="font-bold text-xs text-slate-500 tabular-nums">
                              {slotRes.length} / 12 mesas
                            </span>
                          </div>

                          {slotRes.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                              Nenhuma mesa reservada neste turno.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {slotRes.map((r) => (
                                <div
                                  key={r.id}
                                  className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <strong className="text-slate-900 truncate">{r.customerName}</strong>
                                    <span className="font-bold text-amber-700">Mesa {r.tableId}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                                    <span>{r.guests} pax</span>
                                    {renderStatusBadge(r.status)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================================= */}
          {/* SECÇÃO: MESAS E OCUPAÇÃO                                                */}
          {/* ======================================================================= */}
          {activeSection === 'mesas' && (
            <div className="space-y-4 font-sans">
              {/* Date & Shift Filter */}
              <div className="bg-white p-4 rounded-2xl sm:rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div>
                  <h3 className="font-sans font-bold text-lg text-slate-900">
                    Planta da Sala & Gestão de Mesas
                  </h3>
                  <p className="font-sans font-normal text-xs text-slate-500">
                    Toque numa mesa para alterar capacidade, ativar/desativar ou reatribuir reservas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 text-sm font-sans font-medium tabular-nums bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Visual Floor Plan */}
              <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <FloorPlanSVG
                  mode="management"
                  tables={tables}
                  tableStatusMap={tableStatusMap}
                  onTableActionClick={(tbl) => setSelectedTableForModal(tbl)}
                />
              </div>

              {/* Table Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tables.map((t) => {
                  const statusInfo = tableStatusMap[t.id];
                  const status = statusInfo?.status || 'livre';
                  const res = statusInfo?.currentReservation;

                  return (
                    <div
                      key={`tbl-detail-${t.id}`}
                      onClick={() => setSelectedTableForModal(t)}
                      className="p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 space-y-2 cursor-pointer transition-all active:scale-[0.98] shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-base text-slate-900">
                          Mesa {t.number}
                        </span>
                        <span className="text-xs font-bold text-slate-500 tabular-nums">
                          {t.capacity} pax
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className={`font-sans font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${
                            status === 'sentada'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : status === 'chegou'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : status === 'reservada'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : status === 'a_limpar'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : status === 'bloqueada'
                              ? 'bg-slate-100 text-slate-600 border border-slate-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {status}
                        </span>

                        <span className="text-[11px] text-slate-400 capitalize">
                          {t.section}
                        </span>
                      </div>

                      {res ? (
                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-700">
                          <strong className="block truncate text-slate-900">{res.customerName}</strong>
                          <span className="text-slate-500 tabular-nums">{res.time} · {res.guests} pax</span>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
                          Mesa disponível
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* SECÇÃO: ESTATÍSTICAS E RELATÓRIOS                                       */}
          {/* ======================================================================= */}
          {activeSection === 'estatisticas' && (
            <div className="space-y-6 font-sans">
              {/* Period Selector */}
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="font-sans font-bold text-base text-slate-900">Relatório de Performance</h3>
                  <p className="font-sans font-normal text-xs text-slate-500">
                    Métricas reais calculadas a partir da base de dados do restaurante.
                  </p>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStatsPeriod('7dias')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statsPeriod === '7dias' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    7 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod('30dias')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statsPeriod === '30dias' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    30 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsPeriod('tudo')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statsPeriod === 'tudo' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tudo
                  </button>
                </div>
              </div>

              {/* 5 Key Stats Cards (sem retenção de clientes) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Reservas</span>
                  <div className="font-bold text-2xl text-slate-900 tabular-nums">{statsData.total}</div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Clientes</span>
                  <div className="font-bold text-2xl text-emerald-700 tabular-nums">{statsData.totalGuests}</div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Média Pax</span>
                  <div className="font-bold text-2xl text-sky-700 tabular-nums">{statsData.avgGuests}</div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Cancelamentos</span>
                  <div className="font-bold text-2xl text-rose-700 tabular-nums">{statsData.cancelRate}%</div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Falta de Comparência</span>
                  <div className="font-bold text-2xl text-purple-700 tabular-nums">{statsData.noShowRate}%</div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* SECÇÃO: CONFIGURAÇÕES                                                   */}
          {/* ======================================================================= */}
          {activeSection === 'configuracoes' && settings && (
            <div className="space-y-6 font-sans">
              {/* Supabase Database Integration Card */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                      <Database className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-slate-900">Base de Dados Supabase (PostgreSQL)</h4>
                        <span className="font-sans font-bold text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {supabaseStatus?.connected ? 'Conectado' : 'Configurado'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Armazenamento e sincronização na cloud com a instância PostgreSQL do Supabase.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Testar Conexão Supabase"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                      <span>{isTestingSupabase ? 'A verificar...' : 'Testar Conexão'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncSupabase}
                      disabled={isSyncingSupabase}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      title="Sincronizar reservas e clientes locais com o Supabase"
                    >
                      <Database className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-pulse' : ''}`} />
                      <span>{isSyncingSupabase ? 'A sincronizar...' : 'Sincronizar Dados'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSqlModal(true)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      title="Ver script SQL para criar as tabelas no Supabase"
                    >
                      <span>Ver Script SQL</span>
                    </button>
                  </div>
                </div>

                {/* Connection details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Supabase Project URL
                    </span>
                    <span className="font-mono text-slate-800 break-all select-all font-semibold">
                      {SUPABASE_URL}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Anon / Publishable API Key
                    </span>
                    <span className="font-mono text-slate-800 break-all select-all font-semibold">
                      {SUPABASE_ANON_KEY.substring(0, 16)}...{SUPABASE_ANON_KEY.substring(SUPABASE_ANON_KEY.length - 8)}
                    </span>
                  </div>
                </div>

                {/* Connection Test Status Banner if triggered */}
                {supabaseStatus && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                      supabaseStatus.connected
                        ? supabaseStatus.hasTables
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">{supabaseStatus.message}</p>
                      {supabaseStatus.details && (
                        <div className="flex gap-4 text-[11px] mt-1">
                          <span>
                            Reservas: <strong>{supabaseStatus.details.reservations ? '✓ Criada' : '✗ Não encontrada'}</strong>
                          </span>
                          <span>
                            Clientes: <strong>{supabaseStatus.details.customers ? '✓ Criada' : '✗ Não encontrada'}</strong>
                          </span>
                          <span>
                            Mesas: <strong>{supabaseStatus.details.tables ? '✓ Criada' : '✗ Não encontrada'}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Webhook n8n Integration Status */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-slate-900">Integração Webhook n8n</h4>
                      <p className="text-xs text-slate-500">
                        Cada nova reserva dispara automaticamente um HTTP POST para o fluxo n8n.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                    <span>{isTestingWebhook ? 'A testar...' : 'Disparar Webhook de Teste'}</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 break-all flex items-center justify-between gap-2">
                  <span>{N8N_WEBHOOK_URL}</span>
                  <span className="font-sans font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                    Ativo
                  </span>
                </div>
              </div>

              {/* Formulário Completo de Configurações para Admin */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="font-bold text-base text-slate-900">Identificação e Contactos Oficiais</h4>
                    <p className="text-xs text-slate-500">Dados do restaurante apresentados aos clientes e na confirmação de reservas.</p>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingSettings}
                    onClick={async () => {
                      setIsSavingSettings(true);
                      try {
                        await saveOwnerSettings(settings);
                        showToast('Todas as configurações guardadas com sucesso!');
                        const data = await fetchOwnerAllData();
                        setSettings(data.settings);
                      } catch (err: any) {
                        showToast(err.message || 'Erro ao guardar configurações');
                      } finally {
                        setIsSavingSettings(false);
                      }
                    }}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isSavingSettings ? 'animate-spin' : ''}`} />
                    <span>{isSavingSettings ? 'A guardar...' : 'Guardar Alterações'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Nome do Restaurante
                    </label>
                    <input
                      type="text"
                      value={settings.restaurantName ?? ''}
                      placeholder="Qué Pasa"
                      onChange={(e) => setSettings({ ...settings, restaurantName: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Slogan / Descrição
                    </label>
                    <input
                      type="text"
                      value={settings.tagline ?? ''}
                      placeholder="Cozinha de Autor & Petiscos"
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Telefone Oficial de Contacto
                    </label>
                    <input
                      type="text"
                      value={settings.phone ?? ''}
                      placeholder="234 424 208"
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Email de Contacto Público
                    </label>
                    <input
                      type="email"
                      value={settings.email ?? ''}
                      placeholder="reservas@quepasa.pt"
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Email de Notificações do Administrador
                    </label>
                    <input
                      type="email"
                      value={settings.ownerEmail ?? ''}
                      placeholder="dono@quepasa.pt"
                      onChange={(e) => setSettings({ ...settings, ownerEmail: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Morada
                    </label>
                    <input
                      type="text"
                      value={settings.address ?? ''}
                      placeholder="Cais dos Mercantéis 14"
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      value={settings.postalCode ?? ''}
                      placeholder="3800-228"
                      onChange={(e) => setSettings({ ...settings, postalCode: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={settings.city ?? ''}
                      placeholder="Aveiro"
                      onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Políticas e Regras de Reservas */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 space-y-5 shadow-xs">
                <div>
                  <h4 className="font-bold text-base text-slate-900">Políticas e Regras de Reserva</h4>
                  <p className="text-xs text-slate-500">Configuração de prazos, tolerâncias e intervalos operacionais.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Tolerância de Chegada (minutos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={settings.noShowGraceMinutes ?? 15}
                      onChange={(e) => setSettings({ ...settings, noShowGraceMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Tempo de tolerância antes de mesa vaga</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Intervalo de Limpeza (minutos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={settings.cleaningBufferMinutes ?? 15}
                      onChange={(e) => setSettings({ ...settings, cleaningBufferMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Buffer entre turnos consecutivos</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Antecedência Mínima (horas)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="48"
                      value={settings.minAdvanceHours ?? 1}
                      onChange={(e) => setSettings({ ...settings, minAdvanceHours: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Horas mínimas antes do serviço</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Antecedência Máxima (dias)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.maxAdvanceDays ?? 30}
                      onChange={(e) => setSettings({ ...settings, maxAdvanceDays: parseInt(e.target.value) || 1 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Dias no futuro abertos para reserva</span>
                  </div>
                </div>
              </div>

              {/* Modelos de Mensagens e Notificações por Email */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 space-y-5 shadow-xs">
                <div>
                  <h4 className="font-bold text-base text-slate-900">Modelos de Mensagens e Emails</h4>
                  <p className="text-xs text-slate-500">Personalize o assunto e as mensagens automáticas de confirmação e cancelamento enviadas aos clientes e sincronizadas com o n8n.</p>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Assunto: Confirmação de Reserva
                      </label>
                      <input
                        type="text"
                        value={settings.emailTemplates?.confirmationSubject ?? ''}
                        placeholder="Confirmação da sua Reserva - Qué Pasa"
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailTemplates: {
                              ...(settings.emailTemplates || {}),
                              confirmationSubject: e.target.value,
                            },
                          })
                        }
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Assunto: Cancelamento de Reserva
                      </label>
                      <input
                        type="text"
                        value={settings.emailTemplates?.cancellationSubject ?? ''}
                        placeholder="Reserva Cancelada · Qué Pasa"
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailTemplates: {
                              ...(settings.emailTemplates || {}),
                              cancellationSubject: e.target.value,
                            },
                          })
                        }
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Texto do Email de Confirmação
                    </label>
                    <textarea
                      rows={3}
                      value={settings.emailTemplates?.confirmationBody ?? ''}
                      placeholder="Texto do email de confirmação..."
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailTemplates: {
                            ...(settings.emailTemplates || {}),
                            confirmationBody: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Texto do Email de Cancelamento
                    </label>
                    <textarea
                      rows={2}
                      value={settings.emailTemplates?.cancellationBody ?? ''}
                      placeholder="Texto do email de cancelamento..."
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailTemplates: {
                            ...(settings.emailTemplates || {}),
                            cancellationBody: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-xs text-slate-500 italic">
                    Como administrador, todas as alterações guardadas aplicam-se imediatamente a todo o sistema e webhooks.
                  </span>
                  <button
                    type="button"
                    disabled={isSavingSettings}
                    onClick={async () => {
                      setIsSavingSettings(true);
                      try {
                        await saveOwnerSettings(settings);
                        showToast('Todas as configurações guardadas com sucesso!');
                        const data = await fetchOwnerAllData();
                        setSettings(data.settings);
                      } catch (err: any) {
                        showToast(err.message || 'Erro ao guardar configurações');
                      } finally {
                        setIsSavingSettings(false);
                      }
                    }}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-95 text-slate-950 font-bold text-sm rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isSavingSettings ? 'animate-spin' : ''}`} />
                    <span>{isSavingSettings ? 'A guardar...' : 'Guardar Todas as Configurações'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAIS REUTILIZADOS & ATIVOS                                            */}
      {/* ========================================================================= */}
      {/* Modal de Criação / Edição de Reserva */}
      <ManualReservationModal
        isOpen={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          setEditingReservation(null);
        }}
        tables={tables}
        defaultDate={selectedDate}
        initialReservation={editingReservation}
        onSuccess={() => {
          showToast(editingReservation ? 'Reserva atualizada com sucesso!' : 'Reserva criada com sucesso!');
          loadAll();
        }}
      />

      {/* Modal de Bloqueio de Período / Folga */}
      <BlockPeriodModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        tables={tables}
        onSuccess={() => {
          showToast('Bloqueio registado com sucesso!');
          loadAll();
        }}
      />

      {/* Modal de Ações da Mesa (Planta) */}
      <TableDetailModal
        isOpen={selectedTableForModal !== null}
        onClose={() => setSelectedTableForModal(null)}
        table={selectedTableForModal}
        allTables={tables}
        currentStatus={selectedTableForModal ? tableStatusMap[selectedTableForModal.id]?.status || 'livre' : 'livre'}
        currentReservation={selectedTableForModal ? tableStatusMap[selectedTableForModal.id]?.currentReservation : undefined}
        onRefresh={() => {
          loadAll();
          showToast('Mesa atualizada!');
        }}
        isAdmin={true}
      />

      {/* Modal de Confirmação Gmail Oficial */}
      <GmailConfirmModal
        isOpen={showGmailModal}
        onClose={() => {
          setShowGmailModal(false);
          setSelectedReservationForGmail(null);
        }}
        onConfirm={handleConfirmSendGmail}
        recipientEmail={selectedReservationForGmail?.customerEmail || ''}
        reservationCode={selectedReservationForGmail?.code || ''}
        customerName={selectedReservationForGmail?.customerName || ''}
        isSending={isSendingGmail}
      />

      {/* Modal: Script SQL Supabase */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up font-sans">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Script SQL para o Supabase</h3>
                  <p className="text-xs text-slate-500">Copie e execute no SQL Editor do seu projeto Supabase</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Instruções para ativar as tabelas no Supabase:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-amber-800">
                  <li>Abra o dashboard do Supabase (supabase.com/dashboard)</li>
                  <li>Selecione o projeto <strong>vuyzzmjjbedkuqxjzayr</strong></li>
                  <li>No menu esquerdo, clique no ícone <strong>SQL Editor</strong></li>
                  <li>Cole o código abaixo e clique no botão verde <strong>Run</strong></li>
                </ol>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-80 leading-relaxed">
                  {SUPABASE_SETUP_SQL}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCopySql}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSql ? 'Copiado!' : 'Copiar Código SQL'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
