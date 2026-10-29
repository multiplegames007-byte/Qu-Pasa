-- ==============================================================================
-- QUÉ PASA · SCHEMA SQL PARA SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/khikzqexcdbshnokwqrm/sql
-- ==============================================================================

-- 1. Tabela de Reservas (Reservations)
CREATE TABLE IF NOT EXISTS public.reservations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  guests INTEGER NOT NULL DEFAULT 2,
  table_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  special_requests JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  internal_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmada',
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  source TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Clientes (Customers CRM)
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT DEFAULT '',
  is_vip BOOLEAN DEFAULT false,
  visits_count INTEGER DEFAULT 1,
  no_show_count INTEGER DEFAULT 0,
  allergies JSONB DEFAULT '[]'::jsonb,
  internal_notes TEXT DEFAULT '',
  last_visit DATE,
  gdpr_consent_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Mesas do Restaurante (Restaurant Tables)
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 2,
  x INTEGER NOT NULL DEFAULT 100,
  y INTEGER NOT NULL DEFAULT 100,
  radius INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_with_id INTEGER,
  section TEXT NOT NULL DEFAULT 'sala',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Tabela de Períodos Bloqueados (Blocked Periods)
CREATE TABLE IF NOT EXISTS public.blocked_periods (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'dia_inteiro', 'horario', 'mesa'
  date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  table_id INTEGER,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Tabela de Configurações do Restaurante (Settings)
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id TEXT PRIMARY KEY DEFAULT 'current_settings',
  restaurant_name TEXT NOT NULL DEFAULT 'Qué Pasa',
  phone TEXT DEFAULT '234 424 208',
  email TEXT DEFAULT 'reservas@quepasa.pt',
  address TEXT DEFAULT 'Cais dos Mercantéis, nº 14',
  city TEXT DEFAULT 'Aveiro',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Inserir as 12 Mesas Oficiais do Qué Pasa
INSERT INTO public.restaurant_tables (id, number, capacity, x, y, radius, is_active, section)
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
ON CONFLICT (id) DO UPDATE SET
  number = EXCLUDED.number,
  capacity = EXCLUDED.capacity,
  section = EXCLUDED.section;

-- 7. Configuração de Políticas de Acesso (Row Level Security - RLS)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público (Permitir leitura e inserção de reservas)
CREATE POLICY "Permitir leitura pública de reservas" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de reservas" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização de reservas" ON public.reservations FOR UPDATE USING (true);

CREATE POLICY "Permitir leitura pública de mesas" ON public.restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Permitir gestão de mesas" ON public.restaurant_tables FOR ALL USING (true);

CREATE POLICY "Permitir leitura e escrita de clientes" ON public.customers FOR ALL USING (true);
CREATE POLICY "Permitir leitura de bloqueios" ON public.blocked_periods FOR ALL USING (true);
CREATE POLICY "Permitir leitura e gestão de configurações" ON public.restaurant_settings FOR ALL USING (true);
