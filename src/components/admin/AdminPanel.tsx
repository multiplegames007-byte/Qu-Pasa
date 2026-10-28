import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Compass,
  Clock,
  Users,
  Settings as SettingsIcon,
  BarChart3,
  LogOut,
  Moon,
  Sun,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Star,
  Trash2,
  Edit2,
  RefreshCw,
  Bell,
  Eye,
  ArrowRightLeft,
  Lock,
  Unlock,
  Mail,
  Smartphone
} from 'lucide-react';
import {
  UserAccount,
  RestaurantTable,
  Reservation,
  WaitlistEntry,
  CustomerProfile,
  RestaurantSettings,
  BlockedPeriod,
  OwnerNotification,
  TableStatus
} from '../../types/index.ts';
import {
  fetchOwnerAllData,
  fetchOwnerDaySummary,
  createOwnerReservation,
  updateOwnerReservation,
  deleteOwnerReservation,
  saveOwnerTablesLayout,
  updateOwnerTable,
  deleteOwnerBlock,
  markOwnerNotificationsRead,
  updateOwnerCustomer,
  gdprDeleteOwnerCustomer,
  saveOwnerSettings,
  resetOwnerDemo,
  ownerLogout,
  resendOwnerSms,
  resendOwnerEmail,
  sendOwnerReminder,
  testBrevoConnection
} from '../../services/api.ts';
import { getTodayStr, exportReservationsToCsv } from '../../services/storage.ts';
import { FloorPlanSVG } from '../FloorPlanSVG.tsx';
import { ManualReservationModal } from './ManualReservationModal.tsx';
import { TableDetailModal } from './TableDetailModal.tsx';
import { BlockPeriodModal } from './BlockPeriodModal.tsx';
import { SmsPreviewModal } from '../SmsPreviewModal.tsx';
import { PWAInstallButton } from '../PWAInstallButton.tsx';
import { GoogleSignInButton } from '../GoogleSignInButton.tsx';
import { GmailConfirmModal } from '../GmailConfirmModal.tsx';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from '../../services/googleAuth.ts';
import { sendGmailMessage, generateReservationHtmlEmail } from '../../services/gmail.ts';
import type { User as FirebaseUser } from 'firebase/auth';

interface AdminPanelProps {
  user: UserAccount;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'resumo' | 'dia' | 'reservas' | 'editor' | 'bloqueios' | 'espera' | 'clientes' | 'relatorios' | 'configuracoes'>('resumo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Core Data States
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);

  // Day Summary
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
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

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
  const [selectedTableForModal, setSelectedTableForModal] = useState<RestaurantTable | null>(null);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [selectedReservationForSms, setSelectedReservationForSms] = useState<Reservation | null>(null);
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Google Workspace / Gmail Integration State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState<boolean>(false);
  const [selectedReservationForGmail, setSelectedReservationForGmail] = useState<Reservation | null>(null);
  const [showGmailModal, setShowGmailModal] = useState<boolean>(false);
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setGoogleUser(u),
      () => setGoogleUser(null)
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleConnect = async () => {
    setIsGoogleConnecting(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
        showToast(`Conectado ao Gmail: ${res.user.email}`);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar ao Google');
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
        bodyText: `Olá ${selectedReservationForGmail.customerName},\n\nA sua mesa para ${selectedReservationForGmail.guests} pessoas no Qué Pasa está confirmada para ${selectedReservationForGmail.date} às ${selectedReservationForGmail.time} (Mesa ${selectedReservationForGmail.tableId}).\nCódigo: ${selectedReservationForGmail.code}.\n\nCais dos Mercantéis 14, Aveiro.`,
        bodyHtml: html,
      });
      showToast(`Aviso enviado com sucesso via Gmail para ${selectedReservationForGmail.customerEmail}!`);
      setShowGmailModal(false);
      setSelectedReservationForGmail(null);
    } catch (err: any) {
      showToast(err.message || 'Falha ao enviar aviso pelo Gmail');
    } finally {
      setIsSendingGmail(false);
    }
  };

  // Brevo Test State
  const [isTestingBrevo, setIsTestingBrevo] = useState<boolean>(false);
  const [brevoTestResult, setBrevoTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleTestBrevo = async () => {
    setIsTestingBrevo(true);
    setBrevoTestResult(null);
    try {
      const res = await testBrevoConnection({
        apiKey: settings?.brevoApiKey,
        senderEmail: settings?.brevoSenderEmail,
        senderName: settings?.brevoSenderName,
        testRecipient: settings?.ownerEmail || 'dono@barbaazul.pt',
      });
      setBrevoTestResult({
        success: true,
        message: `Conexão Brevo bem sucedida! Email de teste enviado para ${res.recipient} (ID: ${res.messageId})`,
      });
      showToast('Brevo conectado com sucesso!');
    } catch (err: any) {
      setBrevoTestResult({
        success: false,
        message: err.message || 'Erro ao comunicar com a API da Brevo.',
      });
      showToast('Falha no teste Brevo');
    } finally {
      setIsTestingBrevo(false);
    }
  };

  // Push notifications permission status
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load all data
  const loadAll = async () => {
    try {
      const data = await fetchOwnerAllData();
      setTables(data.tables);
      setReservations(data.reservations);
      setCustomers(data.customers);
      setWaitlist(data.waitlist);
      setSettings(data.settings);
      setBlockedPeriods(data.blockedPeriods);
      setNotifications(data.notifications);

      const summary = await fetchOwnerDaySummary(selectedDate);
      setDaySummary(summary);
    } catch (err) {
      console.error('Error loading owner data:', err);
    }
  };

  useEffect(() => {
    loadAll();
    // Real-time polling every 8 seconds for new reservations and table changes
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Request browser push notification permission
  const handleRequestPush = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setPushEnabled(true);
        showToast('Notificações push ativadas com sucesso!');
        new Notification('Qué Pasa', {
          body: 'Notificações ativas: receberá alertas instantâneos de novas reservas.',
          icon: '/icon.svg',
        });
      }
    }
  };

  // Logout
  const handleLogout = async () => {
    await ownerLogout();
    onLogout();
  };

  // Drag position update in Editor mode
  const handleUpdateTablePosition = (id: number, x: number, y: number) => {
    const updated = tables.map((t) => (t.id === id ? { ...t, x, y } : t));
    setTables(updated);
  };

  // Build live table status map
  const tableStatusMap = React.useMemo(() => {
    const map: Record<number, { status: TableStatus; currentReservation?: Reservation }> = {};
    const dayRes = reservations.filter((r) => r.date === selectedDate && r.status !== 'cancelada' && r.status !== 'noshow');

    tables.forEach((t) => {
      // Check block
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

  // Filtered reservations
  const filteredReservations = React.useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== 'todas' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.customerName.toLowerCase().includes(q);
        const matchesPhone = r.customerPhone.includes(q);
        const matchesCode = r.code.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCode) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, searchQuery]);

  // Reports
  const reportStats = React.useMemo(() => {
    const totalRes = reservations.length;
    const confirmedRes = reservations.filter((r) => ['confirmada', 'sentada', 'concluida'].includes(r.status));
    const noShowRes = reservations.filter((r) => r.status === 'noshow');
    const cancelledRes = reservations.filter((r) => r.status === 'cancelada');
    const totalPax = confirmedRes.reduce((acc, r) => acc + r.guests, 0);

    const noShowRate = totalRes ? Math.round((noShowRes.length / totalRes) * 100) : 0;
    const cancelRate = totalRes ? Math.round((cancelledRes.length / totalRes) * 100) : 0;

    return {
      totalRes,
      totalPax,
      noShowRate,
      cancelRate,
    };
  }, [reservations]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} transition-colors duration-200`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold font-serif-display text-lg">
            QP
          </div>
          <div>
            <h1 className="dashboard-titulo text-white tracking-tight leading-none">
              o que pasa
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              by Barba Azul · Dashboard Privado do Dono
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Gmail Integration Status / Button */}
          {googleUser ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <Mail className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline font-medium truncate max-w-[150px]">{googleUser.email}</span>
              <span className="sm:hidden font-medium">Gmail</span>
              <button
                type="button"
                onClick={handleGoogleDisconnect}
                className="text-slate-400 hover:text-white text-[10px] underline ml-1 cursor-pointer"
                title="Desconectar Gmail"
              >
                Sair
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              onClick={handleGoogleConnect}
              isLoading={isGoogleConnecting}
              text="Conectar Gmail"
              className="py-1.5 px-3 text-xs"
            />
          )}

          {/* PWA Install Button (Prompt) */}
          <PWAInstallButton variant="compact" />

          {/* Push notification toggle */}
          {!pushEnabled && (
            <button
              onClick={handleRequestPush}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-amber-500/20"
              title="Ativar Notificações no Telemóvel"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Ativar Notificações</span>
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => {
              setShowNotificationsDrawer(!showNotificationsDrawer);
              if (unreadCount > 0) markOwnerNotificationsRead();
            }}
            className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Novas Reservas"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
            title="Terminar Sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max py-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('resumo')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'resumo' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Resumo do Dia</span>
          </button>

          <button
            onClick={() => setActiveTab('dia')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'dia' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Planta em Tempo Real (12 Mesas)</span>
          </button>

          <button
            onClick={() => setActiveTab('reservas')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'reservas' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Reservas</span>
          </button>

          <button
            onClick={() => setActiveTab('bloqueios')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'bloqueios' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Bloqueios & Folgas</span>
            {blockedPeriods.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 text-[10px] flex items-center justify-center font-bold">
                {blockedPeriods.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'editor' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Editor da Planta</span>
          </button>

          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'clientes' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Base de Clientes</span>
          </button>

          <button
            onClick={() => setActiveTab('relatorios')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'relatorios' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Relatórios</span>
          </button>

          <button
            onClick={() => setActiveTab('configuracoes')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'configuracoes' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Configurações</span>
          </button>
        </div>
      </nav>

      {/* NOTIFICATIONS DRAWER (NEW BOOKING ALERTS) */}
      {showNotificationsDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl p-5 flex flex-col animate-slide-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Bell className="w-4 h-4" />
              <span>Notificações de Reservas</span>
            </div>
            <button onClick={() => setShowNotificationsDrawer(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800 pt-2 space-y-2">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">Sem notificações recentes.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="pt-2 pb-2 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-400">{n.title}</span>
                    <span className="text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-0.5">
                    <Mail className="w-3 h-3" />
                    <span>Email de alerta enviado ao dono</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* ========================================================= */}
        {/* TAB: RESUMO DO DIA                                        */}
        {/* ========================================================= */}
        {activeTab === 'resumo' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data de Análise:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
                <button
                  onClick={() => setSelectedDate(getTodayStr())}
                  className="px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
                >
                  Hoje
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowManualModal(true)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Reserva Manual</span>
                </button>

                <button
                  onClick={() => setShowBlockModal(true)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20 font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>Bloquear Período</span>
                </button>
              </div>
            </div>

            {/* 4 Top KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reservas Hoje</span>
                <div className="dashboard-estatistica-num text-amber-500">{daySummary.totalReservations}</div>
                <span className="text-[11px] text-slate-400">Total de marcações</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pessoas Esperadas</span>
                <div className="dashboard-estatistica-num text-emerald-500">{daySummary.expectedGuests}</div>
                <span className="text-[11px] text-slate-400">Total de clientes (pax)</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mesas Livres</span>
                <div className="dashboard-estatistica-num text-sky-400">{daySummary.freeTables}</div>
                <span className="text-[11px] text-slate-400">Disponíveis na sala</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mesas Ocupadas</span>
                <div className="dashboard-estatistica-num text-rose-500">{daySummary.occupiedTables}</div>
                <span className="text-[11px] text-slate-400">Em serviço / reservadas</span>
              </div>
            </div>

            {/* Split: Floor Plan (Left) + Upcoming Arrivals (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="dashboard-seccao">
                    Planta da Sala em Tempo Real ({selectedDate})
                  </h3>
                  <span className="text-xs text-slate-500">Toque em qualquer mesa para gerir estado</span>
                </div>
                <FloorPlanSVG
                  mode="management"
                  tables={tables}
                  tableStatusMap={tableStatusMap}
                  onTableActionClick={(tbl) => setSelectedTableForModal(tbl)}
                />
              </div>

              {/* Upcoming Arrivals */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col h-[640px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h3 className="dashboard-seccao">Próximas Chegadas</h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                    {daySummary.upcomingArrivals.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pt-2 space-y-2 pr-1">
                  {daySummary.upcomingArrivals.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      Sem chegadas previstas para esta data.
                    </div>
                  ) : (
                    daySummary.upcomingArrivals.map((res) => (
                      <div key={res.id} className="pt-2 pb-2 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {res.time}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              res.status === 'sentada'
                                ? 'bg-red-500/20 text-red-400'
                                : res.status === 'chegou'
                                ? 'bg-amber-500/20 text-amber-400'
                                : res.status === 'concluida'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>

                        <div className="flex justify-between items-baseline">
                          <strong className="text-slate-800 dark:text-slate-200">{res.customerName}</strong>
                          <span className="font-semibold text-amber-500">Mesa {res.tableId}</span>
                        </div>

                        <div className="text-slate-500 flex justify-between">
                          <span>{res.guests} pessoas · {res.customerPhone}</span>
                          <span className="text-[10px] font-mono">{res.code}</span>
                        </div>

                        {res.specialRequests.length > 0 && (
                          <div className="text-[11px] text-amber-400/90 font-medium bg-amber-500/10 px-2 py-0.5 rounded">
                            {res.specialRequests.join(' · ')}
                          </div>
                        )}

                        {/* Quick action buttons */}
                        <div className="flex gap-1.5 pt-1">
                          {res.status === 'confirmada' && (
                            <button
                              onClick={async () => {
                                await updateOwnerReservation(res.id, { status: 'chegou' });
                                showToast(`Cliente ${res.customerName} marcado como Chegou!`);
                                loadAll();
                              }}
                              className="px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[11px] flex-1 text-center"
                            >
                              Chegou
                            </button>
                          )}
                          {(res.status === 'confirmada' || res.status === 'chegou') && (
                            <button
                              onClick={async () => {
                                await updateOwnerReservation(res.id, { status: 'sentada' });
                                showToast(`Cliente ${res.customerName} sentou na Mesa ${res.tableId}`);
                                loadAll();
                              }}
                              className="px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] flex-1 text-center"
                            >
                              Sentar
                            </button>
                          )}
                          {res.status === 'sentada' && (
                            <button
                              onClick={async () => {
                                await updateOwnerReservation(res.id, { status: 'concluida' });
                                showToast(`Mesa ${res.tableId} concluída! SMS e Email de agradecimento enviados.`);
                                loadAll();
                              }}
                              className="px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] flex-1 text-center cursor-pointer"
                            >
                              Concluir (SMS + Mail)
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: PLANTA EM TEMPO REAL                                */}
        {/* ========================================================= */}
        {activeTab === 'dia' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="dashboard-seccao">
                  Planta da Sala em Tempo Real
                </h3>
                <p className="text-xs text-slate-400">
                  Estado ao vivo das 12 mesas circulares. Toque numa mesa para ações imediatas.
                </p>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-800 border border-slate-700 rounded-xl"
              />
            </div>

            <FloorPlanSVG
              mode="management"
              tables={tables}
              tableStatusMap={tableStatusMap}
              onTableActionClick={(tbl) => setSelectedTableForModal(tbl)}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: RESERVAS & AÇÕES                                    */}
        {/* ========================================================= */}
        {activeTab === 'reservas' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome, telefone ou código..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl w-64"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="todas">Todos os Estados</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="chegou">Chegou</option>
                  <option value="sentada">Sentada</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="noshow">No-Show</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportReservationsToCsv}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar CSV</span>
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Reserva Manual</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left dashboard-tabela-corpo">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 dashboard-tabela-header text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Data e Hora</th>
                      <th className="px-4 py-3">Mesa</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Pax</th>
                      <th className="px-4 py-3">Pedidos / Notas</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredReservations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                          Nenhuma reserva encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredReservations.map((res) => (
                        <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-sky-400">{res.code}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold dashboard-hora-num">{res.date}</div>
                            <div className="text-slate-400 dashboard-hora-num">{res.time} ({res.durationMinutes}m)</div>
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-500">Mesa {res.tableId}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{res.customerName}</div>
                            <div className="text-slate-400">{res.customerPhone}</div>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                              <span
                                onClick={() => {
                                  setSelectedReservationForSms(res);
                                  setShowSmsModal(true);
                                }}
                                className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold cursor-pointer ${
                                  res.smsSent ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500'
                                }`}
                                title={res.smsSent ? 'SMS entregue ao cliente. Clique para ver.' : 'SMS não enviado'}
                              >
                                <Smartphone className="w-2.5 h-2.5" /> SMS
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold ${
                                  res.emailSent ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500'
                                }`}
                                title={res.emailSent ? 'Email de confirmação enviado' : 'Email não enviado'}
                              >
                                <Mail className="w-2.5 h-2.5" /> Email
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold dashboard-hora-num">{res.guests} pax</td>
                          <td className="px-4 py-3 max-w-xs truncate text-slate-400">
                            {res.specialRequests.join(', ') || 'Nenhum'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] dashboard-badge ${
                                res.status === 'sentada'
                                  ? 'bg-red-500/20 text-red-400'
                                  : res.status === 'chegou'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : res.status === 'confirmada'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : res.status === 'cancelada'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : res.status === 'noshow'
                                  ? 'bg-slate-500/20 text-slate-400'
                                  : 'bg-purple-500/20 text-purple-400'
                              }`}
                            >
                              {res.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {res.status === 'confirmada' && (
                                <button
                                  onClick={async () => {
                                    await updateOwnerReservation(res.id, { status: 'chegou' });
                                    showToast('Chegada marcada');
                                    loadAll();
                                  }}
                                  className="p-1 hover:bg-slate-700 rounded text-amber-400"
                                  title="Marcar Chegada"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  try {
                                    await sendOwnerReminder(res.id);
                                    showToast(`Lembrete SMS enviado para ${res.customerPhone}`);
                                    loadAll();
                                  } catch (err: any) {
                                    showToast(err.message || 'Erro ao enviar lembrete');
                                  }
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-amber-400 cursor-pointer"
                                title="Disparar Lembrete Automático por SMS (Twilio)"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenGmailConfirm(res)}
                                className="p-1 hover:bg-slate-700 rounded text-red-400 cursor-pointer"
                                title="Enviar Aviso de Reserva através do Gmail"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedReservationForSms(res);
                                  setShowSmsModal(true);
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-emerald-400 cursor-pointer"
                                title="Ver / Reenviar SMS"
                              >
                                <Smartphone className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  await updateOwnerReservation(res.id, {
                                    status: res.status === 'cancelada' ? 'confirmada' : 'cancelada',
                                  });
                                  showToast('Estado atualizado');
                                  loadAll();
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-rose-400 cursor-pointer"
                                title="Cancelar / Reativar"
                              >
                                <Trash2 className="w-4 h-4" />
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
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: BLOQUEIOS (FOLGAS, EVENTOS PRIVADOS, MESAS)          */}
        {/* ========================================================= */}
        {activeTab === 'bloqueios' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="dashboard-seccao text-white">Bloqueios & Encerramentos</h3>
                <p className="text-xs text-slate-400">
                  Bloqueie dias completos (folgas, feriados), intervalos de horas ou mesas específicas para eventos privados.
                </p>
              </div>
              <button
                onClick={() => setShowBlockModal(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 dashboard-botao rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Bloqueio</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {blockedPeriods.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                  Não existem bloqueios ativos no momento.
                </div>
              ) : (
                blockedPeriods.map((block) => (
                  <div
                    key={block.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold text-[10px] uppercase">
                        {block.type === 'dia_inteiro' ? 'Dia Inteiro' : block.type === 'horario' ? 'Horário' : `Mesa ${block.tableId}`}
                      </span>
                      <button
                        onClick={async () => {
                          await deleteOwnerBlock(block.id);
                          showToast('Bloqueio removido com sucesso!');
                          loadAll();
                        }}
                        className="text-slate-500 hover:text-rose-400"
                        title="Remover Bloqueio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="font-bold text-white text-sm">{block.date}</div>
                    {block.startTime && block.endTime && (
                      <div className="text-xs text-slate-400">
                        {block.startTime} às {block.endTime}
                      </div>
                    )}
                    <p className="text-xs text-slate-300 font-medium">Motivo: {block.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: EDITOR DA PLANTA                                    */}
        {/* ========================================================= */}
        {activeTab === 'editor' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="dashboard-seccao text-white">
                  Editor de Disposição das 12 Mesas
                </h3>
                <p className="text-xs text-slate-400">
                  Arraste diretamente as mesas com o dedo ou rato para posicionar na sala de Aveiro.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await saveOwnerTablesLayout(tables);
                    showToast('Disposição da sala guardada com sucesso!');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white dashboard-botao rounded-xl"
                >
                  Guardar Layout
                </button>
                <button
                  onClick={async () => {
                    await resetOwnerDemo();
                    showToast('Layout original reposto.');
                    loadAll();
                  }}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl dashboard-botao"
                >
                  Restaurar Original
                </button>
              </div>
            </div>

            <FloorPlanSVG
              mode="management"
              tables={tables}
              isDraggable={true}
              onUpdateTablePosition={handleUpdateTablePosition}
              onTableActionClick={(tbl) => setSelectedTableForModal(tbl)}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: BASE DE CLIENTES (CRM)                              */}
        {/* ========================================================= */}
        {activeTab === 'clientes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="dashboard-seccao text-white">Base de Clientes (CRM)</h3>
                <p className="text-xs text-slate-400">
                  Histórico de visitas, preferências e conformidade com o RGPD (Direito ao Apagamento).
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left dashboard-tabela-corpo">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 dashboard-tabela-header text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Contactos</th>
                    <th className="px-4 py-3">Visitas</th>
                    <th className="px-4 py-3">No-Shows</th>
                    <th className="px-4 py-3">Alergias / Notas</th>
                    <th className="px-4 py-3">VIP</th>
                    <th className="px-4 py-3 text-right">RGPD (Apagar)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-white">{c.name}</td>
                      <td className="px-4 py-3 text-slate-400">
                        <div>{c.phone}</div>
                        <div>{c.email}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-white dashboard-hora-num">{c.visitsCount}</td>
                      <td className="px-4 py-3">
                        <span className={`dashboard-hora-num ${c.noShowCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                          {c.noShowCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {c.allergies.length > 0 && (
                          <div className="text-rose-400 font-semibold mb-0.5">{c.allergies.join(', ')}</div>
                        )}
                        <div className="text-slate-400 truncate">{c.internalNotes || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            await updateOwnerCustomer(c.id, { isVip: !c.isVip });
                            showToast(c.isVip ? 'Removido de VIP' : 'Marcado como VIP');
                            loadAll();
                          }}
                          className={`p-1.5 rounded-lg ${c.isVip ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-amber-400'}`}
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={async () => {
                            if (window.confirm(`Apagar permanentemente todos os dados de ${c.name} (RGPD)?`)) {
                              await gdprDeleteOwnerCustomer(c.id);
                              showToast('Dados anonimizados com sucesso.');
                              loadAll();
                            }
                          }}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold"
                        >
                          Apagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: RELATÓRIOS                                          */}
        {/* ========================================================= */}
        {activeTab === 'relatorios' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">Total Reservas</span>
                <div className="dashboard-estatistica-num text-amber-500">{reportStats.totalRes}</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">Total Pax</span>
                <div className="dashboard-estatistica-num text-emerald-500">{reportStats.totalPax}</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">Taxa No-Show</span>
                <div className="dashboard-estatistica-num text-rose-500">{reportStats.noShowRate}%</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">Cancelamentos</span>
                <div className="dashboard-estatistica-num text-sky-500">{reportStats.cancelRate}%</div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-3">
              <h4 className="dashboard-seccao text-white">Exportação de Relatórios</h4>
              <p className="text-xs text-slate-400">
                Descarregue os registos completos das reservas em ficheiro CSV compatível com Excel e Google Sheets.
              </p>
              <button
                onClick={exportReservationsToCsv}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 dashboard-botao rounded-2xl flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4" />
                <span>Descarregar Ficheiro CSV / Excel</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: CONFIGURAÇÕES                                       */}
        {/* ========================================================= */}
        {activeTab === 'configuracoes' && settings && (
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="dashboard-seccao text-white">Configurações do Restaurante</h3>
                <p className="text-xs text-slate-400">
                  Horários semanais, email de alerta do dono e tempos de limpeza.
                </p>
              </div>
              <button
                onClick={async () => {
                  await saveOwnerSettings(settings);
                  showToast('Configurações guardadas!');
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 dashboard-botao rounded-xl"
              >
                Guardar Configurações
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email do Dono para Alertas Instantâneos de Novas Reservas
              </label>
              <input
                type="email"
                value={settings.ownerEmail || 'dono@barbaazul.pt'}
                onChange={(e) => setSettings({ ...settings, ownerEmail: e.target.value })}
                className="w-full sm:w-96 p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white"
              />
            </div>

            {/* Brevo (Sendinblue) Integration Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-800/80 border border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-sm">
                    BR
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="dashboard-seccao text-white">Integração Brevo (Sendinblue)</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${settings.brevoApiKey ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
                        {settings.brevoApiKey ? 'Conectado / Configurado' : 'Opcional / Desconectado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Disparo profissional de emails transacionais e SMS de confirmação através da API da Brevo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestBrevo}
                  disabled={isTestingBrevo || !settings.brevoApiKey}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingBrevo ? 'animate-spin' : ''}`} />
                  <span>{isTestingBrevo ? 'A testar conexão...' : 'Testar Conexão Brevo'}</span>
                </button>
              </div>

              {brevoTestResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${brevoTestResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'}`}>
                  {brevoTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
                  <span>{brevoTestResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Chave Brevo (API v3 ou Chave SMTP)
                  </label>
                  <input
                    type="password"
                    placeholder="xkeysib-... ou xsmtpsib-..."
                    value={settings.brevoApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, brevoApiKey: e.target.value })}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Aceita Chave de API v3 (<code className="text-amber-400">xkeysib-...</code>) para Email e SMS ou Chave SMTP (<code className="text-amber-400">xsmtpsib-...</code>) para Email.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Email de Remetente (Verificado na Brevo)
                  </label>
                  <input
                    type="email"
                    placeholder="reservas@quepasa.pt"
                    value={settings.brevoSenderEmail || ''}
                    onChange={(e) => setSettings({ ...settings, brevoSenderEmail: e.target.value })}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Deve corresponder a um domínio ou remetente verificado na Brevo
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nome do Remetente
                  </label>
                  <input
                    type="text"
                    placeholder="Qué Pasa · Aveiro"
                    value={settings.brevoSenderName || 'Qué Pasa · Aveiro'}
                    onChange={(e) => setSettings({ ...settings, brevoSenderName: e.target.value })}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Remetente Alfanumérico SMS (Máx. 11 caracteres)
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="QuePasa"
                    value={settings.brevoSmsSender || 'QuePasa'}
                    onChange={(e) => setSettings({ ...settings, brevoSmsSender: e.target.value })}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Horários Semanais</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {settings.schedule.map((day, idx) => (
                  <div key={day.dayOfWeek} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{day.dayName}</strong>
                      <span className={day.isOpen ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {day.isOpen ? 'Aberto' : 'Encerrado'}
                      </span>
                    </div>
                    {day.isOpen && (
                      <div className="text-[11px] text-slate-400 flex justify-between">
                        <span>Almoço: {day.lunchStart}–{day.lunchEnd}</span>
                        <span>Jantar: {day.dinnerStart}–{day.dinnerEnd}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Reservation Modal */}
      <ManualReservationModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        tables={tables}
        defaultDate={selectedDate}
        onSuccess={() => {
          showToast('Reserva manual criada com sucesso!');
          loadAll();
        }}
      />

      {/* Block Period Modal */}
      <BlockPeriodModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        tables={tables}
        onSuccess={() => {
          showToast('Bloqueio registado com sucesso!');
          loadAll();
        }}
      />

      {/* Table Detail & Actions Modal */}
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

      {/* SMS Preview & Resend Modal */}
      <SmsPreviewModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        reservation={selectedReservationForSms}
        onResend={async () => {
          if (!selectedReservationForSms) return;
          const res = await resendOwnerSms(selectedReservationForSms.id);
          setSelectedReservationForSms(res.reservation);
          showToast('SMS reenviado com sucesso!');
          loadAll();
        }}
      />

      {/* Gmail Confirmation Modal */}
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
    </div>
  );
};
