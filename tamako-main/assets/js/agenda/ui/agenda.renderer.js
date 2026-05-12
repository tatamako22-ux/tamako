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

    // ⏰ LÍNEAS HORARIAS
    for (let h = 8; h <= 20; h++) {
      const line = document.createElement("div");

      line.className = "hour-line";

      line.innerHTML = `

                <span>
                    ${h}:00
                </span>

            `;

      body.appendChild(line);
    }

    // 📌 CITAS DEL BARBERO
    const citasBarbero = citasDelDia.filter(
      (c) => String(c.id_barbero) === String(barbero.id_barbero),
    );

    citasBarbero.forEach((cita) => {
      const inicio = horaToMin(normalizarHora(cita.hora_inicio));

      const fin = horaToMin(normalizarHora(cita.hora_fin));

      // 📍 POSICIÓN
      const top = ((inicio - 480) / 60) * 120;

      // 📏 ALTURA
      const height = ((fin - inicio) / 60) * 120;

      const bloque = document.createElement("div");

      bloque.className = "calendar-event";

      bloque.style.top = `${top}px`;

      bloque.style.height = `${height}px`;

      bloque.innerHTML = `

                <div class="event-client">
                    ${cita.nombre_cliente}
                </div>

                <div class="event-hour">

                    ${normalizarHora(cita.hora_inicio)}

                </div>

            `;

      body.appendChild(bloque);
    });

    columna.appendChild(body);

    agendaGrid.appendChild(columna);
  });
}
