export const normalizarTelefono = (valor) => String(valor || "").replace(/\D/g, "").slice(-10);
export function clavesCliente(cita) {
  const claves = [];
  if (cita.user_id) claves.push(`usuario:${cita.user_id}`);
  const telefono = normalizarTelefono(cita.telefono_cliente);
  if (telefono.length >= 7 && !/^0+$/.test(telefono)) claves.push(`telefono:${telefono}`);
  const email = String(cita.email_cliente || "").trim().toLowerCase();
  if (email.includes("@")) claves.push(`email:${email}`);
  return claves;
}
export function indexarCitas(citas) {
  const indice = new Map();
  for (const cita of citas) for (const clave of clavesCliente(cita)) {
    if (!indice.has(clave)) indice.set(clave, []);
    indice.get(clave).push(cita);
  }
  return indice;
}
export function citasDelCliente(indice, cita) {
  const unicas = new Map();
  for (const clave of clavesCliente(cita)) for (const otra of indice.get(clave) || []) {
    if (String(otra.id_cita) !== String(cita.id_cita)) unicas.set(String(otra.id_cita), otra);
  }
  return [...unicas.values()];
}
