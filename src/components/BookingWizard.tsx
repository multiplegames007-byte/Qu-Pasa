import React, { useState, useEffect, useId } from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Info,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Download,
  Eye,
  PhoneCall,
  Smartphone,
  CheckCheck
} from 'lucide-react';
import {
  RestaurantTable,
  Reservation,
  RestaurantSettings
} from '../types/index.ts';
import {
  fetchPublicConfig,
  fetchPublicTables,
  fetchPublicSlots,
  fetchPublicTableStatus,
  submitPublicReservation,
  sendPublicHold,
  submitPublicWaitlist,
  resendPublicNotifications,
  sendPublicReminder
} from '../services/api.ts';
import {
  getDurationForGuests,
  generateIcsFile,
  getTodayStr,
  getTomorrowStr
} from '../services/storage.ts';
import { FloorPlanSVG } from './FloorPlanSVG.tsx';
import { EmailPreviewModal } from './EmailPreviewModal.tsx';
import { SmsPreviewModal } from './SmsPreviewModal.tsx';
import { PrivacyModal } from './PrivacyModal.tsx';
import { WaitlistModal } from './WaitlistModal.tsx';
import { GoogleSignInButton } from './GoogleSignInButton.tsx';
import { GmailConfirmModal } from './GmailConfirmModal.tsx';
import { initAuth, googleSignIn, getAccessToken } from '../services/googleAuth.ts';
import { sendGmailMessage, generateReservationHtmlEmail } from '../services/gmail.ts';
import type { User as FirebaseUser } from 'firebase/auth';

interface BookingWizardProps {
  onSuccessReturnHome?: () => void;
  onBackToLanding?: () => void;
}

export const BookingWizard: React.FC<BookingWizardProps> = ({ onSuccessReturnHome, onBackToLanding }) => {
  const sessionId = useId();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [config, setConfig] = useState<Partial<RestaurantSettings>>({
    restaurantName: 'Qué Pasa',
    phone: '234 424 208',
    address: 'Cais dos Mercantéis, nº 14',
    city: 'Aveiro',
    noShowGraceMinutes: 20,
    maxAdvanceDays: 60,
  });

  // Steps 1 to 6, then 7 = Success
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Visual Calendar Month State
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Form selections - default to next open day if today is Monday
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    if (today.getDay() === 1) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    return getTodayStr();
  });
  const [guests, setGuests] = useState<number>(2);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [autoAssigned, setAutoAssigned] = useState<boolean>(false);

  // Customer contact info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('+351 ');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [gdprConsent, setGdprConsent] = useState<boolean>(true);

  // Validation errors & loading
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Available slots for selected date & guests (default to active turnos)
  const [availableSlots, setAvailableSlots] = useState<{ lunchSlots: string[]; dinnerSlots: string[] }>({
    lunchSlots: ['12:30', '14:00'],
    dinnerSlots: ['19:30', '21:00'],
  });

  // Table availability map from server (only isFree / isBlocked - ZERO client data)
  const [tableAvailabilityMap, setTableAvailabilityMap] = useState<Record<number, { isFree: boolean; isBlocked?: boolean }>>({});
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);

  // Modals & Notifications
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState<boolean>(false);
  const [isResendingNotifs, setIsResendingNotifs] = useState<boolean>(false);
  const [resendNotifsSuccess, setResendNotifsSuccess] = useState<boolean>(false);
  const [isSendingReminder, setIsSendingReminder] = useState<boolean>(false);
  const [reminderSentSuccess, setReminderSentSuccess] = useState<boolean>(false);

  // Completed reservation for success screen
  const [completedReservation, setCompletedReservation] = useState<Reservation | null>(null);

  const handleResendNotifications = async () => {
    if (!completedReservation) return;
    setIsResendingNotifs(true);
    try {
      const res = await resendPublicNotifications(completedReservation.code);
      setCompletedReservation(res.reservation);
      setResendNotifsSuccess(true);
      setTimeout(() => setResendNotifsSuccess(false), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsResendingNotifs(false);
    }
  };

  const handleSendReminder = async () => {
    if (!completedReservation) return;
    setIsSendingReminder(true);
    try {
      const res = await sendPublicReminder(completedReservation.code);
      setCompletedReservation(res.reservation);
      setReminderSentSuccess(true);
      setTimeout(() => setReminderSentSuccess(false), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Google Workspace / Gmail Integration
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [showGmailModal, setShowGmailModal] = useState<boolean>(false);
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);
  const [gmailSentSuccess, setGmailSentSuccess] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initAuth((u) => setGoogleUser(u), () => setGoogleUser(null));
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleTriggerGmail = async () => {
    const token = await getAccessToken();
    if (!token || !googleUser) {
      try {
        const res = await googleSignIn();
        if (res?.user) {
          setGoogleUser(res.user);
          setShowGmailModal(true);
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }
    setShowGmailModal(true);
  };

  const handleConfirmSendGmail = async () => {
    if (!completedReservation) return;
    setIsSendingGmail(true);
    try {
      const html = generateReservationHtmlEmail(completedReservation);
      await sendGmailMessage({
        to: completedReservation.customerEmail,
        subject: `Confirmação de Reserva Oficial · Qué Pasa (${completedReservation.code})`,
        bodyText: `Olá ${completedReservation.customerName},\n\nA sua mesa para ${completedReservation.guests} pessoas no Qué Pasa está confirmada para ${completedReservation.date} às ${completedReservation.time} (Mesa ${completedReservation.tableId}).\nCódigo: ${completedReservation.code}.\n\nCais dos Mercantéis 14, Aveiro.`,
        bodyHtml: html,
      });
      setGmailSentSuccess(true);
      setShowGmailModal(false);
      setTimeout(() => setGmailSentSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Falha ao enviar através do Gmail');
    } finally {
      setIsSendingGmail(false);
    }
  };

  // Initial load of tables and config
  useEffect(() => {
    fetchPublicTables().then(setTables).catch(console.error);
    fetchPublicConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (cfg?.closedDates?.includes(selectedDate)) {
          const nextDay = new Date(selectedDate + 'T12:00:00');
          nextDay.setDate(nextDay.getDate() + 1);
          setSelectedDate(nextDay.toISOString().split('T')[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch slots whenever date or guests change
  useEffect(() => {
    if (selectedDate && guests) {
      setIsLoadingSlots(true);
      fetchPublicSlots(selectedDate, guests)
        .then((slots) => {
          if (slots && (slots.lunchSlots?.length > 0 || slots.dinnerSlots?.length > 0)) {
            setAvailableSlots(slots);
          } else {
            // Check if day is explicitly closed
            const isClosed = config?.closedDates?.includes(selectedDate);
            if (isClosed) {
              setAvailableSlots({ lunchSlots: [], dinnerSlots: [] });
            } else {
              setAvailableSlots({
                lunchSlots: ['12:30', '14:00'],
                dinnerSlots: ['19:30', '21:00'],
              });
            }
          }
          if (selectedTime && slots && !slots.lunchSlots?.includes(selectedTime) && !slots.dinnerSlots?.includes(selectedTime)) {
            setSelectedTime('');
            setSelectedTable(null);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar horários disponíveis:', err);
          // Fallback to standard turnos so user is not falsely blocked
          setAvailableSlots({
            lunchSlots: ['12:30', '14:00'],
            dinnerSlots: ['19:30', '21:00'],
          });
        })
        .finally(() => setIsLoadingSlots(false));
    }
  }, [selectedDate, guests, config?.closedDates]);

  // Fetch table availability when time is chosen
  useEffect(() => {
    if (selectedDate && selectedTime) {
      fetchPublicTableStatus(selectedDate, selectedTime, guests, sessionId)
        .then(setTableAvailabilityMap)
        .catch((err) => {
          console.error('Erro ao obter status das mesas:', err);
          // Default to free
          setTableAvailabilityMap({});
        });
    }
  }, [selectedDate, selectedTime, guests, sessionId]);

  // Handle table selection (persists until booking is confirmed)
  const handleSelectTable = (table: RestaurantTable) => {
    setSelectedTable(table);
    setAutoAssigned(false);
  };

  // Auto Assign Smart Best Table
  const handleAutoAssign = () => {
    // Prefer tables with capacity >= guests, or any free active table
    const freeTables = tables.filter((t) => {
      if (!t.isActive) return false;
      const status = tableAvailabilityMap[t.id];
      return status ? status.isFree && !status.isBlocked : true;
    });

    const eligible = freeTables.filter((t) => t.capacity >= guests);
    const chosenList = eligible.length > 0 ? eligible : freeTables;

    if (chosenList.length === 0) {
      return;
    }

    // Sort: least wasted seats first, then window preference
    chosenList.sort((a, b) => {
      const diffA = Math.abs(a.capacity - guests);
      const diffB = Math.abs(b.capacity - guests);
      if (diffA !== diffB) return diffA - diffB;
      if (a.section === 'janela' && b.section !== 'janela') return -1;
      if (b.section === 'janela' && a.section !== 'janela') return 1;
      return a.number - b.number;
    });

    if (chosenList[0]) {
      handleSelectTable(chosenList[0]);
      setAutoAssigned(true);
    }
  };

  // Form validation
  const validateStep5 = () => {
    const errors: Record<string, string> = {};
    if (!customerName.trim() || customerName.trim().length < 3) {
      errors.name = 'Por favor indique o seu nome completo.';
    }
    const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.length < 9) {
      errors.phone = 'Por favor indique um contacto de telemóvel válido.';
    }
    if (!customerEmail.includes('@') || !customerEmail.includes('.')) {
      errors.email = 'Por favor indique um email válido.';
    }
    if (!gdprConsent) {
      errors.gdpr = 'Deverá aceitar a política de tratamento de dados para confirmação da reserva.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit reservation to Server API
  const handleConfirmReservation = async () => {
    if (!selectedTable || !selectedDate || !selectedTime) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const allRequests = [...specialRequests];
      if (customNotes.trim()) {
        allRequests.push(customNotes.trim());
      }

      const token = await getAccessToken();

      const res = await submitPublicReservation({
        date: selectedDate,
        time: selectedTime,
        guests,
        tableId: selectedTable.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        specialRequests: allRequests,
        notes: customNotes.trim(),
        googleAccessToken: token || undefined,
      });

      setCompletedReservation(res);
      setCurrentStep(7); // Success Screen

      // If Google token available, auto-dispatch confirmation directly via Gmail API
      if (token && res.customerEmail) {
        try {
          const html = generateReservationHtmlEmail(res);
          await sendGmailMessage({
            to: res.customerEmail,
            subject: `Confirmação de Reserva Oficial · Qué Pasa (${res.code})`,
            bodyText: `Olá ${res.customerName},\n\nA sua mesa para ${res.guests} pessoas no Qué Pasa está 100% confirmada para ${res.date} às ${res.time} (Mesa ${res.tableId}).\nA sua reserva está garantida sem necessidade de qualquer código ou validação.\n\nLocalização: Cais dos Mercantéis, nº 14, Aveiro.\nTelefone: 234 424 208`,
            bodyHtml: html,
            accessToken: token,
          });
          setGmailSentSuccess(true);
        } catch (e) {
          console.warn('Auto Gmail dispatch notice:', e);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao confirmar a reserva.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSpecialRequest = (tag: string) => {
    if (specialRequests.includes(tag)) {
      setSpecialRequests(specialRequests.filter((t) => t !== tag));
    } else {
      setSpecialRequests([...specialRequests, tag]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Optional Top Return to Landing */}
      {onBackToLanding && currentStep < 7 && (
        <div className="mb-4 flex items-center justify-start">
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <span>← Início</span>
          </button>
        </div>
      )}

      {/* Progress Stepper */}
      {currentStep < 7 && (
        <div className="mb-6 px-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Passo {currentStep} de 6</span>
            <span className="text-slate-900 font-bold">
              {currentStep === 1 && '1. Selecione a Data'}
              {currentStep === 2 && '2. Número de Pessoas'}
              {currentStep === 3 && '3. Horário Disponível'}
              {currentStep === 4 && '4. Escolha da Mesa'}
              {currentStep === 5 && '5. Os Seus Dados'}
              {currentStep === 6 && '6. Resumo e Confirmação'}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* STEP 1: DATA (VISUAL CALENDAR) */}
      {currentStep === 1 && (() => {
        const year = calendarViewDate.getFullYear();
        const month = calendarViewDate.getMonth();
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Day of week of 1st day (Monday = 0, Sunday = 6)
        const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

        const todayStr = getTodayStr();
        const [todayYear, todayMonth] = todayStr.split('-').map(Number);
        const isCurrentOrPastMonth = year < todayYear || (year === todayYear && month <= todayMonth - 1);

        const handlePrevMonth = () => {
          if (isCurrentOrPastMonth) return;
          setCalendarViewDate(new Date(year, month - 1, 1));
        };

        const handleNextMonth = () => {
          setCalendarViewDate(new Date(year, month + 1, 1));
        };

        const getFormattedSelectedDate = (dateStr: string) => {
          if (!dateStr) return '';
          const d = new Date(dateStr + 'T12:00:00');
          const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          return `${weekdays[d.getDay()]}, ${d.getDate()} de ${monthNames[d.getMonth()]} de ${d.getFullYear()}`;
        };

        return (
          <div className="bg-white rounded-3xl p-3.5 sm:p-8 shadow-sm border border-slate-200/80 space-y-3 sm:space-y-6">
            <div>
              <h2 className="cliente-titulo-passo text-slate-900 text-xl sm:text-2xl">
                Escolha a data da sua refeição
              </h2>
            </div>

            {/* INTERACTIVE CALENDAR CONTAINER */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl sm:rounded-3xl p-3 sm:p-6 space-y-2.5 sm:space-y-4">
              {/* Calendar Month Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={isCurrentOrPastMonth}
                  className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
                </button>

                <div className="text-center">
                  <div className="font-titulo text-base sm:text-xl font-normal text-slate-900">
                    {monthNames[month]} {year}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
                  title="Mês seguinte"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
                </button>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 py-0.5">
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Blank padding cells before 1st day */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8 sm:h-13 aspect-square sm:aspect-auto" />
                ))}

                {/* Month Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isPast = dateStr < todayStr;
                  const isSpecificClosed = Boolean(config?.closedDates && config.closedDates.includes(dateStr));

                  const maxAdvanceDays = config?.maxAdvanceDays || 60;
                  const maxDate = new Date();
                  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
                  const maxDateStr = maxDate.toISOString().split('T')[0];
                  const isTooFar = dateStr > maxDateStr;

                  const isSelected = selectedDate === dateStr;
                  const isToday = dateStr === todayStr;

                  if (isPast) {
                    return (
                      <div
                        key={dateStr}
                        className="h-8 sm:h-13 aspect-square sm:aspect-auto flex flex-col items-center justify-center rounded-xl sm:rounded-2xl text-slate-300 text-xs font-medium cursor-not-allowed select-none"
                      >
                        <span>{dayNum}</span>
                      </div>
                    );
                  }

                  if (isTooFar) {
                    return (
                      <div
                        key={dateStr}
                        className="h-8 sm:h-13 aspect-square sm:aspect-auto flex flex-col items-center justify-center rounded-xl sm:rounded-2xl text-slate-300 text-xs font-medium cursor-not-allowed select-none"
                        title={`Reservas disponíveis com até ${maxAdvanceDays} dias de antecedência`}
                      >
                        <span>{dayNum}</span>
                      </div>
                    );
                  }

                  if (isSpecificClosed) {
                    return (
                      <div
                        key={dateStr}
                        className="h-8 sm:h-13 aspect-square sm:aspect-auto flex flex-col items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100/60 text-slate-400 text-xs cursor-not-allowed select-none border border-dashed border-slate-200"
                        title="Encerrado por motivo excecional / evento privado"
                      >
                        <span className="line-through text-[11px] sm:text-xs">{dayNum}</span>
                        <span className="text-[8px] sm:text-[9px] text-slate-400 tracking-tighter">Fechado</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      type="button"
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`h-8 sm:h-13 aspect-square sm:aspect-auto flex flex-col items-center justify-center rounded-xl sm:rounded-2xl transition-all relative cliente-calendario-num ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-md ring-2 sm:ring-4 ring-amber-100 scale-105 z-10 font-bold'
                          : isToday
                          ? 'bg-white border-2 border-amber-500 text-slate-900 hover:bg-amber-50 font-bold'
                          : 'bg-white border border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="cliente-calendario-num text-xs sm:text-base">{dayNum}</span>
                      {isToday && !isSelected && (
                        <span className="text-[8px] sm:text-[10px] font-medium text-amber-600 -mt-1 sm:-mt-0.5">Hoje</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-md bg-white border border-slate-300" />
                    <span>Disponível</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-md bg-amber-600" />
                    <span>Selecionado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Date Confirmation Strip */}
            {selectedDate && (
              <div className="p-2.5 sm:p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl sm:rounded-2xl flex items-center justify-between text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-slate-500 block text-[10px] sm:text-[11px]">Data Selecionada:</span>
                    <strong className="text-slate-900 text-xs sm:text-sm block">
                      {getFormattedSelectedDate(selectedDate)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!selectedDate}
                className="w-full sm:w-auto px-7 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white cliente-botao rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>Continuar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* STEP 2: NÚMERO DE PESSOAS */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div>
            <h2 className="cliente-titulo-passo text-slate-900">
              Quantas pessoas serão?
            </h2>
          </div>

          <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setGuests(num)}
                className={`flex flex-col items-center justify-center p-3.5 sm:p-5 rounded-2xl border-2 transition-all ${
                  guests === num
                    ? 'border-amber-600 bg-amber-50/70 text-slate-900 shadow-sm scale-105 ring-2 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-bold">{num}</span>
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">
                  {num === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-7 py-3 bg-slate-900 hover:bg-slate-800 text-white cliente-botao rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <span>Ver Horários</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: HORÁRIOS */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div>
            <h2 className="cliente-titulo-passo text-slate-900">
              Selecione o horário
            </h2>
            <p className="cliente-subtitulo text-slate-500 mt-1">
              Data: <strong className="text-slate-800">{selectedDate}</strong> · Grupo: <strong className="text-slate-800">{guests} pessoas</strong> · Duração: {getDurationForGuests(guests)} min
            </p>
          </div>

          {isLoadingSlots ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-700">A verificar mesas e horários disponíveis...</p>
            </div>
          ) : availableSlots.lunchSlots.length === 0 && availableSlots.dinnerSlots.length === 0 ? (
            <div className="p-8 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Lotação Esgotada</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Não existem mesas disponíveis para {guests} pessoas na data selecionada ({selectedDate}). Pode inscrever-se na lista de espera para aviso de desistências.
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => setShowWaitlistModal(true)}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Entrar na Lista de Espera
                </button>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Mudar de Data
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {availableSlots.lunchSlots.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Turnos de Almoço
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableSlots.lunchSlots.map((time) => {
                      const isTurno1 = time === '12:30';
                      const isSelected = selectedTime === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50 text-slate-900 shadow-sm ring-2 ring-amber-200'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                          }`}
                        >
                          <div>
                            <span className="text-xl font-bold block cliente-horario-num">{time}</span>
                            <span className="text-xs text-slate-500 font-medium">
                              {isTurno1 ? '1º Turno (12:30 às 14:00)' : '2º Turno (a partir das 14:00)'}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-lg ${
                              isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isSelected ? 'Selecionado' : 'Disponível'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableSlots.dinnerSlots.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Turnos de Jantar
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableSlots.dinnerSlots.map((time) => {
                      const isTurno1 = time === '19:30';
                      const isSelected = selectedTime === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50 text-slate-900 shadow-sm ring-2 ring-amber-200'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                          }`}
                        >
                          <div>
                            <span className="text-xl font-bold block cliente-horario-num">{time}</span>
                            <span className="text-xs text-slate-500 font-medium">
                              {isTurno1 ? '1º Turno (19:30 às 21:00)' : '2º Turno (a partir das 21:00)'}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-lg ${
                              isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isSelected ? 'Selecionado' : 'Disponível'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              disabled={!selectedTime}
              onClick={() => {
                if (!selectedTable) {
                  handleAutoAssign();
                }
                setCurrentStep(4);
              }}
              className="px-7 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cliente-botao rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <span>Escolher Mesa na Sala</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PLANTA INTERATIVA (PRIVACY SAFE: ZERO CLIENT DATA) */}
      {currentStep === 4 && (
        <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200/80 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="cliente-titulo-passo text-slate-900">
              Escolha a sua mesa
            </h2>
            {selectedTable && (
              <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-bold">
                Mesa {selectedTable.number}
              </span>
            )}
          </div>

          {/* Quick Table Buttons (Touch friendly on mobile & desktop) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Mesas para {guests} pessoas:</span>
              <span className="text-[11px] text-slate-400">Toque numa mesa</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-2">
              {tables.map((t) => {
                const avail = tableAvailabilityMap[t.id];
                const isFree = avail ? avail.isFree : true;
                const isClickable = t.isActive && isFree;
                const isSelected = selectedTable?.id === t.id;

                return (
                  <button
                    key={`quick-table-${t.id}`}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => handleSelectTable(t)}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center border ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40 scale-[1.02]'
                        : isClickable
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm font-extrabold">Mesa {t.number}</span>
                    <span className="text-[10px] font-semibold opacity-90">{t.capacity} lug.</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full">
            <FloorPlanSVG
              mode="customer"
              tables={tables}
              selectedTableId={selectedTable?.id}
              onSelectTable={handleSelectTable}
              requiredGuests={guests}
              tableAvailabilityMap={tableAvailabilityMap}
            />
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              disabled={!selectedTable}
              onClick={() => setCurrentStep(5)}
              className="px-7 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cliente-botao rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <span>Inserir os Meus Dados</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: DADOS DO CLIENTE */}
      {currentStep === 5 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div>
            <h2 className="cliente-titulo-passo text-slate-900">
              Dados para confirmação
            </h2>
            <p className="cliente-subtitulo text-slate-500 mt-1">
              Enviaremos o comprovativo e detalhes da reserva para o seu email.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1 cliente-label">Nome Completo *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Santos"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                    formErrors.name ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-slate-900'
                  }`}
                />
              </div>
              {formErrors.name && <span className="text-rose-600 text-xs mt-1 block cliente-erro">{formErrors.name}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 cliente-label">Telemóvel de Contacto *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="tel"
                  required
                  placeholder="+351 912 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                    formErrors.phone ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-slate-900'
                  }`}
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Apenas para contacto telefónico direto da nossa equipa.</span>
              {formErrors.phone && <span className="text-rose-600 text-xs mt-1 block cliente-erro">{formErrors.phone}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 cliente-label">Email para Confirmação *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@email.pt"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                    formErrors.email ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-slate-900'
                  }`}
                />
              </div>
              <span className="text-[11px] text-emerald-600 font-medium mt-1 block">A confirmação oficial da reserva é enviada para este email (via Gmail).</span>
              {formErrors.email && <span className="text-rose-600 text-xs mt-1 block cliente-erro">{formErrors.email}</span>}
            </div>
          </div>

          {/* Quick Tags */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-slate-700">
              Pedidos Especiais ou Alergias (toque para assinalar):
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Alergia / Intolerância alimentar',
                'Aniversário / Celebração',
                'Cadeira de bebé',
                'Mobilidade reduzida / Acessibilidade',
              ].map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleSpecialRequest(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    specialRequests.includes(tag)
                      ? 'bg-amber-100 border-amber-400 text-amber-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notas adicionais (opcional)</label>
            <textarea
              rows={2}
              placeholder="Ex: alergia grave a crustáceos, aniversário surpresa..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={gdprConsent}
                onChange={(e) => setGdprConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-slate-900 border-slate-300"
              />
              <span>
                Aceito o tratamento dos meus dados para efeitos de reserva e segurança alimentar, nos termos da{' '}
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-sky-700 underline font-semibold hover:text-sky-900"
                >
                  Política de Privacidade e RGPD
                </button>
                .
              </span>
            </label>
            {formErrors.gdpr && <span className="text-rose-600 text-xs mt-1 block">{formErrors.gdpr}</span>}
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (validateStep5()) setCurrentStep(6);
              }}
              className="px-7 py-3 bg-slate-900 hover:bg-slate-800 text-white cliente-botao rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <span>Confirmar Reserva</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: RESUMO E CONFIRMAÇÃO */}
      {currentStep === 6 && selectedTable && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div>
            <h2 className="cliente-titulo-passo text-slate-900">
              Confirmar os detalhes da reserva
            </h2>
            <p className="cliente-subtitulo text-slate-500 mt-1">
              Verifique os seus dados antes de submeter a sua reserva.
            </p>
          </div>

          {submitError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 cliente-erro">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Data</span>
                <strong className="text-slate-800 text-sm block mt-0.5">{selectedDate}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Horário</span>
                <strong className="text-slate-800 text-sm block mt-0.5">{selectedTime}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Pessoas</span>
                <strong className="text-slate-800 text-sm block mt-0.5">{guests} pax</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mesa</span>
                <strong className="text-slate-800 text-sm block mt-0.5">
                  Mesa {selectedTable.number}
                </strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 text-xs">
              <span className="text-slate-400 block font-medium">Titular e Contactos</span>
              <div className="text-slate-800 font-medium mt-0.5">
                {customerName} · {customerPhone} · {customerEmail}
              </div>
            </div>

            {(specialRequests.length > 0 || customNotes.trim()) && (
              <div className="pt-3 border-t border-slate-200 text-xs">
                <span className="text-slate-400 block font-medium">Observações</span>
                <div className="text-slate-800 mt-0.5">
                  {specialRequests.join(' · ')} {customNotes.trim() && `("${customNotes.trim()}")`}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-900 space-y-1">
            <span className="font-bold block">Tolerância de Chegada:</span>
            <span>
              Reservamos a sua mesa durante <strong>{config.noShowGraceMinutes} minutos</strong> a partir da hora marcada. Em caso de atraso imprevisto, contacte-nos pelo {config.phone}.
            </span>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setCurrentStep(5)}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmReservation}
              disabled={isSubmitting}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white cliente-botao rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-100" />
              <span>{isSubmitting ? 'A Confirmar...' : 'Confirmar Reserva'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: SUCESSO */}
      {currentStep === 7 && completedReservation && (
        <div className="bg-white rounded-3xl p-5 sm:p-10 shadow-sm border border-slate-200 text-center space-y-4 sm:space-y-6">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-50">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h2 className="cliente-sucesso text-slate-900 text-xl sm:text-2xl">
              Reserva Confirmada com Sucesso!
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs max-w-lg mx-auto py-1">
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[10px] sm:text-xs">Data</span>
              <strong className="text-slate-800 text-xs sm:text-sm">{completedReservation.date}</strong>
            </div>
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[10px] sm:text-xs">Hora</span>
              <strong className="text-slate-800 text-xs sm:text-sm">{completedReservation.time}</strong>
            </div>
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[10px] sm:text-xs">Pessoas</span>
              <strong className="text-slate-800 text-xs sm:text-sm">{completedReservation.guests} pax</strong>
            </div>
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[10px] sm:text-xs">Mesa</span>
              <strong className="text-slate-800 text-xs sm:text-sm">Mesa {completedReservation.tableId}</strong>
            </div>
          </div>

          {/* Confirmação por email confirmada com sucesso */}
          <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3 sm:p-4 max-w-md mx-auto text-center space-y-1 shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-xs sm:text-sm">
              <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Confirmação por email confirmada com sucesso</span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-700">
              Enviada para <strong>{completedReservation.customerEmail}</strong>
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center max-w-md mx-auto">
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white cliente-botao rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs sm:text-sm"
              >
                <span>Voltar ao Ecrã Inicial</span>
              </button>
            )}
            <button
              onClick={() => {
                if (onSuccessReturnHome) onSuccessReturnHome();
                else window.location.reload();
              }}
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 cliente-botao rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs sm:text-sm"
            >
              <span>Fazer Nova Reserva</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <EmailPreviewModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        reservation={completedReservation}
        settings={config as RestaurantSettings}
      />
      <SmsPreviewModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        reservation={completedReservation}
        onResend={handleResendNotifications}
      />
      <PrivacyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      <WaitlistModal
        isOpen={showWaitlistModal}
        onClose={() => setShowWaitlistModal(false)}
        defaultDate={selectedDate}
        defaultTime={selectedTime}
        defaultGuests={guests}
        onSuccess={() => setShowWaitlistModal(false)}
      />
      <GmailConfirmModal
        isOpen={showGmailModal}
        onClose={() => setShowGmailModal(false)}
        onConfirm={handleConfirmSendGmail}
        recipientEmail={completedReservation?.customerEmail || ''}
        reservationCode={completedReservation?.code || ''}
        customerName={completedReservation?.customerName || ''}
        isSending={isSendingGmail}
      />
    </div>
  );
};
