import { supabase } from '../config/supabaseClient.js';
export async function profesionalesVigentes(profesionales, tiendaId) {
  const { data, error } = await supabase.from('tamaku_equipo_retirado').select('id_profesional').eq('id_tienda', tiendaId);
  if (error) {
    if (['42P01','PGRST205'].includes(error.code)) return profesionales;
    throw error;
  }
  const retirados = new Set((data || []).map(p => String(p.id_profesional)));
  return profesionales.filter(p => !retirados.has(String(p.id_barbero)));
}
