import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Faltan las variables de entorno de Supabase. Revisá que exista un archivo .env en la raíz del proyecto con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y reiniciá `npm run dev`.'
  );
}

export const supabase = createClient(url, anonKey);