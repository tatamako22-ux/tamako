console.log("🚨 ENTRE A MENU.JS");
// ==========================================
// 1. FUNCIONES DE MODALES Y SESIÓN
// ==========================================
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

window.cerrarSesion = () => {
  localStorage.clear();
  window.location.href = "../index.html";
};

// ==========================================
// 2. FUNCIÓN PARA INYECTAR EL MENÚ
// ==========================================

function renderMenuGlobal() {
  console.log("🚀 renderMenuGlobal ejecutado");

  const path = window.location.pathname;
  const page = path.split("/").pop() || "dashboard.html";

  const sidebarHTML = `
        <div class="sidebar-logo">✦ TAMAKU</div>
        <nav class="nav-menu">
            <a href="dashboard.html" class="nav-item ${page === "dashboard.html" ? "active" : ""}">
                <i class="fa-solid fa-house"></i> Dashboard
            </a>
            <a href="agenda.html" class="nav-item ${page === "agenda.html" ? "active" : ""}">
                <i class="fa-solid fa-calendar-alt"></i> Agenda
            </a>
            <a href="clientes.html" class="nav-item ${page === "clientes.html" ? "active" : ""}">
                <i class="fa-solid fa-users"></i> Clientes
            </a>
            <a href="profesionales.html" class="nav-item ${page === "profesionales.html" ? "active" : ""}">
    <i class="fa-solid fa-user-tie"></i> Profesionales
</a>

<a href="facturacion.html" class="nav-item ${page === "facturacion.html" ? "active" : ""}">
    <i class="fa-solid fa-file-invoice-dollar"></i> Facturación
</a>

<a href="ajustes.html" class="nav-item ${page === "ajustes.html" ? "active" : ""}">
                <i class="fa-solid fa-gear"></i> Ajustes
            </a>
        </nav>
        <div class="logout-btn" onclick="toggleLogout(true)">
            Cerrar Sesión
        </div>
    `;

  const mobileTabBarHTML = `
        <a href="dashboard.html" class="tab-item ${page === "dashboard.html" ? "active" : ""}">
            <i class="fa-solid fa-house"></i><span>Inicio</span>
        </a>
        <a href="agenda.html" class="tab-item ${page === "agenda.html" ? "active" : ""}">
            <i class="fa-solid fa-calendar"></i><span>Agenda</span>
        </a>
        <a href="profesionales.html" class="tab-item ${page === "profesionales.html" ? "active" : ""}">
            <i class="fa-solid fa-user-tie"></i><span>Staff</span>
        </a>
        <a href="clientes.html" class="tab-item ${page === "clientes.html" ? "active" : ""}">
            <i class="fa-solid fa-users"></i><span>VIP</span>
        </a>
        <a href="facturacion.html" class="tab-item ${page === "facturacion.html" ? "active" : ""}">
    <i class="fa-solid fa-file-invoice-dollar"></i><span>Fact.</span>
</a>
        <a href="ajustes.html" class="tab-item ${page === "ajustes.html" ? "active" : ""}">
            <i class="fa-solid fa-gear"></i><span>Ajustes</span>
        </a>
    `;

  const sidebarContainer = document.querySelector(".sidebar");
  const mobileNavContainer = document.querySelector(".mobile-tab-bar");

  if (sidebarContainer) sidebarContainer.innerHTML = sidebarHTML;
  if (mobileNavContainer) mobileNavContainer.innerHTML = mobileTabBarHTML;
}

// Ejecutar inmediatamente al cargar el script o el DOM
console.log("menu.js ejecutándose");
console.log("📌 Estado DOM:", document.readyState);

document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM cargado, ejecutando menú");
    renderMenuGlobal();
});
