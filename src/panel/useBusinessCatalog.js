import { useEffect, useState } from 'react';
import { fetchBusinessById, fetchServicesCatalog, fetchAllProfessionals } from '../lib/api';

// Datos REALES del negocio con el que se entró al panel (nombre, servicios, profesionales y
// horario base). Antes varias pantallas leían un archivo fijo con los datos de Barber Studio
// (Richard y Omar), por eso un negocio nuevo veía nombres que no eran los suyos.
const cache = new Map();

const EMPTY = { business: null, services: [], professionals: [], loading: true };

export function useBusinessCatalog(businessId) {
  const [state, setState] = useState(() => cache.get(businessId) || EMPTY);

  useEffect(() => {
    if (!businessId) return undefined;
    let active = true;
    const cached = cache.get(businessId);
    if (cached) setState(cached);

    (async () => {
      const [{ data: biz }, { data: services }, { data: pros }] = await Promise.all([
        fetchBusinessById(businessId),
        fetchServicesCatalog(businessId),
        fetchAllProfessionals(businessId)
      ]);
      const value = {
        business: biz ? { id: biz.id, name: biz.name, slug: biz.slug, schedule: biz.schedule || {} } : null,
        // Los turnos guardan el "slug" del servicio, no su id interno
        services: (services || []).map((s) => ({ id: s.slug, label: s.label })),
        professionals: (pros || []).map((p) => ({ id: p.id, slug: p.slug, name: p.name, schedule: p.schedule || null })),
        loading: false
      };
      cache.set(businessId, value);
      if (active) setState(value);
    })();

    return () => { active = false; };
  }, [businessId]);

  return state;
}

export function serviceLabelFrom(services, id) {
  return services.find((s) => s.id === id)?.label || id;
}
