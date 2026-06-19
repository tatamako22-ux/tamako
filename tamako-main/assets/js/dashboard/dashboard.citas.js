import { supabase } from "../config/supabaseClient.js";

let tiendaInfo = null;

/* =========================
   INIT DEL MÓDULO
========================= */
export function initCitas(tienda) {
  tiendaInfo = tienda;
  cargarCitasDelDia();
}

/* =========================
   CARGAR CITAS DEL DÍA
========================= */
export async function cargarCitasDelDia() {
  if (!tiendaInfo) {
    console.error("❌ No hay información de tienda");
    return;
  }

  const hoy = new Date().toISOString().split("T")[0];

  try {
    const { data: citas, error } = await supabase
      .from("citas")
      .select(
        `
        *,
        profesionales (
          nombre_empleado
        )
      `,
      )
      .eq("id_tienda", tiendaInfo.id)
      .eq("fecha", hoy)
      .neq("estado", "CANCELADA")
      .order("hora_inicio", { ascending: true });

    if (error) {
      console.error("❌ Error cargando citas:", error);
      return;
    }

    console.log(`✅ ${citas?.length || 0} citas cargadas`);

    renderCitas(citas || []);
  } catch (err) {
    console.error("❌ Error inesperado:", err);
  }
}

/* =========================
   RENDER TABLA DE CITAS
========================= */
function renderCitas(citas) {
  const tbody = document.getElementById("listaCitas");

  if (!tbody) {
    console.error("❌ No se encontró #listaCitas");
    return;
  }

  tbody.innerHTML = "";

  /* =========================
     ESTADÍSTICAS
  ========================= */
  const total = citas.length;

  const pendientes = citas.filter(
    (c) => (c.estado || "").toUpperCase() === "PENDIENTE",
  ).length;

  const valCitas = document.getElementById("valCitas");
  const valEspera = document.getElementById("valEspera");

  if (valCitas) valCitas.innerText = total;
  if (valEspera) valEspera.innerText = pendientes;

  /* =========================
     SIN CITAS
  ========================= */
  if (citas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:20px;color:#888;">
          No hay citas programadas para hoy
        </td>
      </tr>
    `;

    return;
  }

  /* =========================
     FILAS
  ========================= */
  citas.forEach((cita, index) => {
    const profNombre =
      cita.profesionales?.nombre_empleado ||
      cita.nombre_profesional ||
      "No asignado";

    const hora = cita.hora_inicio ? cita.hora_inicio.substring(0, 5) : "--:--";

    const nombreCliente = cita.nombre_cliente || `Cliente ${index + 1}`;

    const telefono = cita.telefono_cliente
      ? cita.telefono_cliente.replace(/\s+/g, "")
      : "";

    const estado = cita.estado || "PENDIENTE";

    const row = document.createElement("tr");

    row.innerHTML = `
      <td style="font-weight:600; color: var(--gold);">
        ${hora}
      </td>

      <td>
        <strong>${nombreCliente}</strong>
      </td>

      <td style="color:#888;">
        ${profNombre}
      </td>

      <td>
        <span class="status-pill">
          ${estado}
        </span>
      </td>

      <td>
        ${
          telefono
            ? `
              <a
                href="https://wa.me/57${telefono}"
                target="_blank"
                class="btn-whatsapp"
              >
                <i class="fa-brands fa-whatsapp"></i>
              </a>
            `
            : "-"
        }
      </td>
    `;

    tbody.appendChild(row);
  });

  console.log(`✅ Renderizadas ${citas.length} citas`);

  /* =========================
     SCROLL
  ========================= */
  const mainContent = document.querySelector(".main-content");

  if (mainContent) {
    const necesitaScroll = mainContent.scrollHeight > mainContent.clientHeight;

    console.log(`🔽 Scroll: ${necesitaScroll ? "Sí" : "No"}`);
  }
}

/* =========================
   RECARGAR CITAS
========================= */
export async function recargarCitas() {
  await cargarCitasDelDia();
}
