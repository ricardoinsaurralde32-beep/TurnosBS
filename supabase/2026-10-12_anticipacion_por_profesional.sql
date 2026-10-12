-- Anticipacion minima por profesional. NULL hereda la configuracion del negocio.
alter table public.professionals
  add column if not exists min_hours_ahead numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'professionals_min_hours_ahead_range'
      and conrelid = 'public.professionals'::regclass
  ) then
    alter table public.professionals
      add constraint professionals_min_hours_ahead_range
      check (min_hours_ahead is null or min_hours_ahead between 0 and 999);
  end if;
end;
$$;

-- La regla se valida nuevamente en el servidor al confirmar una reserva.
create or replace function public.create_booking_public(
  p_business_id uuid, p_professional_id uuid, p_date date, p_time text, p_services text[],
  p_client_name text, p_client_phone text, p_client_email text default null::text,
  p_reference_photo_url text default null::text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text; v_suspended boolean; v_min numeric; v_ts timestamptz; v_active int;
begin
  select b.suspended, coalesce(p.min_hours_ahead, b.min_hours_ahead)
    into v_suspended, v_min
  from businesses b
  join professionals p on p.business_id = b.id
  where b.id = p_business_id and p.id = p_professional_id;
  if not found then raise exception 'Profesional inválido'; end if;
  if v_suspended then raise exception 'Este negocio no está aceptando turnos por ahora'; end if;

  if char_length(btrim(coalesce(p_client_name, ''))) < 2 or char_length(p_client_name) > 80 then
    raise exception 'Nombre inválido';
  end if;
  if char_length(regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g')) < 6 or char_length(p_client_phone) > 25 then
    raise exception 'Teléfono inválido';
  end if;
  if coalesce(p_client_email, '') <> '' and
     (char_length(p_client_email) > 120 or p_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Correo inválido';
  end if;
  if coalesce(p_time, '') !~ '^\d{2}:\d{2}$' then raise exception 'Hora inválida'; end if;
  if p_services is null or cardinality(p_services) = 0 or cardinality(p_services) > 10 then
    raise exception 'Servicios inválidos';
  end if;
  if coalesce(p_reference_photo_url, '') <> '' and
     p_reference_photo_url not like 'https://pxywwgwcbdzownrtngjt.supabase.co/storage/%' then
    raise exception 'Foto inválida';
  end if;

  v_ts := ((p_date + p_time::time) at time zone 'America/Argentina/Buenos_Aires');
  if v_ts - now() < coalesce(v_min, 0) * interval '1 hour' then
    raise exception 'Ese horario ya no está disponible';
  end if;
  if v_ts - now() > interval '120 days' then raise exception 'Fecha demasiado lejana'; end if;

  if exists (select 1 from blocked_clients where business_id = p_business_id and phone = p_client_phone) then
    raise exception 'No se puede reservar con este número';
  end if;

  select count(*) into v_active from bookings
   where business_id = p_business_id and client_phone = p_client_phone
     and status = 'pending' and date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  if v_active >= 4 then
    raise exception 'Ya tenés varios turnos reservados. Cancelá alguno o escribile al negocio.';
  end if;

  insert into bookings (
    business_id, professional_id, date, time, services,
    client_name, client_phone, client_email, reference_photo_url
  ) values (
    p_business_id, p_professional_id, p_date, p_time, p_services,
    btrim(p_client_name), btrim(p_client_phone), nullif(btrim(coalesce(p_client_email, '')), ''), nullif(p_reference_photo_url, '')
  )
  returning access_code into v_code;
  return v_code;
end;
$function$;
