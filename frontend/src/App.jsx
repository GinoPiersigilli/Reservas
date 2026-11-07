import { Routes, Route, Navigate } from 'react-router-dom';
import { SignUp } from '@clerk/clerk-react';
import { AuthProvider } from './context/AuthContext.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import RutaSoloAdmin from './components/RutaSoloAdmin.jsx';
import Reservas from './pages/Reservas.jsx';
import DetalleReserva from './pages/DetalleReserva.jsx';
import FormularioReserva from './pages/FormularioReserva.jsx';
import Resumen from './pages/Resumen.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/Login.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/reservas" replace />} />
        <Route path="/login/*" element={<Login />} />
        <Route path="/register/*" element={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <SignUp routing="path" path="/register" redirectUrl="/reservas" />
          </div>
        } />
        <Route path="/reservas" element={<RutaProtegida><Reservas /></RutaProtegida>} />
        <Route path="/reservas/nueva" element={<RutaProtegida><FormularioReserva /></RutaProtegida>} />
        <Route path="/reservas/:id" element={<RutaProtegida><DetalleReserva /></RutaProtegida>} />
        <Route path="/reservas/:id/editar" element={<RutaSoloAdmin><FormularioReserva /></RutaSoloAdmin>} />
        <Route path="/resumen" element={<RutaSoloAdmin><Resumen /></RutaSoloAdmin>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;