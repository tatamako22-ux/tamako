const PERMISOS_VALIDOS = new Set([
  "dashboard_ver", "agenda_ver", "agenda_gestionar", "agenda_solo_propias",
  "clientes_ver", "clientes_gestionar", "profesionales_ver",
  "profesionales_gestionar", "facturacion_ver", "facturas_crear",
  "cuentas_gestionar", "caja_gestionar", "reportes_ver", "ajustes_ver",
  "usuarios_gestionar",
]);

function responder(res, estado, contenido) {
  return res.status(estado).json(contenido);
}

async function supabaseRequest(url, serviceKey, ruta, opciones = {}) {
  return fetch(`${url}${ruta}`, {
    ...opciones,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return responder(res, 500, { error: "La API de usuarios no está configurada en el servidor." });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return responder(res, 401, { error: "Sesión no válida." });

  const usuarioResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!usuarioResponse.ok) return responder(res, 401, { error: "La sesión expiró." });
  const propietario = await usuarioResponse.json();

  const { tienda_id, nombre, email, password, rol, id_profesional, permisos = {} } = req.body || {};
  if (!tienda_id || !nombre?.trim() || !email?.trim()) return responder(res, 400, { error: "Nombre, correo y tienda son obligatorios." });
  if (!password || password.length < 8) return responder(res, 400, { error: "La contraseña debe tener mínimo 8 caracteres." });
  if (!["ADMINISTRADOR", "EMPLEADO"].includes(rol)) return responder(res, 400, { error: "El rol seleccionado no es válido." });

  const tiendaQuery = `/rest/v1/tiendas?select=id&id=eq.${encodeURIComponent(tienda_id)}&user_id=eq.${encodeURIComponent(propietario.id)}`;
  const tiendaResponse = await supabaseRequest(supabaseUrl, serviceKey, tiendaQuery);
  const tiendas = await tiendaResponse.json();
  if (!tiendaResponse.ok || !tiendas.length) return responder(res, 403, { error: "Solo el propietario puede crear usuarios de esta tienda." });

  if (id_profesional) {
    const profesionalQuery = `/rest/v1/profesionales?select=id_barbero&id_barbero=eq.${encodeURIComponent(id_profesional)}&id_tienda=eq.${encodeURIComponent(tienda_id)}`;
    const profesionalResponse = await supabaseRequest(supabaseUrl, serviceKey, profesionalQuery);
    const profesionales = await profesionalResponse.json();
    if (!profesionalResponse.ok || !profesionales.length) return responder(res, 400, { error: "El profesional no pertenece a esta tienda." });
  }

  const permisosLimpios = Object.fromEntries(
    Object.entries(permisos).filter(([clave]) => PERMISOS_VALIDOS.has(clave)).map(([clave, valor]) => [clave, Boolean(valor)]),
  );
  const authResponse = await supabaseRequest(supabaseUrl, serviceKey, "/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre.trim(), tipo: "equipo_tamaku" },
    }),
  });
  const authUser = await authResponse.json();
  if (!authResponse.ok) return responder(res, authResponse.status, { error: authUser.msg || authUser.message || "No se pudo crear la cuenta." });

  const perfilResponse = await supabaseRequest(supabaseUrl, serviceKey, "/rest/v1/perfiles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: authUser.id,
      tienda_id,
      id_profesional: id_profesional || null,
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      rol,
      activo: true,
      permisos: permisosLimpios,
    }),
  });
  const perfil = await perfilResponse.json();
  if (!perfilResponse.ok) {
    await supabaseRequest(supabaseUrl, serviceKey, `/auth/v1/admin/users/${authUser.id}`, { method: "DELETE" });
    return responder(res, 400, { error: perfil.message || "No se pudo vincular el usuario con la tienda." });
  }

  return responder(res, 201, { usuario: { id: authUser.id, email: authUser.email }, perfil: perfil[0] });
}
