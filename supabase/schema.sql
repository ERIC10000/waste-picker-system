-- =====================================================================
--  Web-Based Mobile Waste Picker App
--  INSY 492 Senior Project - Wiclife Omondi Ongo (UEAB, BBIT)
--  Supabase / PostgreSQL schema
--
--  HOW TO RUN:
--    Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run
--  Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type picker_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type picker_role as enum ('picker', 'community_leader', 'data_collector');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('superadmin', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audience_type as enum ('all', 'region', 'individual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type material_type as enum ('plastic', 'paper', 'glass', 'metal', 'e_waste', 'organic', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. REGIONS  (Western Kenya / Lake Victoria basin counties)
-- ---------------------------------------------------------------------
create table if not exists public.regions (
  id          serial primary key,
  name        text not null unique,
  code        text not null unique,          -- used inside the generated picker ID
  county      text,
  created_at  timestamptz not null default now()
);

insert into public.regions (name, code, county) values
  ('Kisumu',      'KSM', 'Kisumu'),
  ('Siaya',       'SIA', 'Siaya'),
  ('Busia',       'BSA', 'Busia'),
  ('Homa Bay',    'HMB', 'Homa Bay'),
  ('Migori',      'MGR', 'Migori'),
  ('Kakamega',    'KKG', 'Kakamega'),
  ('Vihiga',      'VHG', 'Vihiga'),
  ('Bungoma',     'BGM', 'Bungoma'),
  ('Trans Nzoia', 'TNZ', 'Trans Nzoia'),
  ('Nandi',       'NDI', 'Nandi')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 3. ADMINS  (web dashboard users)
--    id mirrors auth.users.id
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        admin_role not null default 'admin',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. WASTE PICKERS  (mobile app users)
--    id mirrors auth.users.id; picker_id is the system-generated unique ID
-- ---------------------------------------------------------------------
create table if not exists public.waste_pickers (
  id             uuid primary key references auth.users(id) on delete cascade,
  picker_id      text unique,                        -- e.g. WP-KSM-2026-0001 (assigned on approval)
  full_name      text not null,
  phone          text not null unique,               -- 2547XXXXXXXX
  national_id    text unique,
  gender         text,
  date_of_birth  date,
  region_id      int references public.regions(id),
  sub_location   text,
  photo_url      text,
  status         picker_status not null default 'pending',
  role           picker_role   not null default 'picker',
  approved_at    timestamptz,
  approved_by    uuid references public.admins(id),
  rejection_note text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_pickers_status on public.waste_pickers(status);
create index if not exists idx_pickers_region on public.waste_pickers(region_id);
create index if not exists idx_pickers_created on public.waste_pickers(created_at);

-- ---------------------------------------------------------------------
-- 5. ANNOUNCEMENTS  (communication module)
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  audience      audience_type not null default 'all',
  region_id     int  references public.regions(id),
  recipient_id  uuid references public.waste_pickers(id) on delete cascade,
  is_urgent     boolean not null default false,
  created_by    uuid references public.admins(id),
  recipient_count int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ann_created on public.announcements(created_at desc);

-- delivery / read receipts -> powers "communication reach" reporting
create table if not exists public.announcement_recipients (
  id               bigserial primary key,
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  picker_id        uuid not null references public.waste_pickers(id) on delete cascade,
  delivered_at     timestamptz not null default now(),
  read_at          timestamptz,
  unique (announcement_id, picker_id)
);

create index if not exists idx_ann_recip_picker on public.announcement_recipients(picker_id);

-- ---------------------------------------------------------------------
-- 6. DEVICE TOKENS  (push notification targets)
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  id          bigserial primary key,
  picker_id   uuid not null references public.waste_pickers(id) on delete cascade,
  token       text not null unique,
  platform    text not null default 'android',
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. COLLECTIONS  (activity tracking -> reporting module)
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id            uuid primary key default gen_random_uuid(),
  picker_id     uuid not null references public.waste_pickers(id) on delete cascade,
  material      material_type not null,
  weight_kg     numeric(10,2) not null check (weight_kg > 0),
  collected_on  date not null default current_date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_collections_picker on public.collections(picker_id);
create index if not exists idx_collections_date   on public.collections(collected_on);

-- ---------------------------------------------------------------------
-- 8. UNIQUE ID GENERATOR
--    Format: WP-<REGION CODE>-<YEAR>-<4 digit sequence within region+year>
--    Example: WP-KSM-2026-0001
-- ---------------------------------------------------------------------
create table if not exists public.id_sequences (
  region_code text not null,
  year        int  not null,
  last_value  int  not null default 0,
  primary key (region_code, year)
);

create or replace function public.generate_picker_id(p_region_id int)
returns text
language plpgsql
as $$
declare
  v_code text;
  v_year int := extract(year from now())::int;
  v_next int;
begin
  select coalesce(code, 'GEN') into v_code from public.regions where id = p_region_id;
  if v_code is null then v_code := 'GEN'; end if;

  insert into public.id_sequences (region_code, year, last_value)
  values (v_code, v_year, 1)
  on conflict (region_code, year)
  do update set last_value = public.id_sequences.last_value + 1
  returning last_value into v_next;

  return 'WP-' || v_code || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- Assign the unique ID automatically the moment a picker becomes 'approved'
create or replace function public.assign_picker_id()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and (new.picker_id is null or new.picker_id = '') then
    new.picker_id := public.generate_picker_id(new.region_id);
    if new.approved_at is null then
      new.approved_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_assign_picker_id on public.waste_pickers;
create trigger trg_assign_picker_id
  before insert or update on public.waste_pickers
  for each row execute function public.assign_picker_id();

-- ---------------------------------------------------------------------
-- 9. REPORTING VIEWS
-- ---------------------------------------------------------------------
create or replace view public.v_registrations_by_region as
select
  r.id   as region_id,
  r.name as region,
  count(w.id)                                              as total,
  count(w.id) filter (where w.status = 'approved')         as approved,
  count(w.id) filter (where w.status = 'pending')          as pending,
  count(w.id) filter (where w.status = 'rejected')         as rejected,
  count(w.id) filter (where w.status = 'suspended')        as suspended
from public.regions r
left join public.waste_pickers w on w.region_id = r.id
group by r.id, r.name
order by r.name;

create or replace view public.v_communication_log as
select
  a.id,
  a.title,
  a.audience,
  a.is_urgent,
  a.created_at,
  r.name as region,
  ad.full_name as sent_by,
  a.recipient_count,
  count(ar.id) filter (where ar.read_at is not null) as read_count
from public.announcements a
left join public.regions r  on r.id = a.region_id
left join public.admins  ad on ad.id = a.created_by
left join public.announcement_recipients ar on ar.announcement_id = a.id
group by a.id, r.name, ad.full_name
order by a.created_at desc;

create or replace view public.v_collection_summary as
select
  w.id                as picker_uuid,
  w.picker_id,
  w.full_name,
  rg.name             as region,
  count(c.id)         as trips,
  coalesce(sum(c.weight_kg), 0) as total_kg
from public.waste_pickers w
left join public.regions rg on rg.id = w.region_id
left join public.collections c on c.picker_id = w.id
group by w.id, w.picker_id, w.full_name, rg.name
order by total_kg desc;

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
--     All application traffic goes through the Node/Express API using the
--     service_role key (which bypasses RLS). RLS is enabled here so that the
--     anon/public key can never read or write the tables directly.
-- ---------------------------------------------------------------------
alter table public.regions                 enable row level security;
alter table public.admins                  enable row level security;
alter table public.waste_pickers           enable row level security;
alter table public.announcements           enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.device_tokens           enable row level security;
alter table public.collections             enable row level security;
alter table public.id_sequences            enable row level security;

-- Regions are public reference data (read-only for signed-in clients)
drop policy if exists regions_read on public.regions;
create policy regions_read on public.regions for select using (true);

-- A picker may read their own record
drop policy if exists pickers_self_read on public.waste_pickers;
create policy pickers_self_read on public.waste_pickers
  for select using (auth.uid() = id);

-- A picker may read announcements addressed to them
drop policy if exists ann_recip_self_read on public.announcement_recipients;
create policy ann_recip_self_read on public.announcement_recipients
  for select using (auth.uid() = picker_id);

-- A picker may read/insert their own collections
drop policy if exists collections_self on public.collections;
create policy collections_self on public.collections
  for all using (auth.uid() = picker_id) with check (auth.uid() = picker_id);

-- ---------------------------------------------------------------------
-- 11. STORAGE BUCKET for profile photos & documents
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('picker-photos', 'picker-photos', true)
on conflict (id) do nothing;

drop policy if exists "picker photos are publicly readable" on storage.objects;
create policy "picker photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'picker-photos');

-- =====================================================================
--  DONE. Next: run seed.sql (optional demo data), then start the API.
-- =====================================================================
