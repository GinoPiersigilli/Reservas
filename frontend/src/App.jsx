import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import RutaSoloAdmin from './components/RutaSoloAdmin.jsx';
import Reservas from './pages/Reservas.jsx';
import DetalleReserva from './pages/DetalleReserva.jsx';
import FormularioReserva from './pages/FormularioReserva.jsx';
import Resumen from './pages/Resumen.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import GuiaEstilos from './pages/GuiaEstilos.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/reservas" replace />} />
        <Route path="/login/*" element={<Login />} />
        <Route path="/register/*" element={<Register />} />
        <Route
          element={
            <RutaProtegida>
              <AppShell />
            </RutaProtegida>
          }
        >
          <Route path="/reservas" element={<Reservas />} />
          <Route path="/reservas/nueva" element={<FormularioReserva />} />
          <Route path="/reservas/:id" element={<DetalleReserva />} />
          <Route
            path="/reservas/:id/editar"
            element={
              <RutaSoloAdmin>
                <FormularioReserva />
              </RutaSoloAdmin>
            }
          />
          <Route
            path="/resumen"
            element={
              <RutaSoloAdmin>
                <Resumen />
              </RutaSoloAdmin>
            }
          />
        </Route>
        {import.meta.env.DEV ? (
          <Route path="/guia-estilos" element={<GuiaEstilos />} />
        ) : null}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
