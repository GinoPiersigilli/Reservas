import { useState } from 'react';
import { Button, Field, Input, Select } from './ui/index.js';
import { TEXTOS } from '../textos.js';
import styles from './FiltrosReservas.module.css';

const OPCIONES_ESTADO = [
  { value: 'pendiente', label: TEXTOS.estados.pendiente },
  { value: 'aprobada', label: TEXTOS.estados.aprobada },
  { value: 'rechazada', label: TEXTOS.estados.rechazada },
  { value: 'cancelada', label: TEXTOS.estados.cancelada }
];

export default function FiltrosReservas({ onFiltrar, aulas = [] }) {
  const [form, setForm] = useState({ fecha: '', estado: '', aulaId: '', q: '' });

  const handleChange = (evento) => {
    const { name, value } = evento.target;
    const actualizado = { ...form, [name]: value };
    setForm(actualizado);
    if (name !== 'q') {
      onFiltrar(actualizado);
    }
  };

  const handleSubmit = (evento) => {
    evento.preventDefault();
    onFiltrar(form);
  };

  const handleLimpiar = () => {
    const vacio = { fecha: '', estado: '', aulaId: '', q: '' };
    setForm(vacio);
    onFiltrar(vacio);
  };

  const tieneFiltros = Object.values(form).some((valor) => valor !== '');
  const opcionesAula = aulas.map((aula) => ({
    value: String(aula.id),
    label: aula.nombre
  }));

  return (
    <section aria-label="Filtros de búsqueda" className={styles.panel}>
      <form onSubmit={handleSubmit} className={styles.fila}>
        <Field id="filtro-estado" etiqueta="Estado">
          <Select
            name="estado"
            value={form.estado}
            onChange={handleChange}
            placeholder="Todos"
            opciones={OPCIONES_ESTADO}
          />
        </Field>

        <Field id="filtro-fecha" etiqueta="Fecha">
          <Input type="date" name="fecha" value={form.fecha} onChange={handleChange} />
        </Field>

        <Field id="filtro-aula" etiqueta="Aula">
          {opcionesAula.length > 0 ? (
            <Select
              name="aulaId"
              value={form.aulaId}
              onChange={handleChange}
              placeholder="Todas"
              opciones={opcionesAula}
            />
          ) : (
            <Input
              type="number"
              name="aulaId"
              min="1"
              value={form.aulaId}
              onChange={handleChange}
              placeholder="Todas (ID)"
            />
          )}
        </Field>

        <Field id="filtro-q" etiqueta="Buscar">
          <Input
            type="text"
            name="q"
            value={form.q}
            onChange={handleChange}
            placeholder="Motivo de la reserva"
          />
        </Field>

        <div className={styles.acciones}>
          <Button type="submit" variante="secundario">
            Filtrar
          </Button>
          {tieneFiltros ? (
            <Button type="button" variante="secundario" onClick={handleLimpiar}>
              {TEXTOS.acciones.limpiarFiltros}
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
