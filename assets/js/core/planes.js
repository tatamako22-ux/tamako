// Los códigos se conservan para mantener suscripciones e historial de pagos.
export const PLANES = Object.freeze({
  BASICO: { nombre: "Plata", precio: 34999, usuarios: 1, slug: "plata" },
  PRO: { nombre: "Zafiro", precio: 69999, usuarios: 4, slug: "zafiro" },
  PREMIUM: { nombre: "Diamante", precio: 159999, usuarios: 10, slug: "diamante" },
});

export function codigoPlan(valor = "") {
  const codigo = String(valor).toUpperCase();
  return { PLATA: "BASICO", ZAFIRO: "PRO", DIAMANTE: "PREMIUM" }[codigo] || codigo;
}

export function nombrePlan(valor) {
  const codigo = codigoPlan(valor);
  return codigo === "PRUEBA" ? "Prueba gratuita" : PLANES[codigo]?.nombre || "Sin plan";
}

export function permiteFuncion(tienda, funcion) {
  return tienda?.suscripcion?.funcionalidades?.[funcion] === true;
}
