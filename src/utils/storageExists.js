import { supabase } from '../lib/supabaseClient';

// Dice si existe un archivo en el bucket público, sin generar errores rojos en la consola
export async function storageObjectExists(path, bucket = 'public-images') {
  const i = path.lastIndexOf('/');
  const folder = i >= 0 ? path.slice(0, i) : '';
  const name = i >= 0 ? path.slice(i + 1) : path;
  try {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { search: name, limit: 5 });
    if (error) return false;
    return (data || []).some((f) => f.name === name);
  } catch {
    return false;
  }
}
