import {
    horaToMin
} from "./agenda.utils.js";

import {
    normalizarHora
} from "./agenda.utils.js";

// 🔎 BUSCAR CITA EN SLOT
export function buscarCita({

    citasDelDia = [],

    idBarbero,

    horaSlot

}) {

    if (!citasDelDia.length) {

        return null;
    }

    const horaSlotMin =
        horaToMin(
            normalizarHora(
                horaSlot
            )
        );

    return citasDelDia.find(cita => {

        const mismoBarbero =

            String(
                cita.id_barbero
            )

            ===

            String(
                idBarbero
            );

        if (!mismoBarbero) {

            return false;
        }

        const inicio =
            horaToMin(
                normalizarHora(
                    cita.hora_inicio
                )
            );

        const fin =
            horaToMin(
                normalizarHora(
                    cita.hora_fin
                )
            );

        return (

            horaSlotMin >= inicio &&

            horaSlotMin < fin
        );
    });
}

// 📦 CALCULAR SLOTS OCUPADOS
export function getSlotsOcupados({

    cita,

    listaBarberos = [],

    tiendaInfo

}) {

    if (!cita) return 1;

    const inicio =
        horaToMin(
            normalizarHora(
                cita.hora_inicio
            )
        );

    const fin =
        horaToMin(
            normalizarHora(
                cita.hora_fin
            )
        );

    const profesional =
        listaBarberos.find(b => (

            String(
                b.id_profesional
            )

            ===

            String(
                cita.id_barbero
            )
        ));

    const intervalo =

        parseInt(
            profesional
            ?.intervalo_minutos
        )

        ||

        parseInt(
            tiendaInfo
            ?.intervalo_minutos
        )

        ||

        60;

    const duracion =
        fin - inicio;

    return Math.max(
        1,
        Math.ceil(
            duracion / intervalo
        )
    );
}

// 🧠 SABER SI SLOT ESTÁ OCUPADO
export function slotOcupado({

    citasDelDia = [],

    idBarbero,

    horaSlot

}) {

    return !!buscarCita({

        citasDelDia,

        idBarbero,

        horaSlot
    });
}