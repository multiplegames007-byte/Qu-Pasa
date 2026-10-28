export type ReservationStatus = 
  | 'pendente' 
  | 'confirmada' 
  | 'chegou' 
  | 'sentada' 
  | 'concluida' 
  | 'cancelada' 
  | 'noshow';

export type TableStatus = 'livre' | 'reservada' | 'chegou' | 'sentada' | 'a_limpar' | 'bloqueada';

export interface RestaurantTable {
  id: number;
  number: number;
  capacity: number;
  x: number; // SVG coordinates (0 - 1000)
  y: number; // SVG coordinates (0 - 640)
  radius: number;
  isActive: boolean;
  joinedWithId?: number | null;
  section: 'janela' | 'sala' | 'balcao';
}

export interface SentMessage {
  id: string;
  type: 'sms' | 'email';
  recipient: string;
  subject?: string;
  message: string;
  status: 'enviado' | 'entregue' | 'falha';
  sentAt: string;
  trigger: 'confirmacao_reserva' | 'conclusao_refeicao' | 'lembrete' | 'manual';
}

export interface Reservation {
  id: string;
  code: string; // e.g. OQP-8412
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  guests: number;
  tableId: number;
  joinedTableId?: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  specialRequests: string[];
  notes?: string;
  internalNotes?: string;
  status: ReservationStatus;
  durationMinutes: number;
  createdAt: string;
  source: 'online' | 'telefone' | 'presencial';
  reminderSent?: boolean;
  // Delivery confirmation fields
  smsSent?: boolean;
  smsSentAt?: string;
  smsPhone?: string;
  smsMessage?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailAddress?: string;
  completionSmsSent?: boolean;
  completionEmailSent?: boolean;
  messagesHistory?: SentMessage[];
}

export interface WaitlistEntry {
  id: string;
  date: string; // YYYY-MM-DD
  shift: 'almoco' | 'jantar';
  preferredTime: string;
  guests: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes?: string;
  status: 'em_espera' | 'notificado' | 'atribuido' | 'desistiu';
  createdAt: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  isVip: boolean;
  visitsCount: number;
  noShowCount: number;
  allergies: string[];
  internalNotes: string;
  lastVisit?: string;
  gdprConsentDate: string;
}

export interface DaySchedule {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ... 6 = Sábado
  dayName: string;
  isOpen: boolean;
  lunchStart: string; // "12:30"
  lunchEnd: string;   // "15:30"
  dinnerStart: string;// "19:30"
  dinnerEnd: string;  // "23:00"
}

export interface BlockedPeriod {
  id: string;
  type: 'dia_inteiro' | 'horario' | 'mesa';
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  tableId?: number | null; // specific table or null for entire room
  reason: string; // e.g., "Evento Privado", "Folga Semanal", "Obras"
  createdAt: string;
}

export interface OwnerNotification {
  id: string;
  title: string;
  message: string;
  reservationId: string;
  reservationCode: string;
  isRead: boolean;
  emailSentToOwner: boolean;
  createdAt: string;
}

export interface RestaurantSettings {
  restaurantName: string;
  tagline: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  ownerEmail: string;
  schedule: DaySchedule[];
  closedDates: string[]; // YYYY-MM-DD
  durationsByPax: {
    minPax: number;
    maxPax: number;
    durationMin: number;
  }[];
  cleaningBufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  noShowGraceMinutes: number;
  // Brevo (Sendinblue) Integration
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  brevoSenderName?: string;
  brevoSmsSender?: string;
  emailTemplates: {
    confirmationSubject: string;
    confirmationBody: string;
    reminderSubject: string;
    reminderBody: string;
    cancellationSubject: string;
    cancellationBody: string;
    ownerNewBookingSubject: string;
    ownerNewBookingBody: string;
    completionSubject?: string;
    completionBody?: string;
  };
  smsTemplates?: {
    confirmationBody: string;
    completionBody: string;
    reminderBody: string;
  };
}

export interface UserAccount {
  id: string;
  username: string;
  role: 'admin'; // Only the owner
  name: string;
}

export interface TemporaryTableHold {
  tableId: number;
  date: string;
  time: string;
  expiresAt: number; // timestamp
  sessionId: string;
}
