let linkFinal = "";

export function initQR(tienda) {
  generarLink(tienda);

  // Exponer funciones necesarias para HTML
  window.generarYMostrarQR = generarYMostrarQR;
  window.descargarQR = descargarQR;
  window.copiarAlPortapapeles = copiarAlPortapapeles;
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
function descargarQR() {
  const img = document.querySelector("#qrcode img");

  if (!img) return;

  const a = document.createElement("a");
  a.href = img.src;
  a.download = "QR-TAMAKU.png";
  a.click();
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
