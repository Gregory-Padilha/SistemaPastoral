import React, { useEffect, useState } from 'react'
import { fetchConfiguracoes, upsertConfiguracoes, fetchCategorias } from '../lib/queries'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { supabase } from '../lib/supabase'

export const Configuracoes = () => {
  const { user, refreshUser } = useAuth()
  const { showToast } = useFeedback()
  const [activeTab, setActiveTab] = useState('instituicao')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      showToast('Erro ao carregar configurações', err.message, 'error')
    }
  }

  const loadCategories = async () => {
    try {
      const data = await fetchCategorias(categoryType)
      setCategories(data)
    } catch (err) {
      showToast('Erro ao carregar categorias', err.message, 'error')
    }
  }

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

  useEffect(() => {
    loadCategories()
  }, [categoryType])

  const handleConfigChange = (e) => {
    const { name, value } = e.target
    setConfig(prev => ({ ...prev, [name]: value }))
  }

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
      showToast('Sucesso', 'Configurações da instituição salvas com sucesso!')
    } catch (err) {
      showToast('Erro ao salvar configurações', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profileName) {
      showToast('Aviso', 'O nome não pode estar vazio.', 'warning')
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
      await refreshUser()
      showToast('Sucesso', 'Seu perfil foi atualizado com sucesso!')
    } catch (err) {
      showToast('Erro ao atualizar perfil', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

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
      showToast('Sucesso', 'Categoria adicionada com sucesso!')
    } catch (err) {
      showToast('Erro ao adicionar categoria', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

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
      showToast('Sucesso', 'Categoria excluída com sucesso!')
    } catch (err) {
      showToast('Erro ao excluir categoria', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Preferências & Entidade
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Configurações do Sistema
          </h2>
          <p className="text-xs text-on-surface-variant">
            Personalize os dados institucionais, categorias operacionais e dados da sua conta.
          </p>
        </div>
      </div>

      {/* Tabs selector */}
      <div className="flex bg-surface p-1.5 rounded-2xl border border-outline-variant/80 gap-1.5 shadow-2xs">
        {[
          { id: 'instituicao', name: 'Instituição', icon: 'domain' },
          { id: 'categorias', name: 'Categorias', icon: 'category' },
          { id: 'perfil', name: 'Meu Perfil', icon: 'person' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Main card panel */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-surface rounded-3xl border border-outline-variant/80 shadow-xs gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-outline text-xs font-semibold">Carregando configurações...</span>
        </div>
      ) : (
        <div className="bg-surface rounded-3xl border border-outline-variant/80 shadow-xs overflow-hidden">
          
          {/* TAB: INSTITUIÇÃO */}
          {activeTab === 'instituicao' && (
            <form onSubmit={handleSaveConfig} className="p-6 md:p-8 space-y-6">
              <div className="border-b border-surface-variant/80 pb-4">
                <h3 className="font-bold text-primary text-base">Identidade da Instituição</h3>
                <p className="text-xs text-on-surface-variant">Estas informações constarão nos timbres de relatórios e recibos em PDF.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Logo Upload Box */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-28 h-28 rounded-2xl bg-surface-container-low border border-outline-variant/80 flex items-center justify-center overflow-hidden relative group shadow-inner">
                    {logoFile ? (
                      <img src={URL.createObjectURL(logoFile)} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : config.logo_url ? (
                      <img src={config.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-4xl">domain</span>
                    )}
                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold gap-1">
                      <span className="material-symbols-outlined text-[20px]">upload</span>
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
                      className="text-[11px] text-error font-bold hover:underline"
                    >
                      Remover selecionada
                    </button>
                  )}
                  <p className="text-[10px] text-outline max-w-[130px] text-center">PNG ou JPG quadrado recomendado</p>
                </div>

                {/* Form fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Nome da Instituição *</label>
                    <input 
                      name="nome_instituicao"
                      value={config.nome_instituicao}
                      onChange={handleConfigChange}
                      required
                      placeholder="Ex: Paróquia São Francisco de Assis"
                      className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">CNPJ *</label>
                    <input 
                      name="cnpj"
                      value={config.cnpj}
                      onChange={handleConfigChange}
                      required
                      placeholder="00.000.000/0001-00"
                      className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none font-mono"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Telefone de Contato</label>
                    <input 
                      name="telefone"
                      value={config.telefone}
                      onChange={handleConfigChange}
                      placeholder="(11) 98765-4321"
                      className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none font-mono"
                      type="text"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Endereço Sede</label>
                    <input 
                      name="endereco"
                      value={config.endereco}
                      onChange={handleConfigChange}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none"
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-variant/80 pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-on-primary hover:bg-primary-container px-6 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 active:scale-95"
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

          {/* TAB: CATEGORIAS */}
          {activeTab === 'categorias' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-surface-variant/80 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-primary text-base">Categorias Operacionais</h3>
                  <p className="text-xs text-on-surface-variant">Classificações para lançamentos financeiros e tipos de benefícios.</p>
                </div>

                <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/60">
                  <button
                    onClick={() => setCategoryType('financeiro')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      categoryType === 'financeiro' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    Financeiro
                  </button>
                  <button
                    onClick={() => setCategoryType('beneficio')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      categoryType === 'beneficio' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    Benefícios
                  </button>
                </div>
              </div>

              {/* Add category form */}
              <form onSubmit={handleAddCategory} className="flex gap-2 max-w-md">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={`Nova categoria de ${categoryType === 'financeiro' ? 'Lançamento' : 'Benefício'}...`}
                  required
                  className="flex-1 border border-outline-variant rounded-xl px-3.5 py-2 bg-surface text-xs font-semibold focus:border-primary outline-none"
                  type="text"
                />
                <button
                  type="submit"
                  disabled={saving || !newCategoryName.trim()}
                  className="bg-primary text-on-primary hover:bg-primary-container px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 shrink-0"
                >
                  Adicionar
                </button>
              </form>

              {/* Categories list */}
              <div className="border border-outline-variant/80 rounded-2xl overflow-hidden bg-surface max-w-2xl shadow-2xs">
                <div className="bg-surface-container-low px-4 py-2.5 border-b border-surface-variant/80 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Categorias Ativas ({categories.length})
                </div>
                <ul className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                  {categories.length === 0 ? (
                    <li className="p-6 text-center text-outline">
                      Nenhuma categoria personalizada cadastrada para este tipo.
                    </li>
                  ) : (
                    categories.map(cat => (
                      <li key={cat.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-secondary-container/15 transition-colors">
                        <span className="font-bold text-on-surface">{cat.nome}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 text-outline hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
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
              <div className="border-b border-surface-variant/80 pb-4">
                <h3 className="font-bold text-primary text-base">Meu Perfil de Acesso</h3>
                <p className="text-xs text-on-surface-variant">Atualize suas informações de identificação e foto de perfil.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center overflow-hidden relative group shadow-xs">
                    {avatarFile ? (
                      <img src={URL.createObjectURL(avatarFile)} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : profileFotoUrl ? (
                      <img src={profileFotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold uppercase">
                        {profileName ? profileName.substring(0, 2).toUpperCase() : 'U'}
                      </span>
                    )}
                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold gap-0.5">
                      <span className="material-symbols-outlined text-base">upload</span>
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
                      className="text-[11px] text-error font-bold hover:underline"
                    >
                      Remover Selecionada
                    </button>
                  )}
                </div>

                {/* Profile Form Details */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Nome Completo *</label>
                    <input 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      placeholder="Seu nome completo"
                      className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">E-mail (Login)</label>
                    <input 
                      value={user?.email || ''}
                      disabled
                      className="w-full border border-outline-variant/60 rounded-xl px-3.5 py-2.5 bg-surface-container-low text-on-surface-variant font-mono text-xs cursor-not-allowed outline-none"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Perfil de Acesso</label>
                    <input 
                      value={
                        user?.profile?.perfil === 'admin' ? 'Administrador' :
                        user?.profile?.perfil === 'gestor' ? 'Gestor' : 'Voluntário'
                      }
                      disabled
                      className="w-full border border-outline-variant/60 rounded-xl px-3.5 py-2.5 bg-surface-container-low text-on-surface-variant font-bold text-xs cursor-not-allowed outline-none"
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-variant/80 pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-on-primary hover:bg-primary-container px-6 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 active:scale-95"
                >
                  {saving ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
