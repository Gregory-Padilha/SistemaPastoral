import React, { useEffect, useState } from 'react'
import { fetchConfiguracoes, upsertConfiguracoes, fetchCategorias } from '../lib/queries'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export const Configuracoes = () => {
  const { user, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState('instituicao') // instituicao, categorias, perfil
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Institution state
  const [config, setConfig] = useState({
    id: null,
    nome_instituicao: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    logo_url: ''
  })
  const [logoFile, setLogoFile] = useState(null)

  // Categories states
  const [categories, setCategories] = useState([])
  const [categoryType, setCategoryType] = useState('financeiro')
  const [newCategoryName, setNewCategoryName] = useState('')

  // User Profile state
  const [profileName, setProfileName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [profileFotoUrl, setProfileFotoUrl] = useState('')

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' })
    }, 4000)
  }

  // Load configuration
  const loadConfig = async () => {
    try {
      const data = await fetchConfiguracoes()
      if (data) {
        setConfig({
          id: data.id || null,
          nome_instituicao: data.nome_instituicao || '',
          cnpj: data.cnpj || '',
          endereco: data.endereco || '',
          telefone: data.telefone || '',
          logo_url: data.logo_url || ''
        })
      }
    } catch (err) {
      showToast('Erro ao carregar configurações: ' + err.message, 'error')
    }
  }

  // Load categories
  const loadCategories = async () => {
    try {
      const data = await fetchCategorias(categoryType)
      setCategories(data)
    } catch (err) {
      showToast('Erro ao carregar categorias: ' + err.message, 'error')
    }
  }

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadConfig()
      await loadCategories()
      if (user && user.profile) {
        setProfileName(user.profile.nome || '')
        setProfileFotoUrl(user.profile.foto_url || '')
      }
      setLoading(false)
    }
    init()
  }, [user])

  // Load categories on type change
  useEffect(() => {
    loadCategories()
  }, [categoryType])

  const handleConfigChange = (e) => {
    const { name, value } = e.target
    setConfig(prev => ({ ...prev, [name]: value }))
  }

  // Save institution configurations
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let finalLogoUrl = config.logo_url

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `logo-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName)

        finalLogoUrl = publicUrl
      }

      const payload = {
        nome_instituicao: config.nome_instituicao,
        cnpj: config.cnpj,
        endereco: config.endereco,
        telefone: config.telefone,
        logo_url: finalLogoUrl
      }

      if (config.id) {
        payload.id = config.id
      }

      const updated = await upsertConfiguracoes(payload)
      if (updated) {
        setConfig(prev => ({ ...prev, id: updated.id, logo_url: updated.logo_url }))
      }
      setLogoFile(null)
      showToast('Configurações da instituição salvas com sucesso!')
    } catch (err) {
      showToast('Erro ao salvar configurações: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Save profile updates
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profileName) {
      showToast('O nome não pode estar vazio.', 'error')
      return
    }

    setSaving(true)
    try {
      let finalAvatarUrl = profileFotoUrl

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, avatarFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName)

        finalAvatarUrl = publicUrl
      }

      // Update perfis table
      const { error: updateError } = await supabase
        .from('perfis')
        .update({
          nome: profileName,
          foto_url: finalAvatarUrl
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfileFotoUrl(finalAvatarUrl)
      setAvatarFile(null)
      await refreshUser() // updates context
      showToast('Perfil atualizado com sucesso!')
    } catch (err) {
      showToast('Erro ao atualizar perfil: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Add Category
  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('categorias')
        .insert([{ nome: newCategoryName.trim(), tipo: categoryType }])

      if (error) throw error

      setNewCategoryName('')
      await loadCategories()
      showToast('Categoria adicionada com sucesso!')
    } catch (err) {
      showToast('Erro ao adicionar categoria: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Delete Category
  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadCategories()
      showToast('Categoria excluída com sucesso!')
    } catch (err) {
      showToast('Erro ao excluir categoria: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header */}
      <div className="border-b border-surface-variant pb-6">
        <h2 className="font-display-lg text-headline-lg text-primary font-semibold">Configurações do Sistema</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Gerencie os dados da instituição, categorias operacionais e dados do seu perfil.</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-surface-variant bg-surface-container-low p-1.5 rounded-xl gap-2 w-full md:w-fit self-start shadow-sm">
        {[
          { id: 'instituicao', name: 'Instituição', icon: 'domain' },
          { id: 'categorias', name: 'Categorias', icon: 'category' },
          { id: 'perfil', name: 'Meu Perfil', icon: 'person' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-body-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Main card panel */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-surface rounded-xl border border-outline-variant shadow-sm gap-3">
          <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-on-surface-variant text-xs font-semibold">Carregando configurações...</span>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          {/* TAB: INSTITUIÇÃO */}
          {activeTab === 'instituicao' && (
            <form onSubmit={handleSaveConfig} className="p-6 md:p-8 space-y-6">
              <div className="border-b border-surface-variant pb-4">
                <h3 className="text-headline-md font-display-lg text-primary text-lg font-semibold">Dados da Instituição</h3>
                <p className="text-body-sm text-on-surface-variant">Essas informações serão exibidas nos cabeçalhos de todos os relatórios emitidos.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Logo Upload Box */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-32 h-32 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-center overflow-hidden relative group shadow-inner">
                    {logoFile ? (
                      <img src={URL.createObjectURL(logoFile)} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : config.logo_url ? (
                      <img src={config.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-4xl">domain</span>
                    )}
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-semibold gap-1">
                      <span className="material-symbols-outlined text-sm">upload</span>
                      Enviar Logo
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  {logoFile && (
                    <button 
                      type="button" 
                      onClick={() => setLogoFile(null)} 
                      className="text-xs text-error font-semibold hover:underline"
                    >
                      Remover Selecionado
                    </button>
                  )}
                  <p className="text-[10px] text-on-surface-variant max-w-[150px] text-center">JPG ou PNG, recomendável formato quadrado.</p>
                </div>

                {/* Form fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome da Instituição *</label>
                    <input 
                      name="nome_instituicao"
                      value={config.nome_instituicao}
                      onChange={handleConfigChange}
                      required
                      placeholder="Ex: Obra Social São José"
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">CNPJ *</label>
                    <input 
                      name="cnpj"
                      value={config.cnpj}
                      onChange={handleConfigChange}
                      required
                      placeholder="00.000.000/0001-00"
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Telefone / WhatsApp</label>
                    <input 
                      name="telefone"
                      value={config.telefone}
                      onChange={handleConfigChange}
                      placeholder="(11) 98765-4321"
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                      type="text"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Endereço Completo</label>
                    <input 
                      name="endereco"
                      value={config.endereco}
                      onChange={handleConfigChange}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-variant pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-6 py-3 rounded-lg font-semibold text-body-sm shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

          {/* TAB: CATEGORIAS */}
          {activeTab === 'categorias' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-surface-variant pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-headline-md font-display-lg text-primary text-lg font-semibold">Tabelas de Categorias</h3>
                  <p className="text-body-sm text-on-surface-variant">Gerencie as categorias de fluxo financeiro ou de benefícios sociais.</p>
                </div>

                <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant/60">
                  <button
                    onClick={() => setCategoryType('financeiro')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      categoryType === 'financeiro' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                  >
                    Financeiro
                  </button>
                  <button
                    onClick={() => setCategoryType('beneficio')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      categoryType === 'beneficio' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                  >
                    Benefícios
                  </button>
                </div>
              </div>

              {/* Add category form */}
              <form onSubmit={handleAddCategory} className="flex gap-3 max-w-md">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={`Nova categoria de ${categoryType === 'financeiro' ? 'Lançamento' : 'Benefício'}...`}
                  required
                  className="flex-1 border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                  type="text"
                />
                <button
                  type="submit"
                  disabled={saving || !newCategoryName.trim()}
                  className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-lg font-semibold text-body-sm shadow-sm transition-all disabled:opacity-50 shrink-0"
                >
                  Adicionar
                </button>
              </form>

              {/* Categories list */}
              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest max-w-2xl shadow-sm">
                <div className="bg-surface-container-low px-4 py-3 border-b border-surface-variant text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Nome da Categoria
                </div>
                <ul className="divide-y divide-surface-variant">
                  {categories.length === 0 ? (
                    <li className="p-6 text-center text-on-surface-variant text-body-sm">
                      Nenhuma categoria cadastrada para este tipo.
                    </li>
                  ) : (
                    categories.map(cat => (
                      <li key={cat.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary-container/10 transition-colors">
                        <span className="font-semibold text-on-surface">{cat.nome}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 text-error hover:bg-error-container/20 rounded-md transition-colors"
                          title="Excluir Categoria"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* TAB: MEU PERFIL */}
          {activeTab === 'perfil' && (
            <form onSubmit={handleSaveProfile} className="p-6 md:p-8 space-y-6">
              <div className="border-b border-surface-variant pb-4">
                <h3 className="text-headline-md font-display-lg text-primary text-lg font-semibold">Meu Perfil de Usuário</h3>
                <p className="text-body-sm text-on-surface-variant">Atualize suas credenciais de exibição e foto no sistema.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-28 h-28 rounded-full bg-secondary-container text-on-secondary-container border border-outline-variant flex items-center justify-center overflow-hidden relative group shadow-md">
                    {avatarFile ? (
                      <img src={URL.createObjectURL(avatarFile)} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : profileFotoUrl ? (
                      <img src={profileFotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold uppercase">
                        {profileName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </span>
                    )}
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-semibold flex-col gap-1">
                      <span className="material-symbols-outlined text-sm">upload</span>
                      Mudar Foto
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  {avatarFile && (
                    <button 
                      type="button" 
                      onClick={() => setAvatarFile(null)} 
                      className="text-xs text-error font-semibold hover:underline"
                    >
                      Remover Selecionada
                    </button>
                  )}
                </div>

                {/* Profile Form Details */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome Completo *</label>
                    <input 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      placeholder="Seu nome completo"
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">E-mail (Não editável)</label>
                    <input 
                      value={user?.email || ''}
                      disabled
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface-container-low text-on-surface-variant font-medium text-body-sm cursor-not-allowed outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Perfil de Acesso (Não editável)</label>
                    <input 
                      value={
                        user?.profile?.perfil === 'admin' ? 'Administrador' :
                        user?.profile?.perfil === 'gestor' ? 'Gestor' : 'Voluntário'
                      }
                      disabled
                      className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface-container-low text-on-surface-variant font-medium text-body-sm cursor-not-allowed outline-none"
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-variant pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-6 py-3 rounded-lg font-semibold text-body-sm shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Toast Notification */}
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
