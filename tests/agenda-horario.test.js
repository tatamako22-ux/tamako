import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerHorarioDelDia } from '../assets/js/agenda/utils/agenda.horario.js';
import { calcularCita } from '../assets/js/agenda/core/agenda.engine.js';

test('sabado ampliado usa su jornada y origen para reservar intervalos', () => {
  const profesional = {
    horario_inicio: '09:00', horario_fin: '18:00',
    horario_semanal: { 'sábado': { activo: true, inicio: '08:00', fin: '21:00' } },
  };
  const jornada = obtenerHorarioDelDia(profesional, new Date(2026, 10, 7));
  assert.deepEqual(jornada, { inicio: '08:00', fin: '21:00' });
  const reservar = (inicio, duracion) => calcularCita({
    inicioDeseado: inicio, duracion, modo: 'intervalo', intervaloProfesional: 40,
    jornadaInicio: 480, jornadaFin: 1260,
  });
  assert.ok(reservar(680, 60)); // 11:20: valido desde las 08:00, no desde 09:00.
  assert.ok(reservar(1160, 60)); // Extension despues del cierre habitual.
  assert.equal(reservar(1240, 60), null); // Respeta el cierre especial.
  assert.deepEqual(obtenerHorarioDelDia(profesional, new Date(2026, 10, 9)), {
    inicio: '09:00', fin: '18:00',
  });
});

test('miercoles respeta su horario especial y los dias inactivos usan el habitual', () => {
  const profesional = { horario_semanal: {
    'miércoles': { activo: true, inicio: '10:00', fin: '22:00' },
    'sábado': { activo: false, inicio: '10:00', fin: '22:00' },
  } };
  assert.deepEqual(obtenerHorarioDelDia(profesional, new Date(2026, 10, 4)), {
    inicio: '10:00', fin: '22:00',
  });
  assert.deepEqual(obtenerHorarioDelDia(profesional, new Date(2026, 10, 7)), {
    inicio: '08:00', fin: '20:00',
  });
});
