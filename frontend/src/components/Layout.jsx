import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'
import {
  LayoutDashboard, Users, UserPlus, Calendar, DollarSign,
  MessageSquare, Archive, BarChart2, Clock, LogOut, Receipt, CreditCard,
  ShoppingBag, Tag, BookOpen, PanelLeftClose, PanelLeftOpen, Settings
} from 'lucide-react'
import clsx from 'clsx'
import { useNegocio } from '../hooks/useNegocio'

// roles: undefined = todos, array = solo esos roles
const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alumnos',       icon: Users,           label: 'Alumnos' },
  { to: '/profes',        icon: UserPlus,        label: 'Profes',        roles: ['sadmin'] },
  { to: '/precios',       icon: Tag,             label: 'Precios',       roles: ['sadmin'] },
  { to: '/disciplinas',  icon: BookOpen,        label: 'Disciplinas',   roles: ['sadmin'] },
  { to: '/horarios',      icon: Calendar,        label: 'Horarios' },
  { to: '/cobros',        icon: CreditCard,      label: 'Cobros' },
  { to: '/liquidaciones', icon: DollarSign,      label: 'Liquidaciones', roles: ['sadmin'] },
  { to: '/mensajes',      icon: MessageSquare,   label: 'Mensajes' },
  { to: '/caja',          icon: Archive,         label: 'Caja' },
  { to: '/gastos',        icon: Receipt,         label: 'Gastos' },
  { to: '/reportes',      icon: BarChart2,       label: 'Reportes' },
  { to: '/productos',     icon: ShoppingBag,     label: 'Productos' },
  { to: '/temporales',    icon: Clock,           label: 'Temporales' },
  { to: '/config',        icon: Settings,        label: 'Configuración',  roles: ['sadmin'] },
]

export default function Layout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { logoClaro, nombre } = useNegocio()

  useEffect(() => {
    if (nombre) document.title = `${nombre} · Sistema de gestión`
  }, [nombre])

  // Barra lateral colapsable (persistida). Arranca colapsada en pantallas chicas.
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved !== null) return saved === '1'
    return window.innerWidth < 1024   // colapsada por defecto en iPad/celular
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  async function handleLogout() {
    await logout()
    setUser(null)
    navigate('/login')
  }

  const items = NAV_ITEMS.filter(({ roles }) => !roles || roles.includes(user?.rol))

  return (
    <div className="flex min-h-screen bg-dark-bg">
      {/* Sidebar */}
      <aside className={clsx(
        'flex-shrink-0 bg-dark-surface border-r border-dark-border flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Header + toggle */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <img src={logoClaro} alt="Logo" className="h-7 w-auto object-contain" />
              <p className="text-[10px] text-dark-muted mt-1 tracking-wide">Sistema de gestión</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir menú' : 'Ocultar menú'}
            className="text-dark-muted hover:text-dark-text p-1.5 rounded-lg hover:bg-dark-border transition-colors flex-shrink-0 mx-auto"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary-dark text-white font-medium'
                    : 'text-dark-muted hover:bg-dark-border hover:text-dark-text'
                )
              }
            >
              <Icon size={collapsed ? 20 : 16} className="flex-shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-dark-border">
          {!collapsed && (
            <div className="text-xs text-dark-muted mb-2 px-1 truncate">{user?.nombre}</div>
          )}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className={clsx(
              'flex items-center gap-2 text-xs text-dark-muted hover:text-red-400 transition-colors px-1 py-1',
              collapsed && 'justify-center w-full'
            )}
          >
            <LogOut size={14} />
            {!collapsed && 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
