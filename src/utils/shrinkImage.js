// Reduce una imagen a un máximo de `max` px de lado y la devuelve como JPEG (Blob).
// Se usa para guardar el "original" y poder volver a encuadrar después sin perder calidad.
export function shrinkImage(file, max = 1600) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k);
      c.height = Math.round(im.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
    };
    im.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    im.src = url;
  });
}
