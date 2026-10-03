-- Servicios propios de cada profesional
-- Permite que un profesional (no dueño) cree, edite y elimine SUS propios servicios.
-- No toca los servicios del dueño ni los de otros profesionales.

alter table public.services
  add column if not exists created_by_professional uuid references public.professionals(id) on delete cascade;

drop policy if exists services_pro_insert on public.services;
create policy services_pro_insert on public.services
  for insert to authenticated
  with check (
    created_by_professional is not null
    and created_by_professional = auth_professional_id()
    and business_id = auth_business_id()
  );

drop policy if exists services_pro_update on public.services;
create policy services_pro_update on public.services
  for update to authenticated
  using (created_by_professional = auth_professional_id() and business_id = auth_business_id())
  with check (created_by_professional = auth_professional_id() and business_id = auth_business_id());

drop policy if exists services_pro_delete on public.services;
create policy services_pro_delete on public.services
  for delete to authenticated
  using (created_by_professional = auth_professional_id() and business_id = auth_business_id());
