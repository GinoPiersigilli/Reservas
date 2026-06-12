# 📚 Guía de Clases CSS Disponibles

## Estructura Base

### Contenedores
```jsx
// Para toda la aplicación (ya aplicado en #root)
<div id="root" className="container">
  {/* max-width: 1200px, centrado, padding: 20px */}
</div>

// Para páginas
<div className="page">
  {/* transparent background */}
</div>

// Para cards/contenedores
<div className="card">
  {/* card background, shadow, border, border-radius */}
</div>
```

---

## Botones

### Variantes Principales
```jsx
// Botón primario - Acción principal
<button className="btn-primary">Guardar</button>

// Botón secundario - Acción alternativa
<button className="btn-secondary">Cancelar</button>

// Botón peligroso - Acciones de riesgo
<button className="btn-danger">Eliminar</button>

// Botón fantasma - Acciones neutras
<button className="btn-ghost">Ver más</button>

// Botón pequeño - Contextos comprimidos
<button className="btn-primary btn-small">OK</button>

// Botón link - Para links dentro de texto
<button className="btn-link">Leer más</button>

// Botón deshabilitado
<button className="btn-primary" disabled>Guardando...</button>
```

### Estados de Botones
```css
/* Hover - Movimiento hacia arriba */
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(59,130,246,0.2);
}

/* Click - Vuelve a posición normal */
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

/* Focus - Outline para keyboard */
button:focus-visible {
  outline: 3px solid rgba(59,130,246,0.25);
  outline-offset: 2px;
}

/* Disabled - Opacity 50% */
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Ejemplo de Uso Completo
```jsx
import React, { useState } from 'react';

export const ButtonExample = () => {
  const [cargando, setCargando] = useState(false);

  const handleClick = async () => {
    setCargando(true);
    try {
      // Acción
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <button className="btn-primary" onClick={handleClick} disabled={cargando}>
        {cargando ? 'Guardando...' : 'Guardar'}
      </button>
      <button className="btn-ghost">Cancelar</button>
    </div>
  );
};
```

---

## Formularios

### Estructura Form
```jsx
// Grid automático 2 columnas desktop, 1 móvil
<form className="form-grid">
  <div className="form-row">
    <label htmlFor="email">Email</label>
    <input id="email" type="email" placeholder="tu@email.com" />
  </div>
  
  <div className="form-row">
    <label htmlFor="password">Contraseña</label>
    <input id="password" type="password" placeholder="••••••••" />
  </div>

  {/* Para ocupar 2 columnas */}
  <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>
    Enviar
  </button>
</form>
```

### Form Row Individual
```jsx
<div className="form-row">
  <label htmlFor="name">Nombre</label>
  <input id="name" type="text" placeholder="Tu nombre" />
</div>
```

### Autenticación
```jsx
<div className="auth-container">
  <div className="auth-card fade-in">
    <h1>Iniciar sesión</h1>
    <p className="subtitle">Accede a tu cuenta</p>
    
    <form className="auth-form">
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
      </div>
      
      <button type="submit" className="btn-primary" style={{ width: '100%' }}>
        Ingresar
      </button>
    </form>
    
    <div className="auth-footer">
      ¿No tenés cuenta? <a href="/register">Registrate</a>
    </div>
  </div>
</div>
```

### Validación Visual
```jsx
// Input normal
<input type="email" value={email} onChange={handleChange} />

// Input con error
{error && <div className="alert alert--error">{error}</div>}

// Con validación en tiempo real
<div className="form-row">
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    value={email}
    onChange={handleChange}
    style={email && !email.includes('@') ? { borderColor: 'var(--danger)' } : {}}
  />
  {email && !email.includes('@') && (
    <span style={{ fontSize: '12px', color: 'var(--danger)' }}>
      Email inválido
    </span>
  )}
</div>
```

---

## Alertas

### Alertas de Estados
```jsx
// Error - Uso: Errores de API, validación fallida
<div className="alert alert--error">
  Error al guardar los cambios
</div>

// Success - Uso: Guardado exitoso, confirmación
<div className="alert alert--success">
  ✓ Cambios guardados correctamente
</div>

// Warning - Uso: Advertencias, confirmaciones
<div className="alert alert--warning">
  ⚠️ Esta acción no se puede deshacer
</div>

// Info - Uso: Información adicional
<div className="alert alert--info">
  ℹ️ Por favor, completa el formulario
</div>
```

### Con Lógica Condicional
```jsx
const [error, setError] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await saveData();
  } catch (err) {
    setError(err.message);
  }
};

return (
  <>
    {error && <div className="alert alert--error">{error}</div>}
    <form onSubmit={handleSubmit}>
      {/* Form content */}
    </form>
  </>
);
```

---

## Tablas

### Tabla Profesional
```jsx
// Wrapper necesario para estilos
<div className="table-wrapper">
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Nombre</th>
        <th>Email</th>
        <th style={{ textAlign: 'right' }}>Acciones</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item) => (
        <tr key={item.id}>
          <td style={{ fontWeight: 500 }}>#{item.id}</td>
          <td>{item.nombre}</td>
          <td>{item.email}</td>
          <td style={{ textAlign: 'right' }}>
            <button className="btn-ghost btn-small">
              Ver →
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Con Badges de Estado
```jsx
<div className="table-wrapper">
  <table>
    <thead>
      <tr><th>ID</th><th>Estado</th><th>Acciones</th></tr>
    </thead>
    <tbody>
      {reservas.map((r) => (
        <tr key={r.id}>
          <td>#{r.id}</td>
          <td>
            <span className={`badge ${getBadgeClass(r.estado)}`}>
              {r.estado}
            </span>
          </td>
          <td>
            <button className="btn-ghost btn-small">Ver</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

// Función helper
const getBadgeClass = (estado) => {
  switch(estado) {
    case 'pendiente': return 'badge--pending';
    case 'aprobada': return 'badge--approved';
    case 'cancelada':
    case 'rechazada': return 'badge--rejected';
    default: return '';
  }
};
```

---

## Badges (Estados)

### Variantes
```jsx
// Pendiente - Acción esperada
<span className="badge badge--pending">⏳ PENDIENTE</span>

// Aprobada - Estado positivo
<span className="badge badge--approved">✅ APROBADA</span>

// Rechazada - Estado negativo
<span className="badge badge--rejected">✗ RECHAZADA</span>
```

### En Contextos
```jsx
// En tabla
<td>
  <span className="badge badge--pending">Pendiente</span>
</td>

// Como indicador
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  <span>Estado actual:</span>
  <span className="badge badge--approved">Aprobada</span>
</div>

// En header
<div className="page-header">
  <h1>Reserva #123</h1>
  <span className="badge badge--pending" style={{ fontSize: '14px' }}>
    Pendiente
  </span>
</div>
```

---

## Page Layout

### Page Header
```jsx
// Básico
<div className="page-header">
  <h1>Título de página</h1>
</div>

// Con subtítulo
<div className="page-header">
  <div>
    <h1>Mis Reservas</h1>
    <p className="page-sub">Gestiona tus reservas aquí</p>
  </div>
</div>

// Con acciones
<div className="page-header">
  <div>
    <h1>Dashboard</h1>
    <p className="page-sub">Resumen general</p>
  </div>
  <div className="page-actions">
    <button className="btn-primary">+ Nuevo</button>
    <button className="btn-ghost">Exportar</button>
  </div>
</div>
```

### Page Actions
```jsx
// Botones en línea responsive
<div className="page-actions">
  <a href="/nuevo" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', padding: '11px 18px' }}>
    + Nueva
  </a>
  <button className="btn-secondary">Resumen</button>
  <button className="btn-ghost">Más opciones</button>
</div>

// En móvil se convierten a full-width
// En desktop quedan en fila
```

### Section Title
```jsx
<h2 className="section-title">Próximas acciones</h2>
<p className="section-subtitle">Tareas pendientes para hoy</p>

{/* Contenido de sección */}
```

### Back Button
```jsx
// Simple
<button onClick={() => navigate(-1)} className="back-button">
  ← Volver
</button>

// Como link
<a href="/anterior" className="back-button">
  ← Volver al listado
</a>
```

---

## Métricas (Dashboard)

### Grid de Métricas
```jsx
<div className="metrics-grid">
  <div className="metric">
    <div className="value">142</div>
    <div className="label">Reservas Totales</div>
  </div>
  
  <div className="metric">
    <div className="value">23</div>
    <div className="label">Pendientes</div>
  </div>
  
  <div className="metric">
    <div className="value">89</div>
    <div className="label">Aprobadas</div>
  </div>
</div>
```

### Métrica Individual
```jsx
const MetricCard = ({ label, value, trend }) => (
  <div className="metric">
    <div className="value">{value}</div>
    <div className="label">{label}</div>
    {trend && (
      <div style={{ fontSize: '12px', color: trend > 0 ? '#34D399' : '#FB7185', marginTop: '8px' }}>
        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
      </div>
    )}
  </div>
);
```

---

## Utilidades Flexibles

### Row (Flex Row)
```jsx
<div className="row">
  <span>Label</span>
  <button className="btn-small">Acción</button>
  <span>Info</span>
</div>
```

### Stack (Flex Column)
```jsx
<div className="stack">
  <h3>Título</h3>
  <p>Descripción</p>
  <button className="btn-primary">Continuar</button>
</div>
```

### Center (Flex Center)
```jsx
<div className="center" style={{ minHeight: '200px' }}>
  <p>Contenido centrado</p>
</div>
```

### Grid 2 Columnas
```jsx
<div className="grid-2">
  <div>
    {/* Contenido principal */}
  </div>
  <aside>
    {/* Sidebar */}
  </aside>
</div>

// En mobile: 1 columna
// En desktop: 1fr 320px
```

---

## Animaciones

### Fade In
```jsx
// Aplicar a elemento que entra
<div className="fade-in">
  {/* Elemento entra con animación */}
</div>

// CSS: floatUp 340ms cubic-bezier
// translateY(6px) → 0, opacity 0 → 1
```

### Transition Fast
```jsx
<div className="transition-fast">
  {/* Elemento con transición rápida a todos */}
</div>

// 220ms cubic-bezier en todas las propiedades
```

### Loader
```jsx
// Spinner simple
<div className="loader"></div>

// Con texto
<div style={{ textAlign: 'center' }}>
  <div className="loader" style={{ display: 'inline-block' }}></div>
  <p style={{ marginTop: '12px' }}>Cargando...</p>
</div>
```

---

## Text Utilities

### Text Muted
```jsx
<p className="text-muted">Texto secundario, menos importante</p>
```

### Small
```jsx
<span className="small">Texto pequeño, 13px</span>
```

### Combinadas
```jsx
<div className="text-muted small">
  Información adicional poco importante
</div>
```

---

## Responsive Patterns

### Grid Automático
```jsx
// 2 columnas en desktop, 1 en móvil
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
  <div>Elemento 1</div>
  <div>Elemento 2</div>
  <div>Elemento 3</div>
</div>
```

### Flex Responsivo
```jsx
<div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
  <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}>
    Botón 1
  </button>
  <button className="btn-ghost" style={{ flex: 1, minWidth: '120px' }}>
    Botón 2
  </button>
</div>

// En mobile: stack vertical (flexWrap: wrap)
// En desktop: fila horizontal (flex: 1)
```

---

## Variables CSS Disponibles

```css
/* Paleta */
--bg: #0F172A;
--surface: #111827;
--card: #1E293B;
--primary: #3B82F6;
--primary-600: #2563EB;
--secondary: #8B5CF6;
--muted: #94A3B8;
--text: #F8FAFC;
--text-soft: #94A3B8;
--danger: #FB7185;
--success: #34D399;

/* Radios */
--radius-xl: 20px;
--radius-lg: 16px;
--radius-md: 12px;
--radius-sm: 8px;

/* Sombras */
--shadow-soft: 0 6px 20px rgba(2,6,23,0.6);
--shadow-subtle: 0 8px 30px rgba(2,6,23,0.45);
--shadow-elev: 0 12px 50px rgba(2,6,23,0.55);

/* Motion */
--motion-duration: 220ms;
--motion-ease: cubic-bezier(.2,.9,.35,1);
```

### Uso en Componentes
```jsx
// Usar color primario
<button style={{ background: 'var(--primary)' }}>Click</button>

// Usar espaciado
<div style={{ padding: 'var(--gap)', gap: 'var(--gap)' }}>
  Contenido
</div>

// Usar sombra
<div style={{ boxShadow: 'var(--shadow-soft)' }}>
  Card
</div>
```

---

## Patrones Completos

### Card + Botones
```jsx
<div className="card">
  <h3 style={{ marginTop: 0 }}>Título</h3>
  <p className="text-muted">Descripción</p>
  
  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
    <button className="btn-primary">Guardar</button>
    <button className="btn-ghost">Cancelar</button>
  </div>
</div>
```

### Form + Alert
```jsx
const [error, setError] = useState(null);

return (
  <div className="card">
    {error && <div className="alert alert--error">{error}</div>}
    
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="field">Campo</label>
        <input id="field" type="text" />
      </div>
      
      <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>
        Enviar
      </button>
    </form>
  </div>
);
```

### Tabla + Badges + Acciones
```jsx
<div className="table-wrapper">
  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={item.id}>
          <td>{item.nombre}</td>
          <td>
            <span className={`badge ${getStatusClass(item.estado)}`}>
              {item.estado}
            </span>
          </td>
          <td>
            <div className="table-actions">
              <button className="btn-ghost btn-small">Ver</button>
              <button className="btn-ghost btn-small">Editar</button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Checklist de Buenas Prácticas

- ✅ Usar clases CSS en lugar de estilos inline
- ✅ Mantener consistencia con paleta de colores
- ✅ Usar grid/flex para layouts, no floats
- ✅ Envolver tablas en `.table-wrapper`
- ✅ Usar `.card` para contenedores de contenido
- ✅ Aplicar `.fade-in` a elementos que entran
- ✅ Usar `.form-grid` para formularios
- ✅ Aplicar `.page-header` + `.page-actions` en páginas
- ✅ Usar badges para estados
- ✅ Usar `.alert` para mensajes
- ✅ Respetar breakpoints responsive
- ✅ Mantener labels en todos los inputs
- ✅ Usar `.btn-small` en contextos comprimidos
- ✅ Aplicar focus-visible en botones
- ✅ Usar emojis en buttons para contexto visual

---

**Última actualización:** Junio 2026 | **Versión:** 1.0
