import React, { useEffect, useState } from 'react'
import { fetchUsuarios, createUsuario, toggleUsuarioAtivo } from '../lib/queries'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export const Usuarios = () => {
  const { user: currentUser } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [perfilFilter, setPerfilFilter] = useState('todos')
  
  // Modal and toast states
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [saving, setSaving] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    perfil: 'voluntario'
  })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' })
    }, 4000)
  }

  const loadUsuarios = async () => {
    setLoading(true)
    try {
      const data = await fetchUsuarios()
      setUsuarios(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsuarios()
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleStatusToggle = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      showToast('Você não pode desativar seu próprio usuário!', 'error')
      return
    }

    const newAtivo = !targetUser.ativo
    try {
      await toggleUsuarioAtivo(targetUser.id, newAtivo)
      showToast(`Usuário ${newAtivo ? 'ativado' : 'desativado'} com sucesso!`)
      loadUsuarios()
    } catch (err) {
      showToast('Erro ao alterar status: ' + err.message, 'error')
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!formData.nome || !formData.email || !formData.password || !formData.perfil) {
      showToast('Por favor, preencha todos os campos.', 'error')
      return
    }

    setSaving(true)
    try {
      await createUsuario(formData.email, formData.password, formData.nome, formData.perfil)
      showToast('Usuário criado com sucesso!')
      setModalOpen(false)
      setFormData({ nome: '', email: '', password: '', perfil: 'voluntario' })
      loadUsuarios()
    } catch (err) {
      showToast('Erro ao criar usuário: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Filter users based on search query and selected role tab
  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = u.nome?.toLowerCase().includes(search.toLowerCase()) || 
                          u.email?.toLowerCase().includes(search.toLowerCase())
    
    if (perfilFilter === 'todos') return matchesSearch
    return matchesSearch && u.perfil === perfilFilter
  })

  const getRoleBadge = (perfil) => {
    const roles = {
      admin: { label: 'Admin', class: 'bg-secondary-container/40 text-on-secondary-container border-secondary/20', icon: 'shield_person' },
      gestor: { label: 'Gestor', class: 'bg-primary-container/20 text-primary border-primary/20', icon: 'manage_accounts' },
      voluntario: { label: 'Voluntário', class: 'bg-surface-variant text-on-surface-variant border-outline-variant/30', icon: 'volunteer_activism' }
    }

    const role = roles[perfil] || roles.voluntario
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${role.class}`}>
        <span className="material-symbols-outlined text-[14px]">{role.icon}</span>
        {role.label}
      </span>
    )
  }

  const getInitials = (nome) => {
    if (!nome) return 'U'
    return nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant pb-6 gap-4">
        <div>
          <h2 className="font-display-lg text-headline-lg text-primary font-semibold">Gestão de Usuários</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Gerencie acessos, perfis e permissões da equipe e voluntários.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-6 py-3 rounded-lg flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Novo Usuário
        </button>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 gap-gutter">
        {/* Main Users Card */}
        <div className="bg-surface rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          {/* Filters/Actions inside card */}
          <div className="p-6 border-b border-surface-variant flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-container-low/40">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {[
                { id: 'todos', name: 'Todos' },
                { id: 'admin', name: 'Administradores' },
                { id: 'gestor', name: 'Gestores' },
                { id: 'voluntario', name: 'Voluntários' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPerfilFilter(tab.id)}
                  className={`px-4 py-2 rounded-full font-label-sm text-label-sm transition-all border ${
                    perfilFilter === tab.id
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface text-on-surface-variant border-outline-variant/40 hover:bg-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
            
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
              <input 
                className="pl-10 pr-4 py-2.5 w-full bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm font-body-sm text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-0 outline-none transition-all" 
                placeholder="Buscar por nome ou e-mail..." 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Usuário</th>
                  <th className="px-6 py-4 font-medium">Contato</th>
                  <th className="px-6 py-4 font-medium">Perfil</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-on-surface-variant text-xs font-semibold">Carregando usuários...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-on-surface-variant">Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  filteredUsuarios.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className="hover:bg-secondary-container/10 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.foto_url ? (
                              <img src={u.foto_url} alt={u.nome} className="w-9 h-9 rounded-full object-cover border border-outline-variant" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-xs">
                                {getInitials(u.nome)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-primary flex items-center gap-1.5">
                                {u.nome || 'Sem Nome'}
                                {isSelf && (
                                  <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-medium">Você</span>
                                )}
                              </p>
                              <p className="text-[11px] text-on-surface-variant">
                                Cadastrado em {u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '---'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant">{u.email}</td>
                        <td className="px-6 py-4">{getRoleBadge(u.perfil)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            u.ativo 
                              ? 'bg-primary-container text-on-primary-container' 
                              : 'bg-surface-variant text-on-surface-variant border border-outline-variant/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.ativo ? 'bg-primary' : 'bg-outline'}`}></span>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleStatusToggle(u)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              u.ativo 
                                ? 'bg-error-container/10 border-error/20 text-error hover:bg-error-container/30' 
                                : 'bg-primary-container/20 border-primary/20 text-primary hover:bg-primary-container/40'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={isSelf ? 'Não é possível desativar a si mesmo' : u.ativo ? 'Desativar Usuário' : 'Ativar Usuário'}
                          >
                            {u.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          {!loading && (
            <div className="p-4 border-t border-surface-variant flex items-center justify-between bg-surface-container-low/30 font-body-sm text-body-sm text-on-surface-variant">
              <span>Total de {filteredUsuarios.length} registros</span>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in Drawer Modal for "Novo Usuário" */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-[2px] transition-opacity" onClick={() => setModalOpen(false)}></div>
          
          {/* Drawer Panel */}
          <div className="relative bg-surface w-full md:w-[480px] h-full md:h-screen shadow-2xl flex flex-col border-l border-surface-variant z-10 transition-transform duration-300">
            {/* Modal Header */}
            <header className="px-6 py-5 border-b border-surface-variant flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary font-semibold">Novo Usuário</h3>
                <p className="text-body-sm text-on-surface-variant">Cadastre um novo acesso ao sistema.</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-on-surface hover:bg-surface-container rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </header>
            
            {/* Modal Body Form */}
            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome Completo *</label>
                  <input 
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none transition-all shadow-sm" 
                    placeholder="Ex: João da Silva" 
                    type="text"
                  />
                </div>
                
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">E-mail *</label>
                  <input 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none transition-all shadow-sm" 
                    placeholder="joao@exemplo.com" 
                    type="email"
                  />
                </div>

                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Senha Temporária *</label>
                  <input 
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none transition-all shadow-sm" 
                    placeholder="Mínimo 6 caracteres" 
                    type="password"
                  />
                </div>
                
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Perfil de Acesso *</label>
                  <select 
                    name="perfil"
                    value={formData.perfil}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none shadow-sm"
                  >
                    <option value="voluntario">Voluntário (Apenas Leitura/Lançamento)</option>
                    <option value="gestor">Gestor (Acesso Administrativo)</option>
                    <option value="admin">Administrador (Acesso Total)</option>
                  </select>
                </div>
              </div>
              
              {/* Form Action Footer */}
              <div className="pt-6 border-t border-surface-variant flex justify-end gap-3 bg-surface shrink-0">
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-semibold text-body-sm transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-lg font-semibold text-body-sm shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'Criando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 px-5 py-4 bg-inverse-surface text-inverse-on-surface rounded-xl shadow-xl z-50 animate-bounce">
          <span className={`material-symbols-outlined ${toast.type === 'error' ? 'text-error' : 'text-primary-fixed'}`}>
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <p className="font-body-sm text-body-sm font-medium">{toast.message}</p>
        </div>
      )}
    </div>
  )
}
