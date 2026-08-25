import React, { useEffect, useState } from 'react'
import { fetchUsuarios, createUsuario, toggleUsuarioAtivo } from '../lib/queries'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'

export const Usuarios = () => {
  const { user: currentUser } = useAuth()
  const { showToast } = useFeedback()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [perfilFilter, setPerfilFilter] = useState('todos')
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    perfil: 'voluntario'
  })

  const loadUsuarios = async () => {
    setLoading(true)
    try {
      const data = await fetchUsuarios()
      setUsuarios(data)
    } catch (err) {
      showToast('Erro ao carregar usuários', err.message, 'error')
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
      showToast('Aviso', 'Você não pode desativar seu próprio usuário!', 'warning')
      return
    }

    const newAtivo = !targetUser.ativo
    try {
      await toggleUsuarioAtivo(targetUser.id, newAtivo)
      showToast('Sucesso', `Usuário ${newAtivo ? 'ativado' : 'desativado'} com sucesso!`)
      loadUsuarios()
    } catch (err) {
      showToast('Erro ao alterar status', err.message, 'error')
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!formData.nome || !formData.email || !formData.password || !formData.perfil) {
      showToast('Campos ausentes', 'Por favor, preencha todos os campos obrigatórios.', 'error')
      return
    }

    setSaving(true)
    try {
      await createUsuario(formData.email, formData.password, formData.nome, formData.perfil)
      showToast('Sucesso', 'Novo usuário criado com sucesso!')
      setModalOpen(false)
      setFormData({ nome: '', email: '', password: '', perfil: 'voluntario' })
      loadUsuarios()
    } catch (err) {
      showToast('Erro ao criar usuário', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = u.nome?.toLowerCase().includes(search.toLowerCase()) || 
                          u.email?.toLowerCase().includes(search.toLowerCase())
    
    if (perfilFilter === 'todos') return matchesSearch
    return matchesSearch && u.perfil === perfilFilter
  })

  const getRoleBadge = (perfil) => {
    const roles = {
      admin: { label: 'Administrador', class: 'bg-primary/10 text-primary border-primary/25', icon: 'shield_person' },
      gestor: { label: 'Gestor', class: 'bg-secondary/10 text-secondary border-secondary/25', icon: 'manage_accounts' },
      voluntario: { label: 'Voluntário', class: 'bg-surface-container text-on-surface-variant border-outline-variant/60', icon: 'volunteer_activism' }
    }

    const role = roles[perfil] || roles.voluntario
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${role.class}`}>
        <span className="material-symbols-outlined text-[14px]">{role.icon}</span>
        {role.label}
      </span>
    )
  }

  const getInitials = (nome) => {
    if (!nome) return 'U'
    return nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const totalUsuarios = usuarios.length
  const totalAdmins = usuarios.filter(u => u.perfil === 'admin' || u.perfil === 'gestor').length
  const totalVoluntarios = usuarios.filter(u => u.perfil === 'voluntario' && u.ativo).length

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Equipe Pastoral & Acessos
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Gestão de Usuários
          </h2>
          <p className="text-xs text-on-surface-variant">
            Cadastre membros da equipe, defina cargos e gerencie as permissões no sistema.
          </p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-primary text-on-primary hover:bg-primary-container px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Novo Usuário
        </button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">group</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Total de Membros</span>
            <p className="text-xl font-extrabold text-on-surface leading-tight">{totalUsuarios}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Gestores & Admins</span>
            <p className="text-xl font-extrabold text-secondary leading-tight">{totalAdmins}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">volunteer_activism</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Voluntários Ativos</span>
            <p className="text-xl font-extrabold text-emerald-700 leading-tight">{totalVoluntarios}</p>
          </div>
        </div>
      </div>

      {/* Main Users Card */}
      <div className="bg-surface rounded-3xl shadow-xs border border-outline-variant/80 overflow-hidden">
        {/* Filters/Actions inside card */}
        <div className="p-4 border-b border-surface-variant/80 flex flex-col md:flex-row justify-between items-center gap-3 bg-surface-container-lowest">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            {[
              { id: 'todos', name: 'Todos' },
              { id: 'admin', name: 'Administradores' },
              { id: 'gestor', name: 'Gestores' },
              { id: 'voluntario', name: 'Voluntários' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPerfilFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  perfilFilter === tab.id
                    ? 'bg-primary text-on-primary shadow-2xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-72">
            <div className="flex items-center border border-outline-variant/80 rounded-xl px-3 py-1.5 bg-surface-container-low focus-within:border-primary">
              <span className="material-symbols-outlined text-outline text-[18px] mr-2">search</span>
              <input 
                className="w-full bg-transparent border-none text-xs font-semibold text-on-surface placeholder:text-outline outline-none p-0" 
                placeholder="Buscar por nome ou e-mail..." 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Usuário</th>
                <th className="px-5 py-3.5">E-mail</th>
                <th className="px-5 py-3.5">Perfil de Acesso</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-outline">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <span>Carregando usuários...</span>
                  </td>
                </tr>
              ) : filteredUsuarios.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-outline">Nenhum usuário encontrado.</td>
                </tr>
              ) : (
                filteredUsuarios.map((u) => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="hover:bg-secondary-container/15 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {u.foto_url ? (
                            <img src={u.foto_url} alt={u.nome} className="w-9 h-9 rounded-xl object-cover border border-outline-variant shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                              {getInitials(u.nome)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface flex items-center gap-1.5">
                              {u.nome || 'Sem Nome'}
                              {isSelf && (
                                <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">Você</span>
                              )}
                            </p>
                            <p className="text-[10px] text-outline">
                              Criado em {u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '---'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-on-surface-variant font-mono text-[11px]">{u.email}</td>
                      <td className="px-5 py-3.5">{getRoleBadge(u.perfil)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.ativo 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                            : 'bg-surface-container text-on-surface-variant border-outline-variant'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.ativo ? 'bg-emerald-600' : 'bg-outline'}`}></span>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleStatusToggle(u)}
                          disabled={isSelf}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isSelf 
                              ? 'opacity-40 cursor-not-allowed border-outline-variant bg-surface-container-low text-outline' 
                              : u.ativo 
                                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl shadow-xl w-full max-w-md border border-outline-variant/80 p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant/80 pb-3 shrink-0">
              <h3 className="font-bold text-primary text-base flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                Cadastrar Novo Usuário
              </h3>
              <button 
                onClick={() => setModalOpen(false)} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do membro pastoral"
                  value={formData.nome}
                  onChange={handleInputChange}
                  name="nome"
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2 bg-surface text-xs font-semibold focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  name="email"
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2 bg-surface text-xs font-semibold focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Senha Inicial *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo de 6 caracteres"
                    value={formData.password}
                    onChange={handleInputChange}
                    name="password"
                    className="w-full border border-outline-variant rounded-xl pl-3.5 pr-10 py-2 bg-surface text-xs font-semibold focus:border-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Perfil / Cargo *</label>
                <select
                  name="perfil"
                  value={formData.perfil}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2 bg-surface text-xs font-semibold focus:border-primary outline-none"
                >
                  <option value="voluntario">Voluntário (Acesso Operacional)</option>
                  <option value="gestor">Gestor (Controle Geral & Relatórios)</option>
                  <option value="admin">Administrador (Acesso Total)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-surface-variant/80 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-xl font-bold text-xs hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary-container shadow-xs transition-all active:scale-95"
                >
                  {saving ? 'Criando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
