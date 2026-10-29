import {
  RestaurantTable,
  Reservation,
  WaitlistEntry,
  CustomerProfile,
  RestaurantSettings,
  TemporaryTableHold,
  ReservationStatus,
  TableStatus
} from '../types/index.ts';

const STORAGE_KEYS = {
  TABLES: 'oqp_tables_v1',
  RESERVATIONS: 'oqp_reservations_v1',
  WAITLIST: 'oqp_waitlist_v1',
  CUSTOMERS: 'oqp_customers_v1',
  SETTINGS: 'oqp_settings_v1',
  HOLDS: 'oqp_holds_v1',
  CURRENT_USER: 'oqp_current_user_v1',
};

// Initial 12 circular tables layout with enlarged radii and clear spacing
export const INITIAL_TABLES: RestaurantTable[] = [
  // Zona Janela (Canal / Ria de Aveiro)
  { id: 1, number: 1, capacity: 5, x: 120, y: 130, radius: 58, isActive: true, section: 'janela' },
  { id: 2, number: 2, capacity: 3, x: 120, y: 290, radius: 52, isActive: true, section: 'janela' },
  { id: 3, number: 3, capacity: 3, x: 120, y: 450, radius: 52, isActive: true, section: 'janela' },
  { id: 4, number: 4, capacity: 2, x: 280, y: 130, radius: 46, isActive: true, section: 'janela' },

  // Sala Principal (Centro)
  { id: 5, number: 5, capacity: 2, x: 320, y: 290, radius: 46, isActive: true, section: 'sala' },
  { id: 6, number: 6, capacity: 2, x: 320, y: 450, radius: 46, isActive: true, section: 'sala' },
  { id: 7, number: 7, capacity: 2, x: 510, y: 230, radius: 46, isActive: true, section: 'sala' },
  { id: 8, number: 8, capacity: 2, x: 510, y: 390, radius: 46, isActive: true, section: 'sala' },
  { id: 9, number: 9, capacity: 2, x: 690, y: 210, radius: 46, isActive: true, section: 'sala' },
  { id: 10, number: 10, capacity: 5, x: 690, y: 370, radius: 58, isActive: true, section: 'sala' },

  // Zona Balcão / Garrafeira
  { id: 11, number: 11, capacity: 2, x: 860, y: 190, radius: 46, isActive: true, section: 'balcao' },
  { id: 12, number: 12, capacity: 3, x: 860, y: 350, radius: 52, isActive: true, section: 'balcao' },
];

export const INITIAL_SETTINGS: RestaurantSettings = {
  restaurantName: 'Qué Pasa',
  tagline: 'Cozinha de Autor & Petiscos Contemporâneos',
  address: 'Cais dos Mercantéis, nº 14 (Bairro da Beira-Mar)',
  city: 'Aveiro',
  postalCode: '3800-228',
  phone: '234 424 208',
  email: 'reservas@quepasa.pt',
  schedule: [
    { dayOfWeek: 0, dayName: 'Domingo', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
    { dayOfWeek: 1, dayName: 'Segunda-feira', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
    { dayOfWeek: 2, dayName: 'Terça-feira', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
    { dayOfWeek: 3, dayName: 'Quarta-feira', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
    { dayOfWeek: 4, dayName: 'Quinta-feira', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
    { dayOfWeek: 5, dayName: 'Sexta-feira', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
    { dayOfWeek: 6, dayName: 'Sábado', isOpen: true, lunchStart: '12:30', lunchEnd: '15:30', dinnerStart: '19:30', dinnerEnd: '23:00' },
  ],
  closedDates: [],
  durationsByPax: [
    { minPax: 1, maxPax: 5, durationMin: 90 },
  ],
  cleaningBufferMinutes: 0,
  minAdvanceHours: 1,
  maxAdvanceDays: 60,
  noShowGraceMinutes: 20,
  emailTemplates: {
    confirmationSubject: 'Confirmação da sua Reserva - Qué Pasa',
    confirmationBody: 'Caro(a) {NOME},\n\nA sua mesa para {PESSOAS} pessoas está confirmada para {DATA} às {HORA}.\nCódigo de reserva: {CODIGO}.\n\nLocalização: Cais dos Mercantéis, nº 14, Aveiro.\nTolerância de chegada: 20 minutos.\n\nAté breve,\nEquipa Qué Pasa',
    reminderSubject: 'Lembrete da sua Reserva amanhã - Qué Pasa',
    reminderBody: 'Olá {NOME},\n\nLembramos que tem reserva amanhã ({DATA}) às {HORA} para {PESSOAS} pessoas (Mesa {MESA}).\nPor favor confirme ou faça a gestão da sua reserva no nosso website com o código {CODIGO}.\n\nAguardamos por si!',
    cancellationSubject: 'Cancelamento de Reserva - Qué Pasa',
    cancellationBody: 'Olá {NOME},\n\nA sua reserva {CODIGO} para {DATA} às {HORA} foi cancelada com sucesso.\nEsperamos ter o prazer de o receber numa próxima oportunidade em Aveiro.',
    ownerNewBookingSubject: 'Nova Reserva Recebida - Qué Pasa',
    ownerNewBookingBody: 'Caro Dono,\n\nRecebeu uma nova reserva:\nCliente: {NOME}\nTelemóvel: {TELEMOVEL}\nData e Hora: {DATA} às {HORA}\nMesa: {MESA} ({PESSOAS} pax)',
  },
  ownerEmail: 'dono@quepasa.pt',
};

// Formats a date as YYYY-MM-DD
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStr(): string {
  return formatDate(new Date());
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

// Generate demo reservations based on today's date
function getInitialReservations(): Reservation[] {
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();

  return [
    {
      id: 'res-1',
      code: 'OQP-7101',
      date: today,
      time: '12:30',
      guests: 2,
      tableId: 1,
      customerName: 'Gonçalo Ribeiro',
      customerPhone: '+351 912 345 678',
      customerEmail: 'goncalo.ribeiro@exemplo.pt',
      specialRequests: ['Mesa junto à janela', 'Aniversário'],
      status: 'concluida',
      durationMinutes: 90,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      source: 'online',
    },
    {
      id: 'res-2',
      code: 'OQP-7102',
      date: today,
      time: '13:00',
      guests: 4,
      tableId: 3,
      customerName: 'Mariana Cerqueira',
      customerPhone: '+351 934 892 110',
      customerEmail: 'marianacerqueira@exemplo.pt',
      specialRequests: ['Cadeira de bebé'],
      status: 'sentada',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      source: 'online',
      internalNotes: 'Cliente habitual, aprecia vinhos naturais.',
    },
    {
      id: 'res-3',
      code: 'OQP-7103',
      date: today,
      time: '13:30',
      guests: 4,
      tableId: 5,
      customerName: 'Tiago Fontes',
      customerPhone: '+351 961 773 402',
      customerEmail: 'tiagofontes@exemplo.pt',
      specialRequests: ['Alergia a marisco e nozes'],
      status: 'chegou',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      source: 'telefone',
    },
    {
      id: 'res-4',
      code: 'OQP-7104',
      date: today,
      time: '14:00',
      guests: 2,
      tableId: 2,
      customerName: 'Sofia Albuquerque',
      customerPhone: '+351 925 410 889',
      customerEmail: 'sofia.albuquerque@exemplo.pt',
      specialRequests: [],
      status: 'confirmada',
      durationMinutes: 90,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      source: 'online',
    },
    {
      id: 'res-5',
      code: 'OQP-7105',
      date: today,
      time: '20:00',
      guests: 4,
      tableId: 7,
      customerName: 'Duarte Mendonça',
      customerPhone: '+351 919 663 201',
      customerEmail: 'duarte.mendonca@exemplo.pt',
      specialRequests: ['Mobilidade reduzida (fácil acesso)'],
      status: 'confirmada',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      source: 'online',
    },
    {
      id: 'res-6',
      code: 'OQP-7106',
      date: today,
      time: '20:30',
      guests: 6,
      tableId: 9,
      customerName: 'Beatriz Vasconcelos',
      customerPhone: '+351 938 120 445',
      customerEmail: 'beatriz.v@exemplo.pt',
      specialRequests: ['Jantar de celebração profissional'],
      status: 'confirmada',
      durationMinutes: 120,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      source: 'online',
    },
    {
      id: 'res-7',
      code: 'OQP-7107',
      date: today,
      time: '21:00',
      guests: 4,
      tableId: 11,
      customerName: 'Nuno Carvalheiro',
      customerPhone: '+351 910 554 322',
      customerEmail: 'nuno.carvalheiro@exemplo.pt',
      specialRequests: [],
      status: 'confirmada',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      source: 'telefone',
    },
    {
      id: 'res-8',
      code: 'OQP-7108',
      date: tomorrow,
      time: '13:00',
      guests: 4,
      tableId: 4,
      customerName: 'Helena Pires',
      customerPhone: '+351 966 332 109',
      customerEmail: 'helena.pires@exemplo.pt',
      specialRequests: ['Mesa com vista canal'],
      status: 'confirmada',
      durationMinutes: 105,
      createdAt: new Date().toISOString(),
      source: 'online',
    },
    {
      id: 'res-9',
      code: 'OQP-7109',
      date: tomorrow,
      time: '20:00',
      guests: 2,
      tableId: 1,
      customerName: 'Pedro Antunes',
      customerPhone: '+351 917 882 133',
      customerEmail: 'pedroantunes@exemplo.pt',
      specialRequests: ['Aniversário de casamento'],
      status: 'confirmada',
      durationMinutes: 90,
      createdAt: new Date().toISOString(),
      source: 'online',
    },
    {
      id: 'res-10',
      code: 'OQP-7110',
      date: tomorrow,
      time: '20:30',
      guests: 6,
      tableId: 10,
      customerName: 'Rita Sarmento',
      customerPhone: '+351 933 445 566',
      customerEmail: 'rita.sarmento@exemplo.pt',
      specialRequests: ['Intolerância a lactose'],
      status: 'confirmada',
      durationMinutes: 120,
      createdAt: new Date().toISOString(),
      source: 'online',
    },
  ];
}

const INITIAL_CUSTOMERS: CustomerProfile[] = [
  {
    id: 'cust-1',
    name: 'Mariana Cerqueira',
    phone: '+351 934 892 110',
    email: 'marianacerqueira@exemplo.pt',
    isVip: true,
    visitsCount: 7,
    noShowCount: 0,
    allergies: ['Frutos secos'],
    internalNotes: 'Cliente muito simpática, prefere mesas junto à janela e vinhos da Bairrada.',
    lastVisit: getTodayStr(),
    gdprConsentDate: '2026-02-10T14:30:00Z',
  },
  {
    id: 'cust-2',
    name: 'Gonçalo Ribeiro',
    phone: '+351 912 345 678',
    email: 'goncalo.ribeiro@exemplo.pt',
    isVip: false,
    visitsCount: 3,
    noShowCount: 0,
    allergies: [],
    internalNotes: 'Visita frequentemente ao almoço.',
    lastVisit: getTodayStr(),
    gdprConsentDate: '2026-03-01T10:20:00Z',
  },
  {
    id: 'cust-3',
    name: 'Tiago Fontes',
    phone: '+351 961 773 402',
    email: 'tiagofontes@exemplo.pt',
    isVip: false,
    visitsCount: 2,
    noShowCount: 0,
    allergies: ['Marisco', 'Nozes'],
    internalNotes: 'Atenção às contaminações cruzadas na cozinha.',
    lastVisit: getTodayStr(),
    gdprConsentDate: '2026-04-12T18:00:00Z',
  },
  {
    id: 'cust-4',
    name: 'Beatriz Vasconcelos',
    phone: '+351 938 120 445',
    email: 'beatriz.v@exemplo.pt',
    isVip: true,
    visitsCount: 11,
    noShowCount: 0,
    allergies: [],
    internalNotes: 'Organiza almoços e jantares empresariais. Atendimento prioritário.',
    lastVisit: '2026-10-15',
    gdprConsentDate: '2026-01-15T09:15:00Z',
  },
  {
    id: 'cust-5',
    name: 'Carlos Mesquita',
    phone: '+351 915 221 009',
    email: 'carlos.mesquita@exemplo.pt',
    isVip: false,
    visitsCount: 1,
    noShowCount: 1,
    allergies: [],
    internalNotes: 'Faltou sem avisar uma vez no mês anterior.',
    lastVisit: '2026-09-20',
    gdprConsentDate: '2026-05-18T12:00:00Z',
  },
];

const INITIAL_WAITLIST: WaitlistEntry[] = [
  {
    id: 'wait-1',
    date: getTodayStr(),
    shift: 'jantar',
    preferredTime: '20:30',
    guests: 4,
    customerName: 'António Faria',
    customerPhone: '+351 922 401 988',
    customerEmail: 'antonio.faria@exemplo.pt',
    notes: 'Aceita qualquer mesa livre entre 20h e 21h',
    status: 'em_espera',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

// Broadcast channel for instantaneous cross-tab and component synchronization
const storageChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('oqp_reservations_sync') 
  : null;

function notifyChange(type: string, payload?: unknown) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('oqp_data_updated', { detail: { type, payload } }));
    storageChannel?.postMessage({ type, payload });
  }
}

// Subscribe to real-time updates
export function subscribeToDataChanges(callback: (type: string) => void): () => void {
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent;
    callback(custom.detail?.type || 'all');
  };
  const handleBcMessage = (e: MessageEvent) => {
    callback(e.data?.type || 'all');
  };

  window.addEventListener('oqp_data_updated', handleCustomEvent);
  storageChannel?.addEventListener('message', handleBcMessage);

  return () => {
    window.removeEventListener('oqp_data_updated', handleCustomEvent);
    storageChannel?.removeEventListener('message', handleBcMessage);
  };
}

// TABLES
export function getTables(): RestaurantTable[] {
  const data = localStorage.getItem(STORAGE_KEYS.TABLES);
  if (!data) {
    saveTables(INITIAL_TABLES);
    return INITIAL_TABLES;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_TABLES;
  }
}

export function saveTables(tables: RestaurantTable[]): void {
  localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
  notifyChange('tables');
}

export function updateTable(id: number, updates: Partial<RestaurantTable>): void {
  const tables = getTables();
  const updated = tables.map(t => (t.id === id ? { ...t, ...updates } : t));
  saveTables(updated);
}

// RESERVATIONS
export function getReservations(): Reservation[] {
  const data = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  if (!data) {
    const init = getInitialReservations();
    saveReservations(init);
    return init;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveReservations(res: Reservation[]): void {
  localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(res));
  notifyChange('reservations');
}

export function addReservation(reservation: Omit<Reservation, 'id' | 'code' | 'createdAt'>): Reservation {
  const reservations = getReservations();
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const code = `OQP-${randNum}`;
  const newRes: Reservation = {
    ...reservation,
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code,
    createdAt: new Date().toISOString(),
    smsSent: true,
    smsSentAt: new Date().toISOString(),
    smsPhone: reservation.customerPhone,
    smsMessage: `Qué Pasa: A sua mesa está confirmada! para ${reservation.date} às ${reservation.time} (${reservation.guests} pax, Mesa ${reservation.tableId}). Cais dos Mercantéis 14, Aveiro. Tolerância 20m. Tel: 234 424 208.`,
    emailSent: true,
    emailSentAt: new Date().toISOString(),
    emailAddress: reservation.customerEmail,
  };

  reservations.unshift(newRes);
  saveReservations(reservations);

  // Sync to customer CRM
  syncCustomerFromReservation(newRes);

  // Release any temporary holds for this table
  releaseTableHold(newRes.tableId);

  return newRes;
}

export function updateReservation(id: string, updates: Partial<Reservation>): Reservation | null {
  const reservations = getReservations();
  const index = reservations.findIndex(r => r.id === id);
  if (index === -1) return null;

  reservations[index] = { ...reservations[index], ...updates };
  saveReservations(reservations);
  return reservations[index];
}

export function deleteReservation(id: string): boolean {
  const reservations = getReservations();
  const filtered = reservations.filter(r => r.id !== id);
  if (filtered.length !== reservations.length) {
    saveReservations(filtered);
    return true;
  }
  return false;
}

export function getReservationByCodeAndPhone(code: string, phone: string): Reservation | null {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const cleanCode = code.trim().toUpperCase();

  const reservations = getReservations();
  return reservations.find(r => {
    const resCleanPhone = r.customerPhone.replace(/[\s\-\(\)]/g, '');
    return r.code.toUpperCase() === cleanCode && 
      (resCleanPhone.endsWith(cleanPhone) || cleanPhone.endsWith(resCleanPhone));
  }) || null;
}

// CUSTOMERS (CRM)
export function getCustomers(): CustomerProfile[] {
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
    return INITIAL_CUSTOMERS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_CUSTOMERS;
  }
}

export function saveCustomers(customers: CustomerProfile[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  notifyChange('customers');
}

export function updateCustomer(id: string, updates: Partial<CustomerProfile>): void {
  const customers = getCustomers();
  const updated = customers.map(c => c.id === id ? { ...c, ...updates } : c);
  saveCustomers(updated);
}

function syncCustomerFromReservation(res: Reservation) {
  const customers = getCustomers();
  const cleanPhone = res.customerPhone.replace(/[\s\-\(\)]/g, '');
  const existing = customers.find(c => c.phone.replace(/[\s\-\(\)]/g, '') === cleanPhone);

  const allergiesFromRequests = res.specialRequests
    .filter(req => req.toLowerCase().includes('alergia') || req.toLowerCase().includes('intolerância'));

  if (existing) {
    existing.visitsCount += 1;
    existing.lastVisit = res.date;
    if (allergiesFromRequests.length > 0) {
      existing.allergies = Array.from(new Set([...existing.allergies, ...allergiesFromRequests]));
    }
    saveCustomers(customers);
  } else {
    const newCust: CustomerProfile = {
      id: `cust-${Date.now()}`,
      name: res.customerName,
      phone: res.customerPhone,
      email: res.customerEmail,
      isVip: false,
      visitsCount: 1,
      noShowCount: 0,
      allergies: allergiesFromRequests,
      internalNotes: res.notes ? `Nota da reserva: ${res.notes}` : '',
      lastVisit: res.date,
      gdprConsentDate: new Date().toISOString(),
    };
    customers.push(newCust);
    saveCustomers(customers);
  }
}

// RGPD Delete Customer and Anonymize Data
export function deleteCustomerGdpr(phone: string): boolean {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const customers = getCustomers();
  const filtered = customers.filter(c => c.phone.replace(/[\s\-\(\)]/g, '') !== cleanPhone);
  saveCustomers(filtered);

  // Anonymize reservations
  const reservations = getReservations();
  const updated = reservations.map(r => {
    if (r.customerPhone.replace(/[\s\-\(\)]/g, '') === cleanPhone) {
      return {
        ...r,
        customerName: 'Cliente Anonimizado (RGPD)',
        customerPhone: '+351 000 000 000',
        customerEmail: 'anonimizado@rgpd.pt',
        specialRequests: [],
        notes: '',
        internalNotes: 'Dados apagados a pedido do titular dos dados.',
      };
    }
    return r;
  });
  saveReservations(updated);
  return true;
}

// WAITLIST
export function getWaitlist(): WaitlistEntry[] {
  const data = localStorage.getItem(STORAGE_KEYS.WAITLIST);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(INITIAL_WAITLIST));
    return INITIAL_WAITLIST;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_WAITLIST;
  }
}

export function saveWaitlist(entries: WaitlistEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(entries));
  notifyChange('waitlist');
}

export function addToWaitlist(entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'status'>): WaitlistEntry {
  const list = getWaitlist();
  const newEntry: WaitlistEntry = {
    ...entry,
    id: `wait-${Date.now()}`,
    status: 'em_espera',
    createdAt: new Date().toISOString(),
  };
  list.unshift(newEntry);
  saveWaitlist(list);
  return newEntry;
}

export function updateWaitlistStatus(id: string, status: WaitlistEntry['status']): void {
  const list = getWaitlist();
  const updated = list.map(e => e.id === id ? { ...e, status } : e);
  saveWaitlist(updated);
}

// SETTINGS
export function getSettings(): RestaurantSettings {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_SETTINGS;
  }
}

export function saveSettings(settings: RestaurantSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  notifyChange('settings');
}

// TEMPORARY TABLE HOLDS (5-minute checkout lock)
export function getTableHolds(): TemporaryTableHold[] {
  const now = Date.now();
  const raw = localStorage.getItem(STORAGE_KEYS.HOLDS);
  if (!raw) return [];
  try {
    const list: TemporaryTableHold[] = JSON.parse(raw);
    // filter expired holds
    const valid = list.filter(h => h.expiresAt > now);
    if (valid.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.HOLDS, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function setTableHold(tableId: number, date: string, time: string, sessionId: string): TemporaryTableHold {
  const holds = getTableHolds().filter(h => h.tableId !== tableId);
  const newHold: TemporaryTableHold = {
    tableId,
    date,
    time,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    sessionId,
  };
  holds.push(newHold);
  localStorage.setItem(STORAGE_KEYS.HOLDS, JSON.stringify(holds));
  notifyChange('holds');
  return newHold;
}

export function releaseTableHold(tableId: number): void {
  const holds = getTableHolds().filter(h => h.tableId !== tableId);
  localStorage.setItem(STORAGE_KEYS.HOLDS, JSON.stringify(holds));
  notifyChange('holds');
}

// TIME CONVERSIONS
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getDurationForGuests(_guests: number): number {
  return 90; // Fixed 90-minute shifts
}

// AVAILABILITY LOGIC
export function isTableAvailable(
  tableId: number,
  date: string,
  time: string,
  durationMin: number,
  sessionId?: string,
  excludeResId?: string
): boolean {
  const tables = getTables();
  const table = tables.find(t => t.id === tableId);
  if (!table || !table.isActive) return false;

  const targetStart = timeToMinutes(time);
  const settings = getSettings();
  const buffer = settings.cleaningBufferMinutes;
  const targetEnd = targetStart + durationMin + buffer;

  // Check 5-minute checkout hold
  const holds = getTableHolds();
  const activeHold = holds.find(h => 
    h.tableId === tableId && 
    h.date === date && 
    Math.abs(timeToMinutes(h.time) - targetStart) < 60 &&
    (!sessionId || h.sessionId !== sessionId)
  );
  if (activeHold) {
    return false;
  }

  // Check overlapping reservations
  const reservations = getReservations();
  const activeReservations = reservations.filter(r => 
    r.date === date &&
    (r.tableId === tableId || r.joinedTableId === tableId) &&
    r.status !== 'cancelada' &&
    r.status !== 'noshow' &&
    r.id !== excludeResId
  );

  for (const res of activeReservations) {
    const resStart = timeToMinutes(res.time);
    const resEnd = resStart + res.durationMinutes + buffer;

    // Overlap condition: startA < endB && startB < endA
    if (targetStart < resEnd && resStart < targetEnd) {
      return false;
    }
  }

  return true;
}

// GET AVAILABLE TIME SLOTS FOR A DATE AND GUESTS
export function getAvailableSlots(date: string, guests: number): {
  lunchSlots: string[];
  dinnerSlots: string[];
} {
  const settings = getSettings();
  const targetDate = new Date(date + 'T12:00:00');
  const dayOfWeek = targetDate.getDay();
  const daySched = settings.schedule.find(s => s.dayOfWeek === dayOfWeek);

  if (!daySched || !daySched.isOpen || settings.closedDates.includes(date)) {
    return { lunchSlots: [], dinnerSlots: [] };
  }

  const durationMin = getDurationForGuests(guests);
  const tables = getTables();

  const generateSlots = (startStr: string, endStr: string): string[] => {
    const slots: string[] = [];
    const startMins = timeToMinutes(startStr);
    const endMins = timeToMinutes(endStr) - durationMin; // Last seating must fit before closing

    for (let m = startMins; m <= endMins; m += 30) {
      const slotTime = minutesToTime(m);
      // Check if any suitable table is free
      const hasFreeTable = tables.some(t => {
        if (!t.isActive) return false;
        if (t.capacity < guests) return false;
        // Don't waste a huge table for 1-2 pax if avoidable, but allowed if free
        return isTableAvailable(t.id, date, slotTime, durationMin);
      });

      if (hasFreeTable) {
        slots.push(slotTime);
      }
    }
    return slots;
  };

  return {
    lunchSlots: generateSlots(daySched.lunchStart, daySched.lunchEnd),
    dinnerSlots: generateSlots(daySched.dinnerStart, daySched.dinnerEnd),
  };
}

// SMART AUTO-ASSIGNMENT (FIND BEST TABLE)
export function findBestTable(date: string, time: string, guests: number, sessionId?: string): RestaurantTable | null {
  const durationMin = getDurationForGuests(guests);
  const tables = getTables().filter(t => t.isActive);

  // Filter tables with enough capacity
  const eligible = tables.filter(t => t.capacity >= guests && isTableAvailable(t.id, date, time, durationMin, sessionId));

  if (eligible.length === 0) {
    // If party is large (>4) and no single table fits, check if we can join two neighboring tables
    if (guests > 4) {
      // Try adjacent pairs e.g. (3 & 4), (5 & 6), (7 & 8), (9 & 10), (11 & 12)
      const pairs = [[3, 4], [5, 6], [7, 8], [9, 10], [11, 12]];
      for (const [idA, idB] of pairs) {
        const tA = tables.find(t => t.id === idA);
        const tB = tables.find(t => t.id === idB);
        if (tA && tB && (tA.capacity + tB.capacity >= guests)) {
          if (isTableAvailable(idA, date, time, durationMin, sessionId) && 
              isTableAvailable(idB, date, time, durationMin, sessionId)) {
            return tA; // Table A will be primary, Table B joined
          }
        }
      }
    }
    return null;
  }

  // Sort by smallest capacity >= guests (least seat wastage), then by preference for window section
  eligible.sort((a, b) => {
    const diffA = a.capacity - guests;
    const diffB = b.capacity - guests;
    if (diffA !== diffB) return diffA - diffB;
    if (a.section === 'janela' && b.section !== 'janela') return -1;
    if (b.section === 'janela' && a.section !== 'janela') return 1;
    return a.number - b.number;
  });

  return eligible[0];
}

// GET LIVE STATUS OF A TABLE FOR TODAY AT A SPECIFIC TIME
export function getTableCurrentState(
  tableId: number,
  date: string,
  timeStr: string
): { status: TableStatus; currentReservation?: Reservation } {
  const reservations = getReservations().filter(r => 
    r.date === date && 
    (r.tableId === tableId || r.joinedTableId === tableId) &&
    r.status !== 'cancelada' &&
    r.status !== 'noshow'
  );

  const checkMins = timeToMinutes(timeStr);
  const settings = getSettings();
  const buffer = settings.cleaningBufferMinutes;

  for (const res of reservations) {
    const start = timeToMinutes(res.time);
    const end = start + res.durationMinutes;
    const cleaningEnd = end + buffer;

    // Inside seating window
    if (checkMins >= start - 15 && checkMins < end) {
      if (res.status === 'sentada') {
        return { status: 'sentada', currentReservation: res };
      }
      if (res.status === 'chegou') {
        return { status: 'chegou', currentReservation: res };
      }
      return { status: 'reservada', currentReservation: res };
    }

    // In cleaning period
    if (checkMins >= end && checkMins < cleaningEnd) {
      return { status: 'a_limpar', currentReservation: res };
    }
  }

  // Check 5-min holds
  const holds = getTableHolds();
  const hold = holds.find(h => h.tableId === tableId && h.date === date);
  if (hold) {
    return { status: 'bloqueada' };
  }

  return { status: 'livre' };
}

// GENERATE ICALENDAR (.ICS) FILE
export function generateIcsFile(res: Reservation): void {
  const dateFormatted = res.date.replace(/-/g, '');
  const [h, m] = res.time.split(':').map(Number);
  const startHours = String(h).padStart(2, '0');
  const startMins = String(m).padStart(2, '0');

  const startTotalMinutes = h * 60 + m;
  const endTotalMinutes = startTotalMinutes + res.durationMinutes;
  const endHours = String(Math.floor(endTotalMinutes / 60)).padStart(2, '0');
  const endMins = String(endTotalMinutes % 60).padStart(2, '0');

  const dtStart = `${dateFormatted}T${startHours}${startMins}00`;
  const dtEnd = `${dateFormatted}T${endHours}${endMins}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Qué Pasa//Sistema de Reservas//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:res-${res.code}@quepasa.pt`,
    `DTSTAMP:${dateFormatted}T000000Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Reserva em Qué Pasa (${res.guests} pax)`,
    `DESCRIPTION:Reserva confirmada no restaurante Qué Pasa.\\nCódigo: ${res.code}\\nMesa nº: ${res.tableId}\\nPessoas: ${res.guests}\\nPedidos: ${res.specialRequests.join(', ') || 'Nenhum'}`,
    'LOCATION:Cais dos Mercantéis\\, nº 14\\, 3800-228 Aveiro\\, Portugal',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `reserva-${res.code}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// EXPORT RESERVATIONS TO CSV
export function exportReservationsToCsv(): void {
  const reservations = getReservations();
  const headers = ['Código', 'Data', 'Hora', 'Pessoas', 'Mesa', 'Nome Cliente', 'Telemóvel', 'Email', 'Estado', 'Pedidos Especiais', 'Notas'];
  
  const rows = reservations.map(r => [
    r.code,
    r.date,
    r.time,
    r.guests,
    `Mesa ${r.tableId}${r.joinedTableId ? ` + ${r.joinedTableId}` : ''}`,
    `"${r.customerName.replace(/"/g, '""')}"`,
    r.customerPhone,
    r.customerEmail,
    r.status.toUpperCase(),
    `"${r.specialRequests.join('; ').replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `reservas-que-pasa-${getTodayStr()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// RESET TO FACTORY DEMO DATA
export function resetFactoryDemoData(): void {
  saveTables(INITIAL_TABLES);
  saveReservations(getInitialReservations());
  saveCustomers(INITIAL_CUSTOMERS);
  saveWaitlist(INITIAL_WAITLIST);
  saveSettings(INITIAL_SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.HOLDS);
  notifyChange('all');
}
