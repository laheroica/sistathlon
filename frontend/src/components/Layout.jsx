import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'
import {
  LayoutDashboard, Users, UserPlus, Calendar, DollarSign,
  MessageSquare, Archive, BarChart2, Clock, LogOut, Receipt, CreditCard, ShoppingBag, Tag
} from 'lucide-react'
import clsx from 'clsx'

// roles: undefined = todos, array = solo esos roles
const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alumnos',       icon: Users,           label: 'Alumnos' },
  { to: '/profes',        icon: UserPlus,        label: 'Profes',        roles: ['sadmin'] },
  { to: '/precios',       icon: Tag,             label: 'Precios',       roles: ['sadmin'] },
  { to: '/horarios',      icon: Calendar,        label: 'Horarios' },
  { to: '/cobros',        icon: CreditCard,      label: 'Cobros' },
  { to: '/liquidaciones', icon: DollarSign,      label: 'Liquidaciones', roles: ['sadmin'] },
  { to: '/mensajes',      icon: MessageSquare,   label: 'Mensajes' },
  { to: '/caja',          icon: Archive,         label: 'Caja' },
  { to: '/gastos',        icon: Receipt,         label: 'Gastos' },
  { to: '/reportes',      icon: BarChart2,       label: 'Reportes' },
  { to: '/productos',     icon: ShoppingBag,     label: 'Productos' },
  { to: '/temporales',    icon: Clock,           label: 'Temporales' },
]

export default function Layout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-dark-bg">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-dark-surface border-r border-dark-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-dark flex items-center justify-center">
              <span className="text-white text-sm font-black">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-dark-text leading-none">Sistathlon</p>
              <p className="text-xs text-dark-muted">Athlon Gym</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter(({ roles }) => !roles || roles.includes(user?.rol)).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-primary-dark text-white font-medium'
                    : 'text-dark-muted hover:bg-dark-border hover:text-dark-text'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-dark-border">
          <div className="text-xs text-dark-muted mb-2 px-1 truncate">{user?.nombre}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-dark-muted hover:text-red-400 transition-colors px-1 py-1"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
