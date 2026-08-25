import React, { useState, useEffect, useRef } from 'react'
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

  // 5-Minute Inactivity Auto-Sync States
  const lastActivityRef = useRef(Date.now())
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  const [showSyncBadge, setShowSyncBadge] = useState(false)

  const triggerSilentSync = (reason = 'auto') => {
    // Safety check: Avoid syncing if the user is typing in a form or an input dialog is open
    const activeEl = document.activeElement
    const isTyping = activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.isContentEditable
    )
    const hasOpenModal = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0.z-50')

    if (reason === 'auto' && (isTyping || hasOpenModal)) {
      // Postpone for 1 minute so the user isn't interrupted while typing
      lastActivityRef.current = Date.now() - (4 * 60 * 1000)
      return
    }

    setIsSyncing(true)
    window.dispatchEvent(new CustomEvent('app:silent-refresh', { detail: { timestamp: Date.now(), reason } }))

    setTimeout(() => {
      setIsSyncing(false)
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setLastSyncTime(nowTime)
      setShowSyncBadge(true)
      setTimeout(() => setShowSyncBadge(false), 3500)
    }, 800)

    lastActivityRef.current = Date.now()
  }

  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now()
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(ev => window.addEventListener(ev, handleUserActivity, { passive: true }))

    // Check every 15 seconds if 5 minutes (300,000 ms) of inactivity have elapsed
    const idleCheckInterval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current
      if (idleTime >= 5 * 60 * 1000) {
        triggerSilentSync('auto')
      }
    }, 15000)

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleUserActivity))
      clearInterval(idleCheckInterval)
    }
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/', icon: 'grid_view' },
    { name: 'Beneficiários', href: '/beneficiarios', icon: 'group' },
    { name: 'Cesta Básica', href: '/cestas', icon: 'shopping_bag' },
    { name: 'Anotações de Retirada', href: '/retiradas', icon: 'assignment' },
    { name: 'Ficha de Aluguel', href: '/aluguel', icon: 'home' },
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

  const currentRouteName = navigation.find(item => isActive(item.href))?.name || 'Sistema Pastoral'

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row relative font-body-md text-on-surface">
      
      {/* Mobile Header Bar */}
      <header className="md:hidden w-full h-16 bg-surface border-b border-surface-variant/80 flex items-center justify-between px-margin-mobile shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-[20px]">church</span>
          </div>
          <div>
            <span className="font-comfortaa text-[16px] font-bold text-primary block leading-tight">Sistema Pastoral</span>
            <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Gestão Filantrópica</span>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-on-surface hover:bg-surface-container rounded-xl focus:outline-none transition-colors"
          aria-label="Abrir Menu"
        >
          <span className="material-symbols-outlined text-[24px]">{sidebarOpen ? 'close' : 'menu'}</span>
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 w-sidebar-width bg-surface border-r border-outline-variant/60 flex flex-col z-40 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen shrink-0 shadow-sm md:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Logo Header */}
        <div className="h-20 flex items-center px-6 border-b border-surface-variant/70 gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-primary-container text-on-primary flex items-center justify-center font-bold shadow-sm">
            <span className="material-symbols-outlined text-[24px]">church</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-comfortaa text-[17px] font-bold text-primary leading-tight truncate">Sistema Pastoral</span>
            <span className="text-[10px] text-on-surface-variant font-semibold tracking-wide uppercase mt-0.5">Plataforma SaaS</span>
          </div>
        </div>

        {/* User Info Card inside sidebar */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-surface-container-low border border-outline-variant/50">
          <div className="flex items-center gap-3">
            {user?.profile?.foto_url ? (
              <img src={user.profile.foto_url} alt="Profile" className="w-10 h-10 rounded-xl object-cover border border-outline-variant shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                {getUserInitials()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-on-surface truncate">{getUserName()}</span>
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{getUserRole()}</span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-150
                  ${active 
                    ? 'bg-primary text-on-primary shadow-xs' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }
                `}
              >
                <span className={`material-symbols-outlined text-[20px] ${active ? 'text-on-primary' : 'text-outline'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout Button Footer */}
        <div className="p-3 border-t border-surface-variant/70">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-error hover:bg-error-container/20 rounded-xl text-xs font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Overlay background for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-30 md:hidden animate-in fade-in duration-200"
        ></div>
      )}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Header Bar for Desktop */}
        <header className="hidden md:flex h-20 bg-surface border-b border-outline-variant/60 items-center justify-between px-8 shrink-0 z-20 shadow-2xs">
          <div className="flex items-center gap-6 flex-1 max-w-2xl">
            <h2 className="text-xl font-display-lg text-primary font-bold shrink-0">
              {currentRouteName}
            </h2>
            
            {/* Global Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="flex items-center bg-surface-container-low border border-outline-variant/80 rounded-2xl px-3.5 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all shadow-xs">
                <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Busca global (Beneficiários, Cestas, Locatários...)"
                  className="bg-transparent border-none text-xs outline-none w-full text-on-surface placeholder:text-outline/70 py-0.5 font-medium"
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
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant/80 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto p-1.5 animate-in fade-in duration-150">
                    {loadingSearch ? (
                      <div className="p-4 text-center text-xs font-semibold text-outline flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Buscando registros...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs font-semibold text-outline">
                        Nenhum resultado encontrado para "{searchTerm}"
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {searchResults.map((item) => (
                          <button
                            key={`${item.tipo}-${item.id}`}
                            onClick={() => {
                              setShowDropdown(false)
                              setSearchTerm('')
                              navigate(item.link)
                            }}
                            className="w-full px-3.5 py-2.5 hover:bg-surface-container rounded-xl flex items-center gap-3 text-left transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate">{item.nome}</p>
                              <p className="text-[10px] text-outline font-semibold uppercase tracking-wider truncate">{item.tipo}</p>
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

          <div className="flex items-center gap-3 shrink-0">
            {/* Auto-Sync Feedback Badge */}
            {showSyncBadge && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 rounded-xl text-[11px] font-bold animate-in fade-in duration-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                <span>Dados atualizados</span>
              </div>
            )}

            {/* Silent Auto-Sync Button / Indicator */}
            <button
              type="button"
              onClick={() => triggerSilentSync('manual')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 hover:border-primary/40 text-on-surface-variant hover:text-primary rounded-xl text-xs font-semibold transition-all group active:scale-95 shadow-2xs"
              title={`Sincronização automática ativa (atualiza silenciosamente após 5min sem uso).\nÚltima atualização: ${lastSyncTime}.\nClique para sincronizar agora.`}
            >
              <span className={`material-symbols-outlined text-[17px] text-primary transition-transform ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 duration-500'}`}>
                sync
              </span>
              <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-primary">
                {isSyncing ? 'Atualizando...' : `Ao vivo (${lastSyncTime})`}
              </span>
            </button>

            <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-low border border-outline-variant/60 px-3 py-1.5 rounded-xl">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-container-max mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
