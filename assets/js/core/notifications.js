const ICONOS = {
  success: "✓",
  error: "×",
  warning: "!",
  info: "i",
};

function inferirTipo(mensaje) {
  const texto = String(mensaje).toLowerCase();
  if (/error|no se pudo|incorrect|inválid|vencido|problema|falló/.test(texto))
    return "error";
  if (/éxito|correctamente|guardad|cread|copiad|actualizad|enviado/.test(texto))
    return "success";
  if (/por favor|selecciona|completa|debe|primero|advertencia|ya existe/.test(texto))
    return "warning";
  return "info";
}

function asegurarContenedor() {
  let contenedor = document.getElementById("tamakuToastStack");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "tamakuToastStack";
    contenedor.className = "tamaku-toast-stack";
    contenedor.setAttribute("aria-live", "polite");
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

function notificar(mensaje, tipo = "info", opciones = {}) {
  const contenedor = asegurarContenedor();
  const toast = document.createElement("div");
  const duracion = opciones.duracion ?? (tipo === "error" ? 6500 : 4500);
  toast.className = `tamaku-toast tamaku-toast-${tipo}`;
  toast.setAttribute("role", tipo === "error" ? "alert" : "status");
  toast.innerHTML = `
    <div class="tamaku-toast-icon"><span>${ICONOS[tipo] || ICONOS.info}</span></div>
    <div class="tamaku-toast-copy">
      <strong>${opciones.titulo || ({ success: "Todo listo", error: "Algo salió mal", warning: "Revisa esta información", info: "Información" }[tipo])}</strong>
      <p></p>
    </div>
    <button type="button" class="tamaku-toast-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
    <span class="tamaku-toast-progress"></span>`;
  toast.querySelector("p").textContent = String(mensaje);
  toast.querySelector(".tamaku-toast-progress").style.animationDuration = `${duracion}ms`;

  let temporizador;
  const cerrar = () => {
    clearTimeout(temporizador);
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 260);
  };
  toast.querySelector("button").addEventListener("click", cerrar);
  contenedor.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  temporizador = setTimeout(cerrar, duracion);
  return { cerrar, elemento: toast };
}

function confirmar({
  titulo = "¿Confirmar acción?",
  mensaje = "Esta acción requiere tu confirmación.",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  peligro = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "tamaku-confirm-overlay";
    overlay.innerHTML = `
      <div class="tamaku-confirm-card" role="dialog" aria-modal="true" aria-labelledby="tamakuConfirmTitle">
        <div class="tamaku-confirm-icon ${peligro ? "danger" : ""}"><span>${peligro ? "!" : "?"}</span></div>
        <span class="tamaku-confirm-eyebrow">TAMAKU</span>
        <h2 id="tamakuConfirmTitle"></h2>
        <p></p>
        <div class="tamaku-confirm-actions">
          <button type="button" class="tamaku-confirm-cancel"></button>
          <button type="button" class="tamaku-confirm-accept ${peligro ? "danger" : ""}"></button>
        </div>
      </div>`;
    overlay.querySelector("h2").textContent = titulo;
    overlay.querySelector("p").textContent = mensaje;
    overlay.querySelector(".tamaku-confirm-cancel").textContent = textoCancelar;
    overlay.querySelector(".tamaku-confirm-accept").textContent = textoConfirmar;

    let resuelto = false;
    const terminar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      overlay.classList.remove("is-visible");
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener("keydown", teclado);
      resolve(valor);
    };
    const teclado = (event) => {
      if (event.key === "Escape") terminar(false);
      if (event.key === "Enter") terminar(true);
    };
    overlay.querySelector(".tamaku-confirm-cancel").addEventListener("click", () => terminar(false));
    overlay.querySelector(".tamaku-confirm-accept").addEventListener("click", () => terminar(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) terminar(false);
    });
    document.addEventListener("keydown", teclado);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      overlay.querySelector(".tamaku-confirm-accept").focus();
    });
  });
}

window.TamakuUI = {
  notify: notificar,
  success: (mensaje, opciones) => notificar(mensaje, "success", opciones),
  error: (mensaje, opciones) => notificar(mensaje, "error", opciones),
  warning: (mensaje, opciones) => notificar(mensaje, "warning", opciones),
  info: (mensaje, opciones) => notificar(mensaje, "info", opciones),
  confirm: confirmar,
};

// Compatibilidad con todo el código existente que todavía llama alert().
window.alert = (mensaje) => notificar(mensaje, inferirTipo(mensaje));
