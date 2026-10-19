-- =========================================================
-- CHÁ DE CASA NOVA — SUPABASE
-- Rode este arquivo no SQL Editor do Supabase.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.event_settings (
  id boolean primary key default true check (id = true),
  casal_nome text not null default 'Állan & Dalilla',
  titulo text not null default 'Nosso primeiro lar juntos',
  descricao text,
  data_evento date,
  horario_evento time,
  local_nome text,
  local_endereco text,
  mapa_url text,
  updated_at timestamptz not null default now()
);

insert into public.event_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.presentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  categoria text,
  preco numeric(10,2) not null check (preco >= 0),
  imagem_url text,
  link_compra text not null,
  status text not null default 'disponivel'
    check (status in ('disponivel','reservado','recebido')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  presente_id uuid not null references public.presentes(id) on delete restrict,
  nome_convidado text not null check (char_length(btrim(nome_convidado)) between 3 and 120),
  status text not null default 'reservado'
    check (status in ('reservado','recebido','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_presentes_status on public.presentes(status);
create index if not exists idx_reservas_presente on public.reservas(presente_id);
create index if not exists idx_reservas_status on public.reservas(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists presentes_updated_at on public.presentes;
create trigger presentes_updated_at
before update on public.presentes
for each row execute function public.set_updated_at();

drop trigger if exists reservas_updated_at on public.reservas;
create trigger reservas_updated_at
before update on public.reservas
for each row execute function public.set_updated_at();

drop trigger if exists event_settings_updated_at on public.event_settings;
create trigger event_settings_updated_at
before update on public.event_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Reserva atômica:
-- somente uma pessoa consegue mudar disponível -> reservado.
-- ---------------------------------------------------------
create or replace function public.reserve_present(
  p_present_id uuid,
  p_guest_name text
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva public.reservas;
begin
  if btrim(coalesce(p_guest_name,'')) = '' or char_length(btrim(p_guest_name)) < 3 then
    raise exception 'Informe seu nome e sobrenome.';
  end if;

  if char_length(p_guest_name) > 120 then
    raise exception 'Nome muito longo.';
  end if;

  update public.presentes
  set status = 'reservado', updated_at = now()
  where id = p_present_id
    and status = 'disponivel';

  if not found then
    raise exception 'Este presente acabou de ser reservado por outra pessoa.';
  end if;

  insert into public.reservas (presente_id, nome_convidado)
  values (p_present_id, btrim(p_guest_name))
  returning * into v_reserva;

  return v_reserva;
end;
$$;

-- A função é chamada pela Edge Function com a service role.
-- Removemos acesso público direto à função para evitar bypass.
revoke all on function public.reserve_present(uuid,text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.event_settings enable row level security;
alter table public.presentes enable row level security;
alter table public.reservas enable row level security;

drop policy if exists "public can read event settings" on public.event_settings;
create policy "public can read event settings"
on public.event_settings for select
to anon, authenticated
using (true);

drop policy if exists "public can read presents" on public.presentes;
create policy "public can read presents"
on public.presentes for select
to anon, authenticated
using (true);

-- Convidados NÃO podem ler reservas.
-- Admin autenticado pode ler.
drop policy if exists "admins can read reservations" on public.reservas;
create policy "admins can read reservations"
on public.reservas for select
to authenticated
using (true);

-- Administração dos presentes: usuário autenticado.
-- Em produção, se houver outros usuários Supabase, troque por
-- uma checagem explícita de e-mail/role ou tabela de admins.
drop policy if exists "authenticated can insert presents" on public.presentes;
create policy "authenticated can insert presents"
on public.presentes for insert
to authenticated
with check (true);

drop policy if exists "authenticated can update presents" on public.presentes;
create policy "authenticated can update presents"
on public.presentes for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can delete presents" on public.presentes;
create policy "authenticated can delete presents"
on public.presentes for delete
to authenticated
using (true);

drop policy if exists "authenticated can update reservations" on public.reservas;
create policy "authenticated can update reservations"
on public.reservas for update
to authenticated
using (true)
with check (true);

-- ---------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.presentes;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------
-- Dados de exemplo (opcional)
-- ---------------------------------------------------------
insert into public.presentes
(nome, descricao, categoria, preco, imagem_url, link_compra, ordem)
values
('Jogo de panelas', 'Para começar nossa cozinha juntos.', 'Cozinha', 399.90, null, 'https://www.shopee.com.br/', 1),
('Jogo de toalhas', 'Um detalhe para deixar nosso cantinho mais aconchegante.', 'Banho', 89.90, null, 'https://www.mercadolivre.com.br/', 2),
('Liquidificador', 'Para nossas receitas e cafés da manhã.', 'Cozinha', 249.90, null, 'https://www.shopee.com.br/', 3)
on conflict do nothing;

-- IMPORTANTE:
-- Para produção, restrinja as policies administrativas a uma
-- identidade/role específica. O exemplo acima é propositalmente
-- simples para o primeiro protótipo.
