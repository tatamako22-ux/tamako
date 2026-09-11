import { supabase } from "../config/supabaseClient.js";
import { isMissingRpc } from "../core/read-pages.js";

const unavailable = new Set();
export async function optionalSummary(name, args) {
  if (unavailable.has(name)) return null;
  const { data, error } = await supabase.rpc(name, args);
  if (isMissingRpc(error)) { unavailable.add(name); return null; }
  if (error) throw error; // No ocultar errores de permisos o de base de datos.
  return data;
}
