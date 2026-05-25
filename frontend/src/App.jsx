import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AlumnosPage from './pages/AlumnosPage'
import NuevoAlumnoPage from './pages/NuevoAlumnoPage'
import CajaPage from './pages/CajaPage'
import TemporalesPage from './pages/TemporalesPage'
import ProfesPage from './pages/ProfesPage'
import HorariosPage from './pages/HorariosPage'
import LiquidacionesPage from './pages/LiquidacionesPage'
import GastosPage from './pages/GastosPage'
import CobrosPage from './pages/CobrosPage'
import ReportesPage from './pages/ReportesPage'
import ProductosPage from './pages/ProductosPage'
import MensajesPage from './pages/MensajesPage'
import PreciosPage from './pages/PreciosPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-dark-bg flex items-center justify-center text-dark-muted">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RolRoute({ children, roles }) {
  const { user } = useAuth()
  if (!roles || roles.includes(user?.rol)) return children
  return <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="alumnos" element={<AlumnosPage />} />
        <Route path="alumnos/nuevo" element={<NuevoAlumnoPage />} />
        <Route path="profes" element={<RolRoute roles={['sadmin']}><ProfesPage /></RolRoute>} />
        <Route path="precios" element={<RolRoute roles={['sadmin']}><PreciosPage /></RolRoute>} />
        <Route path="horarios" element={<HorariosPage />} />
        <Route path="liquidaciones" element={<RolRoute roles={['sadmin']}><LiquidacionesPage /></RolRoute>} />
        <Route path="mensajes" element={<MensajesPage />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="cobros" element={<CobrosPage />} />
        <Route path="gastos" element={<GastosPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="temporales" element={<TemporalesPage />} />
        <Route path="productos" element={<ProductosPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
