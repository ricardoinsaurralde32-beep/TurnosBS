-- Permite al dueño de la plataforma cambiar también los días de prueba, y precios chicos (para pruebas reales).
drop function if exists public.admin_update_plan(integer, text);

create or replace function public.admin_update_plan(p_price integer, p_label text, p_trial_days integer default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
  if p_price is null or p_price < 10 or p_price > 1000000 then raise exception 'Precio inválido'; end if;
  if p_trial_days is not null and (p_trial_days < 0 or p_trial_days > 60) then raise exception 'Días de prueba inválidos'; end if;
  update public.plans
     set price_ars = p_price,
         price_label = nullif(btrim(coalesce(p_label, '')), ''),
         trial_days = coalesce(p_trial_days, trial_days)
   where active;
end;
$fn$;

revoke execute on function public.admin_update_plan(integer, text, integer) from public, anon;
grant execute on function public.admin_update_plan(integer, text, integer) to authenticated;
