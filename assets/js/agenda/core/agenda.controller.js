import {
  agendaState,
  setState,
  getState,
  resetReserva,
} from "../state/agenda.state.js";

import {
  obtenerBarberos,
  obtenerCitas,
  obtenerConteoCitasRango,
  cancelarCita,
  marcarCitaNoAsistida,
} from "../../services/agenda.service.js";

import {
  formatearFecha,
  horaToMin,
  normalizarHora,
} from "../utils/agenda.utils.js";
import { crearMensajeReserva } from "../utils/agenda.whatsapp.js";
// 🔔 Mostrar mensajes tipo Toast
function mostrarToast(mensaje, tipo = "success") {
  window.TamakuUI?.notify(mensaje, tipo);
}

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
  const sesion = tiendaInfo.sesion || {};
  const esEmpleado = !sesion.es_propietario && String(sesion.rol || "").toUpperCase() === "EMPLEADO";
  const idProfesionalForzado = esEmpleado ? sesion.id_profesional : null;
  const puedeGestionarAgenda = Boolean(sesion.es_propietario || sesion.permisos?.agenda_gestionar);

  // 🎨 RENDER
  function renderizar() {
    renderizarAgenda({
      agendaGrid,

      listaBarberos: getState("listaBarberos"),

      citasDelDia: getState("citasDelDia"),

      conteoCitasSemana: getState("conteoCitasSemana"),

      fechaSeleccionada: getState("fechaSeleccionada"),

      tiendaInfo,
    });
  }

  // 📅 CARGAR CITAS
  async function cargarCitasDelDia() {
    const fecha = getState("fechaSeleccionada").toLocaleDateString("sv-SE");

    const idBarbero = idProfesionalForzado || selectorBarbero?.value;

    if (!idBarbero) return;

    const fechaHasta = new Date(getState("fechaSeleccionada"));
    fechaHasta.setDate(fechaHasta.getDate() + 6);
    const hasta = fechaHasta.toLocaleDateString("sv-SE");
    const [citas, conteoSemana] = await Promise.all([
      obtenerCitas({ idTienda: tiendaInfo.id, fecha, idBarbero }),
      obtenerConteoCitasRango({ idTienda: tiendaInfo.id, desde: fecha, hasta, idBarbero }),
    ]);
    setState("citasDelDia", citas);
    setState("conteoCitasSemana", conteoSemana);

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
  }

  // 👨‍💼 CARGAR BARBEROS
  async function cargarBarberos() {
    if (esEmpleado && !idProfesionalForzado) {
      mostrarToast("Tu usuario no tiene un profesional vinculado. Solicita al administrador que configure tu perfil.", "error");
      setState("listaBarberos", []);
      setState("citasDelDia", []);
      renderizar();
      return;
    }
    const barberos = await obtenerBarberos(tiendaInfo.id, idProfesionalForzado);
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
      if (esEmpleado) {
        selectorBarbero.disabled = true;
        selectorBarbero.title = "Tu acceso está limitado a tu agenda profesional";
      }
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
    if (!puedeGestionarAgenda) {
      mostrarToast("No tienes permiso para modificar citas.", "error");
      return;
    }
    setState("citaACancelar", idCita);

    document.getElementById("confirmCancelModal").style.display = "flex";
  };

  window.confirmarNoAsistencia = async (idCita, nombreCliente = "el cliente") => {
    if (!puedeGestionarAgenda) {
      mostrarToast("No tienes permiso para modificar citas.", "error");
      return;
    }
    const confirmar = window.confirm(
      `¿Confirmas que ${nombreCliente} no asistió? La cita aparecerá como ingreso no facturado en Liquidaciones.`,
    );
    if (!confirmar) return;

    const ok = await marcarCitaNoAsistida(idCita, tiendaInfo.id);
    if (!ok) {
      mostrarToast("No se pudo registrar la inasistencia.", "error");
      return;
    }
    mostrarToast(`${nombreCliente} quedó marcado como no asistió.`, "success");
    await cargarCitasDelDia();
  };

  // ❌ EJECUTAR CANCELACIÓN
  async function ejecutarCancelacion() {
    const idCita = getState("citaACancelar");

    if (!idCita) return;

    const ok = await cancelarCita(idCita, tiendaInfo.id);

    if (!ok) {
      alert("❌ Error al cancelar");

      return;
    }

    document.getElementById("confirmCancelModal").style.display = "none";

    resetReserva();

    await cargarCitasDelDia();
  }

  // ➕ ABRIR MODAL (CON SERVICIOS REALES)
  window.abrirModalReserva = async (idBarbero, horaInicio, horaFin) => {
    if (!puedeGestionarAgenda) {
      mostrarToast("Tu usuario puede consultar la agenda, pero no crear citas.", "error");
      return;
    }
    const profesional = getState("listaBarberos").find(
      (b) => String(b.id_barbero) === String(idBarbero),
    );

    const nombreBarbero = profesional?.nombre_empleado || "PROFESIONAL";
    setState("datosNuevaReserva", {
      idBarbero,
      horaInicio,
      horaFin,
    });

    document.getElementById("infoReserva").innerHTML = `
            📅 Agendando con
            <strong>
                ${nombreBarbero}
            </strong>
            <br>
            ⏰ ${horaInicio} - ${horaFin}
        `;

    // Cargar selector de servicios dinámico
    const selectServicio = document.getElementById("res_servicio");
    if (selectServicio) {
      let avisoBloques = document.getElementById("avisoBloquesServicio");
      if (!avisoBloques) {
        avisoBloques = document.createElement("div");
        avisoBloques.id = "avisoBloquesServicio";
        avisoBloques.style.cssText =
          "display:none; margin:-5px 0 15px; padding:12px; border-radius:10px; " +
          "background:rgba(191,149,63,.12); border:1px solid rgba(191,149,63,.35); " +
          "color:#e7c778; font-size:.82rem; line-height:1.4;";
        selectServicio.insertAdjacentElement("afterend", avisoBloques);
      }

      const actualizarAvisoBloques = () => {
        const opcion = selectServicio.options[selectServicio.selectedIndex];
        const duracion = parseInt(opcion?.getAttribute("data-duracion"), 10);
        const intervalo =
          parseInt(profesional?.intervalo_citas, 10) ||
          parseInt(tiendaInfo.intervalo_minutos, 10) ||
          40;

        if (profesional?.modo_agenda !== "intervalo" || !duracion) {
          avisoBloques.style.display = "none";
          avisoBloques.textContent = "";
          return;
        }

        const cantidad = Math.max(1, Math.ceil(duracion / intervalo));
        const palabra = cantidad === 1 ? "turno" : "turnos";
        avisoBloques.textContent =
          `Este servicio dura ${duracion} min y ocupará ${cantidad} ${palabra} ` +
          `de ${intervalo} min en la agenda.`;
        avisoBloques.style.display = "block";
      };

      selectServicio.onchange = actualizarAvisoBloques;
      avisoBloques.style.display = "none";
      selectServicio.innerHTML =
        '<option value="">Cargando servicios...</option>';

      try {
        const { data: servicios, error } = await supabase
          .from("servicios")
          .select("id_servicio, nombre_servicio, precio, duracion_minutos")
          .eq("id_barbero", idBarbero)
          .eq("id_tienda", tiendaInfo.id)
          .order("nombre_servicio", { ascending: true });

        if (error || !servicios || servicios.length === 0) {
          selectServicio.innerHTML =
            '<option value="">Servicio general</option>';
        } else {
          let html = '<option value="">-- Selecciona el Servicio --</option>';
          servicios.forEach((s) => {
            html += `<option value="${s.id_servicio}" data-nombre="${s.nombre_servicio}" data-precio="${s.precio}" data-duracion="${s.duracion_minutos}">
              ${s.nombre_servicio} - $${s.precio.toLocaleString("es-CO")}
            </option>`;
          });
          selectServicio.innerHTML = html;
          actualizarAvisoBloques();
        }
      } catch (err) {
        console.error("Error al cargar servicios:", err);
        selectServicio.innerHTML = '<option value="">Servicio General</option>';
      }
    }

    document.getElementById("reservaModal").style.display = "flex";
  };

  // ✅ CONFIRMAR RESERVA
  async function confirmarReserva() {
    if (!puedeGestionarAgenda) {
      mostrarToast("No tienes permiso para crear citas.", "error");
      return;
    }
    const nombreInput = document.getElementById("res_nombre");

    const telInput = document.getElementById("res_tel");

    const nombre = nombreInput.value.trim();

    const telefono = telInput.value.replace(/\D/g, "");

    if (!nombre) {
      alert("⚠️ Ingresa el nombre del cliente");

      return;
    }

    if (telefono.length !== 10) {
      alert("⚠️ El teléfono debe tener exactamente 10 números.");

      telInput.focus();

      return;
    }

    const reserva = getState("datosNuevaReserva");

    const profesional = getState("listaBarberos").find(
      (b) => String(b.id_barbero) === String(reserva.idBarbero),
    );

    const fecha = getState("fechaSeleccionada").toLocaleDateString("sv-SE");

    const hora24 = normalizarHora(reserva.horaInicio);

    // La duracion de la cita la define el servicio, no el tamano visual del
    // bloque sobre el que se hizo clic. Si no hay servicio seleccionado,
    // conservamos la duracion del bloque como respaldo.
    const selectServicio = document.getElementById("res_servicio");
    const opcionSel = selectServicio?.options[selectServicio.selectedIndex];
    const duracionBloque =
      horaToMin(normalizarHora(reserva.horaFin)) -
      horaToMin(normalizarHora(reserva.horaInicio));
    const duracionServicio =
      parseInt(opcionSel?.getAttribute("data-duracion"), 10) || duracionBloque;

    const horarioDia = profesional
      ? (() => {
          const dias = [
            "domingo",
            "lunes",
            "martes",
            "miÃ©rcoles",
            "jueves",
            "viernes",
            "sÃ¡bado",
          ];
          const indiceDia = getState("fechaSeleccionada").getDay();
          const horario = profesional.horario_semanal?.[dias[indiceDia]];
          return horario?.activo
            ? horario
            : {
                inicio: profesional.horario_inicio || "08:00",
                fin: profesional.horario_fin || "20:00",
              };
        })()
      : { inicio: "00:00", fin: "24:00" };
    console.group("=== RESERVA ===");

    console.log("Hora inicio:", reserva.horaInicio);
    console.log("Hora fin:", reserva.horaFin);
    console.log("Hora normalizada:", hora24);

    console.log("Profesional:", profesional);
    console.log("Modo:", profesional?.modo_agenda);
    console.log("Intervalo profesional:", profesional?.intervalo_citas);
    console.log("Intervalo tienda:", tiendaInfo.intervalo_minutos);
    const bloques = getState("citasDelDia")
      .filter((c) => String(c.id_barbero) === String(reserva.idBarbero))
      .map((c) => ({
        inicio: horaToMin(normalizarHora(c.hora_inicio)),
        fin: horaToMin(normalizarHora(c.hora_fin)),
        tipo: "ocupado",
      }));

    if (profesional?.almuerzo_inicio && Number(profesional.almuerzo_minutos) > 0) {
      const inicio = horaToMin(normalizarHora(profesional.almuerzo_inicio));
      bloques.push({ inicio, fin: inicio + Number(profesional.almuerzo_minutos), tipo: "almuerzo" });
    }
    if (profesional?.break_inicio && Number(profesional.break_minutos) > 0) {
      const inicio = horaToMin(normalizarHora(profesional.break_inicio));
      bloques.push({ inicio, fin: inicio + Number(profesional.break_minutos), tipo: "descanso" });
    }

    console.table(bloques);

    console.groupEnd();
    const resultado = calcularCita({
      inicioDeseado: horaToMin(hora24),

      duracion: duracionServicio,

      modo: profesional?.modo_agenda || "auto",

      bloques,

      jornadaInicio: horaToMin(normalizarHora(horarioDia.inicio)),

      jornadaFin: horaToMin(normalizarHora(horarioDia.fin)),

      profesional,

      intervaloProfesional: profesional?.intervalo_citas,

      intervaloTienda: tiendaInfo.intervalo_minutos,
    });

    console.log("RESULTADO calcularCita:", resultado);

    if (!resultado) {
      alert("⚠️ Horario inválido");

      return;
    }

    const hhFin = String(Math.floor(resultado.fin / 60)).padStart(2, "0");

    const mmFin = String(resultado.fin % 60).padStart(2, "0");
    const horaFinGuardar = `${hhFin}:${mmFin}:00`;

    // Capturar servicio seleccionado
    const servicioId = selectServicio?.value || null;
    const servicioNombre =
      opcionSel?.getAttribute("data-nombre") || "Servicio General";
    const valorServicio = Number(opcionSel?.getAttribute("data-precio")) || 0;

    const { error } = await supabase.from("citas").insert([
      {
        id_tienda: tiendaInfo.id,
        id_barbero: reserva.idBarbero,
        servicio: servicioId,
        servicio_nombre: servicioNombre,
        valor_servicio: valorServicio,
        nombre_cliente: nombre.toUpperCase(),
        telefono_cliente: telefono,
        fecha,
        hora_inicio: `${hora24}:00`,
        hora_fin: horaFinGuardar,
        duracion_minutos: resultado.fin - resultado.inicio,
        estado: "PENDIENTE",
      },
    ]);

    if (error) {
      console.error(error);

      const esCruce = error?.code === "23P01" || /citas_no_superpuestas/i.test(error?.message || "");
      alert(esCruce
        ? "⚠️ Ese horario acaba de ser ocupado. La agenda se actualizará."
        : `❌ Error al reservar: ${error.message}`);
      if (esCruce) await cargarCitasDelDia();

      return;
    }

    document.getElementById("reservaModal").style.display = "none";

    const mensaje = crearMensajeReserva({
      cliente: nombre.toUpperCase(),

      profesional: profesional.nombre_empleado,

      tienda: tiendaInfo.nombre,

      fecha,

      hora: hora24,

      url: "https://TU-PAGINA.COM",
    });

    setState("whatsappReserva", {
      telefono,

      mensaje,
    });

    document.getElementById("textoWhatsapp").innerHTML = `

<strong>${nombre.toUpperCase()}</strong>

<br><br>

¿Deseas enviar la confirmación por WhatsApp?

`;

    document.getElementById("modalWhatsapp").style.display = "flex";

    nombreInput.value = "";

    telInput.value = "";

    await cargarCitasDelDia();
  }

  // 🔴 REALTIME
  function iniciarRealtime() {
    const canal = supabase

      .channel(`agenda-${tiendaInfo.id}`)

      .on(
        "postgres_changes",

        {
          event: "*",

          schema: "public",

          table: "citas",

          filter: `id_tienda=eq.${tiendaInfo.id}`,
        },

        (cambio) => {
          const fechaVisible = getState("fechaSeleccionada").toLocaleDateString("sv-SE");
          const profesionalVisible = selectorBarbero?.value;
          const esNuevaCitaVisible =
            cambio.eventType === "INSERT" &&
            cambio.new?.fecha === fechaVisible &&
            String(cambio.new?.id_barbero) === String(profesionalVisible);

          if (esNuevaCitaVisible) {
            window.TamakuUI?.success?.("La agenda se actualizó automáticamente.", {
              titulo: "Nueva cita recibida",
              duracion: 3500,
            });
          }
          programarActualizacion();
        },
      )

      .subscribe((estado) => {
        console.log("Estado Realtime de Agenda:", estado);
      });

    return canal;
  }

  // Realtime actualiza al instante. Este respaldo vuelve a consultar cuando
  // la publicación de Supabase o la conexión móvil no están disponibles.
  let temporizadorActualizacion;
  let intervaloActualizacion;

  function programarActualizacion() {
    clearTimeout(temporizadorActualizacion);
    temporizadorActualizacion = setTimeout(cargarCitasDelDia, 350);
  }

  function iniciarActualizacionAutomatica() {
    const intervaloRespaldo = window.matchMedia("(max-width: 900px)").matches
      ? 30000
      : 15000;
    intervaloActualizacion = setInterval(() => {
      if (document.visibilityState === "visible") cargarCitasDelDia();
    }, intervaloRespaldo);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") programarActualizacion();
    });
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
    // ❌ Cerrar modal Nueva Reserva
    document.getElementById("closeReserva")?.addEventListener("click", () => {
      // ❌ Cerrar haciendo clic fuera del modal
      document
        .getElementById("reservaModal")
        ?.addEventListener("click", (e) => {
          if (e.target.id === "reservaModal") {
            document.getElementById("reservaModal").style.display = "none";

            document.getElementById("res_nombre").value = "";

            document.getElementById("res_tel").value = "";

            resetReserva();
          }
        });
      document.getElementById("reservaModal").style.display = "none";

      document.getElementById("res_nombre").value = "";

      document.getElementById("res_tel").value = "";

      resetReserva();
    });
    // ❌ Cerrar con la tecla ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.getElementById("reservaModal").style.display = "none";

        document.getElementById("res_nombre").value = "";

        document.getElementById("res_tel").value = "";

        resetReserva();
      }
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
    // ✍️ Nombre siempre en MAYÚSCULAS
    document.getElementById("res_nombre")?.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
    // 📱 Solo números y máximo 10 dígitos
    document.getElementById("res_tel")?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
    // 🟢 Enviar WhatsApp
    document
      .getElementById("btnEnviarWhatsapp")
      ?.addEventListener("click", () => {
        console.log("CLICK WHATSAPP");
        const datos = getState("whatsappReserva");
        console.log("DATOS WHATSAPP:", datos);

        if (!datos) return;

        const url = `https://wa.me/57${datos.telefono}?text=${encodeURIComponent(datos.mensaje)}`;
        console.log(url);

        window.open(url, "_blank");

        document.getElementById("modalWhatsapp").style.display = "none";
      });

    // ❌ Cerrar modal WhatsApp
    document
      .getElementById("btnCerrarWhatsapp")
      ?.addEventListener("click", () => {
        document.getElementById("modalWhatsapp").style.display = "none";
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

  const canalRealtime = iniciarRealtime();
  iniciarActualizacionAutomatica();
  cargarAgenda();

  window.addEventListener("pagehide", () => {
    clearTimeout(temporizadorActualizacion);
    clearInterval(intervaloActualizacion);
    supabase.removeChannel(canalRealtime);
  }, { once: true });
}
