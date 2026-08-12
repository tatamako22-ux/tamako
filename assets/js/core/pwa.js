class TamakuPWA {
  constructor() {
    this.deferredPrompt = null;
    this.widget = null;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    this.isMobileDevice = navigator.userAgentData?.mobile === true
      || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || this.isIOS;
    this.isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    this.init();
  }

  init() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Error PWA:", error)));
    }
    // El aviso solo desaparece definitivamente cuando la aplicación realmente
    // está abierta desde el icono instalado en la pantalla de inicio.
    // La invitación de instalación pertenece únicamente a celulares y tabletas.
    // En un computador conservamos el service worker, pero no creamos el aviso.
    if (this.isStandalone || !this.isMobileDevice) return;
    this.buildWidget();
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      setTimeout(() => this.showWidget(), 1800);
    });
    if (this.isIOS) setTimeout(() => this.showIOSWidget(), 1800);
  }

  buildWidget() {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="tamakuPWABackdrop" class="tamaku-pwa-backdrop" aria-hidden="true"></div>
      <section id="tamakuPWA" class="tamaku-pwa-widget" role="dialog" aria-modal="false" aria-labelledby="pwaTitle">
        <button id="pwaCloseBtn" class="pwa-close" type="button" aria-label="Cerrar aviso de instalación"><span class="pwa-x" aria-hidden="true">×</span><span class="pwa-close-label">Cerrar</span></button>
        <div class="pwa-summary">
          <img src="/assets/images/icon-192.png" alt="" class="pwa-icon">
          <div class="pwa-info"><span class="pwa-kicker">ACCESO RÁPIDO</span><h4 id="pwaTitle" class="pwa-title">Instala TAMAKU</h4><p class="pwa-desc">Entra a tu negocio desde la pantalla principal.</p></div>
          <button id="pwaInstallBtn" class="pwa-btn" type="button">Instalar</button>
        </div>
        <div id="pwaIosHelp" class="ios-instruction">
          <div class="ios-heading"><span class="apple-mark"></span><div><b>Agregar TAMAKU en iPhone</b><p>Se hace desde Safari en tres pasos.</p></div></div>
          <ol class="ios-steps">
            <li><span>1</span><div><b>Abre esta página en Safari</b><small>Si estás en otro navegador, copia el enlace y ábrelo en Safari.</small></div><i aria-hidden="true">🧭</i></li>
            <li><span>2</span><div><b>Toca el botón Compartir</b><small>Es el cuadrado con una flecha hacia arriba.</small></div><i aria-hidden="true">↥</i></li>
            <li><span>3</span><div><b>Selecciona “Agregar a inicio”</b><small>Luego toca “Agregar” arriba a la derecha.</small></div><i aria-hidden="true">⊞</i></li>
          </ol>
          <button id="pwaIOSDone" class="pwa-done" type="button">Entendido, continuar</button>
          <p class="ios-note">Apple no muestra un botón de instalación automático; estos pasos crean el ícono de TAMAKU.</p>
        </div>
      </section>`);
    this.widget = document.getElementById("tamakuPWA");
    this.backdrop = document.getElementById("tamakuPWABackdrop");
    document.getElementById("pwaCloseBtn").addEventListener("click", () => this.hideWidget());
    document.getElementById("pwaInstallBtn").addEventListener("click", () => this.installApp());
    document.getElementById("pwaIOSDone").addEventListener("click", () => this.hideWidget());
    this.backdrop.addEventListener("click", () => this.hideWidget());
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") this.hideWidget(); });
  }

  showWidget() { this.widget?.classList.add("show"); }

  showIOSWidget() {
    if (!this.widget) return;
    this.widget.classList.add("is-ios", "show");
    this.widget.setAttribute("aria-modal", "true");
    this.backdrop.classList.add("show");
    this.backdrop.setAttribute("aria-hidden", "false");
  }

  hideWidget() {
    this.widget?.classList.remove("show");
    this.backdrop?.classList.remove("show");
    this.backdrop?.setAttribute("aria-hidden", "true");
  }

  async installApp() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === "accepted") this.hideWidget();
    this.deferredPrompt = null;
  }
}

document.addEventListener("DOMContentLoaded", () => new TamakuPWA());
