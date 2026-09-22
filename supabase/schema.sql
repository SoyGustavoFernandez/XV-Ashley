-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,            -- va en el link personal y dentro del QR
  name          text not null,
  max_party     int  not null default 1 check (max_party between 1 and 20),  -- cupos asignados
  status        text not null default 'pending' check (status in ('pending','confirmed','declined')),
  party_size    int  check (party_size between 1 and 20),                    -- personas que confirmaron
  phone         text,
  message       text,
  confirmed_at  timestamptz,
  checked_in_at timestamptz,
  checked_in_by text,
  created_at    timestamptz not null default now(),
  constraint party_le_max check (party_size is null or party_size <= max_party)
);

create index if not exists guests_status_idx on public.guests (status);

-- Seguridad: nadie con la clave pública (anon) puede leer ni escribir.
-- Solo las funciones /api, que usan la service_role key, acceden a la tabla.
alter table public.guests enable row level security;
revoke all on public.guests from anon, authenticated;
