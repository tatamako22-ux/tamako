import {
  horaToMin,
  minToTime12,
  normalizarHora,
} from "../utils/agenda.utils.js";

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

// ⏰ GENERAR HORARIOS
function generarHorarios({
  inicio = 480, // 8AM
  fin = 1200, // 8PM
  intervalo = 60,
}) {
  const horarios = [];

  for (let min = inicio; min <= fin; min += intervalo) {
    horarios.push(min);
  }

  return horarios;
}

// 🟢 SLOT LIBRE
function crearSlotLibre({ hora, barbero }) {
  return `

        <div
            class="agenda-slot libre"

            onclick="
                abrirModalReserva(
                    '${barbero.id_barbero}',
                    '${hora}',
                    '${barbero.nombre_empleado}'
                )
            "
        >

            <div class="slot-top">

                <span class="slot-hour">
                    ${hora}
                </span>

                <span class="slot-badge">
                    Disponible
                </span>

            </div>

        </div>

    `;
}

// 🔴 SLOT RESERVADO
function crearSlotReservado({ cita }) {
  return `

        <div
            class="agenda-slot reservado"

            onclick="
                confirmarCancelacion(
                    '${cita.id_cita}'
                )
            "
        >

            <div class="cliente">

                ${cita.nombre_cliente}

            </div>

            <div class="servicio">

                ${cita.servicio_nombre || "SERVICIO"}

            </div>

            <div class="hora">

                ${normalizarHora(cita.hora_inicio)}

            </div>

        </div>

    `;
}

// 🎨 RENDER PRINCIPAL
export function renderizarAgenda({
  agendaGrid,
  listaBarberos = [],
  citasDelDia = [],
}) {
  if (!agendaGrid) return;

  agendaGrid.innerHTML = "";

  listaBarberos.forEach((barbero) => {
    const columna = document.createElement("div");

    columna.className = "calendar-column";

    // 👨‍💼 HEADER
    const header = document.createElement("div");

    header.className = "calendar-barber";

    header.innerHTML = `

    <div class="barber-profile">

        <img
            src="
                ${
                  barbero.foto_url ||
                  "https://ui-avatars.com/api/?name=Barber&background=111111&color=bf953f&size=256"
                }
            "

            class="barber-photo"

            onerror="
            this.src='https://ui-avatars.com/api/?name=Barber&background=111111&color=bf953f&size=256'
            "
        >

        <div class="barber-info">

            <div class="barber-name">

                ${barbero.nombre_empleado || "PROFESIONAL"}

            </div>

            <div class="barber-role">

                BARBER PRO

            </div>

        </div>

    </div>

`;

    columna.appendChild(header);

    // 📅 BODY
    const body = document.createElement("div");

    body.className = "calendar-body";

    // 📌 CITAS DEL BARBERO
    const citasBarbero = citasDelDia.filter(
      (c) => String(c.id_barbero) === String(barbero.id_barbero),
    );

    citasBarbero.forEach((cita) => {
      const inicio = horaToMin(normalizarHora(cita.hora_inicio));

      const fin = horaToMin(normalizarHora(cita.hora_fin));

      // 📍 POSICIÓN
      const top = ((inicio - 480) / 60) * 120;
      // 📏 ALTURA DINÁMICA
      const calculatedHeight = ((fin - inicio) / 60) * 120;

      // 👇 altura mínima elegante
      const height = Math.max(calculatedHeight, 170);
      const bloque = document.createElement("div");

      bloque.className = "calendar-event";
      bloque.style.top = `${top}px`;
      bloque.style.height = `${height}px`;
      bloque.innerHTML = `

<div class="event-glow"></div>

<div class="event-top-row">

    <div class="event-hour">

        <i class="fa-regular fa-clock"></i>

        ${normalizarHora(cita.hora_inicio)}
        —
        ${normalizarHora(cita.hora_fin)}

    </div>

    <div class="event-chip">

        Confirmada

    </div>

</div>

<div class="event-main">

    <div class="event-avatar">

        ${cita.nombre_cliente.charAt(0)}

    </div>

    <div class="event-data">

        <div class="event-client">

            ${cita.nombre_cliente}

        </div>

        <div class="event-service">

            ${cita.servicio_nombre || "Servicio"}

        </div>

    </div>

</div>

<div class="event-phone">

    <i class="fa-solid fa-phone"></i>

    ${cita.telefono || "Sin teléfono"}

</div>

<div class="event-actions">

    <button
        class="event-btn whatsapp"
        onclick="
            event.stopPropagation();

            window.open(
                'https://wa.me/57${cita.telefono}',
                '_blank'
            )
        "
    >
        <i class="fa-brands fa-whatsapp"></i>
    </button>

    <button
        class="event-btn call"
        onclick="
            event.stopPropagation();

            window.location.href='tel:${cita.telefono}'
        "
    >
        <i class="fa-solid fa-phone"></i>
    </button>

    <button
        class="event-btn cancel"
        onclick="
            event.stopPropagation();

            confirmarCancelacion('${cita.id_cita}')
        "
    >
        <i class="fa-solid fa-xmark"></i>
    </button>

</div>

`;

      body.appendChild(bloque);
    });

    columna.appendChild(body);

    agendaGrid.appendChild(columna);
  });
}
