// 🧠 MOTOR DE AGENDA TAMAKU

export function horaToMin(h) {
    if (!h) return 0;
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
}

export function minToHora(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// 🔹 Generar timeline inteligente
export function generarTimeline(bloques, inicioJornada, finJornada) {
    let timeline = [];
    let cursor = inicioJornada;

    // ordenar bloques
    bloques.sort((a, b) => a.inicio - b.inicio);

    for (let b of bloques) {

        // espacio libre antes del bloque
        if (cursor < b.inicio) {
            timeline.push({
                inicio: cursor,
                fin: b.inicio,
                tipo: "libre"
            });
        }

        // bloque ocupado
        timeline.push({
            inicio: b.inicio,
            fin: b.fin,
            tipo: b.tipo || "ocupado"
        });

        cursor = Math.max(cursor, b.fin);
    }

    // espacio libre final
    if (cursor < finJornada) {
        timeline.push({
            inicio: cursor,
            fin: finJornada,
            tipo: "libre"
        });
    }

    return timeline;
}

// 🔹 Buscar mejor espacio disponible
export function encontrarMejorSlot(duracion, timeline) {
    let mejorOpcion = null;

    for (let bloque of timeline) {

        if (bloque.tipo !== "libre") continue;

        const espacio = bloque.fin - bloque.inicio;

        // espacio perfecto
        if (espacio >= duracion) {
            return {
                inicio: bloque.inicio,
                fin: bloque.inicio + duracion,
                tipo: "perfecto"
            };
        }

        // espacio flexible
        if (espacio >= duracion * 0.75) {
            mejorOpcion = {
                inicio: bloque.inicio,
                fin: bloque.fin,
                tipo: "recortado"
            };
        }
    }

    return mejorOpcion;
}

// 🔹 Crear bloques automáticos (almuerzo + break)
export function generarBloquesAutomaticos(profesional) {
    const bloques = [];

    // almuerzo
    if (
        profesional.almuerzo_inicio &&
        Number(profesional.almuerzo_minutos) > 0
    ) {
        const inicio = horaToMin(profesional.almuerzo_inicio);

        bloques.push({
            inicio,
            fin: inicio + Number(profesional.almuerzo_minutos),
            tipo: "almuerzo"
        });
    }

    // break
    if (
        profesional.break_inicio &&
        Number(profesional.break_minutos) > 0
    ) {
        const inicio = horaToMin(profesional.break_inicio);

        bloques.push({
            inicio,
            fin: inicio + Number(profesional.break_minutos),
            tipo: "break"
        });
    }

    return bloques;
}

// 🔹 FUNCIÓN PRINCIPAL
export function calcularCita({
    inicioDeseado,
    duracion,
    modo,
    bloques = [],
    jornadaInicio,
    jornadaFin,
    intervalo = 30,
    profesional = null
}) {

    // agregar bloques automáticos
    let bloquesFinales = [...bloques];

    if (profesional) {
        bloquesFinales.push(...generarBloquesAutomaticos(profesional));
    }

    const inicio = inicioDeseado;
    const fin = inicio + duracion;

    // 🟢 AUTO = usa duración real
    if (modo === "auto") {
        return {
            inicio,
            fin,
            tipo: "auto"
        };
    }

    // 🔒 PRO = no deja cruces
    if (modo === "pro") {
        for (let b of bloquesFinales) {
            if (inicio < b.fin && fin > b.inicio) {
                return null;
            }
        }

        return {
            inicio,
            fin,
            tipo: "pro"
        };
    }

   if (modo === "intervalo") {

    const timeline = generarTimeline(
        bloquesFinales,
        jornadaInicio,
        jornadaFin
    );

    // 🔥 convertir duración a bloques reales
    const bloquesNecesarios = Math.ceil(duracion / intervalo);
    const duracionReal = bloquesNecesarios * intervalo;

    const slot = encontrarMejorSlot(
        duracionReal,
        timeline
    );

    if (slot) {
        return {
            inicio: slot.inicio,
            fin: slot.inicio + duracionReal,
            bloques: bloquesNecesarios,
            tipo: "intervalo"
        };
    }

    return null;
}