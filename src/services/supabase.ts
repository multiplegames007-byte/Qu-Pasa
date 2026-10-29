import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Reservation, CustomerProfile, RestaurantTable } from '../types/index.ts';

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
  customers: CustomerProfile[]
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
