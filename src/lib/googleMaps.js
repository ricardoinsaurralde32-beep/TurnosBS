// Carga el script de Google Maps JavaScript API una sola vez, sin importar
// cuántas veces se abra el modal del mapa. Si ya está cargado (o cargándose),
// devuelve la misma promesa.
let mapsPromise = null;

export function loadGoogleMaps() {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      reject(new Error('Falta VITE_GOOGLE_MAPS_API_KEY en el .env'));
      return;
    }

    const callbackName = '__initGoogleMaps';
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  });

  return mapsPromise;
}
