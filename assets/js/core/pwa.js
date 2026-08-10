// ==========================================
// TAMAKU PWA MANAGER - Inteligente y Modular
// ==========================================

class TamakuPWA {
  constructor() {
    this.deferredPrompt = null;
    this.widget = null;

    // Detectar si es iOS (iPhone/iPad)
    this.isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Detectar si ya está instalada (Standalone mode)
    this.isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    this.init();
  }

  init() {
    // 1. Registrar Service Worker silenciosamente
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("✅ PWA Core Activo"))
          .catch((err) => console.error("❌ Error PWA:", err));
      });
    }

    // Si ya está instalada, no hacemos nada más y nos detenemos aquí
    if (this.isStandalone) return;

    // 2. Construir la UI del widget flotante
    this.buildWidget();

    // 3. Lógica para Android / Chrome (Captura el evento nativo)
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      // Mostrar widget con un pequeño retraso de 2 segundos para no ser invasivo
      setTimeout(() => this.showWidget(), 2000);
    });

    // 4. Lógica para iOS (Apple no soporta beforeinstallprompt, se muestra instrucción manual)
    if (this.isIOS) {
      setTimeout(() => this.showIOSWidget(), 2000);
    }
  }

  buildWidget() {
    // Inyectamos el HTML directamente desde JS para no ensuciar el index.html
    const widgetHTML = `
            <div id="tamakuPWA" class="tamaku-pwa-widget">
                <img src="/assets/images/icon-192.png" alt="Tamaku App" class="pwa-icon">
                <div class="pwa-info">
                    <h4 class="pwa-title">TAMAKU APP</h4>
                    <p class="pwa-desc">Acceso rápido y premium</p>
                </div>
                <button id="pwaInstallBtn" class="pwa-btn">Instalar</button>
                <button id="pwaCloseBtn" class="pwa-close">&times;</button>

                <div id="pwaIosHelp" class="ios-instruction">
                    Toca <strong>Compartir</strong> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> <br> y luego <strong>Agregar a inicio</strong> ➕
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", widgetHTML);

    this.widget = document.getElementById("tamakuPWA");

    // Asignar eventos a los botones
    document
      .getElementById("pwaCloseBtn")
      .addEventListener("click", () => this.hideWidget());
    document
      .getElementById("pwaInstallBtn")
      .addEventListener("click", () => this.installApp());
  }

  showWidget() {
    if (this.widget) this.widget.classList.add("show");
  }

  showIOSWidget() {
    if (this.widget) {
      // Adaptamos el widget ocultando el botón normal y mostrando las instrucciones de Apple
      document.getElementById("pwaInstallBtn").style.display = "none";
      document.getElementById("pwaIosHelp").style.display = "block";
      this.widget.style.flexWrap = "wrap";
      this.widget.classList.add("show");
    }
  }

  hideWidget() {
    if (this.widget) {
      this.widget.classList.remove("show");
      // Aquí podríamos guardar en localStorage que lo cerró para no molestarlo en 7 días
    }
  }

  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("✅ App instalada por el usuario");
        this.hideWidget();
      }
      this.deferredPrompt = null;
    }
  }
}

// Inicializar cuando el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", () => {
  new TamakuPWA();
});
