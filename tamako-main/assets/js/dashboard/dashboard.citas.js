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
    console.error("No hay información de tienda");
    return;
  }

  const hoy = new Date().toISOString().split("T")[0];

  const { data: citas, error } = await supabase
    .from("citas")
    .select("*, profesionales!id_barbero(nombre_empleado)")
    .eq("id_tienda", tiendaInfo.id)
    .eq("fecha", hoy)
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Error cargando citas:", error);
    return;
  }

  renderCitas(citas || []);
}

/* =========================
   RENDER DE TABLA
========================= */
function renderCitas(citas) {
  const tbody = document.getElementById("listaCitas");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Stats del dashboard
  const total = citas.length;
  const pendientes = citas.filter((c) => c.estado === "PENDIENTE").length;

  const valCitas = document.getElementById("valCitas");
  const valEspera = document.getElementById("valEspera");

  if (valCitas) valCitas.innerText = total;
  if (valEspera) valEspera.innerText = pendientes;

  // Render filas
  citas.forEach((cita) => {
    const profNombre = cita.profesionales
      ? cita.profesionales.nombre_empleado
      : "No asignado";

    const tel = cita.telefono_cliente
      ? cita.telefono_cliente.replace(/\s+/g, "")
      : "";

    const row = `
            <tr>
                <td style="font-weight:600; color: var(--gold);">
                    ${cita.hora_inicio ? cita.hora_inicio.substring(0, 5) : "--:--"}
                </td>
                <td>${cita.nombre_cliente || "Sin nombre"}</td>
                <td style="color:#888;">${profNombre}</td>
                <td>
                    <span class="status-pill">${cita.estado || "PENDIENTE"}</span>
                </td>
                <td>
                    ${
                      tel
                        ? `<a href="https://wa.me/57${tel}" target="_blank" class="btn-whatsapp">
                                <i class="fa-brands fa-whatsapp"></i>
                              </a>`
                        : "-"
                    }
                </td>
            </tr>
        `;

    tbody.innerHTML += row;
  });
}
