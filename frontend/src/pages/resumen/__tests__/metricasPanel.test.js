import { calcularMetricas } from '../metricasPanel.js';

const resumenBase = {
  porEstado: [
    { estado: 'aprobada', total: 6 },
    { estado: 'pendiente', total: 2 }
  ],
  tasaOcupacionAulas: [
    { aulaId: 1, nombre: 'Aula 910', horasOcupadas: 6.5, tasaOcupacion: 12 },
    { aulaId: 2, nombre: 'Aula Magna', horasOcupadas: 4, tasaOcupacion: 30 }
  ],
  aulasMayorDemanda: [
    { aulaId: 1, nombre: 'Aula 910', totalReservas: 3 },
    { aulaId: 2, nombre: 'Aula Magna', totalReservas: 2 }
  ],
  totalReservas: 8
};

describe('calcularMetricas', () => {
  it('une ocupación y demanda de cada aula en una sola fila', () => {
    const { ocupacion } = calcularMetricas(resumenBase, []);

    expect(ocupacion).toEqual([
      { aulaId: 2, nombre: 'Aula Magna', tasaOcupacion: 30, horasOcupadas: 4, totalReservas: 2 },
      { aulaId: 1, nombre: 'Aula 910', tasaOcupacion: 12, horasOcupadas: 6.5, totalReservas: 3 }
    ]);
  });

  it('conserva las aulas que solo aparecen en la demanda', () => {
    const { ocupacion } = calcularMetricas(
      {
        ...resumenBase,
        tasaOcupacionAulas: [resumenBase.tasaOcupacionAulas[0]],
        aulasMayorDemanda: [{ aulaId: 7, nombre: 'Sala B', totalReservas: 5 }]
      },
      []
    );

    expect(ocupacion.map((fila) => fila.aulaId)).toContain(7);
    expect(ocupacion.find((fila) => fila.aulaId === 7)).toMatchObject({
      totalReservas: 5,
      tasaOcupacion: 0
    });
  });

  it('deja la cantidad de reservas en cero cuando la demanda no trae el aula', () => {
    const { ocupacion } = calcularMetricas({ ...resumenBase, aulasMayorDemanda: [] }, []);

    expect(ocupacion.every((fila) => fila.totalReservas === 0)).toBe(true);
  });

  it('reconstruye la distribución por estado cuando el backend no la manda', () => {
    const { distribucionEstados } = calcularMetricas(resumenBase, []);

    expect(distribucionEstados).toContainEqual({
      estado: 'aprobada',
      cantidad: 6,
      porcentaje: 75
    });
  });

  it('cuenta los pendientes por la cola, que es más precisa que el agregado', () => {
    const { cantidadPendientes } = calcularMetricas(resumenBase, [{ id: 1 }, { id: 2 }, { id: 3 }]);

    expect(cantidadPendientes).toBe(3);
  });
});
