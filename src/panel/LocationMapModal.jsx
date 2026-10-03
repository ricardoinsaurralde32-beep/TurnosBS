import { useEffect, useRef, useState } from 'react';
import { loadLeaflet, geocodeAddress } from '../lib/leaflet';
import { IconPin, IconX } from '../components/Icons';
import './LocationMapModal.css';

// Si todavía no hay ninguna ubicación cargada, el mapa abre YA en este punto (Argentina) y después
// salta a la ubicación real apenas se detecta. Antes esperaba hasta 5 segundos antes de mostrar nada.
const FALLBACK_CENTER = { lat: -34.6037, lng: -58.3816 };

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR = 'Imágenes &copy; Esri';

// El satélite de Esri no tiene imágenes de alta resolución en todos lados: más allá de este zoom
// muestra un cartel gris "Map data not yet available". Pedimos hasta acá y, si se acerca más,
// se agranda la última imagen buena (se ve menos nítida pero NUNCA queda en gris).
const SAT_NATIVE_MAX = 17;

function getBrowserLocation(highAccuracy = false, timeout = 6000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('sin geolocalización')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout, enableHighAccuracy: highAccuracy, maximumAge: 60000 }
    );
  });
}

/**
 * Modal con mapa interactivo (arrastrar/zoom, pin fijo en el centro) y vista de calle al lado
 * para confirmar visualmente el local. Usa OpenStreetMap/Esri con Leaflet: no necesita API key
 * ni tarjeta de crédito. Abre en mapa de calles.
 *
 * Props:
 *  - open: boolean
 *  - initialLat, initialLng: numéricos o null si el negocio todavía no cargó ubicación
 *  - initialQuery: dirección escrita (opcional): abre el mapa cerca de ahí, sin mostrar buscador
 *  - onClose(): cierra sin guardar
 *  - onConfirm({ lat, lng }): el usuario confirmó este punto
 */
export default function LocationMapModal({ open, initialLat, initialLng, initialQuery, onClose, onConfirm }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const layersRef = useRef({});
  const meRef = useRef(null);
  const centerRef = useRef(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const userMovedRef = useRef(false);
  const programmaticRef = useRef(false);
  const debounceRef = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [center, setCenter] = useState(centerRef.current);
  const [svPoint, setSvPoint] = useState(centerRef.current);
  const [satellite, setSatellite] = useState(false);
  const [svKey, setSvKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState('');

  const moveTo = (point, zoom) => {
    const map = mapRef.current;
    if (!map) return;
    programmaticRef.current = true;
    map.setView([point.lat, point.lng], zoom, { animate: false });
    programmaticRef.current = false;
  };

  const showMe = (point) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (meRef.current) meRef.current.remove();
    meRef.current = L.circleMarker([point.lat, point.lng], {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#2f80ff', fillOpacity: 1, interactive: false,
    }).addTo(map);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    userMovedRef.current = false;
    setStatus('loading');
    setLocateMsg('');
    setSatellite(false); // abre en mapa de calles: es nítido hasta el zoom máximo

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapDivRef.current) return;
        LRef.current = L;

        const hasInitial = initialLat != null && initialLng != null;
        const start = hasInitial ? { lat: initialLat, lng: initialLng } : FALLBACK_CENTER;

        const map = L.map(mapDivRef.current, {
          center: [start.lat, start.lng],
          zoom: hasInitial ? 18 : 13,
          maxZoom: 20,
          zoomControl: false,
          attributionControl: false,
          zoomSnap: 1,
          fadeAnimation: false,
        });
        L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
        L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);

        const tileOpts = { updateWhenIdle: false, updateWhenZooming: false, keepBuffer: 4, maxZoom: 20 };
        const sat = L.tileLayer(SAT_URL, { ...tileOpts, maxNativeZoom: SAT_NATIVE_MAX, attribution: SAT_ATTR });
        const street = L.tileLayer(OSM_URL, { ...tileOpts, maxNativeZoom: 19, attribution: OSM_ATTR });
        street.addTo(map); // abre en calles (nítido); el satélite se activa con el botón
        layersRef.current = { sat, street };
        mapRef.current = map;

        const reportCenter = () => {
          const c = map.getCenter();
          const next = { lat: c.lat, lng: c.lng };
          centerRef.current = next;
          setCenter(next);
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => setSvPoint(next), 400);
        };
        reportCenter();
        map.on('moveend', reportCenter);
        // Si la persona toca el mapa, ya no lo movemos solos cuando llegue la ubicación detectada
        map.on('dragstart', () => { userMovedRef.current = true; });
        map.on('zoomstart', () => { if (!programmaticRef.current) userMovedRef.current = true; });

        // El mapa vive dentro de un modal que cambia de tamaño (celular, giro de pantalla): si no se
        // avisa, Leaflet carga mal los cuadritos al acercar. Esto lo mantiene siempre al día.
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => map.invalidateSize());
          ro.observe(mapDivRef.current);
          map.__ro = ro;
        }
        setTimeout(() => map.invalidateSize(), 60);

        setStatus('ready');

        // Sin ubicación guardada: se busca en segundo plano (la dirección escrita y/o el GPS),
        // sin hacer esperar a nadie. Gana la primera que llegue, salvo que ya haya movido el mapa.
        if (!hasInitial) {
          const apply = (point, zoom) => {
            if (cancelled || userMovedRef.current || !mapRef.current) return;
            moveTo(point, zoom);
            userMovedRef.current = true;
          };
          if (initialQuery && initialQuery.trim()) {
            geocodeAddress(initialQuery).then((p) => { if (p) apply(p, 18); }).catch(() => {});
          }
          getBrowserLocation(false, 5000).then((p) => { apply(p, 17); showMe(p); }).catch(() => {});
        }
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
      const map = mapRef.current;
      if (map) {
        if (map.__ro) map.__ro.disconnect();
        map.remove();
        mapRef.current = null;
      }
      meRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Alterna satélite / mapa de calles
  useEffect(() => {
    const map = mapRef.current;
    const { sat, street } = layersRef.current;
    if (!map || !sat || !street) return;
    if (satellite) {
      // El satélite solo es nítido hasta SAT_NATIVE_MAX: no dejamos acercar más para que nunca se vea borroso
      map.setMaxZoom(SAT_NATIVE_MAX);
      if (map.getZoom() > SAT_NATIVE_MAX) map.setZoom(SAT_NATIVE_MAX);
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(sat)) sat.addTo(map);
    } else {
      map.setMaxZoom(20); if (map.hasLayer(sat)) map.removeLayer(sat); if (!map.hasLayer(street)) street.addTo(map); }
  }, [satellite, status]);

  async function handleLocate() {
    if (!mapRef.current || locating) return;
    setLocating(true);
    setLocateMsg('');
    try {
      const p = await getBrowserLocation(true, 9000);
      userMovedRef.current = true;
      showMe(p);
      moveTo(p, 18);
    } catch (err) {
      setLocateMsg(
        err && err.code === 1
          ? 'No tenemos permiso para ver tu ubicación. Activalo en el navegador (candado de la barra de arriba).'
          : 'No pudimos detectar tu ubicación. Probá de nuevo o movés el mapa a mano.'
      );
    } finally {
      setLocating(false);
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
            <button type="button" className="lmm-layer-btn" onClick={() => setSatellite((v) => !v)}>
              {satellite ? 'Ver calles' : 'Ver satélite'}
            </button>
            <button
              type="button"
              className={`lmm-locate ${locating ? 'busy' : ''}`}
              onClick={handleLocate}
              aria-label="Usar mi ubicación"
              title="Usar mi ubicación"
              disabled={status !== 'ready'}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3.2" />
                <circle cx="12" cy="12" r="7.5" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
            <div className="lmm-pin"><IconPin size={40} /></div>
            {status === 'loading' && <div className="lmm-loading">Cargando mapa...</div>}
          </div>
          <div className="lmm-sv-col">
            <div className="lmm-sv-label">Vista de calle</div>
            <div className="lmm-sv">
              {status === 'ready' && svSrc && (
                <iframe key={svKey} title="Vista de calle" src={svSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
              )}
            </div>
            <p className="lmm-sv-note">
              La vista de calle es solo de ayuda. Si no carga, podés confirmar igual con el mapa.
            </p>
            <button type="button" className="lmm-sv-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setSvKey((k) => k + 1)}>
              Recargar vista de calle
            </button>
            <a className="lmm-sv-link" href={svLink} target="_blank" rel="noreferrer">
              Abrir vista de calle en Google
            </a>
          </div>
        </div>

        {locateMsg && <p className="lmm-search-msg">{locateMsg}</p>}

        <div className="lmm-footer">
          <span className="lmm-coords">
            {center ? `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : '—'}
          </span>
          <div className="lmm-actions">
            <button type="button" className="lmm-cancel" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="lmm-confirm"
              disabled={status !== 'ready' || !centerRef.current}
              onClick={() => onConfirm(centerRef.current)}
            >
              Confirmar local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
