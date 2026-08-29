import { supabase } from "../config/supabaseClient.js";

const escapar = (valor = "") => String(valor)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function fechaBogota(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function sumarDias(fecha, dias) {
  const resultado = new Date(`${fecha}T12:00:00-05:00`);
  resultado.setDate(resultado.getDate() + dias);
  return fechaBogota(resultado);
}

function claveEvento(cita) {
  return `${cita.id_cita}:${cita.cancelada_en || "sin-fecha"}`;
}

function etiquetaGrupo(fecha, hoy, manana) {
  if (fecha === hoy) return "HOY";
  if (fecha === manana) return "MAÑANA";
  return "PRÓXIMAS";
}

function descripcionOrigen(cita) {
  const tipo = String(cita.cancelada_por_tipo || "").toUpperCase();
  const profesional = cita.profesionales?.nombre_empleado || "El profesional";
  if (tipo === "CLIENTE") return "Cancelada por el cliente";
  if (tipo === "PROFESIONAL") return `${profesional} canceló la cita`;
  if (tipo === "PROPIETARIO") return "Cancelada por el propietario";
  if (tipo === "EQUIPO") return "Cancelada por el equipo";
  return "Cancelación registrada";
}

function crearInterfaz() {
  if (document.getElementById("tamakuCancellationAlert")) return;

  const boton = document.createElement("button");
  boton.id = "tamakuCancellationBell";
  boton.className = "tamaku-cancellation-bell";
  boton.type = "button";
  boton.hidden = true;
  boton.setAttribute("aria-label", "Ver cancelaciones recientes");
  boton.innerHTML = `<i class="fa-solid fa-calendar-xmark"></i><span>0</span>`;

  const modal = document.createElement("div");
  modal.id = "tamakuCancellationAlert";
  modal.className = "tamaku-cancellation-overlay";
  modal.innerHTML = `
    <section class="tamaku-cancellation-card" role="dialog" aria-modal="true" aria-labelledby="tamakuCancellationTitle">
      <div class="tamaku-cancellation-accent"><i class="fa-solid fa-bell"></i></div>
      <div class="tamaku-cancellation-heading">
        <div><small>ALERTA DE AGENDA</small><h2 id="tamakuCancellationTitle">Cancelaciones pendientes</h2></div>
        <button type="button" data-cerrar aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p class="tamaku-cancellation-intro">Se liberaron estos espacios de tu agenda.</p>
      <div class="tamaku-cancellation-groups"></div>
      <div class="tamaku-cancellation-actions">
        <a href="agenda.html">Abrir agenda</a>
        <button type="button" data-entendido>Entendido</button>
      </div>
    </section>`;

  document.body.append(boton, modal);
}

export function initCancellationAlerts(tienda) {
  if (!tienda?.id || window.__tamakuCancellationAlerts) return () => {};
  window.__tamakuCancellationAlerts = true;
  crearInterfaz();

  const usuarioId = tienda.sesion?.user_id;
  const profesionalId = tienda.sesion?.id_profesional;
  const esPropietario = Boolean(tienda.sesion?.es_propietario);
  const storageKey = `tamaku_cancelaciones_vistas:${usuarioId}:${tienda.id}`;
  const modal = document.getElementById("tamakuCancellationAlert");
  const boton = document.getElementById("tamakuCancellationBell");
  const contenedor = modal.querySelector(".tamaku-cancellation-groups");
  let actuales = [];
  let consultando = false;
  let temporizador;

  const leerVistas = () => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey)) || []); }
    catch { return new Set(); }
  };

  const guardarVistas = (citas) => {
    const vistas = leerVistas();
    citas.forEach((cita) => vistas.add(claveEvento(cita)));
    localStorage.setItem(storageKey, JSON.stringify([...vistas].slice(-200)));
  };

  const renderizar = (citas, nuevas = []) => {
    actuales = citas;
    const hoy = fechaBogota();
    const manana = sumarDias(hoy, 1);
    const grupos = ["HOY", "MAÑANA", "PRÓXIMAS"];

    contenedor.innerHTML = grupos.map((grupo) => {
      const elementos = citas.filter((cita) => etiquetaGrupo(cita.fecha, hoy, manana) === grupo);
      if (!elementos.length) return "";
      return `<section class="tamaku-cancellation-group">
        <h3>${grupo}<span>${elementos.length}</span></h3>
        ${elementos.map((cita) => `
          <article class="tamaku-cancellation-item ${nuevas.some((nueva) => claveEvento(nueva) === claveEvento(cita)) ? "is-new" : ""}">
            <time>${escapar(cita.hora_inicio?.slice(0, 5) || "--:--")}</time>
            <div><strong>${escapar(cita.nombre_cliente || "Cliente")}</strong><span>${escapar(cita.servicio_nombre || "Servicio")} · ${escapar(cita.profesionales?.nombre_empleado || "Sin asignar")}</span></div>
            <small>${escapar(descripcionOrigen(cita))}</small>
          </article>`).join("")}
      </section>`;
    }).join("");

    boton.hidden = citas.length === 0;
    boton.querySelector("span").textContent = String(nuevas.length || citas.length);
    boton.classList.toggle("has-new", nuevas.length > 0);
  };

  const abrir = (citas = actuales) => {
    if (!citas.length) return;
    renderizar(actuales, citas);
    modal.classList.add("is-visible");
    navigator.vibrate?.([80, 45, 80]);
  };

  const cerrar = () => {
    guardarVistas(actuales);
    modal.classList.remove("is-visible");
    boton.classList.remove("has-new");
    boton.querySelector("span").textContent = String(actuales.length);
  };

  const consultar = async ({ mostrar = true } = {}) => {
    if (consultando) return;
    consultando = true;
    try {
      let query = supabase
        .from("citas")
        .select("id_cita,nombre_cliente,servicio_nombre,fecha,hora_inicio,cancelada_en,cancelada_por_tipo,cancelada_por_user_id,profesionales(nombre_empleado)")
        .eq("id_tienda", tienda.id)
        .eq("estado", "CANCELADA")
        .gte("fecha", fechaBogota())
        .order("fecha", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (!esPropietario && profesionalId) query = query.eq("id_barbero", profesionalId);
      const { data, error } = await query;
      if (error) throw error;

      const visibles = data || [];
      const vistas = leerVistas();
      const nuevas = visibles.filter((cita) => !vistas.has(claveEvento(cita)));
      renderizar(visibles, nuevas);
      if (mostrar && nuevas.length) abrir(nuevas);
    } catch (error) {
      console.warn("No se pudieron consultar las alertas de cancelación:", error);
    } finally {
      consultando = false;
    }
  };

  const programarConsulta = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => consultar(), 450);
  };

  boton.addEventListener("click", () => abrir(actuales));
  modal.querySelector("[data-cerrar]").addEventListener("click", cerrar);
  modal.querySelector("[data-entendido]").addEventListener("click", cerrar);
  modal.addEventListener("click", (event) => { if (event.target === modal) cerrar(); });

  const canal = supabase
    .channel(`cancelaciones-global-${tienda.id}-${usuarioId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "citas",
      filter: `id_tienda=eq.${tienda.id}`,
    }, programarConsulta)
    .subscribe();

  window.addEventListener("focus", programarConsulta);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") programarConsulta();
  });
  const intervalo = setInterval(() => {
    if (document.visibilityState === "visible") consultar({ mostrar: true });
  }, 60000);

  window.addEventListener("pagehide", () => {
    clearTimeout(temporizador);
    clearInterval(intervalo);
    supabase.removeChannel(canal);
  }, { once: true });

  consultar();
  return () => supabase.removeChannel(canal);
}
