// Las fotos HEIC/HEIF (iPhone, o WhatsApp enviada como documento) no las abre Chrome ni Windows.
// Acá las pasamos a JPG antes de usarlas. La librería se carga solo cuando hace falta.
export const isHeic = (file) =>
  !!file && (/image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || ''));

export const looksLikeImage = (file) => !!file && ((file.type || '').startsWith('image/') || isHeic(file));

export async function normalizeImage(file) {
  if (!isHeic(file)) return file;
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], (file.name || 'foto').replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
