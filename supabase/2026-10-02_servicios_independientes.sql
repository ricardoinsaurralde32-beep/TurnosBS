-- Servicios independientes: cada profesional tiene SU PROPIA lista de servicios.
-- 1) A cada empleado (no dueño) se le crea una copia propia de cada servicio que tenía del dueño.
-- 2) Los servicios que no tenían autor pasan a ser del dueño del negocio.
-- Los turnos ya guardados no se tocan (guardan el nombre interno del servicio original, que sigue existiendo).
-- Se puede ejecutar más de una vez sin duplicar nada.

do $$
declare
  r record;
  nid uuid;
begin
  for r in
    select ps.professional_id, ps.service_id, ps.price as my_price,
           p.business_id, s.slug, s.label, s.price as base_price, s.show_price
    from public.professional_services ps
    join public.professionals p on p.id = ps.professional_id
    join public.services s on s.id = ps.service_id
    where coalesce(p.is_owner, false) = false
      and s.created_by_professional is null
  loop
    insert into public.services (business_id, slug, label, price, show_price, created_by_professional)
    values (r.business_id, r.slug || '-' || substr(r.professional_id::text, 1, 4), r.label,
            coalesce(r.my_price, r.base_price), r.show_price, r.professional_id)
    returning id into nid;

    update public.professional_services
       set service_id = nid, price = null
     where professional_id = r.professional_id and service_id = r.service_id;
  end loop;

  -- El dueño: si tenía un precio propio distinto, pasa a ser el precio del servicio
  update public.services s
     set price = ps.price
    from public.professional_services ps
    join public.professionals o on o.id = ps.professional_id and o.is_owner = true
   where ps.service_id = s.id and ps.price is not null;
  update public.professional_services ps
     set price = null
    from public.professionals o
   where o.id = ps.professional_id and o.is_owner = true and ps.price is not null;

  -- Lo que quedó sin autor es del dueño del negocio
  update public.services s
     set created_by_professional = o.id
    from public.professionals o
   where s.created_by_professional is null
     and o.business_id = s.business_id
     and o.is_owner = true;
end $$;
