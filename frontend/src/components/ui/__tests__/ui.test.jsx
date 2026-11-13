import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GuiaEstilos from '../../../pages/GuiaEstilos.jsx';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  EstadoBadge,
  Field,
  Input,
  Select,
  TablaSkeleton,
  Table,
  Textarea,
  Toast
} from '../index.js';

describe('Componentes base de UI (src/components/ui/)', () => {
  describe('Button', () => {
    it('renderiza las variantes primario, secundario y peligro y ejecuta onClick', () => {
      const onClick = vi.fn();
      const { rerender } = render(
        <Button variante="primario" onClick={onClick}>
          Reservar aula
        </Button>
      );

      const boton = screen.getByRole('button', { name: 'Reservar aula' });
      expect(boton).toBeInTheDocument();
      expect(boton).not.toBeDisabled();
      fireEvent.click(boton);
      expect(onClick).toHaveBeenCalledTimes(1);

      rerender(<Button variante="secundario">Guardar cambios</Button>);
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();

      rerender(<Button variante="peligro">Cancelar reserva</Button>);
      expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
    });

    it('deshabilita el botón y marca aria-busy cuando está cargando', () => {
      render(<Button cargando>Procesando…</Button>);
      const boton = screen.getByRole('button', { name: 'Procesando…' });
      expect(boton).toBeDisabled();
      expect(boton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Field, Input, Select y Textarea', () => {
    it('asocia etiqueta, ayuda y error al Input mediante atributos ARIA', () => {
      render(
        <Field
          id="campo-email"
          etiqueta="Correo electrónico"
          ayuda="Ingrese su correo institucional"
          error="El correo electrónico no es válido"
          obligatorio
        >
          <Input type="email" />
        </Field>
      );

      const input = screen.getByLabelText(/Correo electrónico/i);
      expect(input).toHaveAttribute('id', 'campo-email');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-invalid', 'true');

      const ayuda = screen.getByText('Ingrese su correo institucional');
      const error = screen.getByRole('alert');
      expect(error).toHaveTextContent('El correo electrónico no es válido');

      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toContain(ayuda.id);
      expect(describedBy).toContain(error.id);
    });

    it('renderiza Select y Textarea asociados a su etiqueta en Field', () => {
      render(
        <div>
          <Field etiqueta="Aula" obligatorio>
            <Select
              placeholder="Seleccione un aula"
              opciones={[
                { value: '1', label: 'Aula 910' },
                { value: '2', label: 'Laboratorio A6' }
              ]}
            />
          </Field>
          <Field etiqueta="Motivo" ayuda="Máximo 255 caracteres">
            <Textarea />
          </Field>
        </div>
      );

      const select = screen.getByLabelText(/Aula/i);
      expect(select).toBeRequired();
      expect(screen.getByRole('option', { name: 'Aula 910' })).toBeInTheDocument();

      const textarea = screen.getByLabelText(/Motivo/i);
      expect(textarea).toHaveAttribute('aria-describedby');
    });
  });

  describe('EstadoBadge', () => {
    it('muestra texto visible e ícono decorativo en los 4 estados', () => {
      const { container } = render(
        <div>
          <EstadoBadge estado="pendiente" />
          <EstadoBadge estado="aprobada" />
          <EstadoBadge estado="rechazada" />
          <EstadoBadge estado="cancelada" />
        </div>
      );

      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('Aprobada')).toBeInTheDocument();
      expect(screen.getByText('Rechazada')).toBeInTheDocument();
      expect(screen.getByText('Cancelada')).toBeInTheDocument();

      const iconos = container.querySelectorAll('svg');
      expect(iconos.length).toBe(4);
      iconos.forEach((svg) => {
        expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
      });
    });
  });

  describe('Table, TablaSkeleton, EmptyState y ErrorState', () => {
    const columnas = [
      { key: 'id', titulo: '#' },
      { key: 'aula', titulo: 'Aula' }
    ];

    it('renderiza filas y cabeceras con Table', () => {
      render(
        <Table
          ariaLabel="Listado de aulas"
          columnas={columnas}
          datos={[{ id: 1, aula: 'Aula 910' }]}
        />
      );

      expect(screen.getByRole('table', { name: 'Listado de aulas' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Aula' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'Aula 910' })).toBeInTheDocument();
    });

    it('muestra estado vacío cuando Table recibe datos vacíos', () => {
      render(
        <Table
          columnas={columnas}
          datos={[]}
          vacioTitulo="No hay reservas"
          vacioDescripcion="Limpie los filtros o cree una reserva."
        />
      );

      expect(screen.getByText('No hay reservas')).toBeInTheDocument();
      expect(screen.getByText('Limpie los filtros o cree una reserva.')).toBeInTheDocument();
    });

    it('renderiza TablaSkeleton con atributos de carga accesibles', () => {
      render(<TablaSkeleton filas={3} columnas={4} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('renderiza EmptyState con acción opcional', () => {
      render(
        <EmptyState
          titulo="Sin resultados"
          descripcion="No se encontraron elementos."
          accion={<Button>Crear nuevo</Button>}
        />
      );

      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Crear nuevo' })).toBeInTheDocument();
    });

    it('renderiza ErrorState con rol alert y botón Reintentar funcional', () => {
      const onReintentar = vi.fn();
      render(
        <ErrorState
          titulo="Error de conexión"
          descripcion="No se pudieron cargar las reservas."
          onReintentar={onReintentar}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      const boton = screen.getByRole('button', { name: 'Reintentar' });
      fireEvent.click(boton);
      expect(onReintentar).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toast', () => {
    it('usa role="alert" para errores, role="status" para info y permite cerrar', () => {
      const onCerrar = vi.fn();
      const { rerender } = render(
        <Toast tipo="info" mensaje="Reserva creada." onCerrar={onCerrar} />
      );

      expect(screen.getByRole('status')).toHaveTextContent('Reserva creada.');
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
      expect(onCerrar).toHaveBeenCalledTimes(1);

      rerender(<Toast tipo="error" mensaje="No se pudo guardar." />);
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
    });
  });

  describe('ConfirmDialog', () => {
    function DemoDialogo() {
      const [abierto, setAbierto] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setAbierto(true)}>
            Abrir confirmación
          </button>
          <ConfirmDialog
            abierto={abierto}
            titulo="Cancelar reserva"
            descripcion="¿Confirma que desea cancelar esta reserva?"
            textoConfirmar="Cancelar reserva"
            textoCancelar="Volver"
            onConfirmar={() => setAbierto(false)}
            onCancelar={() => setAbierto(false)}
          />
        </div>
      );
    }

    it('atrapa el foco con Tab, cierra con Escape y devuelve el foco al botón disparador', () => {
      render(<DemoDialogo />);

      const disparador = screen.getByRole('button', { name: 'Abrir confirmación' });
      disparador.focus();
      expect(document.activeElement).toBe(disparador);

      fireEvent.click(disparador);

      const dialogo = screen.getByRole('dialog', { name: 'Cancelar reserva' });
      expect(dialogo).toHaveAttribute('aria-modal', 'true');

      const btnCancelar = screen.getByRole('button', { name: 'Volver' });
      const btnConfirmar = screen.getByRole('button', { name: 'Cancelar reserva' });

      // Foco inicial en el botón secundario (Cancelar/Volver)
      expect(document.activeElement).toBe(btnCancelar);

      // Shift+Tab desde el primer elemento cicla al último
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(btnConfirmar);

      // Tab desde el último elemento cicla al primero
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(btnCancelar);

      // Escape cierra el diálogo y restaura el foco al disparador
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(disparador);
    });
  });

  describe('Página /guia-estilos (GuiaEstilos)', () => {
    it('renderiza todas las secciones de componentes y estados sin errores', () => {
      render(<GuiaEstilos />);

      expect(
        screen.getByRole('heading', { name: /Guía de estilos y componentes base/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Botones \(Button\)/i })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /Indicadores de estado \(EstadoBadge\)/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Campos y controles/i })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /Tabla de datos y esqueleto de carga/i })
      ).toBeInTheDocument();
    });
  });
});
