// Remember the public booking destination independently of authentication.
(() => {
    const storageKey = "tamaku_booking_destination";
    window.TamakuBookingLaunch = {
        remember(reference) {
            if (typeof reference !== "string" || !reference.trim()) return;
            const target = new URL("/pages/reserva.html", window.location.origin);
            target.searchParams.set("v", reference.trim());
            try { localStorage.setItem(storageKey, target.pathname + target.search); }
            catch { /* Booking remains available when storage is unavailable. */ }
        }
    };

    const standalone = window.matchMedia("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
    const isHome = ["/", "/index.html"].includes(window.location.pathname);
    // Preserve explicit links, including password recovery callbacks.
    if (!standalone || !isHome || window.location.search || window.location.hash) return;
    try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return;
        const target = new URL(saved, window.location.origin);
        if (target.origin !== window.location.origin || target.pathname !== "/pages/reserva.html"
            || !target.searchParams.get("v")?.trim()) return;
        const destination = new URL("/pages/reserva.html", window.location.origin);
        destination.searchParams.set("v", target.searchParams.get("v"));
        window.location.replace(destination.pathname + destination.search);
    } catch { /* Keep the normal home page if no usable destination is stored. */ }
})();
