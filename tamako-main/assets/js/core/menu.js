window.toggleModal = (show) => {
  const modal = document.getElementById("modalCita");
  if (modal) modal.style.display = show ? "flex" : "none";
};
window.toggleQR = (show) => {
  const modal = document.getElementById("modalQR");
  if (modal) modal.style.display = show ? "flex" : "none";
};
window.toggleLogout = (show) => {
  const modal = document.getElementById("modalLogout");
  if (modal) modal.style.display = show ? "flex" : "none";
};
window.toggleMobileMore = (show) => {
  document.getElementById("mobileMoreMenu")?.classList.toggle("is-visible", show);
  document.body.classList.toggle("mobile-menu-open", show);
};

/* Feedback sutil para los controles de la interfaz móvil. */
function activarFeedbackMovil() {
  const esMovil = () => window.matchMedia("(max-width: 900px)").matches;
  let audioContext;

  const reproducirTono = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      audioContext ||= new AudioContext();
      if (audioContext.state === "suspended") audioContext.resume();

      const inicio = audioContext.currentTime;
      const oscilador = audioContext.createOscillator();
      const volumen = audioContext.createGain();
      oscilador.type = "sine";
      oscilador.frequency.setValueAtTime(620, inicio);
      oscilador.frequency.exponentialRampToValueAtTime(760, inicio + 0.07);
      volumen.gain.setValueAtTime(0.0001, inicio);
      volumen.gain.exponentialRampToValueAtTime(0.035, inicio + 0.012);
      volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.09);
      oscilador.connect(volumen).connect(audioContext.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.095);
    } catch (error) {
      console.debug("Feedback sonoro no disponible:", error);
    }
  };

  document.addEventListener("click", (event) => {
    if (!esMovil()) return;
    const control = event.target.closest(
      'button, [role="button"], .tab-item, .nav-item, a[class*="btn-"]',
    );
    if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;

    reproducirTono();
    navigator.vibrate?.(14);
  }, { capture: true });
}

activarFeedbackMovil();

window.tamakuContextReady = import("./session.js").then((session) => {
  window.cerrarSesion = session.cerrarSesion;
  return session.requireTiendaInfo();
});

const PERMISOS_RUTA = {
  "dashboard.html": "dashboard_ver",
  "agenda.html": "agenda_ver",
  "clientes.html": "clientes_ver",
  "profesionales.html": "profesionales_ver",
  "facturacion.html": "facturacion_ver",
  "tienda.html": "tienda_ver",
  "usuarios.html": "usuarios_gestionar",
  "ajustes.html": "ajustes_ver",
};

function puede(tienda, permiso) {
  return Boolean(tienda?.sesion?.es_propietario || tienda?.sesion?.permisos?.[permiso]);
}

function protegerRuta(tienda, pagina) {
  const permiso = PERMISOS_RUTA[pagina];
  if (!permiso || puede(tienda, permiso)) return true;
  const destino = Object.entries(PERMISOS_RUTA).find(([, clave]) =>
    puede(tienda, clave),
  )?.[0];
  window.location.replace(destino || "../index.html");
  return false;
}

function enlace(tienda, permiso, href, pagina, icono, texto) {
  if (!puede(tienda, permiso)) return "";
  return `<a href="${href}" class="nav-item ${pagina === href ? "active" : ""}">
    <i class="fa-solid ${icono}"></i>${texto}
  </a>`;
}

function renderMenuGlobal(tienda) {
  const pagina = window.location.pathname.split("/").pop();
  if (!protegerRuta(tienda, pagina)) return;

  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.innerHTML = `<div class="sidebar-logo">✦ TAMAKU</div>
      <nav class="nav-menu">
        ${enlace(tienda, "dashboard_ver", "dashboard.html", pagina, "fa-house", "Dashboard")}
        ${enlace(tienda, "agenda_ver", "agenda.html", pagina, "fa-calendar-alt", "Agenda")}
        ${enlace(tienda, "clientes_ver", "clientes.html", pagina, "fa-users", "Clientes")}
        ${enlace(tienda, "profesionales_ver", "profesionales.html", pagina, "fa-user-tie", "Profesionales")}
        ${enlace(tienda, "facturacion_ver", "facturacion.html", pagina, "fa-file-invoice-dollar", "Facturación")}
        ${enlace(tienda, "tienda_ver", "tienda.html", pagina, "fa-bag-shopping", "Tienda")}
        ${enlace(tienda, "usuarios_gestionar", "usuarios.html", pagina, "fa-user-shield", "Usuarios")}
        ${enlace(tienda, "ajustes_ver", "ajustes.html", pagina, "fa-gear", "Ajustes")}
      </nav>
      <button class="logout-btn" type="button" onclick="toggleLogout(true)">Cerrar sesión</button>`;
  }

  const mobile = document.querySelector(".mobile-tab-bar");
  if (mobile) {
    const tabs = [
      ["dashboard_ver", "dashboard.html", "fa-house", "Inicio"],
      ["agenda_ver", "agenda.html", "fa-calendar", "Agenda"],
      ["clientes_ver", "clientes.html", "fa-users", "Clientes"],
      ["facturacion_ver", "facturacion.html", "fa-file-invoice-dollar", "Facturas"],
    ].filter(([permiso]) => puede(tienda, permiso));
    mobile.innerHTML = tabs.map(([, href, icono, texto]) =>
      `<a href="${href}" class="tab-item ${pagina === href ? "active" : ""}"><i class="fa-solid ${icono}"></i><span>${texto}</span></a>`,
    ).join("") + `<button type="button" class="tab-item tab-more ${["profesionales.html", "usuarios.html", "ajustes.html", "tienda.html"].includes(pagina) ? "active" : ""}" onclick="toggleMobileMore(true)"><i class="fa-solid fa-ellipsis"></i><span>Más</span></button>`;
  }

  crearModalLogoutGlobal();
  crearMenuMasMobile(pagina, tienda);
}

function opcionMas(tienda, permiso, href, pagina, icono, titulo, detalle) {
  if (!puede(tienda, permiso)) return "";
  return `<a href="${href}" class="${pagina === href ? "active" : ""}"><i class="fa-solid ${icono}"></i><div><strong>${titulo}</strong><span>${detalle}</span></div><i class="fa-solid fa-chevron-right"></i></a>`;
}

function crearMenuMasMobile(pagina, tienda) {
  document.getElementById("mobileMoreMenu")?.remove();
  const panel = document.createElement("div");
  panel.id = "mobileMoreMenu";
  panel.className = "mobile-more-overlay";
  panel.innerHTML = `<section class="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobileMoreTitle">
    <div class="mobile-more-handle"></div>
    <div class="mobile-more-heading"><div><small>TAMAKU</small><h2 id="mobileMoreTitle">Más opciones</h2></div><button type="button" onclick="toggleMobileMore(false)" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button></div>
    <nav class="mobile-more-links">
      ${opcionMas(tienda, "tienda_ver", "tienda.html", pagina, "fa-bag-shopping", "Tienda", "Productos e insumos a domicilio")}
      ${opcionMas(tienda, "profesionales_ver", "profesionales.html", pagina, "fa-user-tie", "Profesionales", "Equipo, servicios y horarios")}
      ${opcionMas(tienda, "usuarios_gestionar", "usuarios.html", pagina, "fa-user-shield", "Usuarios", "Accesos, roles y permisos")}
      ${opcionMas(tienda, "ajustes_ver", "ajustes.html", pagina, "fa-sliders", "Ajustes", "Identidad y reglas del negocio")}
      <button type="button" class="mobile-more-logout" onclick="toggleMobileMore(false); toggleLogout(true)"><i class="fa-solid fa-power-off"></i><div><strong>Cerrar sesión</strong><span>Salir de la administración</span></div><i class="fa-solid fa-chevron-right"></i></button>
    </nav>
  </section>`;
  panel.addEventListener("click", (event) => {
    if (event.target === panel) window.toggleMobileMore(false);
  });
  document.body.appendChild(panel);
}

function crearModalLogoutGlobal() {
  if (document.getElementById("modalLogout")) return;
  const modal = document.createElement("div");
  modal.id = "modalLogout";
  modal.className = "menu-logout-overlay";
  modal.innerHTML = `<div class="menu-logout-card" role="dialog" aria-modal="true" aria-labelledby="menuLogoutTitulo"><div class="menu-logout-icon"><i class="fa-solid fa-power-off"></i></div><h2 id="menuLogoutTitulo">¿Cerrar sesión?</h2><p>Deberás ingresar nuevamente para administrar tu negocio.</p><div class="menu-logout-actions"><button type="button" class="menu-logout-confirm" onclick="cerrarSesion()">Sí, salir</button><button type="button" class="menu-logout-cancel" onclick="toggleLogout(false)">Cancelar</button></div></div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) window.toggleLogout(false);
  });
  document.body.appendChild(modal);
}

document.addEventListener("DOMContentLoaded", async () => {
  const tienda = await window.tamakuContextReady;
  if (!tienda) return;
  renderMenuGlobal(tienda);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      window.toggleMobileMore(false);
      window.toggleLogout(false);
    }
  });
});
