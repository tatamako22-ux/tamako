// Compatibilidad con proyectos que aun no tienen las RPC de resumen.
// Ordenar por una clave unica en createQuery. No inferir el final por una
// pagina corta: PostgREST puede imponer un limite inferior al solicitado.
export async function readAllPages(createQuery, pageSize = 500) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await createQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    offset += data.length;
  }
}

export function isMissingRpc(error) {
  return error?.code === "PGRST202" || error?.code === "42883";
}
