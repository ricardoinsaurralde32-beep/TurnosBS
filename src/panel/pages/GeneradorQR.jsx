import { useState } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { useBusinessCatalog } from '../useBusinessCatalog';
import './GeneradorQR.css';

// Cada negocio tiene su propia página pública: /su-slug (el "/" pelado es la portada de TurnosBS)
function buildUrl(slug, params) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qs = new URLSearchParams(params).toString();
  const base = slug ? `${origin}/${slug}` : origin;
  return qs ? `${base}?${qs}` : base;
}

function qrImageUrl(targetUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(targetUrl)}`;
}

function QRCard({ title, hint, url }) {
  const img = qrImageUrl(url);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copyLink = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Descarga directa: baja la imagen y la guarda sin abrir otra ventana
  const downloadQr = async () => {
    setDownloading(true);
    try {
      const res = await fetch(img);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qr-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'turnos'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      window.open(img, '_blank', 'noopener');
    }
    setDownloading(false);
  };

  return (
    <div className="qr-card">
      <div className="qr-img-wrap"><img src={img} alt={title} /></div>
      <h3>{title}</h3>
      {hint && <p className="qr-hint">{hint}</p>}
      <p className="qr-url">{url}</p>
      <div className="qr-actions">
        <button type="button" className="qr-btn" onClick={copyLink}>{copied ? '¡Link copiado ✓!' : 'Copiar link'}</button>
        <button type="button" className="qr-btn qr-btn-ghost" onClick={downloadQr} disabled={downloading}>{downloading ? 'Descargando…' : 'Descargar'}</button>
      </div>
    </div>
  );
}

export default function GeneradorQR() {
  const { session } = usePanelAuth();
  const isOwner = session.role === 'owner';

  const { business, professionals: allPros, loading } = useBusinessCatalog(session.businessId);
  const slug = business?.slug;

  const professionals = isOwner
    ? allPros
    : allPros.filter((p) => p.id === session.professionalId);

  return (
    <div className="qr">
      <div className="qr-head">
        <h1>Códigos QR</h1>
        <p className="qr-sub">Para pegar en la vidriera, compartir en redes o mandar por WhatsApp</p>
      </div>

      {loading && <p className="qr-sub">Cargando…</p>}
      {!loading && !slug && <p className="qr-sub">No pudimos cargar los datos de tu negocio. Recargá la página.</p>}

      {slug && (
      <div className="qr-section">
        <h2>General</h2>
        <div className="qr-grid">
          <QRCard
            title="Reservar turno"
            hint="Va a la página normal: el cliente elige profesional, día y hora"
            url={buildUrl(slug, {})}
          />
        </div>
      </div>
      )}

      {slug && professionals.map((pro) => (
        <div key={pro.id} className="qr-section">
          <h2>{isOwner ? pro.name : 'El mío'}</h2>
          <div className="qr-grid">
            <QRCard
              title={`Reservar con ${pro.name}`}
              hint="Ya viene con el profesional elegido"
              url={buildUrl(slug, { prof: pro.slug })}
            />
            <QRCard
              title="Turno rápido de hoy"
              hint="Salta directo a los horarios libres de hoy (o del próximo día disponible)"
              url={buildUrl(slug, { prof: pro.slug, quick: '1' })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}