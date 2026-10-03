-- =====================================================================
-- Seguridad de reservas + regla de cancelación online
-- Correr UNA vez en el SQL Editor de Supabase.
-- =====================================================================

-- 1) Cancelar online: el cliente solo puede hasta (anticipación mínima del negocio + 1 hora) antes del turno.
--    El panel (dueño / profesional) cancela directo sobre la tabla, así que NO tiene esta restricción.
create or replace function public.cancel_booking_by_code(p_business_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid; v_date date; v_time text; v_min numeric; v_ts timestamptz;
begin
  select b.id, b.date, b.time, bz.min_hours_ahead
    into v_id, v_date, v_time, v_min
  from bookings b
  join businesses bz on bz.id = b.business_id
  where b.business_id = p_business_id and b.access_code = upper(p_code) and b.status = 'pending';

  if v_id is null then return false; end if;

  v_ts := ((v_date + v_time::time) at time zone 'America/Argentina/Buenos_Aires');
  if v_ts - now() < (coalesce(v_min, 0) + 1) * interval '1 hour' then
    raise exception 'CANCEL_WINDOW';
  end if;

  update bookings set status = 'cancelled' where id = v_id;
  return true;
end;
$function$;

-- 2) Cancelar / buscar turnos solo con el teléfono: cualquiera que supiera tu número podía ver y cancelar tus turnos.
--    La pantalla no lo usa (se gestiona con el código del turno), así que se cierra.
revoke execute on function public.client_find_bookings(uuid, text) from public, anon, authenticated;
revoke execute on function public.client_cancel_booking(uuid, uuid, text) from public, anon, authenticated;

-- 3) Reservas: hoy cualquiera podía insertar turnos directo en la tabla saltándose todas las reglas.
--    Se cierra esa puerta: solo se reserva por create_booking_public, que ahora valida todo en el servidor.
drop policy if exists bookings_public_insert on public.bookings;

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
  select suspended, min_hours_ahead into v_suspended, v_min from businesses where id = p_business_id;
  if not found then raise exception 'Negocio no encontrado'; end if;
  if v_suspended then raise exception 'Este negocio no está aceptando turnos por ahora'; end if;

  if not exists (select 1 from professionals where id = p_professional_id and business_id = p_business_id) then
    raise exception 'Profesional inválido';
  end if;

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
  -- La foto de referencia solo puede ser una imagen subida a este mismo proyecto
  if coalesce(p_reference_photo_url, '') <> '' and
     p_reference_photo_url not like 'https://pxywwgwcbdzownrtngjt.supabase.co/storage/%' then
    raise exception 'Foto inválida';
  end if;

  -- Respeta la anticipación mínima del negocio y no deja reservar a más de 120 días
  v_ts := ((p_date + p_time::time) at time zone 'America/Argentina/Buenos_Aires');
  if v_ts - now() < coalesce(v_min, 0) * interval '1 hour' then
    raise exception 'Ese horario ya no está disponible';
  end if;
  if v_ts - now() > interval '120 days' then raise exception 'Fecha demasiado lejana'; end if;

  if exists (select 1 from blocked_clients where business_id = p_business_id and phone = p_client_phone) then
    raise exception 'No se puede reservar con este número';
  end if;

  -- Tope por teléfono: evita que alguien llene la agenda con turnos falsos
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

-- 4) Fotos de referencia: cualquiera puede subir archivos a la carpeta "references".
--    Se limita el tamaño (10 MB) y el tipo (solo imágenes).
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
 where id = 'public-images';
