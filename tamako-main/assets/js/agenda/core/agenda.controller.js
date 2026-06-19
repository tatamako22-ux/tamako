import {
  agendaState,
  setState,
  getState,
  resetReserva,
} from "../state/agenda.state.js";

import {
  obtenerBarberos,
  obtenerCitas,
  cancelarCita,
} from "../../services/agenda.service.js";

import {
  formatearFecha,
  horaToMin,
  normalizarHora,
} from "../utils/agenda.utils.js";

// 🚀 INICIAR AGENDA
export function iniciarAgenda({
  supabase,
  tiendaInfo,
  calcularCita,
  renderSkeleton,
  renderizarAgenda,
}) {
  // 🎯 ELEMENTOS DOM
  const agendaGrid = document.getElementById("agendaGrid");

  const selectorBarbero = document.getElementById("mobileBarberSelector");

  // 🎨 RENDER
  function renderizar() {
    renderizarAgenda({
      agendaGrid,

      listaBarberos: getState("listaBarberos"),

      citasDelDia: getState("citasDelDia"),

      fechaSeleccionada: getState("fechaSeleccionada"),

      tiendaInfo,
    });
  }

  // 📅 CARGAR CITAS
  async function cargarCitasDelDia() {
    const fecha = getState("fechaSeleccionada").toLocaleDateString("sv-SE");

    const idBarbero = selectorBarbero?.value;

    if (!idBarbero) return;

    const citas = await obtenerCitas({
      idTienda: tiendaInfo.id,

      fecha,

      idBarbero,
    });
    console.log("📋 CITAS RECIBIDAS:", citas);
    console.log("📋 PRIMERA CITA COMPLETA:");
    console.table(citas);

    console.log("SERVICIO NOMBRE:", citas[0]?.servicio_nombre);
    console.log("SERVICIO:", citas[0]?.servicio);

    setState("citasDelDia", citas);

    renderizar();
  }

  // 📆 ACTUALIZAR FECHA
  async function actualizarFecha() {
    console.log(
      "🔄 ACTUALIZANDO AGENDA CON FECHA:",
      getState("fechaSeleccionada"),
    );
    const fecha = getState("fechaSeleccionada");

    const fechaElem = document.getElementById("fechaActual");

    if (fechaElem) {
      fechaElem.innerText = formatearFecha(fecha);
    }

    // Actualiza dinámicamente las clases 'active' del mini-calendario si se usan los botones atrás/adelante
    const fechaISO = fecha.toLocaleDateString("sv-SE");
    document.querySelectorAll(".calendar-day").forEach((d) => {
      if (d.dataset.fecha === fechaISO) {
        d.classList.add("active");
      } else {
        d.classList.remove("active");
      }
    });

    await cargarCitasDelDia();
    console.log("🎨 TERMINO CARGA, RENDERIZANDO");
    renderizar();
  }

  // 👨‍💼 CARGAR BARBEROS
  async function cargarBarberos() {
    const barberos = await obtenerBarberos(tiendaInfo.id);
    console.log("👨‍💼 BARBEROS COMPLETOS:", barberos);

    setState("listaBarberos", barberos);

    if (selectorBarbero && barberos.length) {
      selectorBarbero.innerHTML = barberos
        .map(
          (b) => `

                    <option
                        value="${b.id_barbero}"
                    >
                        ${(b.nombre_empleado || "STAFF").toUpperCase()}
                    </option>

                `,
        )
        .join("");

      selectorBarbero.value = barberos[0].id_barbero;
    }
  }

  // 🚀 CARGA INICIAL
  async function cargarAgenda() {
    renderSkeleton();

    await cargarBarberos();

    await actualizarFecha();
  }

  // ❌ MODAL CANCELAR
  window.confirmarCancelacion = async (idCita) => {
    setState("citaACancelar", idCita);

    document.getElementById("confirmCancelModal").style.display = "flex";
  };

  // ❌ EJECUTAR CANCELACIÓN
  async function ejecutarCancelacion() {
    const idCita = getState("citaACancelar");

    if (!idCita) return;

    const ok = await cancelarCita(idCita);

    if (!ok) {
      alert("❌ Error al cancelar");

      return;
    }

    document.getElementById("confirmCancelModal").style.display = "none";

    resetReserva();

    await cargarCitasDelDia();
  }

  // ➕ ABRIR MODAL
  window.abrirModalReserva = (idBarbero, hora, nombreBarbero) => {
    setState("datosNuevaReserva", {
      idBarbero,
      hora,
      nombreBarbero,
    });

    document.getElementById("infoReserva").innerHTML = `

            📅 Agendando con
            <strong>
                ${nombreBarbero}
            </strong>

            <br>

            ⏰ ${hora}
        `;

    document.getElementById("reservaModal").style.display = "flex";
  };

  // ✅ CONFIRMAR RESERVA
  async function confirmarReserva() {
    const nombreInput = document.getElementById("res_nombre");

    const telInput = document.getElementById("res_tel");

    const nombre = nombreInput.value.trim();

    const telefono = telInput.value.replace(/\D/g, "");

    if (!nombre || !telefono) {
      alert("⚠️ Completa todos los campos");

      return;
    }

    const reserva = getState("datosNuevaReserva");

    const profesional = getState("listaBarberos").find(
      (b) => String(b.id_barbero) === String(reserva.idBarbero),
    );

    const fecha = getState("fechaSeleccionada").toLocaleDateString("sv-SE");

    const hora24 = normalizarHora(reserva.hora);

    const resultado = calcularCita({
      inicioDeseado: horaToMin(hora24),

      duracion: parseInt(profesional?.intervalo_citas) || 60,

      modo: profesional?.modo_agenda || "auto",

      bloques: getState("citasDelDia")
        .filter((c) => String(c.id_barbero) === String(reserva.idBarbero))

        .map((c) => ({
          inicio: horaToMin(normalizarHora(c.hora_inicio)),

          fin: horaToMin(normalizarHora(c.hora_fin)),

          tipo: "ocupado",
        })),

      profesional,

      intervaloProfesional: profesional?.intervalo_citas,

      intervaloTienda: tiendaInfo.intervalo_minutos,
    });

    if (!resultado) {
      alert("⚠️ Horario inválido");

      return;
    }

    const hhFin = String(Math.floor(resultado.fin / 60)).padStart(2, "0");

    const mmFin = String(resultado.fin % 60).padStart(2, "0");

    const { error } = await supabase.from("citas").insert([
      {
        id_tienda: tiendaInfo.id,

        id_barbero: reserva.idBarbero,

        nombre_cliente: nombre.toUpperCase(),

        telefono_cliente: telefono,

        fecha,

        hora_inicio: `${hora24}:00`,

        hora_fin: `${hhFin}:${mmFin}:00`,

        duracion_minutos: resultado.fin - resultado.inicio,

        estado: "PENDIENTE",
      },
    ]);

    if (error) {
      console.error(error);

      alert("❌ Error al reservar");

      return;
    }

    document.getElementById("reservaModal").style.display = "none";

    nombreInput.value = "";
    telInput.value = "";

    await cargarCitasDelDia();
  }

  // 🔴 REALTIME
  function iniciarRealtime() {
    supabase

      .channel(`agenda-${tiendaInfo.id}`)

      .on(
        "postgres_changes",

        {
          event: "*",

          schema: "public",

          table: "citas",

          filter: `id_tienda=eq.${tiendaInfo.id}`,
        },

        async () => {
          await cargarCitasDelDia();
        },
      )

      .subscribe();
  }

  // 🎧 EVENTOS
  function eventos() {
    selectorBarbero?.addEventListener("change", cargarCitasDelDia);

    document
      .getElementById("btnCancelarSi")
      ?.addEventListener("click", ejecutarCancelacion);

    document
      .getElementById("btnConfirmarReserva")
      ?.addEventListener("click", confirmarReserva);

    document.getElementById("btnCancelarNo")?.addEventListener("click", () => {
      document.getElementById("confirmCancelModal").style.display = "none";

      resetReserva();
    });

    document.getElementById("prevDay")?.addEventListener("click", async () => {
      const fecha = getState("fechaSeleccionada");

      fecha.setDate(fecha.getDate() - 1);

      setState("fechaSeleccionada", fecha);

      await actualizarFecha();
    });

    document.getElementById("nextDay")?.addEventListener("click", async () => {
      const fecha = getState("fechaSeleccionada");

      fecha.setDate(fecha.getDate() + 1);

      setState("fechaSeleccionada", fecha);

      await actualizarFecha();
    });
  }

  // 🚀 INIT
  // Escucha el clic de los días del mini-calendario dinámico
  console.log("🎧 LISTENER FECHA CARGADO");
  window.addEventListener("cambiar-fecha-agenda", async (e) => {
    console.log("🔥 EVENTO RECIBIDO EN CONTROLLER:", e.detail);

    const nuevaFecha = new Date(e.detail.fecha + "T00:00:00");

    console.log("📅 NUEVA FECHA CREADA:", nuevaFecha);

    setState("fechaSeleccionada", nuevaFecha);

    console.log("📌 STATE DESPUÉS:", getState("fechaSeleccionada"));

    await actualizarFecha();
  });
  eventos();

  iniciarRealtime();

  cargarAgenda();
}
