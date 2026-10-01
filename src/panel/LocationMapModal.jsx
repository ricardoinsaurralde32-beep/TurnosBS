import { useEffect, useRef, useState } from 'react';
import { loadLeaflet, geocodeAddress } from '../lib/leaflet';
import { IconPin, IconX } from '../components/Icons';
import './LocationMapModal.css';

// Centro por defecto si todavía no hay ninguna ubicación cargada y el
// navegador no comparte la geolocalización: Buenos Aires.
const FALLBACK_CENTER = { lat: -34.6037, lng: -58.3816 };

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR = 'Imágenes &copy; Esri';

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('sin geolocalización')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('permiso denegado')),
      { timeout: 5000 }
    );
  });
}

/**
 * Modal con mapa interactivo (arrastrar/zoom, pin fijo en el centro) y vista de
 * calle al lado para confirmar visualmente el local. Usa OpenStreetMap (Leaflet),
 * así que no necesita API key ni tarjeta de crédito.
 *
 * Props:
 *  - open: boolean
 *  - initialLat, initialLng: numéricos o null si el negocio todavía no cargó ubicación
 *  - initialQuery: dirección escrita (opcional), para abrir el mapa ya cerca
 *  - onClose(): cierra sin guardar
 *  - onConfirm({ lat, lng }): el usuario confirmó este punto
 */
export default function LocationMapModal({ open, initialLat, initialLng, initialQuery, onClose, onConfirm }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const debounceRef = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [center, setCenter] = useState(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const [svPoint, setSvPoint] = useState(center);
  const [satellite, setSatellite] = useState(false);
  const [query, setQuery] = useState(initialQuery || '');
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('loading');
    setSearchMsg('');
    setQuery(initialQuery || '');

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapDivRef.current) return;

        let startCenter = initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null;
        let zoom = 18;
        if (!startCenter && initialQuery) {
          startCenter = await geocodeAddress(initialQuery).catch(() => null);
        }
        if (!startCenter) {
          startCenter = await getBrowserLocation().catch(() => FALLBACK_CENTER);
          zoom = 15;
        }
        if (cancelled || !mapDivRef.current) return;

        const map = L.map(mapDivRef.current, { center: [startCenter.lat, startCenter.lng], zoom, maxZoom: 19 });
        const street = L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTR });
        const sat = L.tileLayer(SAT_URL, { maxZoom: 19, attribution: SAT_ATTR });
        street.addTo(map);
        layersRef.current = { street, sat };
        mapRef.current = map;

        setCenter(startCenter);
        setSvPoint(startCenter);

        map.on('move', () => {
          const c = map.getCenter();
          setCenter({ lat: c.lat, lng: c.lng });
        });
        map.on('moveend', () => {
          const c = map.getCenter();
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => setSvPoint({ lat: c.lat, lng: c.lng }), 400);
        });

        setStatus('ready');
        setTimeout(() => map.invalidateSize(), 50);
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e.message || 'No se pudo cargar el mapa');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Alterna entre mapa y satélite
  useEffect(() => {
    const map = mapRef.current;
    const { street, sat } = layersRef.current;
    if (!map || !street || !sat) return;
    if (satellite) { map.removeLayer(street); sat.addTo(map); }
    else { map.removeLayer(sat); street.addTo(map); }
  }, [satellite, status]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim() || !mapRef.current) return;
    setSearching(true);
    setSearchMsg('');
    try {
      const found = await geocodeAddress(query);
      if (!found) {
        setSearchMsg('No encontramos esa dirección. Probá agregando la ciudad, o movés el mapa a mano.');
      } else {
        mapRef.current.setView([found.lat, found.lng], 18);
      }
    } catch {
      setSearchMsg('No se pudo buscar ahora. Movés el mapa a mano hasta tu local.');
    } finally {
      setSearching(false);
    }
  }

  if (!open) return null;

  const svSrc = svPoint
    ? `https://maps.google.com/maps?layer=c&cbll=${svPoint.lat},${svPoint.lng}&cbp=11,0,0,0,0&source=embed&output=svembed`
    : '';
  const svLink = center
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${center.lat},${center.lng}`
    : '#';

  return (
    <div className="lmm-overlay" role="dialog" aria-modal="true">
      <div className="lmm-panel">
        <div className="lmm-head">
          <div>
            <h2>Ubicación del local</h2>
            <p>Movés el mapa hasta que el pin quede justo sobre la puerta de tu local.</p>
          </div>
          <button type="button" className="lmm-close" onClick={onClose} aria-label="Cerrar">
            <IconX size={18} />
          </button>
        </div>

        {status === 'error' && (
          <div className="lmm-error">No se pudo cargar el mapa: {errorMsg}. Revisá tu conexión y probá de nuevo.</div>
        )}

        <div className="lmm-body">
          <div className="lmm-map-col">
            <div className="lmm-map" ref={mapDivRef} />
            <form className="lmm-search" onSubmit={handleSearch}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar dirección (ej: San Martín 1234, Paraná)"
              />
              <button type="submit" disabled={searching || status !== 'ready'}>{searching ? '...' : 'Buscar'}</button>
            </form>
            <button type="button" className="lmm-layer-btn" onClick={() => setSatellite((v) => !v)}>
              {satellite ? 'Ver mapa' : 'Ver satélite'}
            </button>
            <div className="lmm-pin"><IconPin size={40} /></div>
            {status === 'loading' && <div className="lmm-loading">Cargando mapa...</div>}
          </div>
          <div className="lmm-sv-col">
            <div className="lmm-sv-label">Vista de calle</div>
            <div className="lmm-sv">
              {status === 'ready' && svSrc && (
                <iframe title="Vista de calle" src={svSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
              )}
            </div>
            <a className="lmm-sv-link" href={svLink} target="_blank" rel="noreferrer">
              Si no se ve, abrir vista de calle en Google
            </a>
          </div>
        </div>

        {searchMsg && <p className="lmm-search-msg">{searchMsg}</p>}

        <div className="lmm-footer">
          <span className="lmm-coords">
            {center ? `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : '—'}
          </span>
          <div className="lmm-actions">
            <button type="button" className="lmm-cancel" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="lmm-confirm"
              disabled={status !== 'ready' || !center}
              onClick={() => onConfirm(center)}
            >
              Confirmar local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
