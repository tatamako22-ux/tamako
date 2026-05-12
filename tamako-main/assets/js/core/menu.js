// assets/js/menu.js

// Funciones de control de Interfaz (Modales)
window.toggleModal = (show) => { 
    const modal = document.getElementById("modalCita");
    if(modal) modal.style.display = show ? "flex" : "none"; 
};

window.toggleQR = (show) => { 
    const modal = document.getElementById("modalQR");
    if(modal) modal.style.display = show ? "flex" : "none"; 
};

window.toggleLogout = (show) => { 
    const modal = document.getElementById("modalLogout");
    if(modal) modal.style.display = show ? "flex" : "none"; 
};

// Función de Cerrar Sesión Universal
window.cerrarSesion = () => { 
    localStorage.clear(); 
    // Como estamos en una subcarpeta (pages), subimos un nivel al index
    window.location.href = "../index.html"; 
};

console.log("🛠️ Tamako Core cargado");