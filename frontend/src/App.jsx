import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import RutaSoloAdmin from './components/RutaSoloAdmin.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Reservas from './pages/Reservas.jsx';
import DetalleReserva from './pages/DetalleReserva.jsx';
import FormularioReserva from './pages/FormularioReserva.jsx';
import Resumen from './pages/Resumen.jsx';
import NotFound from './pages/NotFound.jsx';
import Callback from './pages/Callback.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/reservas" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/callback" element={<Callback />} />

      <Route path="/reservas" element={
        <RutaProtegida><Reservas /></RutaProtegida>
      } />
      <Route path="/reservas/nueva" element={
        <RutaProtegida><FormularioReserva /></RutaProtegida>
      } />
      <Route path="/reservas/:id" element={
        <RutaProtegida><DetalleReserva /></RutaProtegida>
      } />
      <Route path="/reservas/:id/editar" element={
        <RutaSoloAdmin><FormularioReserva /></RutaSoloAdmin>
      } />
      <Route path="/resumen" element={
        <RutaSoloAdmin><Resumen /></RutaSoloAdmin>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;