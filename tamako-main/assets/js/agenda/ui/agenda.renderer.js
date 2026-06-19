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
          "https://ui-avatars.com/api/?name=Barber&background=111111&color=bf953f&size=256"
        }"
        class="barber-photo"
        alt="${barbero.nombre_empleado || "Profesional"}"
      />
      <div class="barber-info">
        <div class="barber-name">
          ${barbero.nombre_empleado || "PROFESIONAL"}
        </div>
        <div class="barber-role">BARBER PRO</div>
      </div>
    </div>
  `;
  return header;
}

// 🎨 CREAR TARJETA DE CITA (Adaptada para citas y bloques disponibles)
function crearTarjetaCita(cita, esMovil = false) {
  const evento = document.createElement("div");

  // Si no tiene id_cita significa que es un bloque disponible generado sintéticamente
  const esDisponible = !cita.id_cita;

  evento.className = esDisponible
    ? "calendar-event disponible"
    : "calendar-event";

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

  const telefono = cita.telefono
    ? String(cita.telefono).replace(/\D/g, "")
    : "";
  const telefonoWhatsApp = telefono ? `57${telefono}` : "";
  const telefonoLlamar = telefono ? `tel:${telefono}` : "#";

  // Renderizado condicional según el estado del bloque
  evento.innerHTML = `
    <div class="event-glow"></div>
    <div class="event-top-row">
      <div class="event-hour">
        ${normalizarHora(cita.hora_inicio)} — ${normalizarHora(cita.hora_fin)}
      </div>
      ${
        esDisponible
          ? `<div class="event-chip chip-libre">Disponible</div>`
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
        <div class="event-service">
  ${
    esDisponible
      ? "Toca para agendar"
      : cita.servicio_nombre || cita.servicio || "Servicio no definido"
  }
</div>
      </div>
    </div>
    ${esDisponible ? "" : `<div class="event-phone">${cita.telefono || "Sin teléfono"}</div>`}
    
    ${
      esDisponible
        ? ""
        : `
    <div class="event-actions">
      <button class="event-btn whatsapp" onclick="event.stopPropagation(); ${telefonoWhatsApp ? `window.open('https://wa.me/${telefonoWhatsApp}', '_blank')` : "alert('No hay número')"}" title="WhatsApp">WA</button>
      <button class="event-btn call" onclick="event.stopPropagation(); ${telefonoLlamar !== "#" ? `window.location.href='${telefonoLlamar}'` : "alert('No hay número')"}" title="Llamar">📞</button>
      <button class="event-btn cancel" onclick="event.stopPropagation(); confirmarCancelacion('${cita.id_cita}')" title="Cancelar">✕</button>
    </div>
    `
    }
  `;

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
    );

    const horarioDia = obtenerHorarioDelDia(barbero, fechaSeleccionada);
    console.log("👨‍💼 BARBERO:", barbero.nombre_empleado);
    console.log("📆 FECHA:", fechaSeleccionada);
    console.log("🗂️ HORARIO SEMANAL:", barbero.horario_semanal);
    console.log("⏰ HORARIO DIA:", horarioDia);

    const HORARIO_INICIO = horaToMin(normalizarHora(horarioDia.inicio));

    const HORARIO_FIN = horaToMin(normalizarHora(horarioDia.fin));

    // Aplicamos bloques disponibles también en móvil para mantener sincronía
    const lineaTiempoCompleta = obtenerLineaTiempoCompleta(
      barbero.id_barbero,
      HORARIO_INICIO,
      HORARIO_FIN,
      citasOcupadas,
      40,
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
    );

    const horarioDia = obtenerHorarioDelDia(barbero, fechaSeleccionada);
    console.log("👨‍💼 BARBERO:", barbero.nombre_empleado);
    console.log("📆 FECHA:", fechaSeleccionada);
    console.log("🗂️ HORARIO SEMANAL:", barbero.horario_semanal);
    console.log("⏰ HORARIO DIA:", horarioDia);

    const HORARIO_INICIO = horaToMin(normalizarHora(horarioDia.inicio));

    const HORARIO_FIN = horaToMin(normalizarHora(horarioDia.fin));

    const lineaTiempoCompleta = obtenerLineaTiempoCompleta(
      barbero.id_barbero,
      HORARIO_INICIO,
      HORARIO_FIN,
      citasOcupadas,
      40,
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
) {
  let lineaTiempo = [];
  let tiempoActual = horarioInicioMin;

  const ocupadas = citasOcupadas.sort(
    (a, b) =>
      horaToMin(normalizarHora(a.hora_inicio)) -
      horaToMin(normalizarHora(b.hora_inicio)),
  );

  ocupadas.forEach((cita) => {
    const citaInicio = horaToMin(normalizarHora(cita.hora_inicio));
    const citaFin = horaToMin(normalizarHora(cita.hora_fin));

    while (tiempoActual + intervaloMin <= citaInicio) {
      lineaTiempo.push({
        id_barbero,
        hora_inicio: minToHora(tiempoActual),
        hora_fin: minToHora(tiempoActual + intervaloMin),
      });
      tiempoActual += intervaloMin;
    }

    lineaTiempo.push(cita);
    tiempoActual = citaFin;
  });

  while (tiempoActual + intervaloMin <= horarioFinMin) {
    lineaTiempo.push({
      id_barbero,
      hora_inicio: minToHora(tiempoActual),
      hora_fin: minToHora(tiempoActual + intervaloMin),
    });
    tiempoActual += intervaloMin;
  }

  return lineaTiempo;
}

// 🎯 RENDER PRINCIPAL (entry point)
export function renderizarAgenda({
  agendaGrid,
  listaBarberos = [],
  citasDelDia = [],
  fechaSeleccionada = new Date(),
}) {
  if (!agendaGrid) {
    console.error("❌ agendaGrid no encontrado");
    return;
  }

  agendaGrid.innerHTML = "";

  // ¡Ponemos esto aquí para que dibuje el minicalendario cada vez que se renderice la agenda!
  renderizarMiniCalendario(citasDelDia, fechaSeleccionada);

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
  citasDelDia = [],
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
    const fechaISO = copiaFecha.toISOString().split("T")[0];

    // Contamos cuántas de las citas cargadas pertenecen a este día exacto
    // (Nota: Si tu "citasDelDia" ya viene filtrado solo para el día seleccionado,
    // pasaremos un contador global del estado en el controller más adelante,
    // pero esta lógica base ya te dibuja los días perfectamente)
    const totalCitas = citasDelDia.filter((c) =>
      c.fecha === fechaISO || i === 0 ? c : false,
    ).length;

    const diaDiv = document.createElement("div");
    // Al primer día (hoy) le ponemos la clase active por defecto
    diaDiv.className = i === 0 ? "calendar-day active" : "calendar-day";

    // Le guardamos la fecha real en un atributo de datos por si quieres hacerle click
    diaDiv.dataset.fecha = fechaISO;

    diaDiv.innerHTML = `
      <span class="day-name">${nombreDia}</span>
      <span class="day-number">${numeroDia}</span>
      <span class="day-count">${totalCitas > 0 ? `${totalCitas} citas` : "Libre"}</span>
    `;

    // Evento por si el administrador toca un día del minicalendario
    diaDiv.addEventListener("click", () => {
      document
        .querySelectorAll(".calendar-day")
        .forEach((d) => d.classList.remove("active"));
      diaDiv.classList.add("active");

      // Lanza un evento personalizado para que tu agenda.controller.js sepa que debe cambiar de fecha
      console.log("📅 CLICK MINI CALENDARIO:", fechaISO);

      console.log("📅 CLICK MINI CALENDARIO:", fechaISO);

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
