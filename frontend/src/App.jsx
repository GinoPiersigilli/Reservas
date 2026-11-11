import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { AuthProvider } from './context/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import RutaSoloAdmin from './components/RutaSoloAdmin.jsx';
import Reservas from './pages/Reservas.jsx';
import DetalleReserva from './pages/DetalleReserva.jsx';
import FormularioReserva from './pages/FormularioReserva.jsx';
import Resumen from './pages/Resumen.jsx';
import Aulas from './pages/Aulas.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

const GuiaEstilos = import.meta.env.DEV
  ? lazy(() => import('./pages/GuiaEstilos.jsx'))
  : null;

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/reservas" replace />} />
        <Route path="/login/*" element={<Login />} />
        <Route path="/register/*" element={<Register />} />
        <Route
          path="/sso-callback"
          element={
            <AuthenticateWithRedirectCallback
              signInForceRedirectUrl="/reservas"
              signUpForceRedirectUrl="/reservas"
            />
          }
        />
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
          <Route
            path="/aulas"
            element={
              <RutaSoloAdmin>
                <Aulas />
              </RutaSoloAdmin>
            }
          />
        </Route>
        {import.meta.env.DEV && GuiaEstilos ? (
          <Route
            path="/guia-estilos"
            element={
              <Suspense fallback={null}>
                <GuiaEstilos />
              </Suspense>
            }
          />
        ) : null}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
