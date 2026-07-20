import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { searchGlobalEntities } from '../lib/queries'

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Global Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: 'grid_view' },
    { name: 'Beneficiários', href: '/beneficiarios', icon: 'group' },
    { name: 'Cesta Básica', href: '/cestas', icon: 'shopping_bag' },
    { name: 'Aluguel de Equipamentos', href: '/aluguel', icon: 'handyman' },
    { name: 'Anotações de Retirada', href: '/retiradas', icon: 'edit_note' },
    { name: 'Mensagens', href: '/mensagens', icon: 'chat' },
    { name: 'Caderno de Fechamento', href: '/financeiro', icon: 'menu_book' },
    { name: 'Relatórios', href: '/relatorios', icon: 'bar_chart' },
    { name: 'Usuários', href: '/usuarios', icon: 'manage_accounts' },
    { name: 'Configurações', href: '/configuracoes', icon: 'settings' }
  ]

  // Global search query with debounce
  useEffect(() => {
    if (searchTerm.trim().length < 3) {
      setSearchResults([])
      return
    }

    setLoadingSearch(true)
    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await searchGlobalEntities(searchTerm)
        setSearchResults(results)
      } catch (err) {
        console.error('Error fetching global search results:', err)
      } finally {
        setLoadingSearch(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // Get user initial or profile initials
  const getUserInitials = () => {
    if (!user) return 'U'
    const name = user.profile?.nome || user.email || 'Usuário'
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const getUserName = () => {
    if (!user) return 'Usuário'
    return user.profile?.nome || user.email.split('@')[0]
  }

  const getUserRole = () => {
    if (!user || !user.profile) return 'Voluntário'
    const roles = {
      admin: 'Administrador',
      gestor: 'Gestor',
      voluntario: 'Voluntário'
    }
    return roles[user.profile.perfil] || 'Voluntário'
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col md:flex-row relative">
      {/* Mobile Header Bar */}
      <header className="md:hidden w-full h-16 bg-surface border-b border-surface-variant flex items-center justify-between px-margin-mobile shrink-0 z-20">
        <div className="flex items-center gap-3">
          <img src="/assets/logo.svg" alt="Logo" className="h-8 w-auto" />
          <span className="font-display-lg text-body-lg font-bold text-primary">Sistema Pastoral</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 text-on-surface hover:bg-surface-container rounded-lg focus:outline-none"
        >
          <span className="material-symbols-outlined text-[28px]">{sidebarOpen ? 'close' : 'menu'}</span>
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 w-sidebar-width bg-surface border-r border-surface-variant flex flex-col z-30 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Logo Header */}
        <div className="h-20 flex items-center px-8 border-b border-surface-variant">
          <div className="flex flex-col">
            <span className="font-comfortaa text-[18px] font-bold text-[#3d5a2a] leading-tight">Sistema Pastoral</span>
            <span className="text-[10px] text-on-surface-variant font-medium tracking-wide uppercase mt-0.5">Plataforma SaaS</span>
          </div>
        </div>

        {/* User Info Card inside sidebar */}
        <div className="p-6 border-b border-surface-variant bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            {user?.profile?.foto_url ? (
              <img src={user.profile.foto_url} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-outline-variant" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-body-sm">
                {getUserInitials()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-body-sm text-on-surface truncate">{getUserName()}</span>
              <span className="text-[11px] text-on-surface-variant">{getUserRole()}</span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-4 px-4 py-3 rounded-lg text-body-sm font-medium transition-all duration-200
                  ${active 
                    ? 'bg-primary text-on-primary shadow-sm' 
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }
                `}
              >
                <span className={`material-symbols-outlined text-[22px] ${active ? 'text-on-primary' : 'text-outline'}`}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout Button Footer */}
        <div className="p-4 border-t border-surface-variant">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-error hover:bg-error-container/20 rounded-lg text-body-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Overlay background for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-on-background/40 backdrop-blur-[1px] z-20 md:hidden"
        ></div>
      )}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar for Desktop */}
        <header className="hidden md:flex h-20 bg-surface border-b border-surface-variant items-center justify-between px-8 shrink-0 z-20">
          <div className="flex items-center gap-8 flex-1 max-w-2xl mr-4">
            <h2 className="text-headline-md font-display-lg text-primary font-semibold shrink-0">
              {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
            </h2>
            
            {/* Global Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="flex items-center bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Busca global (Beneficiários, Cestas, Locatários...)"
                  className="bg-transparent border-none text-body-sm outline-none w-full text-on-surface placeholder:text-outline/70 py-0.5"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => { setSearchTerm(''); setSearchResults([]); }}
                    className="text-outline hover:text-on-surface p-0.5 rounded-full"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showDropdown && searchTerm.trim().length >= 3 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                    {loadingSearch ? (
                      <div className="p-4 text-center text-body-sm text-outline flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Buscando...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-body-sm text-outline">
                        Nenhum resultado encontrado
                      </div>
                    ) : (
                      <div className="py-2">
                        {searchResults.map((item) => (
                          <button
                            key={`${item.tipo}-${item.id}`}
                            onClick={() => {
                              setShowDropdown(false)
                              setSearchTerm('')
                              navigate(item.link)
                            }}
                            className="w-full px-4 py-2.5 hover:bg-surface-container flex items-center gap-3 text-left transition-colors"
                          >
                            <span className="material-symbols-outlined text-primary text-[20px]">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm font-semibold text-on-surface truncate">{item.nome}</p>
                              <p className="text-[11px] text-outline truncate">{item.tipo}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <span className="text-body-sm text-on-surface-variant font-medium">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-margin-mobile md:p-8 relative">
          <div className="max-w-container-max mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
