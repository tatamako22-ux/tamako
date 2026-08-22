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

window.tamakuContextReady = Promise.all([import("./session.js"), import("./brand-theme.js")]).then(async ([session, marca]) => {
  window.cerrarSesion = session.cerrarSesion;
  const tienda = await session.requireTiendaInfo();
  marca.aplicarMarcaTienda(tienda);
  return tienda;
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
  "comunicados.html": "ajustes_ver",
  "liquidaciones.html": "liquidaciones_personales",
};

const FUNCIONES_RUTA = {
  "dashboard.html": "dashboard",
  "agenda.html": "agenda",
  "clientes.html": "clientes",
  "profesionales.html": "profesionales",
  "facturacion.html": "facturacion",
  "tienda.html": "tienda",
  "usuarios.html": "usuarios",
  "ajustes.html": "ajustes",
  "comunicados.html": "ajustes",
};

function permitePlan(tienda, pagina) {
  const funciones = tienda?.suscripcion?.funcionalidades;
  if (!funciones) return true;
  const funcion = FUNCIONES_RUTA[pagina];
  return !funcion || funciones[funcion] === true;
}

function puede(tienda, permiso) {
  return Boolean(tienda?.sesion?.es_propietario || tienda?.sesion?.permisos?.[permiso]);
}

function protegerRuta(tienda, pagina) {
  if (pagina === "liquidaciones.html" && (tienda?.sesion?.es_propietario || tienda?.sesion?.id_profesional)) return true;
  const permiso = PERMISOS_RUTA[pagina];
  if ((!permiso || puede(tienda, permiso)) && permitePlan(tienda, pagina)) return true;
  const destinoPermitido = Object.entries(PERMISOS_RUTA).find(([ruta, clave]) =>
    puede(tienda, clave) && permitePlan(tienda, ruta),
  )?.[0];
  window.location.replace(destinoPermitido || "../index.html");
  return false;
}

function enlaceLiquidaciones(tienda, pagina) {
  if (!tienda?.sesion?.es_propietario && !tienda?.sesion?.id_profesional) return "";
  const texto = tienda.sesion.es_propietario ? "Liquidaciones" : "Mis ganancias";
  return `<a href="liquidaciones.html" class="nav-item ${pagina === "liquidaciones.html" ? "active" : ""}"><i class="fa-solid fa-hand-holding-dollar"></i>${texto}</a>`;
}

function enlace(tienda, permiso, href, pagina, icono, texto) {
  if (!puede(tienda, permiso) || !permitePlan(tienda, href)) return "";
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
        ${enlaceLiquidaciones(tienda, pagina)}
        ${enlace(tienda, "tienda_ver", "tienda.html", pagina, "fa-bag-shopping", "Tienda")}
        ${enlace(tienda, "usuarios_gestionar", "usuarios.html", pagina, "fa-user-shield", "Usuarios")}
        ${enlace(tienda, "ajustes_ver", "comunicados.html", pagina, "fa-bullhorn", "Comunicados")}
        ${enlace(tienda, "ajustes_ver", "ajustes.html", pagina, "fa-gear", "Ajustes")}
        ${tienda?.sesion?.es_propietario ? `<a href="mi-plan.html" class="nav-item ${pagina === "mi-plan.html" ? "active" : ""}"><i class="fa-solid fa-gem"></i>Mi plan</a>` : ""}
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
    ].filter(([permiso, href]) => puede(tienda, permiso) && permitePlan(tienda, href));
    mobile.innerHTML = tabs.map(([, href, icono, texto]) =>
      `<a href="${href}" class="tab-item ${pagina === href ? "active" : ""}"><i class="fa-solid ${icono}"></i><span>${texto}</span></a>`,
    ).join("") + `<button type="button" class="tab-item tab-more ${["profesionales.html", "usuarios.html", "comunicados.html", "ajustes.html", "tienda.html", "mi-plan.html", "liquidaciones.html"].includes(pagina) ? "active" : ""}" onclick="toggleMobileMore(true)"><i class="fa-solid fa-ellipsis"></i><span>Más</span></button>`;
  }

  crearModalLogoutGlobal();
  crearMenuMasMobile(pagina, tienda);
}

function opcionMas(tienda, permiso, href, pagina, icono, titulo, detalle) {
  if (!puede(tienda, permiso) || !permitePlan(tienda, href)) return "";
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
      ${(tienda?.sesion?.es_propietario || tienda?.sesion?.id_profesional) ? `<a href="liquidaciones.html" class="${pagina === "liquidaciones.html" ? "active" : ""}"><i class="fa-solid fa-hand-holding-dollar"></i><div><strong>${tienda.sesion.es_propietario ? "Liquidaciones" : "Mis ganancias"}</strong><span>Producción, citas y pagos</span></div><i class="fa-solid fa-chevron-right"></i></a>` : ""}
      ${opcionMas(tienda, "usuarios_gestionar", "usuarios.html", pagina, "fa-user-shield", "Usuarios", "Accesos, roles y permisos")}
      ${opcionMas(tienda, "ajustes_ver", "comunicados.html", pagina, "fa-bullhorn", "Comunicados", "Avisos y promociones para clientes")}
      ${opcionMas(tienda, "ajustes_ver", "ajustes.html", pagina, "fa-sliders", "Ajustes", "Identidad y reglas del negocio")}
      ${tienda?.sesion?.es_propietario ? `<a href="mi-plan.html" class="${pagina === "mi-plan.html" ? "active" : ""}"><i class="fa-solid fa-gem"></i><div><strong>Mi plan</strong><span>Suscripción, vencimiento y pagos</span></div><i class="fa-solid fa-chevron-right"></i></a>` : ""}
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
