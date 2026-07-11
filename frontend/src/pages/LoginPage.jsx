import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login } from '../lib/auth'
import logoBlanco from '../assets/logo-blanco.png'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(username, password)
      setUser(user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoBlanco} alt="Athlon" className="h-12 w-auto object-contain mx-auto mb-4" />
          <p className="text-dark-muted text-sm mt-1">Sistema de Gestión</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Usuario</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-base"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-dark-muted mt-6">
          General Pico, La Pampa · Athlon 107 &amp; Athlon 24
        </p>
      </div>
    </div>
  )
}
