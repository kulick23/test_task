-- HR role is assigned by an admin in auth.users.app_metadata.role.
-- Never use client-controlled user_metadata for authorization.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('newcomer', 'hr')),
  full_name text not null,
  role_title text not null default '',
  team text not null default '',
  start_date date not null default current_date,
  work_email text
);
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  summary text not null default '',
  body text not null,
  reading_minutes int not null default 2 check (reading_minutes > 0),
  published boolean not null default false,
  sort_order int not null default 0
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text not null,
  team text not null default '',
  work_email text not null,
  work_phone text,
  telegram_username text,
  sort_order int not null default 0
);
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null constraint checkins_employee_id_fkey references public.profiles(id) on delete cascade,
  day date not null default current_date,
  mood int not null check (mood between 1 and 5),
  clarity int not null check (clarity between 1 and 5),
  access_ready boolean not null,
  wants_contact boolean not null,
  note text not null default '' check (char_length(note) <= 600),
  status text not null default 'new' check (status in ('new', 'contacted', 'resolved')),
  created_at timestamptz not null default now(),
  unique(employee_id, day)
);
create index checkins_day_idx on public.checkins(day desc);
create index checkins_open_idx on public.checkins(status, day desc) where status != 'resolved';
create table public.hr_shifts (
  hr_id uuid primary key references public.profiles(id) on delete cascade,
  on_shift boolean not null default false,
  telegram_chat_id bigint
);
-- Service-role only: one-time Telegram account linking and delivery deduplication.
create table public.telegram_link_codes (
  token_hash text primary key,
  hr_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.telegram_deliveries (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  hr_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key(checkin_id, hr_id)
);

alter table public.profiles enable row level security;
alter table public.articles enable row level security;
alter table public.contacts enable row level security;
alter table public.checkins enable row level security;
alter table public.hr_shifts enable row level security;
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_deliveries enable row level security;

create policy "own profile or HR" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role') = 'hr');
create policy "published articles to staff" on public.articles for select to authenticated
using (published and (select auth.jwt()->'app_metadata'->>'role') in ('newcomer', 'hr'));
create policy "contacts to staff" on public.contacts for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') in ('newcomer', 'hr'));
create policy "own checkins or HR" on public.checkins for select to authenticated
using (employee_id = (select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role') = 'hr');
create policy "newcomer submits own checkin" on public.checkins for insert to authenticated
with check (employee_id = (select auth.uid()) and (select auth.jwt()->'app_metadata'->>'role') = 'newcomer' and status = 'new' and day between current_date - 1 and current_date + 1);
create policy "HR updates signal status" on public.checkins for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'hr')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'hr');
create policy "HR reads own shift" on public.hr_shifts for select to authenticated
using (hr_id = (select auth.uid()) and (select auth.jwt()->'app_metadata'->>'role') = 'hr');
create policy "HR starts own shift" on public.hr_shifts for insert to authenticated
with check (hr_id = (select auth.uid()) and (select auth.jwt()->'app_metadata'->>'role') = 'hr');
create policy "HR changes own shift" on public.hr_shifts for update to authenticated
using (hr_id = (select auth.uid()) and (select auth.jwt()->'app_metadata'->>'role') = 'hr')
with check (hr_id = (select auth.uid()) and (select auth.jwt()->'app_metadata'->>'role') = 'hr');

revoke all on public.profiles, public.articles, public.contacts, public.checkins, public.hr_shifts, public.telegram_link_codes, public.telegram_deliveries from anon, authenticated;
grant select on public.profiles, public.articles, public.contacts, public.checkins, public.hr_shifts to authenticated;
grant insert (employee_id, day, mood, clarity, access_ready, wants_contact, note) on public.checkins to authenticated;
grant update (status) on public.checkins to authenticated;
grant insert (hr_id, on_shift) on public.hr_shifts to authenticated;
grant update (hr_id, on_shift) on public.hr_shifts to authenticated;
