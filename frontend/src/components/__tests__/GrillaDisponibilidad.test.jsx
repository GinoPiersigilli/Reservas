import { render, screen, fireEvent } from '@testing-library/react';
import GrillaDisponibilidad from '../GrillaDisponibilidad.jsx';
import styles from '../GrillaDisponibilidad.module.css';

const AULAS = [
  { id: 1, nombre: 'Aula 101', capacidad: 30, ubicacion: 'Planta baja' },
  { id: 2, nombre: 'Aula 202', capacidad: 20, ubicacion: 'Primer piso' }
];

// Fecha futura fija: ninguna celda queda marcada como horario pasado.
const FECHA = '2099-01-05';

function renderizarGrilla(props = {}) {
  const onSeleccionarFranja = vi.fn();
  render(
    <GrillaDisponibilidad
      aulas={AULAS}
      fecha={FECHA}
      disponibilidadPorAula={{}}
      onSeleccionarFranja={onSeleccionarFranja}
      {...props}
    />
  );
  return { onSeleccionarFranja };
}

const celda = (aula, inicio, fin) =>
  screen.getByRole('button', { name: `${aula}, ${inicio} a ${fin}, libre` });

describe('GrillaDisponibilidad — vista previa del rango', () => {
  it('no sombrea ninguna celda al apuntar si todavía no se eligió un inicio', () => {
    renderizarGrilla();

    fireEvent.mouseEnter(celda('Aula 101', '11:00', '11:30'));

    expect(celda('Aula 101', '11:00', '11:30')).not.toHaveClass(styles.celdaPrevia);
  });

  it('sombrea el rango entre el inicio elegido y la celda apuntada de la misma aula', () => {
    renderizarGrilla();

    fireEvent.click(celda('Aula 101', '10:00', '10:30'));
    fireEvent.mouseEnter(celda('Aula 101', '11:00', '11:30'));

    expect(celda('Aula 101', '10:00', '10:30')).toHaveClass(styles.celdaPrevia);
    expect(celda('Aula 101', '10:30', '11:00')).toHaveClass(styles.celdaPrevia);
    expect(celda('Aula 101', '11:00', '11:30')).toHaveClass(styles.celdaPrevia);

    // Fuera del rango: antes del inicio, después de la celda apuntada y en otra aula.
    expect(celda('Aula 101', '09:30', '10:00')).not.toHaveClass(styles.celdaPrevia);
    expect(celda('Aula 101', '11:30', '12:00')).not.toHaveClass(styles.celdaPrevia);
    expect(celda('Aula 202', '10:30', '11:00')).not.toHaveClass(styles.celdaPrevia);
  });

  it('también muestra el rango al recorrer las celdas con el teclado', () => {
    renderizarGrilla();

    fireEvent.click(celda('Aula 101', '10:00', '10:30'));
    fireEvent.focus(celda('Aula 101', '10:30', '11:00'));

    expect(celda('Aula 101', '10:30', '11:00')).toHaveClass(styles.celdaPrevia);
  });

  it('no sombrea el rango si hay una reserva ocupando parte del tramo', () => {
    renderizarGrilla({
      disponibilidadPorAula: {
        1: [{ id: 9, horaInicio: '11:00:00', horaFin: '12:00:00', estado: 'aprobada' }]
      }
    });

    fireEvent.click(celda('Aula 101', '10:00', '10:30'));
    fireEvent.mouseEnter(celda('Aula 101', '12:00', '12:30'));

    expect(celda('Aula 101', '10:00', '10:30')).not.toHaveClass(styles.celdaPrevia);
    expect(celda('Aula 101', '12:00', '12:30')).not.toHaveClass(styles.celdaPrevia);
  });

  it('quita la vista previa al sacar el mouse de la grilla', () => {
    renderizarGrilla();

    fireEvent.click(celda('Aula 101', '10:00', '10:30'));
    fireEvent.mouseEnter(celda('Aula 101', '11:00', '11:30'));
    fireEvent.mouseLeave(celda('Aula 101', '11:00', '11:30').closest('tbody'));

    expect(celda('Aula 101', '10:30', '11:00')).not.toHaveClass(styles.celdaPrevia);
  });

  it('confirma el rango con el segundo clic y limpia la vista previa', () => {
    const { onSeleccionarFranja } = renderizarGrilla();

    fireEvent.click(celda('Aula 101', '10:00', '10:30'));
    fireEvent.mouseEnter(celda('Aula 101', '11:00', '11:30'));
    fireEvent.click(celda('Aula 101', '11:00', '11:30'));

    expect(onSeleccionarFranja).toHaveBeenLastCalledWith({
      aulaId: '1',
      horaInicio: '10:00',
      horaFin: '11:30'
    });
    expect(celda('Aula 101', '10:30', '11:00')).not.toHaveClass(styles.celdaPrevia);
  });
});
