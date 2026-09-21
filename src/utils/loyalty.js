// TODO: al conectar Supabase esto pasa a la tabla `businesses`
// (loyalty_enabled, loyalty_threshold, loyalty_reward). Por ahora vive
// en localStorage, así cada negocio lo activa o no sin tocar código.

const KEY = 'loyalty_settings_v1';

const DEFAULTS = {
  enabled: false, // apagado por defecto: no todos los rubros lo quieren
  threshold: 10,
  reward: '10% de descuento en tu próximo turno'
};

export function getLoyaltySettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setLoyaltySettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* incógnito */ }
}