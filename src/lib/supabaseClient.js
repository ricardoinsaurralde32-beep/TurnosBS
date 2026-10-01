import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Faltan las variables de entorno de Supabase. Revisá que exista un archivo .env en la raíz del proyecto con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y reiniciá `npm run dev`.'
  );
}

// La sesión se guarda en el navegador (localStorage) y el token se renueva solo, así no hay que
// volver a iniciar sesión cada rato. Ojo: cada dirección (localhost:5173, localhost:3000,
// turnosbs.com.ar...) guarda su propia sesión, por eso conviene usar siempre la misma.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});