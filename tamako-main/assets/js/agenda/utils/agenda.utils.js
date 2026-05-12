// ⏱️ CONVERTIR "HH:mm" → minutos
export function horaToMin(hora = "00:00") {

    const [h, m] = hora
        .split(":")
        .map(Number);

    return (h * 60) + m;
}

// ⏱️ CONVERTIR minutos → formato 12H
export function minToTime12(minutos = 0) {

    let horas = Math.floor(minutos / 60);

    const minutosRestantes =
        minutos % 60;

    const periodo =
        horas >= 12 ? "PM" : "AM";

    horas = horas % 12 || 12;

    return `
        ${horas
            .toString()
            .padStart(2, "0")}
        :
        ${minutosRestantes
            .toString()
            .padStart(2, "0")}
        ${periodo}
    `
    .replace(/\s/g, "");
}

// 🧠 NORMALIZAR HORAS
// Acepta:
// 08:00
// 08:00:00
// 8:00 PM
// 8:00 AM
export function normalizarHora(hora) {

    if (!hora) {

        return "00:00";
    }

    hora = hora.trim();

    // HH:mm:ss
    if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) {

        const [h, m] = hora.split(":");

        return `${h}:${m}`;
    }

    // HH:mm
    if (/^\d{2}:\d{2}$/.test(hora)) {

        return hora;
    }

    // h:mm AM/PM
    const match = hora.match(
        /(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );

    if (match) {

        let horas =
            parseInt(match[1], 10);

        const minutos = match[2];

        const periodo =
            match[3].toUpperCase();

        if (
            periodo === "PM" &&
            horas !== 12
        ) {
            horas += 12;
        }

        if (
            periodo === "AM" &&
            horas === 12
        ) {
            horas = 0;
        }

        return `
            ${horas
                .toString()
                .padStart(2, "0")}
            :
            ${minutos}
        `
        .replace(/\s/g, "");
    }

    console.warn(
        "⚠️ Hora no reconocida:",
        hora
    );

    return "00:00";
}

// 📅 FORMATEAR FECHA
export function formatearFecha(fecha) {

    return fecha.toLocaleDateString(
        "es-CO",
        {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    )
    .toUpperCase();
}