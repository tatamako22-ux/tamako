let linkFinal = "";
let nombreTienda = "TAMAKU";

export function initQR(tienda) {
  nombreTienda = tienda?.nombre?.trim() || "TAMAKU";
  generarLink(tienda);

  // Exponer funciones necesarias para HTML
  window.generarYMostrarQR = generarYMostrarQR;
  window.descargarQR = descargarQR;
  window.copiarAlPortapapeles = copiarAlPortapapeles;
  window.irAPaginaReservas = irAPaginaReservas;
}

/* =========================
   GENERAR LINK CLIENTES
========================= */
function generarLink(tienda) {
  const urlBase = window.location.href.substring(
    0,
    window.location.href.lastIndexOf("/") + 1,
  );

  linkFinal = `${urlBase}reserva.html?v=${tienda.id}`;

  console.log("🔗 Link clientes:", linkFinal);
}

/* =========================
   MOSTRAR QR
========================= */
function generarYMostrarQR() {
  const container = document.getElementById("qrcode");
  if (!container) return;

  container.innerHTML = "";

  if (!linkFinal) {
    window.TamakuUI?.toast?.("No fue posible generar el link de clientes.", "error");
    return;
  }

  new QRCode(container, {
    text: linkFinal,
    width: 200,
    height: 200,
  });

  toggleModal("modalQR", true);
}

/* =========================
   ABRIR PÁGINA DE RESERVAS
========================= */
function irAPaginaReservas() {
  if (!linkFinal) {
    window.TamakuUI?.toast?.("No fue posible abrir la página de reservas.", "error");
    return;
  }

  window.open(linkFinal, "_blank", "noopener,noreferrer");
}

/* =========================
   COPIAR LINK
========================= */
async function copiarAlPortapapeles() {
  if (!linkFinal) return;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(linkFinal);
    } else {
      const campoTemporal = document.createElement("textarea");
      campoTemporal.value = linkFinal;
      campoTemporal.setAttribute("readonly", "");
      campoTemporal.style.position = "fixed";
      campoTemporal.style.opacity = "0";
      document.body.appendChild(campoTemporal);
      campoTemporal.select();
      const copiado = document.execCommand("copy");
      campoTemporal.remove();
      if (!copiado) throw new Error("El navegador rechazó la copia");
    }

    window.TamakuUI?.success?.("Ya puedes compartirlo con tus clientes.", {
      titulo: "¡Link copiado!",
      duracion: 3200,
    });
  } catch (error) {
    console.error("No se pudo copiar el link:", error);
    window.TamakuUI?.error?.("No se pudo copiar el link. Intenta nuevamente.");
  }
}

/* =========================
   DESCARGAR QR
========================= */
function obtenerImagenQR() {
  const canvas = document.querySelector("#qrcode canvas");
  if (canvas) return canvas.toDataURL("image/png");

  const img = document.querySelector("#qrcode img");
  return img?.src || "";
}

async function cargarJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  const fuentes = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  ];

  for (const fuente of fuentes) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = fuente;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`No cargó ${fuente}`));
        document.head.appendChild(script);
      });
      if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    } catch (error) {
      console.warn("Proveedor de PDF no disponible:", error);
    }
  }

  return null;
}

async function descargarQR() {
  const imagenQR = obtenerImagenQR();
  const JsPDF = await cargarJsPDF();

  if (!imagenQR || !JsPDF) {
    window.TamakuUI?.error?.(
      "No fue posible preparar el PDF. Actualiza la página e intenta nuevamente.",
    );
    return;
  }

  try {
    const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const ancho = pdf.internal.pageSize.getWidth();
    const centro = ancho / 2;

    pdf.setFillColor(8, 8, 8);
    pdf.rect(0, 0, ancho, 297, "F");

    pdf.setDrawColor(191, 149, 63);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(14, 14, ancho - 28, 269, 5, 5, "S");

    pdf.setTextColor(216, 174, 76);
    pdf.setFont("times", "bold");
    pdf.setFontSize(25);
    pdf.text(nombreTienda.toUpperCase(), centro, 40, { align: "center" });

    pdf.setTextColor(235, 235, 235);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("RESERVA TU CITA", centro, 50, { align: "center" });

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(47, 64, 116, 116, 4, 4, "F");
    pdf.addImage(imagenQR, "PNG", 55, 72, 100, 100);

    pdf.setTextColor(216, 174, 76);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("ESCANEA Y RESERVA", centro, 202, { align: "center" });

    pdf.setTextColor(220, 220, 220);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("Abre la cámara de tu celular, escanea el código", centro, 214, {
      align: "center",
    });
    pdf.text("y elige el profesional, servicio y horario que prefieras.", centro, 221, {
      align: "center",
    });

    pdf.setTextColor(145, 145, 145);
    pdf.setFontSize(7);
    const enlaceLineas = pdf.splitTextToSize(linkFinal, 150);
    pdf.text(enlaceLineas, centro, 243, { align: "center" });

    pdf.setTextColor(191, 149, 63);
    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.text("IMPULSADO POR TAMAKU", centro, 270, { align: "center" });

    const nombreArchivo = nombreTienda
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase();

    pdf.save(`QR-RESERVAS-${nombreArchivo || "TAMAKU"}.pdf`);
    window.TamakuUI?.success?.("El código QR quedó listo para imprimir.", {
      titulo: "PDF descargado",
    });
  } catch (error) {
    console.error("No se pudo crear el PDF del QR:", error);
    window.TamakuUI?.error?.("No se pudo descargar el PDF. Intenta nuevamente.");
  }
}

/* =========================
   UTILIDAD MODAL (fallback)
========================= */
function toggleModal(id, estado) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = "";
  modal.classList.toggle("is-visible", estado);
}
