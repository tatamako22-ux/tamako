(() => {
  const nav = document.getElementById('tamakuPublicNav');
  if (!nav) return;
  const boton = nav.querySelector('.menu-toggle');
  const enlaces = nav.querySelector('.nav-links');
  const cambiar = abierto => {
    enlaces.classList.toggle('active', abierto);
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    boton.textContent = abierto ? '×' : '☰';
  };
  boton.addEventListener('click', () => cambiar(boton.getAttribute('aria-expanded') !== 'true'));
  enlaces.addEventListener('click', event => { if (event.target.closest('a')) cambiar(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') { cambiar(false); boton.focus(); }
  });
  document.addEventListener('click', event => { if (!nav.contains(event.target)) cambiar(false); });
  const resumen = document.getElementById('registrationPlanSummary');
  if (resumen) import('./core/planes.js').then(({PLANES,codigoPlan,nombrePlan}) => {
    const codigo = codigoPlan(new URLSearchParams(location.search).get('plan') || 'PRUEBA');
    const precio = PLANES[codigo]?.precio;
    document.getElementById('registrationPlanName').textContent = codigo === 'PRUEBA' ? 'Prueba Diamante · 7 días gratis' : `${nombrePlan(codigo)} · $${new Intl.NumberFormat('es-CO').format(precio)} COP / mes`;
    document.getElementById('registrationPlanNote').textContent = codigo === 'PRUEBA' ? 'Conoce todas las funciones antes de decidir. Sin tarjeta.' : 'Empiezas con 7 días de prueba Diamante. Este es tu plan solicitado para después de la prueba.';
  }).catch(() => {});
})();
