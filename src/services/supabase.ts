import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Reservation, CustomerProfile, RestaurantTable, RestaurantSettings } from '../types/index.ts';
import { INITIAL_SETTINGS, getSettings } from './storage.ts';

// Default provided Supabase credentials (can also be overridden via Vite env vars)
export const DEFAULT_SUPABASE_URL = 'https://vuyzzmjjbedkuqxjzayr.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Id4n8Ocw1pa45B3uvb_1kg_CZt99b4m';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_ANON_KEY;

// Create singleton Supabase Client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// SQL Script to create tables in Supabase SQL Editor
export const SUPABASE_SETUP_SQL = `-- ============================================================================
-- QUÉ PASA · ESTRUTURA DE BASE DE DADOS SUPABASE (POSTGRESQL)
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Tabela de Reservas
CREATE TABLE IF NOT EXISTS public.reservations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  guests INTEGER NOT NULL DEFAULT 2,
  table_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  special_requests TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT DEFAULT '',
  internal_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmada',
  duration_minutes INTEGER DEFAULT 90,
  source TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Clientes (CRM)
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT DEFAULT '',
  is_vip BOOLEAN DEFAULT false,
  visits_count INTEGER DEFAULT 1,
  no_show_count INTEGER DEFAULT 0,
  allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
  internal_notes TEXT DEFAULT '',
  last_visit TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Mesas do Restaurante
CREATE TABLE IF NOT EXISTS public.tables (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  radius INTEGER DEFAULT 48,
  is_active BOOLEAN DEFAULT true,
  section TEXT DEFAULT 'sala',
  joined_with_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. Tabela de Configurações
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. Ativar Row Level Security (RLS) e Políticas Abertas para Anon Key
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público reservas" ON public.reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público clientes" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público mesas" ON public.tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público configurações" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- 6. Inserir as 12 Mesas Oficiais do Qué Pasa
INSERT INTO public.tables (id, number, capacity, x, y, radius, is_active, section)
VALUES
  (1, 1, 5, 120, 130, 58, true, 'janela'),
  (2, 2, 3, 120, 290, 52, true, 'janela'),
  (3, 3, 3, 120, 450, 52, true, 'janela'),
  (4, 4, 2, 280, 130, 46, true, 'janela'),
  (5, 5, 2, 320, 290, 46, true, 'sala'),
  (6, 6, 2, 320, 450, 46, true, 'sala'),
  (7, 7, 2, 510, 230, 46, true, 'sala'),
  (8, 8, 2, 510, 390, 46, true, 'sala'),
  (9, 9, 2, 690, 210, 46, true, 'sala'),
  (10, 10, 5, 690, 370, 58, true, 'sala'),
  (11, 11, 2, 860, 190, 46, true, 'balcao'),
  (12, 12, 3, 860, 350, 52, true, 'balcao')
ON CONFLICT (id) DO NOTHING;
`;

// Helper: Test connection to Supabase
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  hasTables: boolean;
  message: string;
  details?: Record<string, boolean>;
}> {
  try {
    // Probe a query to verify authentication and connectivity
    const probe = await supabase.from('reservations').select('count', { count: 'exact', head: true });

    // If error is PGRST205 or message has 'schema cache', the connection and anon key are authorized
    const isTableMissing = probe.error?.code === 'PGRST205' || probe.error?.message?.includes('schema cache');
    const isConnected = !probe.error || isTableMissing;

    if (!isConnected) {
      return {
        connected: false,
        hasTables: false,
        message: probe.error ? `Erro no Supabase: ${probe.error.message}` : 'Falha ao contactar o Supabase.',
      };
    }

    // Check individual tables
    const checkTable = async (name: string) => {
      const { error } = await supabase.from(name).select('count', { count: 'exact', head: true });
      return !error;
    };

    const [hasReservations, hasCustomers, hasTables] = await Promise.all([
      checkTable('reservations'),
      checkTable('customers'),
      checkTable('tables'),
    ]);

    const anyTableExists = hasReservations || hasCustomers || hasTables;

    return {
      connected: true,
      hasTables: anyTableExists,
      message: anyTableExists
        ? 'Conexão ao Supabase ativa e tabelas prontas!'
        : 'Conexão ao Supabase ativa! Execute o script SQL no Supabase para criar as tabelas.',
      details: {
        reservations: hasReservations,
        customers: hasCustomers,
        tables: hasTables,
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      hasTables: false,
      message: err?.message || 'Falha ao contactar o Supabase.',
    };
  }
}

// Convert Reservation from App model to Supabase row
function toSupabaseReservationRow(res: Reservation) {
  return {
    id: res.id,
    code: res.code,
    date: res.date,
    time: res.time,
    guests: res.guests,
    table_id: res.tableId,
    customer_name: res.customerName,
    customer_phone: res.customerPhone,
    customer_email: res.customerEmail || '',
    special_requests: res.specialRequests || [],
    notes: res.notes || '',
    internal_notes: res.internalNotes || '',
    status: res.status,
    duration_minutes: res.durationMinutes || 90,
    source: res.source || 'online',
    created_at: res.createdAt || new Date().toISOString(),
  };
}

// Convert Supabase row to Reservation
function fromSupabaseReservationRow(row: any): Reservation {
  return {
    id: row.id,
    code: row.code,
    date: row.date,
    time: row.time,
    guests: row.guests,
    tableId: row.table_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email || '',
    specialRequests: Array.isArray(row.special_requests) ? row.special_requests : [],
    notes: row.notes || '',
    internalNotes: row.internal_notes || '',
    status: row.status,
    durationMinutes: row.duration_minutes || 90,
    source: row.source || 'online',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// Sync single reservation to Supabase (non-blocking)
export async function syncReservationToSupabase(reservation: Reservation): Promise<boolean> {
  try {
    const row = toSupabaseReservationRow(reservation);
    const { error } = await supabase.from('reservations').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[SUPABASE SYNC NOTICE] Reservas:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[SUPABASE SYNC EXCEPTION]', e);
    return false;
  }
}

// Sync customer to Supabase
export async function syncCustomerToSupabase(customer: CustomerProfile): Promise<boolean> {
  try {
    const row = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      is_vip: Boolean(customer.isVip),
      visits_count: customer.visitsCount || 1,
      no_show_count: customer.noShowCount || 0,
      allergies: customer.allergies || [],
      internal_notes: customer.internalNotes || '',
      last_visit: customer.lastVisit || '',
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('customers').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[SUPABASE SYNC CUSTOMER NOTICE]', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Bulk sync all local reservations and customers to Supabase
export async function bulkSyncAllToSupabase(
  reservations: Reservation[],
  customers: CustomerProfile[],
  settings?: RestaurantSettings | null
): Promise<{ success: boolean; syncedReservations: number; syncedCustomers: number; message: string }> {
  let syncedReservations = 0;
  let syncedCustomers = 0;

  try {
    if (reservations.length > 0) {
      const rows = reservations.map(toSupabaseReservationRow);
      const { error } = await supabase.from('reservations').upsert(rows, { onConflict: 'id' });
      if (!error) {
        syncedReservations = rows.length;
      } else {
        throw new Error(`Erro na tabela de reservas: ${error.message}`);
      }
    }

    if (customers.length > 0) {
      const rows = customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        is_vip: Boolean(c.isVip),
        visits_count: c.visitsCount || 1,
        no_show_count: c.noShowCount || 0,
        allergies: c.allergies || [],
        internal_notes: c.internalNotes || '',
        last_visit: c.lastVisit || '',
      }));
      const { error } = await supabase.from('customers').upsert(rows, { onConflict: 'id' });
      if (!error) {
        syncedCustomers = rows.length;
      }
    }

    if (settings) {
      await syncSettingsToSupabase(settings);
    }

    return {
      success: true,
      syncedReservations,
      syncedCustomers,
      message: `Sincronizadas ${syncedReservations} reservas e ${syncedCustomers} clientes com o Supabase!`,
    };
  } catch (err: any) {
    return {
      success: false,
      syncedReservations,
      syncedCustomers,
      message: err?.message || 'Falha ao sincronizar com o Supabase.',
    };
  }
}

const FICTITIOUS_RESERVATION_IDS = new Set([
  'res-1',
  'res-2',
  'res-3',
  'res-4',
  'res-5',
  'res-6',
  'res-7',
  'res-8',
  'res-9',
  'res-10',
  'res-1793230719043-kyfj',
  'res-1793224184085-7mci',
  'res-1793122407805-z64k',
  'res-1793122394137-g3os',
  'res-1793031656541-j27b',
  'res-1793030256572-u69b',
]);

const FICTITIOUS_CODES = new Set([
  'OQP-7101',
  'OQP-7102',
  'OQP-7103',
  'OQP-7104',
  'OQP-7105',
  'OQP-7106',
  'OQP-7107',
  'OQP-7108',
  'OQP-7109',
  'OQP-7110',
  'OQP-6352',
  'OQP-2718',
  'OQP-1239',
  'OQP-7367',
  'OQP-7253',
  'OQP-1002',
]);

let clientCleanedSupabaseOnce = false;

// Fetch all reservations from Supabase
export async function fetchReservationsFromSupabase(): Promise<Reservation[] | null> {
  try {
    if (!clientCleanedSupabaseOnce) {
      clientCleanedSupabaseOnce = true;
      supabase.from('reservations').delete().in('id', Array.from(FICTITIOUS_RESERVATION_IDS)).then(() => {});
      supabase.from('reservations').delete().in('code', Array.from(FICTITIOUS_CODES)).then(() => {});
    }
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return null;
    return data
      .filter((row: any) => !FICTITIOUS_RESERVATION_IDS.has(row.id) && !FICTITIOUS_CODES.has(row.code))
      .map(fromSupabaseReservationRow);
  } catch {
    return null;
  }
}

// Delete reservation from Supabase
export async function deleteReservationFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// Fetch all customers from Supabase
export async function fetchCustomersFromSupabase(): Promise<CustomerProfile[] | null> {
  try {
    const { data, error } = await supabase.from('customers').select('*');
    if (error || !Array.isArray(data)) return null;
    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email || '',
      isVip: Boolean(row.is_vip),
      visitsCount: row.visits_count || 1,
      noShowCount: row.no_show_count || 0,
      allergies: Array.isArray(row.allergies) ? row.allergies : [],
      internalNotes: row.internal_notes || '',
      lastVisit: row.last_visit || '',
      gdprConsentDate: row.created_at || new Date().toISOString(),
    }));
  } catch {
    return null;
  }
}

// Fetch tables from Supabase
export async function fetchTablesFromSupabase(): Promise<RestaurantTable[] | null> {
  try {
    const { data, error } = await supabase.from('tables').select('*').order('id', { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data.map((row: any) => ({
      id: row.id,
      number: row.number,
      capacity: row.capacity,
      x: row.x,
      y: row.y,
      radius: row.radius || 48,
      isActive: row.is_active !== false,
      section: row.section || 'sala',
      joinedWithId: row.joined_with_id || undefined,
    }));
  } catch {
    return null;
  }
}

// Sync tables to Supabase
export async function syncTablesToSupabase(tables: RestaurantTable[]): Promise<boolean> {
  try {
    const rows = tables.map((t) => ({
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      x: t.x,
      y: t.y,
      radius: t.radius || 48,
      is_active: t.isActive !== false,
      section: t.section || 'sala',
      joined_with_id: t.joinedWithId ?? null,
    }));
    const { error } = await supabase.from('tables').upsert(rows, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=R.+Cmte.+Rocha+e+Cunha+3C,+3800-140+Aveiro';
const OFFICIAL_ADDRESS = 'R. Cmte. Rocha e Cunha 3C, 3800-140 Aveiro';

// Fetch settings from Supabase
export async function fetchSettingsFromSupabase(): Promise<RestaurantSettings | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'current')
      .maybeSingle();
    if (error || !data || !data.data) return null;

    const loaded = data.data as Partial<RestaurantSettings>;
    const rawTemplates: Partial<NonNullable<RestaurantSettings['emailTemplates']>> = loaded.emailTemplates || {};

    let confirmationBody = rawTemplates.confirmationBody || INITIAL_SETTINGS.emailTemplates?.confirmationBody || '';
    if (confirmationBody.includes('Cais dos Mercantéis') || confirmationBody.includes('Código de reserva: {CODIGO}')) {
      confirmationBody = INITIAL_SETTINGS.emailTemplates?.confirmationBody || confirmationBody;
    }

    let cancellationBody = rawTemplates.cancellationBody || INITIAL_SETTINGS.emailTemplates?.cancellationBody || '';
    if (cancellationBody.includes('A sua reserva {CODIGO} para')) {
      cancellationBody = INITIAL_SETTINGS.emailTemplates?.cancellationBody || cancellationBody;
    }

    const address =
      !loaded.address || loaded.address.includes('Cais dos Mercantéis')
        ? INITIAL_SETTINGS.address
        : loaded.address;

    const postalCode =
      !loaded.postalCode || loaded.postalCode === '3800-228'
        ? INITIAL_SETTINGS.postalCode
        : loaded.postalCode;

    return {
      ...INITIAL_SETTINGS,
      ...loaded,
      address,
      postalCode,
      emailTemplates: {
        ...INITIAL_SETTINGS.emailTemplates,
        ...rawTemplates,
        confirmationBody,
        cancellationBody,
      },
    };
  } catch {
    return null;
  }
}

// Sync settings to Supabase
export async function syncSettingsToSupabase(settings: RestaurantSettings): Promise<boolean> {
  try {
    const { error } = await supabase.from('settings').upsert(
      {
        id: 'current',
        data: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

// Helper to dispatch n8n webhook directly when running in serverless/fallback mode
const N8N_WEBHOOK_URL = 'https://simaoramos.app.n8n.cloud/webhook/nova-reserva';

export async function sendClientN8nWebhook(
  reservation: Reservation,
  eventType: 'nova_reserva' | 'cancelamento_reserva' = 'nova_reserva'
): Promise<void> {
  try {
    const remoteSettings = await Promise.race([
      fetchSettingsFromSupabase(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
    ]);
    const settings = remoteSettings || getSettings() || INITIAL_SETTINGS;
    const restName = settings.restaurantName || 'Qué Pasa';
    const templates = settings.emailTemplates || {};

    const defaultConfirmationSubject = `Confirmação da sua Reserva - ${restName}`;
    const defaultConfirmationBody = `Caro(a) {NOME},\n\nA sua mesa para {PESSOAS} pessoas está confirmada para {DATA} às {HORA}.\n\nLocalização: ${OFFICIAL_ADDRESS} (${MAPS_URL})\nTolerância de chegada: 20 minutos.\n\nAté breve,\nEquipa ${restName}`;

    const defaultCancellationSubject = `Cancelamento de Reserva - ${restName}`;
    const defaultCancellationBody = `Olá {NOME},\n\nA sua reserva para {DATA} às {HORA} foi cancelada com sucesso.\nEsperamos ter o prazer de o receber numa próxima oportunidade em Aveiro.`;

    let confirmationBodyRaw = (templates.confirmationBody || defaultConfirmationBody).trim();
    if (confirmationBodyRaw.includes('Cais dos Mercantéis') || confirmationBodyRaw.includes('Código de reserva: {CODIGO}')) {
      confirmationBodyRaw = defaultConfirmationBody;
    }

    let cancellationBodyRaw = (templates.cancellationBody || defaultCancellationBody).trim();
    if (cancellationBodyRaw.includes('A sua reserva {CODIGO} para')) {
      cancellationBodyRaw = defaultCancellationBody;
    }

    const emailTemplates = {
      confirmationSubject: (templates.confirmationSubject || defaultConfirmationSubject).trim(),
      confirmationBody: confirmationBodyRaw,
      cancellationSubject: (templates.cancellationSubject || defaultCancellationSubject).trim(),
      cancellationBody: cancellationBodyRaw,
    };

    const replacePlaceholders = (text: string) =>
      text
        .replace(/{CODIGO}/g, reservation.code)
        .replace(/{NOME}/g, reservation.customerName)
        .replace(/{DATA}/g, reservation.date)
        .replace(/{HORA}/g, reservation.time)
        .replace(/{MESA}/g, String(reservation.tableId))
        .replace(/{PESSOAS}/g, String(reservation.guests));

    const isCancellation = eventType === 'cancelamento_reserva';
    const activeSubject = replacePlaceholders(
      isCancellation ? emailTemplates.cancellationSubject : emailTemplates.confirmationSubject
    );
    const activeBody = replacePlaceholders(
      isCancellation ? emailTemplates.cancellationBody : emailTemplates.confirmationBody
    );
    const activeHtmlBody = activeBody
      .replace(
        /R\.\s*Cmte\.\s*Rocha\s*e\s*Cunha\s*3C,\s*3800-140\s*Aveiro(?:\s*\(https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=[^)]+\))?/gi,
        `<a href="${MAPS_URL}" target="_blank" rel="noopener noreferrer" style="color:#f59e0b;font-weight:bold;text-decoration:underline;">${OFFICIAL_ADDRESS}</a>`
      )
      .replace(/\n/g, '<br/>');

    const payload = {
      event: eventType,
      evento: eventType,
      timestamp: new Date().toISOString(),
      assunto_email: activeSubject,
      corpo_email: activeBody,
      corpo_email_html: activeHtmlBody,
      email_subject: activeSubject,
      email_body: activeBody,
      email_body_html: activeHtmlBody,
      localizacao: OFFICIAL_ADDRESS,
      mapa_url: MAPS_URL,
      google_maps_url: MAPS_URL,
      emailTemplates,
      id: reservation.id,
      codigo: reservation.code,
      cliente: reservation.customerName,
      nome: reservation.customerName,
      telemovel: reservation.customerPhone,
      telefone: reservation.customerPhone,
      email: reservation.customerEmail,
      data: reservation.date,
      hora: reservation.time,
      pessoas: reservation.guests,
      pax: reservation.guests,
      mesa: reservation.tableId,
      pedidos_especiais: (reservation.specialRequests || []).join(', '),
      observacoes: reservation.notes || '',
      notas: reservation.notes || '',
      notas_internas: reservation.internalNotes || '',
      origem: reservation.source || 'online',
      estado: isCancellation ? 'cancelada' : reservation.status,
      duracao_minutos: reservation.durationMinutes,
      criado_em: reservation.createdAt,
      reservation: {
        ...reservation,
        status: isCancellation ? 'cancelada' : reservation.status,
      },
    };

    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[N8N FALLBACK NOTICE]', err);
  }
}
