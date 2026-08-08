import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://smibbddmwgdmqpwsuaqr.supabase.co";
const supabaseKey = "sb_publishable_kQQ7ldmjql3V5Jbn9jvxYw_IAoSz1Uj";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Función de ayuda para obtener la tienda actual de forma segura
export function getTiendaId() {
  const tienda = JSON.parse(localStorage.getItem("tamaku_tienda"));
  if (!tienda || !tienda.id) {
    window.location.href = "index.html";
    return null;
  }
  return tienda;
}
