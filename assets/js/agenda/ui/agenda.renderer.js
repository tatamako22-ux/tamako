import { horaToMin, minToHora, normalizarHora } from "../utils/agenda.utils.js";
// 📅 Obtener horario según el día seleccionado
function obtenerHorarioDelDia(barbero, fecha = new Date()) {
  if (!barbero.horario_semanal) {
    return {
      inicio: barbero.horario_inicio || "08:00",
      fin: barbero.horario_fin || "20:00",
    };
  }

  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];

  const diaActual = dias[fecha.getDay()];

  const horario = barbero.horario_semanal[diaActual];

  if (horario && horario.activo) {
    return {
      inicio: horario.inicio,
      fin: horario.fin,
    };
  }

  return {
    inicio: barbero.horario_inicio || "08:00",
    fin: barbero.horario_fin || "20:00",
  };
}

function normalizarTexto(valor = "") {
  return String(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function obtenerBloqueosProfesional(barbero, fecha, inicioJornada, finJornada) {
  const fechaISO = fecha.toLocaleDateString("sv-SE");
  const nombresDia = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const esDescanso = normalizarTexto(barbero.dia_descanso) === nombresDia[fecha.getDay()];
  const enVacaciones = barbero.vacaciones_inicio && barbero.vacaciones_fin
    && fechaISO >= barbero.vacaciones_inicio && fechaISO <= barbero.vacaciones_fin;

  if (esDescanso || enVacaciones) {
    return [{ hora_inicio: minToHora(inicioJornada), hora_fin: minToHora(finJornada), tipo: "no_disponible" }];
  }

  const bloqueos = [];
  if (barbero.almuerzo_inicio && Number(barbero.almuerzo_minutos) > 0) {
    const inicio = horaToMin(normalizarHora(barbero.almuerzo_inicio));
    bloqueos.push({ hora_inicio: minToHora(inicio), hora_fin: minToHora(inicio + Number(barbero.almuerzo_minutos)), tipo: "almuerzo" });
  }
  if (barbero.break_inicio && Number(barbero.break_minutos) > 0) {
    const inicio = horaToMin(normalizarHora(barbero.break_inicio));
    bloqueos.push({ hora_inicio: minToHora(inicio), hora_fin: minToHora(inicio + Number(barbero.break_minutos)), tipo: "descanso" });
  }
  return bloqueos;
}

// 🎨 SKELETON
export function renderSkeleton() {
  const agendaGrid = document.getElementById("agendaGrid");
  if (!agendaGrid) return;
  agendaGrid.innerHTML = `
    <div class="agenda-loading">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
}

// ⏰ HORARIOS BASE
function generarHorarios({ inicio = 480, fin = 1200, intervalo = 60 }) {
  const arr = [];
  for (let m = inicio; m <= fin; m += intervalo) {
    arr.push(m);
  }
  return arr;
}

// 🎨 CREAR HEADER DEL BARBERO
function crearHeaderBarbero(barbero) {
  const header = document.createElement("div");
  header.className = "calendar-barber";
  header.innerHTML = `
    <div class="barber-profile">
      <img
        src="${
          barbero.foto_url ||
          "https://ui-avatars.com/api/?name=Profesional&background=111111&color=bf953f&size=256"
        }"
        class="barber-photo"
        alt="${barbero.nombre_empleado || "Profesional"}"
      />
      <div class="barber-info">
        <div class="barber-name">
          ${barbero.nombre_empleado || "PROFESIONAL"}
        </div>
        <div class="barber-role">PROFESIONAL</div>
      </div>
    </div>
  `;
  return header;
}
// 🕒 Formato hora 12 horas AM / PM
function formatoHora12(hora) {
  if (!hora) return "";
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 || 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${periodo}`;
}

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return "fecha cercana";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${fechaISO}T12:00:00`));
}

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[caracter]);
}

function abrirDetalleReservasCercanas(cita) {
  let modal = document.getElementById("repeatBookingModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "repeatBookingModal";
    modal.className = "repeat-booking-modal";
    modal.innerHTML = `<div class="repeat-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="repeatBookingTitle"><button type="button" class="repeat-booking-close" aria-label="Cerrar">&times;</button><div class="repeat-booking-heading"><span><i class="fa-solid fa-eye"></i> ALERTA PREVENTIVA</span><h2 id="repeatBookingTitle">Reservas cercanas del cliente</h2><p>La reserva está permitida. Revisa si se trata de una reprogramación o de servicios diferentes.</p></div><div class="repeat-booking-list"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".repeat-booking-close").addEventListener("click", () => modal.classList.remove("visible"));
    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) modal.classList.remove("visible");
    });
  }

  const reservas = [
    {
      id_cita: cita.id_cita,
      fecha: cita.fecha,
      hora_inicio: cita.hora_inicio,
      hora_fin: cita.hora_fin,
      id_barbero: cita.id_barbero,
      profesional_nombre: cita.profesional_nombre || "Profesional actual",
      actual: true,
    },
    ...(cita.reservas_cercanas || []),
  ];
  const lista = modal.querySelector(".repeat-booking-list");
  lista.innerHTML = reservas.map((reserva) => `
    <article class="repeat-booking-item${reserva.actual ? " current" : ""}">
      <div class="repeat-booking-date"><strong>${reserva.actual ? "Cita seleccionada" : "Reserva relacionada"}</strong><span>${escaparHtml(formatearFechaCorta(reserva.fecha))}</span></div>
      <div class="repeat-booking-meta"><span><i class="fa-regular fa-clock"></i> ${escaparHtml(formatoHora12(reserva.hora_inicio))}${reserva.hora_fin ? ` - ${escaparHtml(formatoHora12(reserva.hora_fin))}` : ""}</span><span><i class="fa-solid fa-scissors"></i> ${escaparHtml(reserva.profesional_nombre)}</span></div>
      <button type="button" class="repeat-booking-go" data-fecha="${escaparHtml(reserva.fecha)}" data-barbero="${escaparHtml(reserva.id_barbero)}" data-cita="${escaparHtml(reserva.id_cita)}">Ir a esta cita <i class="fa-solid fa-arrow-right"></i></button>
    </article>
  `).join("");
  lista.querySelectorAll(".repeat-booking-go").forEach((boton) => {
    boton.addEventListener("click", () => {
      modal.classList.remove("visible");
      window.dispatchEvent(new CustomEvent("cambiar-fecha-agenda", {
        detail: {
          fecha: boton.dataset.fecha,
          idBarbero: boton.dataset.barbero,
          idCita: boton.dataset.cita,
        },
      }));
    });
  });
  modal.classList.add("visible");
  modal.querySelector(".repeat-booking-close").focus();
}
// 🎨 CREAR TARJETA DE CITA (Adaptada para citas y bloques disponibles)
function crearTarjetaCita(cita, esMovil = false) {
  const evento = document.createElement("div");

  // Si no tiene id_cita significa que es un bloque disponible generado sintéticamente
  const esDisponible = !cita.id_cita;
  const factura = Array.isArray(cita.facturas)
    ? cita.facturas[0]
    : cita.facturas;
  const esFacturada = Boolean(factura?.id_factura);
  const esNoAsistio = String(cita.estado || "").toUpperCase() === "NO_ASISTIO";
  const reservaCercana = Array.isArray(cita.reservas_cercanas)
    ? cita.reservas_cercanas[0]
    : null;

  evento.className = esDisponible
    ? "calendar-event disponible"
    : `calendar-event${esFacturada ? " facturada" : ""}${esNoAsistio ? " no-show" : ""}`;
  if (cita.id_cita) evento.dataset.idCita = cita.id_cita;

  if (esMovil) {
    evento.style.position = "relative";
    evento.style.top = "auto";
    evento.style.left = "auto";
    evento.style.right = "auto";
    evento.style.marginBottom = "0";
    evento.style.width = "100%";
  }

  // Si está disponible, le añadimos un evento de clic para abrir tu modal de reserva
  if (esDisponible) {
    evento.setAttribute(
      "onclick",
      `abrirModalReserva('${cita.id_barbero}', '${cita.hora_inicio}', '${cita.hora_fin}')`,
    );
  }
  const telefono = cita.telefono_cliente
    ? String(cita.telefono_cliente).replace(/\D/g, "")
    : "";
  const telefonoWhatsApp = telefono ? `57${telefono}` : "";
  const telefonoLlamar = telefono ? `tel:${telefono}` : "#";
  // Renderizado condicional según el estado del bloque
  evento.innerHTML = `
    <div class="event-glow"></div>
    <div class="event-top-row">
      <div class="event-hour">
        ${formatoHora12(normalizarHora(cita.hora_inicio))} — ${formatoHora12(normalizarHora(cita.hora_fin))}
      </div>
      ${
        esDisponible
          ? `<div class="event-chip chip-libre">Disponible</div>`
          : esNoAsistio
            ? `<div class="event-chip chip-no-show"><i class="fa-solid fa-user-xmark"></i> No asistió</div>`
          : esFacturada
            ? `<div class="event-chip chip-facturada"><i class="fa-solid fa-circle-check"></i> Facturada</div>`
            : `<div class="event-chip">Confirmada</div>`
      }
    </div>
    <div class="event-main">
      <div class="event-avatar">
        ${esDisponible ? "+" : cita.nombre_cliente?.charAt(0) || "?"}
      </div>
      <div class="event-data">
        <div class="event-client">
          ${esDisponible ? "Espacio Disponible" : cita.nombre_cliente || "Cliente"}
        </div>
        ${esDisponible ? "" : `<div class="event-client-category category-${String(cita.categoria_cliente || "NUEVO").toLowerCase()}"><i class="fa-solid ${cita.categoria_cliente === "VIP" ? "fa-crown" : cita.categoria_cliente === "FRECUENTE" ? "fa-repeat" : "fa-user-plus"}"></i> ${cita.categoria_cliente || "NUEVO"}${cita.visitas_cliente ? ` · ${cita.visitas_cliente} visita${cita.visitas_cliente === 1 ? "" : "s"}` : ""}</div>`}
        ${cita.reserva_repetida && reservaCercana ? `<button type="button" class="event-repeat-warning" title="Ver las reservas cercanas de este cliente"><i class="fa-solid fa-eye"></i><span>Revisar reserva repetida</span><small>${reservaCercana.dias_diferencia === 0 ? "Otra cita el mismo día" : `Otra cita el ${formatearFechaCorta(reservaCercana.fecha)}`}</small></button>` : ""}
        ${cita.cliente_bloqueado ? `<div class="event-client-blocked"><i class="fa-solid fa-ban"></i> Cliente bloqueado <small>${cita.bloqueo_cliente_alcance}</small></div>` : ""}
        <div class="event-service">
  ${
    esDisponible
      ? "Toca para agendar"
      : cita.servicio_nombre || cita.servicio || "Servicio no definido"
  }
</div>
      </div>
    </div>
    ${
      esFacturada
        ? `<div class="event-invoice-status">
            <span><i class="fa-solid fa-receipt"></i> ${factura.metodo_pago || "Pagada"}</span>
            <strong>${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(Number(factura.total) || 0)}</strong>
          </div>`
        : ""
    }
    ${esDisponible ? "" : `<div class="event-phone">${cita.telefono_cliente || "Sin teléfono"}</div>`}
    
    ${
      esDisponible
        ? ""
        : `
    <div class="event-actions">
      ${
        esFacturada || esNoAsistio
          ? `<button type="button" class="event-btn ${esNoAsistio ? "no-show" : "cobrada"}" title="${esNoAsistio ? "Cita marcada como no asistió" : "Esta cita ya fue facturada"}" disabled>
              <i class="fa-solid ${esNoAsistio ? "fa-user-xmark" : "fa-receipt"}"></i>
            </button>`
          : `<button type="button" class="event-btn cobrar"
              onclick="event.stopPropagation(); window.abrirFacturacionDesdeCita(${JSON.stringify(cita).replace(/"/g, "&quot;")})"
              title="Finalizar y cobrar">
              <i class="fa-solid fa-money-bill-wave"></i>
            </button>`
      }

      <button type="button" class="event-btn edit"
onclick="event.stopPropagation(); window.abrirModalEditarAgenda('${cita.id_cita || cita.id || ""}', '${(cita.nombre_cliente || "").replace(/'/g, "\\'")}', '${cita.telefono_cliente || cita.telefono || ""}')"
title="Editar Cliente"
style="background: rgba(191,149,63,0.15); border: 1px solid rgba(191,149,63,0.4); color: var(--gold-light); cursor: pointer;">
<i class="fa-solid fa-pen"></i>
</button>
      <button class="event-btn whatsapp"
onclick="event.stopPropagation(); abrirWhatsappCita(${JSON.stringify(cita).replace(/"/g, "&quot;")})"
title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
      ${
        esFacturada || esNoAsistio
          ? ""
          : `<button class="event-btn no-show" onclick="event.stopPropagation(); confirmarNoAsistencia('${cita.id_cita}', '${(cita.nombre_cliente || "el cliente").replace(/'/g, "\\'")}')" title="Marcar que no asistió"><i class="fa-solid fa-user-xmark"></i></button>
             <button class="event-btn cancel" onclick="event.stopPropagation(); confirmarCancelacion('${cita.id_cita}')" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>`
      }
    </div>
    `
    }
  `;

  evento.querySelector(".event-repeat-warning")?.addEventListener("click", (event) => {
    event.stopPropagation();
    abrirDetalleReservasCercanas(cita);
  });

  return evento;
}

// 📱 RENDER MODO MÓVIL (ACTUALIZADO CON BLOQUES LIBRES)
function renderModoMovil({
  agendaGrid,
  listaBarberos = [],
  citasDelDia = [],
  fechaSeleccionada = new Date(),
}) {
  const mobileSelector = document.getElementById("mobileBarberSelector");

  let barberosMostrar = [...listaBarberos];
  if (mobileSelector && mobileSelector.value && mobileSelector.value !== "") {
    barberosMostrar = barberosMostrar.filter(
      (b) => String(b.id_barbero) === String(mobileSelector.value),
    );
  }

  barberosMostrar.forEach((barbero) => {
    const columna = document.createElement("div");
    columna.className = "calendar-column";

    const header = crearHeaderBarbero(barbero);
    columna.appendChild(header);

    const bodyMovil = document.createElement("div");
    bodyMovil.className = "calendar-body calendar-body-movil";
    bodyMovil.style.position = "relative";
    bodyMovil.style.minHeight = "auto";
    bodyMovil.style.padding = "12px";
    bodyMovil.style.display = "flex";
    bodyMovil.style.flexDirection = "column";
    bodyMovil.style.gap = "20px";

    const citasOcupadas = citasDelDia.filter(
      (c) => String(c.id_barbero) === String(barbero.id_barbero),
    ).map((c) => ({ ...c, profesional_nombre: barbero.nombre_empleado || "Profesional" }));

    const horarioDia = obtenerHorarioDelDia(barbero, fechaSeleccionada);

    const HORARIO_INICIO = horaToMin(normalizarHora(horarioDia.inicio));

    const HORARIO_FIN = horaToMin(normalizarHora(horarioDia.fin));

    // Aplicamos bloques disponibles también en móvil para mantener sincronía
    const lineaTiempoCompleta = obtenerLineaTiempoCompleta(
      barbero.id_barbero,
      HORARIO_INICIO,
      HORARIO_FIN,
      citasOcupadas,
      parseInt(barbero.intervalo_citas, 10) || 40,
      barbero,
      fechaSeleccionada,
    );

    if (lineaTiempoCompleta.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "empty-message";
      emptyMsg.textContent = "No hay bloques para este día";
      emptyMsg.style.color = "#aaa";
      emptyMsg.style.textAlign = "center";
      emptyMsg.style.padding = "40px 20px";
      bodyMovil.appendChild(emptyMsg);
    } else {
      lineaTiempoCompleta.forEach((bloque) => {
        const tarjeta = crearTarjetaCita(bloque, true);
        bodyMovil.appendChild(tarjeta);
      });
    }

    columna.appendChild(bodyMovil);
    agendaGrid.appendChild(columna);
  });
}

// 💻 RENDER MODO ESCRITORIO (ESTILO LADRILLOS ANCHO MÁXIMO - CORREGIDO)
function renderModoEscritorio({
  agendaGrid,
  listaBarberos = [],
  citasDelDia = [],
  fechaSeleccionada = new Date(),
}) {
  // CORRECCIÓN 1: Limpieza total obligatoria del contenedor antes de dibujar
  agendaGrid.innerHTML = "";

  const mobileSelector = document.getElementById("mobileBarberSelector");
  let barberosMostrar = [...listaBarberos];

  // CORRECCIÓN 2: Validación estricta del filtro para evitar mezclas
  if (
    mobileSelector &&
    mobileSelector.value &&
    mobileSelector.value !== "" &&
    mobileSelector.value !== "todos"
  ) {
    barberosMostrar = barberosMostrar.filter(
      (b) => String(b.id_barbero) === String(mobileSelector.value),
    );
  }

  // Ajuste de columnas en base al filtro seleccionado
  if (barberosMostrar.length === 1) {
    agendaGrid.style.setProperty("grid-template-columns", "1fr", "important");
  } else {
    agendaGrid.style.setProperty(
      "grid-template-columns",
      "repeat(auto-fit, minmax(500px, 1fr))",
      "important",
    );
  }

  barberosMostrar.forEach((barbero) => {
    const columna = document.createElement("div");
    columna.className = "calendar-column";

    const header = crearHeaderBarbero(barbero);
    columna.appendChild(header);

    const body = document.createElement("div");
    body.className = "calendar-body";

    // CORRECCIÓN 3: Filtrar las citas de manera aislada por CADA profesional recorrido
    const citasOcupadas = citasDelDia.filter(
      (c) => String(c.id_barbero) === String(barbero.id_barbero),
    ).map((c) => ({ ...c, profesional_nombre: barbero.nombre_empleado || "Profesional" }));

    const horarioDia = obtenerHorarioDelDia(barbero, fechaSeleccionada);

    const HORARIO_INICIO = horaToMin(normalizarHora(horarioDia.inicio));

    const HORARIO_FIN = horaToMin(normalizarHora(horarioDia.fin));

    const lineaTiempoCompleta = obtenerLineaTiempoCompleta(
      barbero.id_barbero,
      HORARIO_INICIO,
      HORARIO_FIN,
      citasOcupadas,
      parseInt(barbero.intervalo_citas, 10) || 40,
      barbero,
      fechaSeleccionada,
    );

    lineaTiempoCompleta.forEach((bloque) => {
      const tarjeta = crearTarjetaCita(bloque, false);
      body.appendChild(tarjeta);
    });

    columna.appendChild(body);
    agendaGrid.appendChild(columna);
  });
}

// ⚡ CALCULAR BLOQUES DISPONIBLES EN LOS HUECOS
function obtenerLineaTiempoCompleta(
  id_barbero,
  horarioInicioMin,
  horarioFinMin,
  citasOcupadas,
  intervaloMin = 40,
  barbero = null,
  fecha = new Date(),
) {
  const bloqueos = barbero
    ? obtenerBloqueosProfesional(barbero, fecha, horarioInicioMin, horarioFinMin)
    : [];
  const ocupadas = [...citasOcupadas].sort(
    (a, b) =>
      horaToMin(normalizarHora(a.hora_inicio)) -
      horaToMin(normalizarHora(b.hora_inicio)),
  );
  const ocupadasParaCruce = [...ocupadas, ...bloqueos];

  // Los bloques libres siempre quedan anclados al inicio de la jornada. Una
  // cita de 55 min con intervalo de 40 ocupa por solapamiento dos bloques,
  // pero no desplaza toda la cuadricula 15 minutos hacia adelante.
  const libres = [];
  for (
    let inicio = horarioInicioMin;
    inicio + intervaloMin <= horarioFinMin;
    inicio += intervaloMin
  ) {
    const fin = inicio + intervaloMin;
    const seCruza = ocupadasParaCruce.some((cita) => {
      const citaInicio = horaToMin(normalizarHora(cita.hora_inicio));
      const citaFin = horaToMin(normalizarHora(cita.hora_fin));
      return inicio < citaFin && fin > citaInicio;
    });

    if (!seCruza) {
      libres.push({
        id_barbero,
        hora_inicio: minToHora(inicio),
        hora_fin: minToHora(fin),
      });
    }
  }

  return [...ocupadas, ...libres].sort(
    (a, b) =>
      horaToMin(normalizarHora(a.hora_inicio)) -
      horaToMin(normalizarHora(b.hora_inicio)),
  );
}

// 🎯 RENDER PRINCIPAL (entry point)
export function renderizarAgenda({
  agendaGrid,
  listaBarberos = [],
  citasDelDia = [],
  conteoCitasSemana = {},
  fechaSeleccionada = new Date(),
}) {
  if (!agendaGrid) {
    console.error("❌ agendaGrid no encontrado");
    return;
  }

  agendaGrid.innerHTML = "";

  // ¡Ponemos esto aquí para que dibuje el minicalendario cada vez que se renderice la agenda!
  renderizarMiniCalendario(conteoCitasSemana, fechaSeleccionada);

  const esMobile =
    window.innerWidth <= 900 || window.matchMedia("(max-width: 900px)").matches;

  if (listaBarberos.length === 0) {
    agendaGrid.innerHTML = `
      <div class="empty-state">
        <p>No hay profesionales disponibles</p>
      </div>
    `;
    return;
  }

  if (esMobile) {
    renderModoMovil({
      agendaGrid,
      listaBarberos,
      citasDelDia,
      fechaSeleccionada,
    });
  } else {
    renderModoEscritorio({
      agendaGrid,
      listaBarberos,
      citasDelDia,
      fechaSeleccionada,
    });
  }
}

// 🔄 Función para refrescar la agenda
export function refrescarAgenda({
  listaBarberos = [],
  citasDelDia = [],
  fechaSeleccionada = new Date(),
}) {
  const agendaGrid = document.getElementById("agendaGrid");
  if (!agendaGrid) return;

  renderizarAgenda({
    agendaGrid,
    listaBarberos,
    citasDelDia,
    fechaSeleccionada,
  });
}

// 📏 Escuchar cambios de tamaño de pantalla para refrescar
let timeoutResize;
window.addEventListener("resize", () => {
  clearTimeout(timeoutResize);
  timeoutResize = setTimeout(() => {
    const agendaGrid = document.getElementById("agendaGrid");
    if (agendaGrid && agendaGrid.children.length > 0) {
      window.dispatchEvent(new CustomEvent("agenda-resize"));
    }
  }, 250);
});
// 🗓️ RENDERIZAR MINI CALENDARIO DINÁMICO
export function renderizarMiniCalendario(
  conteoCitasSemana = {},
  fechaSeleccionada = new Date(),
) {
  const container = document.getElementById("miniCalendarStrip");
  if (!container) return;

  container.innerHTML = "";

  // Generamos los próximos 7 días a partir de hoy
  const hoy = new Date(fechaSeleccionada);
  const diasSemana = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

  for (let i = 0; i < 7; i++) {
    const copiaFecha = new Date(hoy);
    copiaFecha.setDate(hoy.getDate() + i);

    const nombreDia = diasSemana[copiaFecha.getDay()];
    const numeroDia = String(copiaFecha.getDate()).padStart(2, "0");

    // Formato YYYY-MM-DD para comparar de manera segura con tus datos de Supabase
    const fechaISO = copiaFecha.toLocaleDateString("sv-SE");

    // Contamos cuántas de las citas cargadas pertenecen a este día exacto
    // (Nota: Si tu "citasDelDia" ya viene filtrado solo para el día seleccionado,
    // pasaremos un contador global del estado en el controller más adelante,
    // pero esta lógica base ya te dibuja los días perfectamente)
    const totalCitas = Number(conteoCitasSemana[fechaISO] || 0);

    const diaDiv = document.createElement("div");
    // Al primer día (hoy) le ponemos la clase active por defecto
    diaDiv.className = i === 0 ? "calendar-day active" : "calendar-day";

    // Le guardamos la fecha real en un atributo de datos por si quieres hacerle click
    diaDiv.dataset.fecha = fechaISO;

    diaDiv.innerHTML = `
      <span class="day-name">${nombreDia}</span>
      <span class="day-number">${numeroDia}</span>
      <span class="day-count">${totalCitas > 0 ? `${totalCitas} ${totalCitas === 1 ? "cita" : "citas"}` : "Libre"}</span>
    `;

    // Evento por si el administrador toca un día del minicalendario
    diaDiv.addEventListener("click", () => {
      document
        .querySelectorAll(".calendar-day")
        .forEach((d) => d.classList.remove("active"));
      diaDiv.classList.add("active");

      // Lanza un evento personalizado para que tu agenda.controller.js sepa que debe cambiar de fecha
      window.dispatchEvent(
        new CustomEvent("cambiar-fecha-agenda", {
          detail: {
            fecha: fechaISO,
          },
        }),
      );
    });

    container.appendChild(diaDiv);
  }
}
window.abrirWhatsappCita = function (cita) {
  const telefono = cita.telefono_cliente
    ? String(cita.telefono_cliente).replace(/\D/g, "")
    : "";

  if (!telefono) {
    alert("No hay número de teléfono");
    return;
  }

  const tienda = window.TIENDA_ACTUAL?.nombre || "kleos";

  const mensaje = `Buen día 👋
Te escribimos desde *${tienda}* para confirmar tu cita.

📅 Hora: ${cita.hora_inicio} - ${cita.hora_fin}


¡Te esperamos ${cita.nombre_cliente || ""}! 💈`;

  const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
};
// 💰 ABRIR FACTURACIÓN DESDE LA AGENDA
window.abrirFacturacionDesdeCita = function (cita) {
  console.log("Llevando cita a facturación:", cita);

  // Guardamos la cita en la memoria temporal del navegador
  localStorage.setItem("facturar_cita", JSON.stringify(cita));

  // Redireccionamos a la pantalla de facturación
  window.location.href = "facturacion.html"; // Ajusta la ruta si es necesario (ej. "../pages/facturacion.html")
};
