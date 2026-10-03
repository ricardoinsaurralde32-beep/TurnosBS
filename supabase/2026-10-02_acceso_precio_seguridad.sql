-- TurnosBS - 2 de octubre 2026
-- Pegar TODO este archivo en Supabase > SQL Editor > Run.
-- Hace: acceso sin pagar manejable, precio manejable (17.900), un solo recordatorio por defecto
-- y cierres de seguridad. No borra datos.

-- 1) Protección de columnas de cobro
create or replace function public.protect_billing_columns()
returns trigger language plpgsql set search_path = public as $fn$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if v_role in ('authenticated', 'anon') and coalesce(current_setting('app.billing_admin', true), '') <> 'on' then
    new.billing_exempt      := old.billing_exempt;
    new.card_confirmed      := old.card_confirmed;
    new.trial_consumed      := old.trial_consumed;
    new.suspended           := old.suspended;
    new.suspended_reason    := old.suspended_reason;
    new.access_until        := old.access_until;
    new.next_payment_at     := old.next_payment_at;
    new.payment_failures    := old.payment_failures;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at       := old.trial_ends_at;
    new.plan_id             := old.plan_id;
    new.owner_user_id       := old.owner_user_id;
    new.mp_preapproval_id   := old.mp_preapproval_id;
    new.mp_payer_email      := old.mp_payer_email;
    new.mp_card_brand       := old.mp_card_brand;
    new.mp_card_last4       := old.mp_card_last4;
  end if;
  return new;
end;
$fn$;

-- 2) Dar / quitar acceso sin pagar (solo el dueño de la plataforma)
create or replace function public.admin_set_billing_exempt(p_business_id uuid, p_exempt boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  b public.businesses%rowtype;
  v_trial int;
begin
  if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
  select * into b from public.businesses where id = p_business_id;
  if not found then raise exception 'Negocio no encontrado'; end if;
  perform set_config('app.billing_admin', 'on', true);
  if p_exempt then
    if b.mp_preapproval_id is not null and not coalesce(b.billing_exempt, false)
       and b.subscription_status in ('active', 'trialing') then
      raise exception 'Este negocio tiene una suscripción de Mercado Pago activa. Cancelala primero para no cobrarle.';
    end if;
    update public.businesses
       set billing_exempt = true, suspended = false, suspended_reason = null,
           subscription_status = 'active', trial_ends_at = null
     where id = p_business_id;
  else
    select coalesce(trial_days, 7) into v_trial from public.plans where id = b.plan_id;
    update public.businesses
       set billing_exempt = false, card_confirmed = false,
           subscription_status = 'trialing',
           trial_ends_at = now() + make_interval(days => coalesce(v_trial, 7))
     where id = p_business_id;
  end if;
end;
$fn$;
revoke execute on function public.admin_set_billing_exempt(uuid, boolean) from public, anon;
grant execute on function public.admin_set_billing_exempt(uuid, boolean) to authenticated;

-- 3) Listado de suscriptores (ahora incluye si tienen acceso sin pagar)
create or replace function public.get_subscribers_overview()
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
  select jsonb_agg(row_to_json(t) order by t.created_at desc) into result
  from (
    select b.id, b.name, b.slug, b.subscription_status, b.trial_ends_at, b.suspended, b.billing_exempt,
      b.terms_accepted_at, (b.mp_preapproval_id is not null) as has_payment_method, b.created_at,
      p.name as plan_name, p.price_ars as plan_price_ars, p.trial_days as plan_trial_days,
      u.email as owner_email,
      (select count(*) from professionals pr where pr.business_id = b.id) as professionals_count,
      (select count(*) from bookings bk where bk.business_id = b.id and bk.status <> 'cancelled') as bookings_count,
      (select max(bk.created_at) from bookings bk where bk.business_id = b.id) as last_booking_at
    from businesses b
    left join plans p on p.id = b.plan_id
    left join auth.users u on u.id = b.owner_user_id
    where b.id <> '24b520a2-ce47-4ac9-a00e-99e49eafc0fe'
  ) t;
  return coalesce(result, '[]'::jsonb);
end;
$fn$;

-- 4) Precio del plan manejable desde el panel (17.900 + etiqueta "Precio de lanzamiento")
alter table public.plans add column if not exists price_label text;
update public.plans set price_ars = 17900, price_label = 'Precio de lanzamiento' where active;

create or replace function public.get_public_plan()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select coalesce((select jsonb_build_object('price_ars', price_ars, 'trial_days', trial_days, 'price_label', price_label)
                   from public.plans where active order by created_at limit 1), '{}'::jsonb);
$fn$;
grant execute on function public.get_public_plan() to anon, authenticated;

create or replace function public.admin_update_plan(p_price integer, p_label text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
  if p_price is null or p_price < 100 or p_price > 1000000 then raise exception 'Precio inválido'; end if;
  update public.plans set price_ars = p_price, price_label = nullif(btrim(coalesce(p_label, '')), '') where active;
end;
$fn$;
revoke execute on function public.admin_update_plan(integer, text) from public, anon;
grant execute on function public.admin_update_plan(integer, text) to authenticated;

-- 5) Un solo recordatorio por correo (el de 30 min); el primero queda apagado
update public.businesses set reminder1_enabled = false;
alter table public.businesses alter column reminder1_enabled set default false;

-- 6) Seguridad
alter table public.reserved_slugs enable row level security;
drop policy if exists reserved_slugs_public_read on public.reserved_slugs;
create policy reserved_slugs_public_read on public.reserved_slugs for select using (true);

revoke execute on function public.get_loyalty_email_data(uuid) from public, anon, authenticated;
grant execute on function public.get_loyalty_email_data(uuid) to service_role;
revoke execute on function public.block_bookings_when_suspended() from public, anon, authenticated;
revoke execute on function public.protect_billing_columns() from public, anon, authenticated;
alter function public.generate_booking_access_code() set search_path = public;
alter function public.slug_is_reserved(text) set search_path = public;

drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_public_insert on public.reviews for insert with check (approved = false);
