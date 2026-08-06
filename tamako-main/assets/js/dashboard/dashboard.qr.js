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
    await navigator.clipboard.writeText(linkFinal);
    window.TamakuUI?.toast?.("Link de clientes copiado.", "success");
  } catch (error) {
    console.error("No se pudo copiar el link:", error);
    window.TamakuUI?.toast?.("No se pudo copiar el link.", "error");
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
