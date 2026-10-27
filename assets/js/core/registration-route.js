// Las entradas comerciales pasan primero por los planes. Se conservan los
// enlaces de autenticación para no interrumpir la confirmación de una cuenta.
(() => {
  const parametros = new URLSearchParams(window.location.search);
  const plan = (parametros.get('plan') || '').toUpperCase();
  const permitidos = ['PLATA','ZAFIRO','DIAMANTE','BASICO','PRO','PREMIUM','PRUEBA'];
  const confirmacion = parametros.has('code') || /(?:access_token|type=signup)/.test(window.location.hash);
  if (!permitidos.includes(plan) && !confirmacion) {
    window.location.replace(new URL('servicios.html?origen=registro#planes', window.location.href).href);
  }
})();
