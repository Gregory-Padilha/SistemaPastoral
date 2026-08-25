import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchBeneficiarios, insertBeneficiario, updateBeneficiario, toggleUsuarioAtivo, fetchAnotacoesByBeneficiarioId, deleteBeneficiarioPermanently } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { maskCPF, maskPhone, validateCPF, isCadastroIncompleto, getCamposPendentes } from '../utils/masks'
import { useFeedback } from '../contexts/FeedbackContext'
import { mapSupabaseError } from '../lib/errorMapper'

export const Beneficiarios = () => {
  const { showToast } = useFeedback()
  const [beneficiarios, setBeneficiarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filters state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  
  // History Modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyBeneficiario, setHistoryBeneficiario] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState([])

  // Safety Deletion Modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [benefToHardDelete, setBenefToHardDelete] = useState(null)
  const [hardDeleteWord, setHardDeleteWord] = useState('')

  const handleOpenHardDelete = (beneficiario) => {
    setBenefToHardDelete(beneficiario)
    setHardDeleteWord('')
    setDeleteConfirmOpen(true)
  }

  const handleHardDeleteConfirm = async (e) => {
    e.preventDefault()
    if (hardDeleteWord !== 'deletar' || !benefToHardDelete) return

    try {
      setLoading(true)
      await deleteBeneficiarioPermanently(benefToHardDelete.id)
      showToast('Sucesso', `Beneficiário "${benefToHardDelete.nome}" excluído permanentemente!`)
      setDeleteConfirmOpen(false)
      setBenefToHardDelete(null)
      setHardDeleteWord('')
      loadBeneficiarios()
    } catch (err) {
      showToast('Erro ao excluir', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenHistory = async (beneficiario) => {
    setHistoryBeneficiario(beneficiario)
    setHistoryModalOpen(true)
    setHistoryLoading(true)
    try {
      const data = await fetchAnotacoesByBeneficiarioId(beneficiario.id)
      setHistoryData(data)
    } catch (err) {
      showToast('Erro ao carregar histórico', err.message, 'error')
    } finally {
      setHistoryLoading(false)
    }
  }
  // Error state for CPF validation
  const [cpfError, setCpfError] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBeneficiario, setEditingBeneficiario] = useState(null)
  const [formSection, setFormSection] = useState('pessoais') // pessoais, contato, socio, familia, documentos
  
  // Form states
  const [formData, setFormData] = useState({
    nome: '', cpf: '', data_nascimento: '', sexo: 'Masculino',
    estado_civil: 'Solteiro(a)', escolaridade: 'Ensino Médio', foto_url: '',
    telefone: '', whatsapp: '', email: '', cep: '', rua: '', numero: '',
    complemento: '', bairro: '', cidade: '', estado: '', renda_familiar: '',
    tipo_moradia: 'Alugada', outros_beneficios: false, quais_beneficios: '',
    observacoes: '', status: 'ativo'
  })
  
  const [membrosFamilia, setMembrosFamilia] = useState([]) // array of { nome, parentesco, idade }
  const [newMembro, setNewMembro] = useState({ nome: '', parentesco: '', idade: '' })
  
  const [beneficios, setBeneficios] = useState([]) // array of strings
  
  const [documentos, setDocumentos] = useState([]) // array of { nome, url, file }
  const [newDocName, setNewDocName] = useState('')
  const [newDocFile, setNewDocFile] = useState(null)
  
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadBeneficiarios = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const statusParam = statusFilter === 'incompletos' ? 'todos' : statusFilter
      const data = await fetchBeneficiarios(search, statusParam)
      if (statusFilter === 'incompletos') {
        setBeneficiarios(data.filter(isCadastroIncompleto))
      } else {
        setBeneficiarios(data)
      }
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadBeneficiarios(false)
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [search, statusFilter])

  useEffect(() => {
    const handleSilentRefresh = () => {
      if (!modalOpen && !deleteConfirmOpen) {
        loadBeneficiarios(true)
      }
    }
    window.addEventListener('app:silent-refresh', handleSilentRefresh)
    window.addEventListener('focus', handleSilentRefresh)
    return () => {
      window.removeEventListener('app:silent-refresh', handleSilentRefresh)
      window.removeEventListener('focus', handleSilentRefresh)
    }
  }, [modalOpen, deleteConfirmOpen, search, statusFilter])

  const openNewModal = () => {
    setEditingBeneficiario(null)
    setFormData({
      nome: '', cpf: '', data_nascimento: '', sexo: 'Masculino',
      estado_civil: 'Solteiro(a)', escolaridade: 'Ensino Médio', foto_url: '',
      telefone: '', whatsapp: '', email: '', cep: '', rua: '', numero: '',
      complemento: '', bairro: '', cidade: '', estado: '', renda_familiar: '',
      tipo_moradia: 'Alugada', outros_beneficios: false, quais_beneficios: '',
      observacoes: '', status: 'ativo'
    })
    setMembrosFamilia([])
    setBeneficios([])
    setDocumentos([])
    setPhotoFile(null)
    setPhotoPreviewUrl('')
    setPhotoRemoved(false)
    setFormSection('pessoais')
    setCpfError(false)
    setModalOpen(true)
  }

  const openEditModal = async (beneficiario) => {
    try {
      setLoading(true)
      setCpfError(false)
      const { data: details, error: dError } = await supabase
        .from('beneficiarios')
        .select(`
          *,
          membros_familia (*),
          beneficios_recebidos (*),
          documentos (*)
        `)
        .eq('id', beneficiario.id)
        .single()

      if (dError) throw dError

      setEditingBeneficiario(details)
      setFormData({
        nome: details.nome || '',
        cpf: details.cpf || '',
        data_nascimento: details.data_nascimento || '',
        sexo: details.sexo || 'Masculino',
        estado_civil: details.estado_civil || 'Solteiro(a)',
        escolaridade: details.escolaridade || 'Ensino Médio',
        foto_url: details.foto_url || '',
        telefone: details.telefone || '',
        whatsapp: details.whatsapp || '',
        email: details.email || '',
        cep: details.cep || '',
        rua: details.rua || '',
        numero: details.numero || '',
        complemento: details.complemento || '',
        bairro: details.bairro || '',
        cidade: details.cidade || '',
        estado: details.estado || '',
        renda_familiar: details.renda_familiar || '',
        tipo_moradia: details.tipo_moradia || 'Alugada',
        outros_beneficios: details.outros_beneficios || false,
        quais_beneficios: details.quais_beneficios || '',
        observacoes: details.observacoes || '',
        status: details.status || 'ativo'
      })
      setMembrosFamilia(details.membros_familia || [])
      setBeneficios(details.beneficios_recebidos?.map(b => b.tipo) || [])
      setDocumentos(details.documentos || [])
      setPhotoFile(null)
      setPhotoPreviewUrl('')
      setPhotoRemoved(false)
      setFormSection('pessoais')
      setModalOpen(true)
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    let formattedValue = type === 'checkbox' ? checked : value

    if (name === 'cpf') {
      formattedValue = maskCPF(value)
    } else if (name === 'telefone' || name === 'whatsapp') {
      formattedValue = maskPhone(value)
    }

    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }))
  }

  const handleCepBlur = async () => {
    const cleanCep = (formData.cep || '').replace(/\D/g, '')
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            rua: data.logradouro || prev.rua,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            estado: data.uf || prev.estado
          }))
          showToast('Endereço Localizado', `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`, 'success')
        }
      } catch (err) {
        console.warn('ViaCEP lookup failed:', err)
      }
    }
  }

  const handleCpfBlur = () => {
    if (formData.cpf) {
      const isValid = validateCPF(formData.cpf)
      setCpfError(!isValid)
    } else {
      setCpfError(false)
    }
  }

  // Handle Photo selection
  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      showToast('Formato Inválido', 'Formatos aceitos: JPG, JPEG, PNG e WEBP.', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem Muito Grande', 'O tamanho máximo da imagem é de 5MB.', 'error')
      return
    }

    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setPhotoRemoved(false)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreviewUrl('')
    setPhotoRemoved(true)
    setFormData(prev => ({ ...prev, foto_url: '' }))
    const fileInput = document.getElementById('photo-upload-input')
    if (fileInput) fileInput.value = ''
  }

  // Handle member list changes
  const addMembro = () => {
    if (!newMembro.nome || !newMembro.parentesco || !newMembro.idade) return
    setMembrosFamilia(prev => [...prev, { ...newMembro, idade: parseInt(newMembro.idade) }])
    setNewMembro({ nome: '', parentesco: '', idade: '' })
  }

  const removeMembro = (index) => {
    setMembrosFamilia(prev => prev.filter((_, idx) => idx !== index))
  }

  // Handle benefits select toggle
  const toggleBeneficio = (tipo) => {
    setBeneficios(prev => 
      prev.includes(tipo) ? prev.filter(b => b !== tipo) : [...prev, tipo]
    )
  }

  // Add document link
  const addDoc = async () => {
    if (!newDocName || !newDocFile) return
    try {
      setSaving(true)
      const fileExt = newDocFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('documentos-beneficiarios')
        .upload(fileName, newDocFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('documentos-beneficiarios')
        .getPublicUrl(fileName)

      setDocumentos(prev => [...prev, { nome: newDocName, url: publicUrl }])
      setNewDocName('')
      setNewDocFile(null)
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeDoc = (index) => {
    setDocumentos(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleStatusToggle = async (b) => {
    const newStatus = b.status === 'ativo' ? 'inativo' : 'ativo'
    try {
      const { error: sError } = await supabase
        .from('beneficiarios')
        .update({ status: newStatus })
        .eq('id', b.id)

      if (sError) throw sError
      loadBeneficiarios()
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    if (formData.cpf && !validateCPF(formData.cpf)) {
      showToast('CPF Inválido', 'Por favor, confira os números do CPF.', 'error')
      setCpfError(true)
      return
    }

    setSaving(true)
    try {
      let finalFotoUrl = formData.foto_url

      if (photoRemoved) {
        finalFotoUrl = null
      }

      // Upload profile photo if present
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        
        const { error: photoUploadError } = await supabase.storage
          .from('fotos-beneficiarios')
          .upload(fileName, photoFile)

        if (photoUploadError) throw photoUploadError

        const { data: { publicUrl } } = supabase.storage
          .from('fotos-beneficiarios')
          .getPublicUrl(fileName)

        finalFotoUrl = publicUrl
      }

      const beneficiarioPayload = {
        ...formData,
        foto_url: finalFotoUrl,
        cpf: formData.cpf || null,
        data_nascimento: formData.data_nascimento || null,
        telefone: formData.telefone || null,
        whatsapp: formData.whatsapp || null,
        email: formData.email || null,
        cep: formData.cep || null,
        rua: formData.rua || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        renda_familiar: formData.renda_familiar ? parseFloat(formData.renda_familiar) : null,
        quais_beneficios: formData.quais_beneficios || null,
        observacoes: formData.observacoes || null
      }

      if (editingBeneficiario) {
        await updateBeneficiario(editingBeneficiario.id, beneficiarioPayload, membrosFamilia, beneficios, documentos)
        showToast('Sucesso', 'Beneficiário atualizado com sucesso!', 'success')
      } else {
        await insertBeneficiario(beneficiarioPayload, membrosFamilia, beneficios, documentos)
        showToast('Sucesso', 'Beneficiário cadastrado com sucesso!', 'success')
      }

      setModalOpen(false)
      loadBeneficiarios()
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const totalBeneficiarios = beneficiarios.length
  const totalAtivos = beneficiarios.filter(b => b.status === 'ativo').length
  const totalIncompletos = beneficiarios.filter(isCadastroIncompleto).length
  const totalComRetiradas = beneficiarios.filter(b => (b.anotacoes_retirada?.[0]?.count || 0) > 0).length

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Famílias & Assistência
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Gestão de Beneficiários
          </h2>
          <p className="text-xs text-on-surface-variant">
            Acompanhe o cadastro social, histórico familiar e entregas de cada família assistida.
          </p>
        </div>
        <button 
          onClick={openNewModal}
          className="bg-primary text-on-primary hover:bg-primary-container px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Novo Beneficiário
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">group</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Total Famílias</span>
            <p className="text-xl font-extrabold text-on-surface leading-tight">{totalBeneficiarios}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Famílias Ativas</span>
            <p className="text-xl font-extrabold text-emerald-700 leading-tight">{totalAtivos}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">assignment_late</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Incompletos</span>
            <p className="text-xl font-extrabold text-amber-700 leading-tight">{totalIncompletos}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Com Retiradas</span>
            <p className="text-xl font-extrabold text-secondary leading-tight">{totalComRetiradas}</p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 p-4 flex flex-col md:flex-row gap-3">
        {/* Advanced Search Input */}
        <div className="flex-1">
          <div className="flex items-center border border-outline-variant/80 rounded-xl px-3.5 py-2 bg-surface-container-low focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all">
            <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-xs font-semibold text-on-surface placeholder:text-outline/70 p-0" 
              placeholder="Buscar por nome, CPF, telefone ou bairro..." 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter: Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'ativo', label: 'Ativos' },
            { id: 'incompletos', label: 'Incompletos ⚠️' },
            { id: 'inativo', label: 'Inativos' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === item.id 
                  ? 'bg-primary text-on-primary shadow-2xs' 
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Data Table */}
      {loading && beneficiarios.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] gap-2">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-outline">Carregando beneficiários...</p>
        </div>
      ) : (
        <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Nome Completo</th>
                  <th className="px-5 py-3.5">CPF</th>
                  <th className="px-5 py-3.5">Contato</th>
                  <th className="px-5 py-3.5">Moradia</th>
                  <th className="px-5 py-3.5">Retiradas</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                {beneficiarios.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-outline">
                      Nenhum beneficiário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  beneficiarios.map((b) => {
                    const phoneNum = b.whatsapp || b.telefone
                    const cleanPhone = phoneNum ? phoneNum.replace(/\D/g, '') : ''
                    const hasWhatsApp = cleanPhone.length >= 10

                    return (
                      <tr key={b.id} className={`hover:bg-secondary-container/15 transition-colors group ${isCadastroIncompleto(b) ? 'border-l-4 border-l-amber-500' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {b.foto_url ? (
                              <img src={b.foto_url} alt={b.nome} className="w-9 h-9 rounded-xl object-cover border border-outline-variant shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                                {b.nome ? b.nome.substring(0, 2).toUpperCase() : 'B'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link to={`/beneficiarios/${b.id}`} className="font-bold text-on-surface hover:text-primary transition-colors truncate">
                                  {b.nome}
                                </Link>
                                {isCadastroIncompleto(b) && (
                                  <div className="relative group/tooltip flex items-center">
                                    <span className="text-amber-500 text-xs cursor-help select-none">⚠️</span>
                                    <div className="invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 absolute left-0 bottom-full mb-2 bg-slate-900 text-white text-[11px] p-2.5 rounded-xl z-50 shadow-xl w-48 pointer-events-none">
                                      <div className="font-bold text-amber-400 mb-1">Campos Pendentes:</div>
                                      <ul className="list-disc list-inside space-y-0.5 text-slate-200">
                                        {getCamposPendentes(b).map((campo, idx) => (
                                          <li key={idx} className="truncate">{campo}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-outline truncate block">{b.bairro ? `${b.bairro} - ${b.cidade || ''}` : 'Endereço não informado'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-on-surface-variant font-mono text-[11px]">
                          {b.cpf || '---'}
                        </td>
                        <td className="px-5 py-3.5">
                          {phoneNum ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-on-surface font-semibold">{phoneNum}</span>
                              {hasWhatsApp && (
                                <a
                                  href={`https://wa.me/55${cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors"
                                  title="Conversar no WhatsApp"
                                >
                                  <span className="material-symbols-outlined text-[14px]">chat</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-outline">---</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-on-surface-variant">
                          {b.tipo_moradia || '---'}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => handleOpenHistory(b)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                            title="Ver histórico de retiradas"
                          >
                            <span className="material-symbols-outlined text-[14px]">assignment</span>
                            {b.anotacoes_retirada?.[0]?.count || 0} retiradas
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            b.status === 'ativo' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                              : 'bg-surface-container text-on-surface-variant border-outline-variant'
                          }`}>
                            {b.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Link to={`/beneficiarios/${b.id}`} className="p-1 text-outline hover:text-primary rounded-lg hover:bg-surface-container transition-colors" title="Visualizar Ficha">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            <button onClick={() => openEditModal(b)} className="p-1 text-outline hover:text-primary rounded-lg hover:bg-surface-container transition-colors" title="Editar">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => handleStatusToggle(b)} className="p-1 text-outline hover:text-amber-600 rounded-lg hover:bg-surface-container transition-colors" title={b.status === 'ativo' ? 'Inativar' : 'Reativar'}>
                              <span className="material-symbols-outlined text-[18px]">
                                {b.status === 'ativo' ? 'block' : 'restore'}
                              </span>
                            </button>
                            <button 
                              onClick={() => handleOpenHardDelete(b)} 
                              className="p-1 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" 
                              title="Excluir Permanentemente"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Creation and Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-40 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-variant">
            {/* Modal Header */}
            <header className="p-6 border-b border-surface-variant flex justify-between items-center bg-surface-container-low shrink-0">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary font-semibold">
                  {editingBeneficiario ? 'Editar Cadastro' : 'Novo Cadastro de Beneficiário'}
                </h3>
                <p className="text-body-sm text-on-surface-variant">Preencha todos os campos para registrar o beneficiário e sua família.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 text-on-surface hover:bg-surface-container rounded-lg">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </header>

            {/* Form Section Navigation Tabs */}
            <div className="flex border-b border-surface-variant bg-surface-container-lowest overflow-x-auto shrink-0">
              {[
                { id: 'pessoais', name: 'Dados Pessoais' },
                { id: 'contato', name: 'Contato e Endereço' },
                { id: 'socio', name: 'Sócio-Econômico' },
                { id: 'familia', name: 'Composição Familiar' },
                { id: 'documentos', name: 'Documentos' }
              ].map(sec => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setFormSection(sec.id)}
                  className={`px-5 py-3.5 text-body-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    formSection === sec.id 
                      ? 'border-primary text-primary bg-primary/5' 
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {sec.name}
                </button>
              ))}
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SECTION: DADOS PESSOAIS */}
              {formSection === 'pessoais' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold mb-1">Nome Completo *</label>
                    <input name="nome" value={formData.nome} onChange={handleInputChange} required className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">CPF (apenas números)</label>
                    <input 
                      name="cpf" 
                      value={formData.cpf} 
                      onChange={handleInputChange} 
                      onBlur={handleCpfBlur}
                      className={`w-full border rounded-lg px-3 py-2 bg-surface focus:ring-0 outline-none ${
                        cpfError 
                          ? 'border-red-500 bg-red-50 focus:border-red-500' 
                          : 'border-outline-variant focus:border-primary'
                      }`} 
                      type="text" 
                      placeholder="000.000.000-00" 
                    />
                    {cpfError && (
                      <p className="text-red-500 text-xs mt-1">CPF inválido. Por favor, confira os números.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Data de Nascimento</label>
                    <input name="data_nascimento" value={formData.data_nascimento} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="date" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Sexo</label>
                    <select name="sexo" value={formData.sexo} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none">
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Estado Civil</label>
                    <select name="estado_civil" value={formData.estado_civil} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none">
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Escolaridade</label>
                    <select name="escolaridade" value={formData.escolaridade} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none">
                      <option value="Fundamental Incompleto">Fundamental Incompleto</option>
                      <option value="Fundamental Completo">Fundamental Completo</option>
                      <option value="Ensino Médio">Ensino Médio</option>
                      <option value="Superior Completo">Superior Completo</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex flex-col items-center sm:items-start">
                    <label className="block text-label-sm font-semibold mb-2">Foto de Perfil</label>
                    <div className="relative group">
                      <div 
                        onClick={() => document.getElementById('photo-upload-input').click()}
                        className="w-[120px] h-[120px] rounded-full bg-slate-100 border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all relative group shadow-inner"
                      >
                        {photoPreviewUrl || formData.foto_url ? (
                          <img 
                            src={photoPreviewUrl || formData.foto_url} 
                            alt="Profile Preview" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-outline-variant group-hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[36px]">photo_camera</span>
                          </div>
                        )}
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider">
                          Alterar
                        </div>
                      </div>

                      {/* Remove button X */}
                      {(photoPreviewUrl || formData.foto_url) && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center shadow-md hover:bg-error-container hover:text-on-error-container transition-colors z-10"
                          title="Remover Foto"
                        >
                          <span className="material-symbols-outlined text-[14px] font-bold">close</span>
                        </button>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-outline mt-2 text-center sm:text-left">
                      Clique para adicionar foto. Formatos: JPG, JPEG, PNG, WEBP. Máx. 5MB.
                    </p>
                    
                    <input
                      id="photo-upload-input"
                      type="file"
                      accept="image/jpeg, image/jpg, image/png, image/webp"
                      className="hidden"
                      onChange={handlePhotoFileChange}
                    />
                  </div>
                </div>
              )}

              {/* SECTION: CONTATO E ENDEREÇO */}
              {formSection === 'contato' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Telefone</label>
                    <input name="telefone" value={formData.telefone} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">WhatsApp</label>
                    <input name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">E-mail</label>
                    <input name="email" value={formData.email} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="email" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">CEP (Auto-preenchimento)</label>
                    <div className="relative">
                      <input 
                        name="cep" 
                        value={formData.cep} 
                        onChange={handleInputChange} 
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" 
                        type="text" 
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold mb-1">Rua</label>
                    <input name="rua" value={formData.rua} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Número</label>
                    <input name="numero" value={formData.numero} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Complemento</label>
                    <input name="complemento" value={formData.complemento} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Bairro</label>
                    <input name="bairro" value={formData.bairro} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Cidade</label>
                    <input name="cidade" value={formData.cidade} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Estado</label>
                    <input name="estado" value={formData.estado} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" />
                  </div>
                </div>
              )}

              {/* SECTION: SÓCIO-ECONÔMICO */}
              {formSection === 'socio' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Renda Familiar Mensal (R$)</label>
                    <input name="renda_familiar" value={formData.renda_familiar} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="number" step="0.01" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold mb-1">Tipo de Moradia</label>
                    <select name="tipo_moradia" value={formData.tipo_moradia} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none">
                      <option value="Alugada">Alugada</option>
                      <option value="Própria">Própria</option>
                      <option value="Cedida">Cedida</option>
                      <option value="Ocupação / Sem-Teto">Ocupação / Sem-Teto</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 font-semibold text-body-sm mt-4 select-none cursor-pointer">
                      <input name="outros_beneficios" checked={formData.outros_beneficios} onChange={handleInputChange} type="checkbox" className="rounded text-primary focus:ring-0 w-4 h-4 border-outline-variant" />
                      Recebe outros benefícios sociais governamentais?
                    </label>
                  </div>
                  {formData.outros_beneficios && (
                    <div className="md:col-span-2">
                      <label className="block text-label-sm font-semibold mb-1">Quais benefícios e valores?</label>
                      <input name="quais_beneficios" value={formData.quais_beneficios} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none" type="text" placeholder="Bolsa Família, BPC, etc." />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold mb-1">Observações Gerais</label>
                    <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface focus:border-primary focus:ring-0 outline-none h-24" />
                  </div>
                </div>
              )}

              {/* SECTION: COMPOSIÇÃO FAMILIAR & BENEFÍCIOS */}
              {formSection === 'familia' && (
                <div className="space-y-6">
                  {/* Composição Familiar */}
                  <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/60">
                    <h4 className="font-semibold text-primary mb-3">Composição Familiar (Membros do Domicílio)</h4>
                    
                    {/* Add new member form row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mb-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Nome Completo</label>
                        <input value={newMembro.nome} onChange={(e) => setNewMembro(prev => ({ ...prev, nome: e.target.value }))} className="w-full border border-outline-variant rounded-lg px-3 py-1.5 bg-surface text-body-sm focus:border-primary focus:ring-0" type="text" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Parentesco</label>
                        <input value={newMembro.parentesco} onChange={(e) => setNewMembro(prev => ({ ...prev, parentesco: e.target.value }))} className="w-full border border-outline-variant rounded-lg px-3 py-1.5 bg-surface text-body-sm focus:border-primary focus:ring-0" type="text" placeholder="Filho, Cônjuge, etc." />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Idade</label>
                          <input value={newMembro.idade} onChange={(e) => setNewMembro(prev => ({ ...prev, idade: e.target.value }))} className="w-full border border-outline-variant rounded-lg px-3 py-1.5 bg-surface text-body-sm focus:border-primary focus:ring-0" type="number" />
                        </div>
                        <button type="button" onClick={addMembro} className="bg-primary text-on-primary px-3 py-2 rounded-lg font-bold text-body-sm transition-all hover:bg-primary-container shrink-0">
                          Adicionar
                        </button>
                      </div>
                    </div>

                    {/* Member List Table */}
                    <div className="overflow-hidden border border-outline-variant rounded-lg bg-surface">
                      <table className="w-full text-left">
                        <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                          <tr>
                            <th className="px-4 py-2">Nome</th>
                            <th className="px-4 py-2">Parentesco</th>
                            <th className="px-4 py-2">Idade</th>
                            <th className="px-4 py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-variant text-body-sm">
                          {membrosFamilia.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="px-4 py-3 text-center text-on-surface-variant text-xs">Nenhum membro familiar adicionado.</td>
                            </tr>
                          ) : (
                            membrosFamilia.map((m, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 font-medium">{m.nome}</td>
                                <td className="px-4 py-2 text-on-surface-variant">{m.parentesco}</td>
                                <td className="px-4 py-2">{m.idade} anos</td>
                                <td className="px-4 py-2 text-right">
                                  <button type="button" onClick={() => removeMembro(idx)} className="p-1 text-error hover:bg-error-container/20 rounded-md">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Benefícios Recebidos */}
                  <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/60">
                    <h4 className="font-semibold text-primary mb-3">Benefícios Internos Solicitados/Recebidos</h4>
                    <div className="flex flex-wrap gap-3">
                      {['Cesta Básica', 'Medicamentos', 'Auxílio Gás', 'Apoio Psicológico', 'Enxoval de Bebê', 'Cursos Livres'].map(b => {
                        const isSelected = beneficios.includes(b)
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => toggleBeneficio(b)}
                            className={`px-4 py-2 rounded-full border text-body-sm font-semibold transition-all select-none ${
                              isSelected 
                                ? 'bg-primary border-primary text-on-primary shadow-sm' 
                                : 'bg-surface border-outline-variant text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {b}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: DOCUMENTOS */}
              {formSection === 'documentos' && (
                <div className="space-y-6">
                  <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/60">
                    <h4 className="font-semibold text-primary mb-3">Anexar Documentação do Beneficiário</h4>
                    
                    {/* Add Document upload inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Nome/Tipo de Documento</label>
                        <input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} className="w-full border border-outline-variant rounded-lg px-3 py-1.5 bg-surface text-body-sm focus:border-primary" type="text" placeholder="Ex: CPF, Comprovante de Residência" />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Arquivo</label>
                          <input type="file" onChange={(e) => setNewDocFile(e.target.files?.[0] || null)} className="w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary" />
                        </div>
                        <button type="button" onClick={addDoc} disabled={saving} className="bg-primary text-on-primary px-3 py-2 rounded-lg font-bold text-body-sm transition-all hover:bg-primary-container shrink-0 disabled:opacity-50">
                          {saving ? 'Enviando...' : 'Anexar'}
                        </button>
                      </div>
                    </div>

                    {/* Documents List */}
                    <div className="overflow-hidden border border-outline-variant rounded-lg bg-surface">
                      <table className="w-full text-left">
                        <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                          <tr>
                            <th className="px-4 py-2">Documento</th>
                            <th className="px-4 py-2">Link de Acesso</th>
                            <th className="px-4 py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-variant text-body-sm">
                          {documentos.length === 0 ? (
                            <tr>
                              <td colSpan="3" className="px-4 py-3 text-center text-on-surface-variant text-xs">Nenhum documento anexado.</td>
                            </tr>
                          ) : (
                            documentos.map((d, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 font-medium">{d.nome}</td>
                                <td className="px-4 py-2 text-primary font-semibold">
                                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    Visualizar Arquivo
                                  </a>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <button type="button" onClick={() => removeDoc(idx)} className="p-1 text-error hover:bg-error-container/20 rounded-md">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Action Footer */}
              <div className="pt-6 border-t border-surface-variant flex justify-between gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-semibold text-body-sm transition-colors"
                >
                  Cancelar
                </button>
                <div className="flex gap-2">
                  {formSection !== 'pessoais' && (
                    <button
                      type="button"
                      onClick={() => {
                        const sections = ['pessoais', 'contato', 'socio', 'familia', 'documentos']
                        const curIdx = sections.indexOf(formSection)
                        setFormSection(sections[curIdx - 1])
                      }}
                      className="px-6 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-semibold text-body-sm"
                    >
                      Voltar
                    </button>
                  )}
                  {formSection !== 'documentos' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const sections = ['pessoais', 'contato', 'socio', 'familia', 'documentos']
                        const curIdx = sections.indexOf(formSection)
                        setFormSection(sections[curIdx + 1])
                      }}
                      className="px-6 py-3 bg-secondary text-on-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-lg font-semibold text-body-sm"
                    >
                      Avançar
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-lg font-semibold text-body-sm shadow-sm disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Salvar Cadastro'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Retiradas */}
      {historyModalOpen && historyBeneficiario && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl border border-surface-variant p-6 flex flex-col gap-4 max-h-[80vh]">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3 shrink-0">
              <div>
                <h3 className="font-semibold text-primary text-headline-sm">Histórico de Retiradas</h3>
                <p className="text-body-sm text-on-surface-variant font-medium">Beneficiário: <strong className="text-gray-900">{historyBeneficiario.nome}</strong></p>
              </div>
              <button 
                onClick={() => {
                  setHistoryModalOpen(false)
                  setHistoryBeneficiario(null)
                  setHistoryData([])
                }} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant text-sm">
                  Nenhuma retirada registrada para este beneficiário.
                </div>
              ) : (
                <div className="space-y-4">
                  {historyData.map(a => (
                    <div key={a.id} className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-surface-variant/40 pb-2">
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                          {new Date(a.data_retirada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                        <span className="text-[10px] text-outline">Ref: {a.id.substring(0, 8).toUpperCase()}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 py-1">
                        {a.anotacoes_itens && a.anotacoes_itens.length > 0 ? (
                          a.anotacoes_itens.map((ai, index) => (
                            <span 
                              key={index} 
                              className="inline-flex items-center px-2.5 py-1 rounded bg-secondary-container/60 text-on-secondary-container border border-outline-variant/30 text-xs font-semibold"
                            >
                              {ai.quantidade}x {ai.item?.nome} {ai.item?.unidade_medida !== 'UN' ? `(${ai.item?.unidade_medida})` : ''}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-on-surface-variant">Nenhum item anotado</span>
                        )}
                      </div>

                      {a.observacoes && (
                        <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/35 text-xs text-on-surface-variant italic">
                          <strong>Observações:</strong> {a.observacoes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="pt-3 border-t border-surface-variant flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false)
                  setHistoryBeneficiario(null)
                  setHistoryData([])
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão de Segurança */}
      {deleteConfirmOpen && benefToHardDelete && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3 shrink-0">
              <h3 className="font-semibold text-error text-headline-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">warning</span>
                Excluir Cadastro Permanentemente
              </h3>
              <button 
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  setBenefToHardDelete(null)
                  setHardDeleteWord('')
                }} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleHardDeleteConfirm} className="space-y-4">
              <div className="text-body-sm text-on-surface-variant space-y-2">
                <p>
                  Esta ação é <strong>irreversível</strong> e apagará todos os dados associados ao beneficiário 
                  <strong className="text-gray-900 ml-1">"{benefToHardDelete.nome}"</strong> (incluindo histórico familiar, documentos anexados e registros de benefícios).
                </p>
                <p className="font-semibold text-error">
                  Para confirmar a exclusão, digite a palavra-chave <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200 font-mono text-xs">deletar</code> no campo abaixo.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  required
                  placeholder='Digite "deletar" para confirmar'
                  value={hardDeleteWord}
                  onChange={(e) => setHardDeleteWord(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-error outline-none font-medium"
                />
              </div>

              <div className="pt-4 border-t border-surface-variant flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setBenefToHardDelete(null)
                    setHardDeleteWord('')
                  }}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={hardDeleteWord !== 'deletar'}
                  className="px-4 py-2 bg-error text-on-error disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold hover:bg-error-container shadow-sm transition-all"
                >
                  Sim, excluir cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
