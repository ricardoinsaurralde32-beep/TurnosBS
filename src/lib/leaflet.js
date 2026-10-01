// Carga Leaflet (mapa gratis, sin API key ni tarjeta) una sola vez, sin importar
// cuántas veces se abra el modal. Los mapas salen de OpenStreetMap.
const VERSION = '1.9.4';
let leafletPromise = null;

export function loadLeaflet() {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.css`;
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.js`;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('No se pudo iniciar el mapa')));
    script.onerror = () => { leafletPromise = null; reject(new Error('No se pudo cargar el mapa')); };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

// Busca una dirección en OpenStreetMap (Nominatim, gratis, sin key). Devuelve {lat, lng} o null.
export async function geocodeAddress(query) {
  const q = (query || '').trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if (!res.ok) throw new Error('No se pudo buscar la dirección');
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}
