import { useEffect, useMemo, useRef, useState } from 'react';
import './ImageCropper.css';

/**
 * Editor de encuadre (como el de WhatsApp): se arrastra la foto para elegir qué parte se ve y se
 * usa el control de zoom para acercar. Muestra al lado cómo se va a ver de verdad en el inicio.
 *
 * Props:
 *  - source: File/Blob o URL (string)
 *  - shape: 'circle' (foto de profesional) | 'wide' (logo del negocio, rectangular)
 *  - aspect: ancho/alto del recorte (circle = 1)
 *  - outputWidth: ancho final en píxeles
 *  - mime: 'image/jpeg' | 'image/png'
 *  - title, hint
 *  - onCancel(), onConfirm(blob)
 */
export default function ImageCropper({ source, shape = 'circle', aspect = 1, outputWidth = 800, mime = 'image/jpeg', title, hint, onSkip, onCancel, onConfirm }) {
  const imgRef = useRef(null);
  const [url, setUrl] = useState('');
  const [nat, setNat] = useState(null);            // tamaño real de la imagen
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });  // desplazamiento en px del recuadro principal
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);

  const frameW = useMemo(() => Math.min(320, (typeof window !== 'undefined' ? window.innerWidth : 360) - 64), []);
  const frameH = Math.round(frameW / aspect);

  useEffect(() => {
    if (typeof source === 'string') { setUrl(source); return undefined; }
    const u = URL.createObjectURL(source);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!url) return;
    const im = new Image();
    if (typeof source === 'string') im.crossOrigin = 'anonymous';
    im.onload = () => { setNat({ w: im.naturalWidth, h: im.naturalHeight }); imgRef.current = im; };
    im.onerror = () => setError('No pudimos abrir la imagen. Probá con otra.');
    im.src = url;
  }, [url, source]);

  // Escala base: la imagen siempre cubre todo el recuadro
  const base = nat ? Math.max(frameW / nat.w, frameH / nat.h) : 1;
  const scale = base * zoom;

  const clamp = (x, y, z = zoom) => {
    if (!nat) return { x: 0, y: 0 };
    const s = base * z;
    const maxX = Math.max(0, (nat.w * s - frameW) / 2);
    const maxY = Math.max(0, (nat.h * s - frameH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setOff(clamp(drag.current.ox + (e.clientX - drag.current.x), drag.current.oy + (e.clientY - drag.current.y)));
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e) => {
    const z = Math.min(4, Math.max(1, zoom - e.deltaY * 0.002));
    setZoom(z);
    setOff((o) => clamp(o.x, o.y, z));
  };
  const onZoom = (z) => { setZoom(z); setOff((o) => clamp(o.x, o.y, z)); };

  // Estilo de la imagen dentro de una caja de ancho bw (misma composición, a otra escala)
  const imgStyle = (bw) => {
    if (!nat) return {};
    const f = bw / frameW;
    const w = nat.w * scale * f;
    const h = nat.h * scale * f;
    const bh = frameH * f;
    return { width: w, height: h, left: (bw - w) / 2 + off.x * f, top: (bh - h) / 2 + off.y * f };
  };

  const confirm = async () => {
    if (!nat || !imgRef.current) return;
    setSaving(true);
    try {
      const outW = outputWidth;
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, outW, outH); }
      const f = outW / frameW;
      const w = nat.w * scale * f;
      const h = nat.h * scale * f;
      ctx.drawImage(imgRef.current, (outW - w) / 2 + off.x * f, (outH - h) / 2 + off.y * f, w, h);
      canvas.toBlob((blob) => {
        setSaving(false);
        if (!blob) { setError('No se pudo preparar la imagen.'); return; }
        onConfirm(blob);
      }, mime, 0.9);
    } catch {
      setSaving(false);
      setError('No se pudo preparar la imagen (puede que esté protegida). Subila de nuevo desde tu galería.');
    }
  };

  const previews = shape === 'circle'
    ? [{ key: 'pc', label: 'Así se ve en el inicio', w: 110, round: true }]
    : [{ key: 'm', label: 'Celular', w: 150 }, { key: 'pc', label: 'Computadora', w: 200 }];

  return (
    <div className="icr-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="icr-panel" onClick={(e) => e.stopPropagation()}>
        <div className="icr-head">
          <h3>{title || 'Encuadrar foto'}</h3>
          <button type="button" className="icr-close" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>
        <p className="icr-hint">{hint || 'Arrastrá la foto para elegir qué parte se ve. Usá el control para acercar.'}</p>

        <div
          className={`icr-frame ${shape === 'circle' ? 'round' : ''}`}
          style={{ width: frameW, height: frameH }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
        >
          {nat && <img src={url} alt="" draggable="false" style={{ ...imgStyle(frameW), position: 'absolute' }} crossOrigin={typeof source === 'string' ? 'anonymous' : undefined} />}
          {!nat && !error && <span className="icr-loading">Cargando...</span>}
        </div>
        {shape === 'circle' && <p className="icr-note">El círculo es lo que se ve; lo de afuera se recorta.</p>}

        <label className="icr-zoom">
          <span>−</span>
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => onZoom(Number(e.target.value))} />
          <span>+</span>
        </label>

        {nat && (
          <div className="icr-previews">
            {previews.map((p) => (
              <div key={p.key} className="icr-prev">
                <div
                  className={`icr-prev-box ${p.round ? 'round' : ''} ${shape === 'wide' ? 'hero' : ''}`}
                  style={{ width: p.w, height: Math.round(p.w / aspect) }}
                >
                  <img src={url} alt="" draggable="false" style={{ ...imgStyle(p.w), position: 'absolute' }} crossOrigin={typeof source === 'string' ? 'anonymous' : undefined} />
                </div>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="icr-error">{error}</p>}

        {onSkip && (
          <button type="button" className="icr-skip" onClick={onSkip}>Usar la imagen completa, sin recortar</button>
        )}
        <div className="icr-actions">
          <button type="button" className="icr-cancel" onClick={onCancel}>Cancelar</button>
          <button type="button" className="icr-ok" onClick={confirm} disabled={!nat || saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
