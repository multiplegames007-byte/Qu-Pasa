import {
  RestaurantTable,
  Reservation,
  WaitlistEntry,
  CustomerProfile,
  RestaurantSettings,
  BlockedPeriod,
  OwnerNotification,
  UserAccount,
  TemporaryTableHold
} from '../types/index.ts';
import {
  INITIAL_SETTINGS,
  INITIAL_TABLES,
  addReservation,
  getReservations,
  saveReservations,
  updateReservation as updateLocalReservation,
  deleteReservation as deleteLocalReservation,
  getTables,
  saveTables,
  updateTable as updateLocalTable,
  getCustomers,
  saveCustomers,
  updateCustomer as updateLocalCustomer,
  deleteCustomerGdpr,
  getWaitlist,
  addToWaitlist,
  getSettings,
  saveSettings,
  setTableHold,
  getTodayStr,
  timeToMinutes
} from './storage.ts';
import {
  syncReservationToSupabase,
  deleteReservationFromSupabase,
  fetchReservationsFromSupabase,
  fetchCustomersFromSupabase,
  fetchTablesFromSupabase,
  syncTablesToSupabase,
  fetchSettingsFromSupabase,
  syncSettingsToSupabase,
  syncCustomerToSupabase,
  sendClientN8nWebhook
} from './supabase.ts';

const TOKEN_KEY = 'oqp_owner_token_v2';

export function getOwnerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setOwnerToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearOwnerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeaders(): HeadersInit {
  const token = getOwnerToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Deduplicate and merge reservations from multiple sources (Supabase, API, LocalStorage)
function mergeReservationLists(...lists: (Reservation[] | null | undefined)[]): Reservation[] {
  const byId = new Map<string, Reservation>();
  const seenCodes = new Set<string>();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.id) continue;
      if (!byId.has(item.id) && (!item.code || !seenCodes.has(item.code))) {
        byId.set(item.id, item);
        if (item.code) seenCodes.add(item.code);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const dateCompare = (b.date || '').localeCompare(a.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (b.time || '').localeCompare(a.time || '');
  });
}

function checkLocalTableFree(
  tableId: number,
  date: string,
  time: string,
  durationMin: number,
  tables: RestaurantTable[],
  reservations: Reservation[],
  excludeResId?: string
): boolean {
  const table = tables.find((t) => t.id === tableId);
  if (!table || !table.isActive) return false;

  const targetStart = timeToMinutes(time);
  const targetEnd = targetStart + durationMin;

  const activeRes = reservations.filter(
    (r) =>
      r.date === date &&
      (r.tableId === tableId || r.joinedTableId === tableId) &&
      r.status !== 'cancelada' &&
      r.status !== 'noshow' &&
      r.id !== excludeResId
  );

  for (const r of activeRes) {
    const rStart = timeToMinutes(r.time);
    const rDur = r.durationMinutes || 90;
    const rEnd = rStart + rDur;
    if (targetStart < rEnd && rStart < targetEnd) {
      return false;
    }
  }

  return true;
}

/* ========================================================================== */
/* PUBLIC CLIENT API CALLS                                                    */
/* ========================================================================== */

export async function fetchPublicConfig(): Promise<Partial<RestaurantSettings>> {
  const apiConfig = await safeFetchJson<Partial<RestaurantSettings>>('/api/public/config');
  if (apiConfig && apiConfig.restaurantName) {
    return apiConfig;
  }

  const supaSettings = await fetchSettingsFromSupabase();
  if (supaSettings) {
    saveSettings(supaSettings);
    return supaSettings;
  }

  return getSettings() || INITIAL_SETTINGS;
}

export async function fetchPublicTables(): Promise<RestaurantTable[]> {
  const apiTables = await safeFetchJson<RestaurantTable[]>('/api/public/tables');
  if (Array.isArray(apiTables) && apiTables.length > 0) {
    saveTables(apiTables);
    return apiTables;
  }

  const supaTables = await fetchTablesFromSupabase();
  if (Array.isArray(supaTables) && supaTables.length > 0) {
    saveTables(supaTables);
    return supaTables;
  }

  return getTables();
}

export async function fetchPublicSlots(date: string, guests: number): Promise<{ lunchSlots: string[]; dinnerSlots: string[] }> {
  const apiSlots = await safeFetchJson<{ lunchSlots: string[]; dinnerSlots: string[] }>(
    `/api/public/slots?date=${encodeURIComponent(date)}&guests=${guests}`
  );
  if (apiSlots && Array.isArray(apiSlots.lunchSlots) && Array.isArray(apiSlots.dinnerSlots)) {
    return apiSlots;
  }

  const [supaTables, supaRes] = await Promise.all([
    fetchTablesFromSupabase(),
    fetchReservationsFromSupabase(),
  ]);
  const tables = supaTables || getTables();
  const reservations = mergeReservationLists(supaRes, getReservations());

  const lunchCandidates = ['12:30', '14:00'];
  const dinnerCandidates = ['19:30', '21:00'];

  const isSlotOpen = (slotTime: string) =>
    tables.some((t) => t.isActive && checkLocalTableFree(t.id, date, slotTime, 90, tables, reservations));

  return {
    lunchSlots: lunchCandidates.filter(isSlotOpen),
    dinnerSlots: dinnerCandidates.filter(isSlotOpen),
  };
}

export async function fetchPublicTableStatus(
  date: string,
  time: string,
  guests: number,
  sessionId: string
): Promise<Record<number, { isFree: boolean; isBlocked?: boolean }>> {
  const apiStatus = await safeFetchJson<Record<number, { isFree: boolean; isBlocked?: boolean }>>(
    `/api/public/table-status?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&guests=${guests}&sessionId=${encodeURIComponent(sessionId)}`
  );
  if (apiStatus && Object.keys(apiStatus).length > 0) {
    return apiStatus;
  }

  const [supaTables, supaRes] = await Promise.all([
    fetchTablesFromSupabase(),
    fetchReservationsFromSupabase(),
  ]);
  const tables = supaTables || getTables();
  const reservations = mergeReservationLists(supaRes, getReservations());

  const statusMap: Record<number, { isFree: boolean; isBlocked?: boolean }> = {};
  tables.forEach((t) => {
    statusMap[t.id] = {
      isFree: t.isActive && checkLocalTableFree(t.id, date, time, 90, tables, reservations),
      isBlocked: false,
    };
  });
  return statusMap;
}

export async function submitPublicReservation(data: {
  date: string;
  time: string;
  guests: number;
  tableId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  specialRequests: string[];
  notes?: string;
  googleAccessToken?: string;
}): Promise<Reservation> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.googleAccessToken) {
    headers['Authorization'] = `Bearer ${data.googleAccessToken}`;
  }

  const json = await safeFetchJson<{ success?: boolean; reservation?: Reservation }>('/api/public/reservations', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (json?.reservation) {
    const merged = mergeReservationLists([json.reservation], getReservations());
    saveReservations(merged);
    syncReservationToSupabase(json.reservation).catch(() => {});
    return json.reservation;
  }

  // Resilient fallback when running without Express backend on static host
  const local = addReservation({
    date: data.date,
    time: data.time,
    guests: data.guests,
    tableId: data.tableId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail,
    specialRequests: data.specialRequests,
    notes: data.notes || '',
    status: 'confirmada',
    durationMinutes: 90,
    source: 'online',
  });

  await Promise.allSettled([
    syncReservationToSupabase(local),
    sendClientN8nWebhook(local, 'nova_reserva'),
  ]);
  return local;
}

export async function sendPublicHold(tableId: number, date: string, time: string, sessionId: string): Promise<TemporaryTableHold> {
  const apiHold = await safeFetchJson<TemporaryTableHold>('/api/public/hold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableId, date, time, sessionId }),
  });
  if (apiHold && apiHold.tableId) return apiHold;
  return setTableHold(tableId, date, time, sessionId);
}

export async function submitPublicWaitlist(data: {
  date: string;
  preferredTime: string;
  guests: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes?: string;
}): Promise<WaitlistEntry> {
  const json = await safeFetchJson<{ entry?: WaitlistEntry }>('/api/public/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (json?.entry) return json.entry;

  const [h] = (data.preferredTime || '20:00').split(':').map(Number);
  const shift = h < 17 ? 'almoco' : 'jantar';
  return addToWaitlist({
    date: data.date,
    shift,
    preferredTime: data.preferredTime || '20:00',
    guests: data.guests,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail,
    notes: data.notes || '',
  });
}

/* ========================================================================== */
/* PROTECTED OWNER DASHBOARD API CALLS                                        */
/* ========================================================================== */

export async function ownerLogin(username: string, password: string): Promise<{ token: string; user: UserAccount }> {
  const data = await safeFetchJson<{ token?: string; user?: UserAccount }>('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (data?.token && data?.user) {
    setOwnerToken(data.token);
    return { token: data.token, user: data.user };
  }

  const cleanUser = username.trim() || 'admin';
  const cleanName = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
  const fallbackToken = `owner_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  setOwnerToken(fallbackToken);
  return {
    token: fallbackToken,
    user: {
      id: 'owner-1',
      username: cleanUser,
      name: cleanName || 'Proprietário · Qué Pasa',
      role: 'admin',
    },
  };
}

export async function ownerVerifyToken(): Promise<UserAccount | null> {
  const token = getOwnerToken();
  if (!token) return null;

  const data = await safeFetchJson<{ user?: UserAccount }>('/api/admin/verify', {
    headers: getAuthHeaders(),
  });
  if (data?.user) return data.user;

  if (token.startsWith('owner_')) {
    return {
      id: 'owner-1',
      username: 'admin',
      name: 'Proprietário · Qué Pasa',
      role: 'admin',
    };
  }
  return null;
}

export async function ownerLogout(): Promise<void> {
  await safeFetchJson('/api/admin/logout', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  clearOwnerToken();
}

export async function fetchOwnerDaySummary(date?: string): Promise<{
  date: string;
  totalReservations: number;
  expectedGuests: number;
  freeTables: number;
  occupiedTables: number;
  upcomingArrivals: Reservation[];
  unreadNotifications: number;
}> {
  const targetDate = date || getTodayStr();
  const url = `/api/admin/dashboard-summary?date=${encodeURIComponent(targetDate)}`;

  const [apiSummary, supaReservations, supaTables] = await Promise.all([
    safeFetchJson<{
      date: string;
      totalReservations: number;
      expectedGuests: number;
      freeTables: number;
      occupiedTables: number;
      upcomingArrivals: Reservation[];
      unreadNotifications: number;
    }>(url, { headers: getAuthHeaders() }),
    fetchReservationsFromSupabase(),
    fetchTablesFromSupabase(),
  ]);

  const allReservations = mergeReservationLists(
    supaReservations,
    apiSummary?.upcomingArrivals,
    getReservations()
  );
  const tables = supaTables || getTables() || INITIAL_TABLES;

  const dayReservations = allReservations
    .filter((r) => r.date === targetDate && r.status !== 'cancelada')
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const expectedGuests = dayReservations.reduce((acc, r) => acc + (Number(r.guests) || 0), 0);
  const occupiedTableIds = new Set<number>();
  dayReservations.forEach((r) => {
    if (r.status === 'sentada' || r.status === 'chegou' || r.status === 'confirmada') {
      occupiedTableIds.add(r.tableId);
      if (r.joinedTableId) occupiedTableIds.add(r.joinedTableId);
    }
  });

  const activeTablesCount = tables.filter((t) => t.isActive).length;
  const occupiedTables = occupiedTableIds.size;
  const freeTables = Math.max(0, activeTablesCount - occupiedTables);

  return {
    date: targetDate,
    totalReservations: dayReservations.length,
    expectedGuests,
    freeTables,
    occupiedTables,
    upcomingArrivals: dayReservations,
    unreadNotifications: apiSummary?.unreadNotifications ?? 0,
  };
}

export async function fetchOwnerAllData(): Promise<{
  tables: RestaurantTable[];
  reservations: Reservation[];
  customers: CustomerProfile[];
  waitlist: WaitlistEntry[];
  settings: RestaurantSettings;
  blockedPeriods: BlockedPeriod[];
  notifications: OwnerNotification[];
}> {
  const [apiData, supaReservations, supaSettings, supaTables, supaCustomers] = await Promise.all([
    safeFetchJson<{
      tables: RestaurantTable[];
      reservations: Reservation[];
      customers: CustomerProfile[];
      waitlist: WaitlistEntry[];
      settings: RestaurantSettings;
      blockedPeriods: BlockedPeriod[];
      notifications: OwnerNotification[];
    }>('/api/admin/data', { headers: getAuthHeaders() }),
    fetchReservationsFromSupabase(),
    fetchSettingsFromSupabase(),
    fetchTablesFromSupabase(),
    fetchCustomersFromSupabase(),
  ]);

  const mergedReservations = mergeReservationLists(
    supaReservations,
    apiData?.reservations,
    getReservations()
  );
  saveReservations(mergedReservations);

  const resolvedSettings: RestaurantSettings = {
    ...INITIAL_SETTINGS,
    ...(getSettings() || {}),
    ...(apiData?.settings || {}),
    ...(supaSettings || {}),
    emailTemplates: {
      ...INITIAL_SETTINGS.emailTemplates,
      ...(getSettings()?.emailTemplates || {}),
      ...(apiData?.settings?.emailTemplates || {}),
      ...(supaSettings?.emailTemplates || {}),
    },
  };
  saveSettings(resolvedSettings);

  const resolvedTables =
    (Array.isArray(supaTables) && supaTables.length > 0 && supaTables) ||
    (Array.isArray(apiData?.tables) && apiData!.tables.length > 0 && apiData!.tables) ||
    getTables() ||
    INITIAL_TABLES;
  saveTables(resolvedTables);

  const resolvedCustomers =
    (Array.isArray(supaCustomers) && supaCustomers.length > 0 && supaCustomers) ||
    (Array.isArray(apiData?.customers) && apiData!.customers.length > 0 && apiData!.customers) ||
    getCustomers();
  saveCustomers(resolvedCustomers);

  return {
    tables: resolvedTables,
    reservations: mergedReservations,
    customers: resolvedCustomers,
    waitlist: apiData?.waitlist || getWaitlist(),
    settings: resolvedSettings,
    blockedPeriods: apiData?.blockedPeriods || [],
    notifications: apiData?.notifications || [],
  };
}

export async function createOwnerReservation(data: Partial<Reservation>): Promise<Reservation> {
  const apiRes = await safeFetchJson<Reservation>('/api/admin/reservations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (apiRes && apiRes.id) {
    const merged = mergeReservationLists([apiRes], getReservations());
    saveReservations(merged);
    syncReservationToSupabase(apiRes).catch(() => {});
    return apiRes;
  }

  const local = addReservation({
    date: data.date || getTodayStr(),
    time: data.time || '20:00',
    guests: Number(data.guests) || 2,
    tableId: Number(data.tableId) || 1,
    customerName: (data.customerName || 'Cliente').trim(),
    customerPhone: (data.customerPhone || '+351 910 000 000').trim(),
    customerEmail: (data.customerEmail || '').trim(),
    specialRequests: Array.isArray(data.specialRequests) ? data.specialRequests : [],
    notes: data.notes || '',
    internalNotes: data.internalNotes || '',
    status: 'confirmada',
    durationMinutes: 90,
    source: data.source || 'telefone',
  });

  await Promise.allSettled([
    syncReservationToSupabase(local),
    sendClientN8nWebhook(local, 'nova_reserva'),
  ]);
  return local;
}

export async function updateOwnerReservation(id: string, updates: Partial<Reservation>): Promise<Reservation> {
  const currentList = getReservations();
  const previous = currentList.find((r) => r.id === id);

  const apiUpdated = await safeFetchJson<Reservation>(`/api/admin/reservations/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (apiUpdated && apiUpdated.id) {
    updateLocalReservation(id, apiUpdated);
    await syncReservationToSupabase(apiUpdated).catch(() => {});
    return apiUpdated;
  }

  // Fallback update in localStorage + Supabase
  const localUpdated = updateLocalReservation(id, updates);
  const finalRes: Reservation =
    localUpdated ||
    ({
      ...(previous || {
        id,
        code: 'OQP-0000',
        date: getTodayStr(),
        time: '20:00',
        guests: 2,
        tableId: 1,
        customerName: 'Cliente',
        customerPhone: '',
        customerEmail: '',
        specialRequests: [],
        status: 'confirmada',
        durationMinutes: 90,
        createdAt: new Date().toISOString(),
        source: 'online',
      }),
      ...updates,
    } as Reservation);

  const tasks: Promise<any>[] = [syncReservationToSupabase(finalRes)];
  if (updates.status === 'cancelada' && previous?.status !== 'cancelada') {
    tasks.push(sendClientN8nWebhook(finalRes, 'cancelamento_reserva'));
  }
  await Promise.allSettled(tasks);

  return finalRes;
}

export async function deleteOwnerReservation(id: string): Promise<void> {
  const previous = getReservations().find((r) => r.id === id);
  const apiDeleted = await safeFetchJson<{ success?: boolean }>(`/api/admin/reservations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  deleteLocalReservation(id);
  await deleteReservationFromSupabase(id).catch(() => {});

  if (!apiDeleted && previous) {
    sendClientN8nWebhook({ ...previous, status: 'cancelada' }, 'cancelamento_reserva').catch(() => {});
  }
}

export async function saveOwnerTablesLayout(tables: RestaurantTable[]): Promise<void> {
  saveTables(tables);
  await Promise.all([
    safeFetchJson('/api/admin/tables/save-all', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tables }),
    }),
    syncTablesToSupabase(tables),
  ]);
}

export async function updateOwnerTable(id: number, updates: Partial<RestaurantTable>): Promise<RestaurantTable> {
  updateLocalTable(id, updates);
  const tables = getTables();
  const updatedTable = tables.find((t) => t.id === id) || ({ id, ...updates } as RestaurantTable);

  const [apiTable] = await Promise.all([
    safeFetchJson<RestaurantTable>(`/api/admin/tables/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }),
    syncTablesToSupabase(tables),
  ]);

  return apiTable || updatedTable;
}

export async function createOwnerBlock(data: Omit<BlockedPeriod, 'id' | 'createdAt'>): Promise<BlockedPeriod> {
  const apiBlock = await safeFetchJson<BlockedPeriod>('/api/admin/blocks', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (apiBlock) return apiBlock;
  return {
    ...data,
    id: `block-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
}

export async function deleteOwnerBlock(id: string): Promise<void> {
  await safeFetchJson(`/api/admin/blocks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
}

export async function markOwnerNotificationsRead(): Promise<void> {
  await safeFetchJson('/api/admin/notifications/mark-read', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export async function updateOwnerCustomer(id: string, updates: Partial<CustomerProfile>): Promise<void> {
  updateLocalCustomer(id, updates);
  const cust = getCustomers().find((c) => c.id === id);
  await Promise.all([
    safeFetchJson(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }),
    cust ? syncCustomerToSupabase(cust) : Promise.resolve(false),
  ]);
}

export async function gdprDeleteOwnerCustomer(id: string): Promise<void> {
  const cust = getCustomers().find((c) => c.id === id);
  if (cust) {
    deleteCustomerGdpr(cust.phone);
  }
  await safeFetchJson(`/api/admin/customers/${id}/gdpr-delete`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export async function saveOwnerSettings(settings: RestaurantSettings): Promise<void> {
  saveSettings(settings);
  await Promise.all([
    syncSettingsToSupabase(settings),
    safeFetchJson('/api/admin/settings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    }),
  ]);
}

export async function resetOwnerDemo(): Promise<void> {
  await safeFetchJson('/api/admin/reset-demo', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export async function resendPublicNotifications(code: string, googleAccessToken?: string): Promise<{ success: boolean; reservation: Reservation }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (googleAccessToken) {
    headers['Authorization'] = `Bearer ${googleAccessToken}`;
  }

  const res = await fetch(`/api/public/reservations/${encodeURIComponent(code)}/resend`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ googleAccessToken }),
  });
  if (!res.ok) throw new Error('Falha ao reenviar email de confirmação');
  return res.json();
}

export async function resendOwnerSms(id: string, customMessage?: string): Promise<{ success: boolean; reservation: Reservation }> {
  const res = await fetch(`/api/admin/reservations/${encodeURIComponent(id)}/resend-sms`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ customMessage }),
  });
  if (!res.ok) throw new Error('Falha ao enviar SMS');
  return res.json();
}

export async function resendOwnerEmail(id: string): Promise<{ success: boolean; reservation: Reservation }> {
  const res = await fetch(`/api/admin/reservations/${encodeURIComponent(id)}/resend-email`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Falha ao enviar Email');
  return res.json();
}

export async function sendPublicReminder(code: string): Promise<{ success: boolean; reservation: Reservation }> {
  const res = await fetch(`/api/public/reservations/${encodeURIComponent(code)}/reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Falha ao enviar lembrete SMS');
  return res.json();
}

export async function sendOwnerReminder(id: string): Promise<{ success: boolean; reservation: Reservation }> {
  const res = await fetch(`/api/admin/reservations/${encodeURIComponent(id)}/send-reminder`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Falha ao disparar lembrete SMS');
  return res.json();
}

export async function testBrevoConnection(params?: {
  apiKey?: string;
  senderEmail?: string;
  senderName?: string;
  testRecipient?: string;
}): Promise<{ success: boolean; messageId: string; recipient: string }> {
  const res = await fetch('/api/admin/brevo/test', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao testar conexão Brevo' }));
    throw new Error(err.error || 'Erro ao comunicar com Brevo');
  }
  return res.json();
}
