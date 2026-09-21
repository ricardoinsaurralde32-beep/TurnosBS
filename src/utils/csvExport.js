// Genera y descarga un CSV a partir de un array de objetos.
// Se abre directo en Excel, sin necesitar ninguna librería extra.

function escapeCsvValue(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename, rows, columns) {
  // columns: [{ key, label }]
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(','));
  const csv = '\uFEFF' + [header, ...lines].join('\r\n'); // BOM: para que Excel lea bien los acentos

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}