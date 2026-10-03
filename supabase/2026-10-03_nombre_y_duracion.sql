-- Mostrar nombre del negocio en el inicio (por defecto SÍ) y duración del turno (por defecto NO)
alter table public.businesses
  add column if not exists show_business_name boolean not null default true,
  add column if not exists show_slot_duration boolean not null default false;

-- Barber Studio: su logo ya trae el nombre, así que no lo repetimos
update public.businesses set show_business_name = false where slug = 'barber-studio';
