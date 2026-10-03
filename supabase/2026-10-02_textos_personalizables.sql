-- Textos personalizables de la página de reservas (foto de referencia).
-- Los horarios del pie usan la columna que ya existía (hours_text).
alter table public.businesses
  add column if not exists reference_photo_label text,
  add column if not exists reference_photo_hint text;
