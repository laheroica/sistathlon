import { Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-8">
          <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-6 max-w-xl w-full">
            <h2 className="text-red-400 font-bold text-lg mb-2">Error en la página</h2>
            <pre className="text-red-300 text-xs whitespace-pre-wrap break-all bg-red-950/40 rounded-xl p-4">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack?.split('\n').slice(0,6).join('\n')}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-xl text-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
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
import DisciplinasPage from './pages/DisciplinasPage'

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
        <Route path="disciplinas" element={<RolRoute roles={['sadmin']}><DisciplinasPage /></RolRoute>} />
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
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AuthProvider>
  )
}
