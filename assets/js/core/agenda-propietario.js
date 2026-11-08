import { supabase } from '../config/supabaseClient.js';

export async function filtrarAgendaPropietario(profesionales, tiendaId) {
  const { data, error } = await supabase.from('tamaku_agenda_propietario')
    .select('id_profesional,visible').eq('id_tienda', tiendaId).maybeSingle();
  if (error) {
    // Instalaciones que aun no han aplicado la migracion conservan su agenda.
    if (['42P01', 'PGRST205'].includes(error.code)) return profesionales;
    throw error;
  }
  if (!data || data.visible || !data.id_profesional) return profesionales;
  return profesionales.filter(pro => String(pro.id_barbero) !== data.id_profesional);
}
