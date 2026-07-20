import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchCestaById, insertCesta, updateCesta, insertCestaEntrega, deleteCestaDocumento } from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { supabase } from '../lib/supabase'
import { mapSupabaseError } from '../lib/errorMapper'

export const CestaForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useFeedback()
  const isEdit = !!id

  const [activeTab, setActiveTab] = useState('pessoais')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Printing template trigger
  const [printOpen, setPrintOpen] = useState(false)

  // Autocomplete search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  // Photo upload and preview states
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [photoRemoved, setPhotoRemoved] = useState(false)

  // Primary form data state
  const [formData, setFormData] = useState({
    beneficiario_id: null,
    nome: '', cpf: '', data_nascimento: '', sexo: 'Masculino', foto_url: '',
    telefone: '', whatsapp: '', email: '',
    cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
    patologias: [], patologia_outro: '', historico_saude: '', observacoes_medicas: '',
    motivo_recebimento: '', renda_familiar: '', num_pessoas_residencia: '1',
    situacao_moradia: 'Alugada',
    responsavel_nome: '', responsavel_parentesco: '', responsavel_cpf: '', responsavel_telefone: '',
    responsavel_whatsapp: '', responsavel_email: '', responsavel_cep: '',
    responsavel_rua: '', responsavel_numero: '', responsavel_complemento: '',
    responsavel_bairro: '', responsavel_cidade: '', responsavel_estado: '',
    status: 'Ativo'
  })

  // Attached files and delivery history
  const [documentos, setDocumentos] = useState([]) // database attachments list
  const [newDocsList, setNewDocsList] = useState([]) // pending uploads { name, file }
  const [newDocName, setNewDocName] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  
  const [entregas, setEntregas] = useState([])
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [deliveryFormData, setDeliveryFormData] = useState({
    data_entrega: new Date().toISOString().split('T')[0],
    mes_referencia: '',
    entregador: '',
    observacoes: '',
    status: 'Entregue'
  })

  const pathologiesList = [
    'Diabetes', 'Hipertensão', 'Câncer', 'Doença Cardíaca', 'Doença Renal',
    'HIV/AIDS', 'Deficiência Física', 'Deficiência Intelectual', 'Transtorno Mental',
    'Idoso acima de 60 anos', 'Gestante', 'Criança em vulnerabilidade'
  ]

  // Address lookup helper (ViaCEP)
  const handleCepLookup = async (cepValue, isResponsavel = false) => {
    const cleaned = cepValue.replace(/\D/g, '')
    if (cleaned.length !== 8) return

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
      const data = await response.json()
      if (data.erro) {
        showToast('CEP não encontrado', 'Verifique o número informado.', 'error')
        return
      }

      if (isResponsavel) {
        setFormData(prev => ({
          ...prev,
          responsavel_cep: cepValue,
          responsavel_rua: data.logradouro || '',
          responsavel_bairro: data.bairro || '',
          responsavel_cidade: data.localidade || '',
          responsavel_estado: data.uf || ''
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          cep: cepValue,
          rua: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || ''
        }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadBeneficiaryDetails = async () => {
    setLoading(true)
    try {
      const data = await fetchCestaById(id)
      setFormData({
        beneficiario_id: data.beneficiario_id || null,
        nome: data.nome || '',
        cpf: data.cpf || '',
        data_nascimento: data.data_nascimento || '',
        sexo: data.sexo || 'Masculino',
        foto_url: data.foto_url || '',
        telefone: data.telefone || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        cep: data.cep || '',
        rua: data.rua || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        patologias: data.patologias || [],
        patologia_outro: data.patologia_outro || '',
        historico_saude: data.historico_saude || '',
        observacoes_medicas: data.observacoes_medicas || '',
        motivo_recebimento: data.motivo_recebimento || '',
        renda_familiar: data.renda_familiar ? data.renda_familiar.toString() : '',
        num_pessoas_residencia: data.num_pessoas_residencia ? data.num_pessoas_residencia.toString() : '1',
        situacao_moradia: data.situacao_moradia || 'Alugada',
        responsavel_nome: data.responsavel_nome || '',
        responsavel_parentesco: data.responsavel_parentesco || '',
        responsavel_cpf: data.responsavel_cpf || '',
        responsavel_telefone: data.responsavel_telefone || '',
        responsavel_whatsapp: data.responsavel_whatsapp || '',
        responsavel_email: data.responsavel_email || '',
        responsavel_cep: data.responsavel_cep || '',
        responsavel_rua: data.responsavel_rua || '',
        responsavel_numero: data.responsavel_numero || '',
        responsavel_complemento: data.responsavel_complemento || '',
        responsavel_bairro: data.responsavel_bairro || '',
        responsavel_cidade: data.responsavel_cidade || '',
        responsavel_estado: data.responsavel_estado || '',
        status: data.status || 'Ativo'
      })
      if (data.beneficiario_id) {
        setSelectedBeneficiary({ id: data.beneficiario_id, nome: data.nome })
      }
      setPhotoPreviewUrl('')
      setPhotoRemoved(false)
      setDocumentos(data.cestas_documentos || [])
      setEntregas(data.cestas_entregas || [])
    } catch (err) {
      showToast('Erro ao carregar', err.message, 'error')
      navigate('/cestas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isEdit) {
      loadBeneficiaryDetails()
    }
  }, [id])

  // Search logic for linking existings
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setDropdownOpen(false)
      return
    }

    const searchBeneficiarios = async () => {
      setSearching(true)
      try {
        const { data, error } = await supabase
          .from('beneficiarios')
          .select('id, nome, cpf, data_nascimento, sexo, telefone, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, estado')
          .is('deletado_em', null)
          .or(`nome.ilike.%${searchQuery}%,cpf.ilike.%${searchQuery}%`)
          .limit(10)

        if (error) throw error
        setSearchResults(data || [])
        setDropdownOpen(true)
      } catch (err) {
        console.error('Error searching beneficiaries:', err)
      } finally {
        setSearching(false)
      }
    }

    const timer = setTimeout(searchBeneficiarios, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSelectBeneficiary = (b) => {
    setSelectedBeneficiary(b)
    setFormData(prev => ({
      ...prev,
      beneficiario_id: b.id,
      nome: b.nome || '',
      cpf: b.cpf || '',
      data_nascimento: b.data_nascimento || '',
      sexo: b.sexo || 'Masculino',
      telefone: b.telefone || '',
      whatsapp: b.whatsapp || '',
      email: b.email || '',
      cep: b.cep || '',
      rua: b.rua || '',
      numero: b.numero || '',
      complemento: b.complemento || '',
      bairro: b.bairro || '',
      cidade: b.cidade || '',
      estado: b.estado || ''
    }))
    setSearchQuery('')
    setDropdownOpen(false)
    showToast('Beneficiário Vinculado', 'Os dados do beneficiário foram importados.', 'success')
  }

  const handleClearSelection = () => {
    setSelectedBeneficiary(null)
    setFormData(prev => ({
      ...prev,
      beneficiario_id: null,
      nome: '',
      cpf: '',
      data_nascimento: '',
      sexo: 'Masculino',
      telefone: '',
      whatsapp: '',
      email: '',
      cep: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: ''
    }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

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

  const handlePathologyToggle = (p) => {
    setFormData(prev => {
      const active = prev.patologias.includes(p)
        ? prev.patologias.filter(x => x !== p)
        : [...prev.patologias, p]
      return { ...prev, patologias: active }
    })
  }

  // Upload attachments handler
  const handleAddDocsPending = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const name = newDocName.trim() || file.name
      setNewDocsList(prev => [...prev, { name, file }])
      setNewDocName('')
      e.target.value = null // clear input
    }
  }

  const handleRemoveDocsPending = (idx) => {
    setNewDocsList(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDeleteDbDoc = async (doc) => {
    if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.nome}"?`)) return
    try {
      await deleteCestaDocumento(doc.id)
      showToast('Sucesso', 'Documento excluído com sucesso!')
      loadBeneficiaryDetails()
    } catch (err) {
      showToast('Erro ao excluir', err.message, 'error')
    }
  }

  // Save/Submit Form handler
  const processSubmit = async (statusOverride = null) => {
    // Validations
    const missing = []
    if (!formData.nome.trim()) missing.push('Nome Completo')
    if (!formData.telefone.trim()) missing.push('Telefone de Contato')
    if (!formData.motivo_recebimento.trim()) missing.push('Motivo do Recebimento')
    if (!formData.responsavel_nome.trim()) missing.push('Nome do Responsável')
    if (!formData.responsavel_telefone.trim()) missing.push('Telefone do Responsável')

    if (missing.length > 0) {
      showToast('Campos obrigatórios ausentes', `Preencha: ${missing.join(', ')}`, 'error')
      return
    }

    setSaving(true)
    try {
      let finalFotoUrl = formData.foto_url

      if (photoRemoved) {
        finalFotoUrl = null
      }

      // Photo upload
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `foto-${Date.now()}.${fileExt}`
        const { error: photoErr } = await supabase.storage
          .from('fotos-beneficiarios')
          .upload(fileName, photoFile)
        if (photoErr) throw photoErr

        const { data: { publicUrl } } = supabase.storage
          .from('fotos-beneficiarios')
          .getPublicUrl(fileName)
        finalFotoUrl = publicUrl
      }

      // Upload files pending lists
      const uploadedDocs = []
      for (const doc of newDocsList) {
        const fileExt = doc.file.name.split('.').pop()
        const fileName = `doc-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const { error: docErr } = await supabase.storage
          .from('documentos-cestas')
          .upload(fileName, doc.file)
        if (docErr) throw docErr

        const { data: { publicUrl } } = supabase.storage
          .from('documentos-cestas')
          .getPublicUrl(fileName)
        uploadedDocs.push({ nome: doc.name, url: publicUrl })
      }

      const payload = {
        ...formData,
        foto_url: finalFotoUrl,
        renda_familiar: formData.renda_familiar ? parseFloat(formData.renda_familiar) : null,
        num_pessoas_residencia: parseInt(formData.num_pessoas_residencia) || 1,
        status: statusOverride || formData.status
      }

      if (isEdit) {
        await updateCesta(id, payload, uploadedDocs)
        showToast('Sucesso', 'Beneficiário atualizado com sucesso!')
      } else {
        await insertCesta(payload, uploadedDocs)
        showToast('Sucesso', 'Beneficiário cadastrado com sucesso!')
      }
      navigate('/cestas')
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Delivery logger handler
  const handleLogDelivery = async (e) => {
    e.preventDefault()
    if (!deliveryFormData.mes_referencia) {
      showToast('Campo ausente', 'Informe o mês de referência.', 'error')
      return
    }

    setSaving(true)
    try {
      await insertCestaEntrega({
        cesta_beneficiario_id: id,
        data_entrega: deliveryFormData.data_entrega || null,
        mes_referencia: deliveryFormData.mes_referencia,
        entregador: deliveryFormData.entregador,
        observacoes: deliveryFormData.observacoes.trim() || null,
        status: deliveryFormData.status
      })
      showToast('Sucesso', 'Entrega registrada com sucesso!')
      setDeliveryModalOpen(false)
      loadBeneficiaryDetails()
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val)
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-variant pb-6">
        <div>
          <nav className="flex items-center text-on-surface-variant font-label-sm text-label-sm mb-1 space-x-2">
            <Link to="/cestas" className="hover:text-primary">Cesta Básica</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-medium">{isEdit ? 'Editar Beneficiário' : 'Novo Beneficiário'}</span>
          </nav>
          <h2 className="font-display-lg text-headline-lg text-primary font-semibold">
            {isEdit ? 'Cadastro de Beneficiário de Cesta' : 'Novo Cadastro de Beneficiário'}
          </h2>
        </div>
        {isEdit && (
          <button
            onClick={() => setPrintOpen(true)}
            className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-xl flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Imprimir Ficha Cadastral
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
          {/* Autocomplete Search Header */}
          {!isEdit && (
            <div className="p-6 border-b border-surface-variant bg-surface-container-low/40 relative">
              <label className="block text-label-sm font-bold text-primary mb-2">
                Vincular a Beneficiário Existente
              </label>
              <div className="flex gap-2 max-w-xl relative">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar beneficiário já cadastrado por nome ou CPF..."
                    disabled={!!selectedBeneficiary}
                    className="w-full border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 bg-white text-body-sm focus:border-primary focus:ring-0 outline-none disabled:bg-surface-container-lowest"
                  />
                  {searching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                  )}
                </div>
                
                {selectedBeneficiary ? (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl font-semibold text-body-sm flex items-center gap-1.5 transition-colors border border-error/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    Desvincular
                  </button>
                ) : null}
              </div>
              
              {/* Autocomplete Dropdown */}
              {dropdownOpen && searchResults.length > 0 && (
                <div className="absolute left-6 right-6 mt-1 max-w-xl bg-white border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-surface-variant">
                  {searchResults.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBeneficiary(b)}
                      className="px-4 py-3 hover:bg-secondary-container/15 cursor-pointer transition-colors flex justify-between items-center text-body-sm"
                    >
                      <div>
                        <p className="font-semibold text-on-surface">{b.nome}</p>
                        <p className="text-xs text-outline font-medium">
                          CPF: {b.cpf || 'Não informado'}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        add_circle
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {dropdownOpen && searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
                <div className="absolute left-6 right-6 mt-1 max-w-xl bg-white border border-outline-variant rounded-xl shadow-lg z-50 p-4 text-center text-body-sm text-outline-variant">
                  Nenhum beneficiário encontrado com "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Tabs header */}
          <div className="flex border-b border-surface-variant bg-surface-container-low overflow-x-auto">
            {[
              { id: 'pessoais', name: 'Dados Pessoais' },
              { id: 'endereco', name: 'Endereço' },
              { id: 'documentos', name: 'Documentos' },
              { id: 'saude', name: 'Saúde' },
              { id: 'motivo', name: 'Motivo / Social' },
              { id: 'responsavel', name: 'Responsável legal' },
              ...(isEdit ? [{ id: 'entregas', name: 'Entregas' }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-4 text-body-sm font-semibold border-b-2 whitespace-nowrap transition-colors outline-none ${
                  activeTab === tab.id 
                    ? 'border-primary text-primary bg-primary/5' 
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Form wrapper */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            
            {/* TABS: DADOS PESSOAIS */}
            {activeTab === 'pessoais' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-label-sm font-semibold text-on-surface">Nome Completo *</label>
                    {selectedBeneficiary && (
                      <span className="bg-green-100 text-green-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        Dados importados de Beneficiários
                      </span>
                    )}
                  </div>
                  <input
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Sexo</label>
                  <select
                    name="sexo"
                    value={formData.sexo}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">CPF</label>
                  <input
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleInputChange}
                    placeholder="Apenas números"
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>

                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Data de Nascimento</label>
                  <input
                    name="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Telefone Principal *</label>
                  <input
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    required
                    placeholder="(00) 00000-0000"
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">WhatsApp</label>
                  <input
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">E-mail</label>
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@exemplo.com"
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="email"
                  />
                </div>
                <div className="md:col-span-3 flex flex-col items-center sm:items-start">
                  <label className="block text-label-sm font-semibold text-on-surface mb-2">Foto de Perfil</label>
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

            {/* TABS: ENDEREÇO */}
            {activeTab === 'endereco' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">CEP</label>
                  <input
                    name="cep"
                    value={formData.cep}
                    onChange={(e) => {
                      handleInputChange(e)
                      handleCepLookup(e.target.value, false)
                    }}
                    placeholder="00000-000"
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Rua / Logradouro</label>
                  <input
                    name="rua"
                    value={formData.rua}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Número</label>
                  <input
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Complemento</label>
                  <input
                    name="complemento"
                    value={formData.complemento}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Bairro</label>
                  <input
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Cidade</label>
                  <input
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Estado (UF)</label>
                  <input
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    type="text"
                  />
                </div>
              </div>
            )}

            {/* TABS: DOCUMENTOS */}
            {activeTab === 'documentos' && (
              <div className="space-y-6">
                <div className="bg-surface-container-low/50 p-4 border border-outline-variant rounded-2xl max-w-xl">
                  <h4 className="font-semibold text-primary mb-3">Anexar Novo Arquivo</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">Tipo de Documento</label>
                      <input
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder="Ex: Identidade, Comprovante Residência"
                        className="w-full border border-outline-variant rounded-xl px-3 py-1.5 bg-surface text-xs"
                        type="text"
                      />
                    </div>
                    <div>
                      <input
                        type="file"
                        onChange={handleAddDocsPending}
                        className="w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Pending files list */}
                {newDocsList.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-bold text-xs text-on-surface-variant">Arquivos para upload ao salvar:</h5>
                    <ul className="divide-y divide-surface-variant border border-dashed border-outline-variant rounded-2xl bg-surface p-3 max-w-xl text-xs space-y-1">
                      {newDocsList.map((doc, idx) => (
                        <li key={idx} className="flex justify-between items-center py-1">
                          <span>{doc.name} ({doc.file.name})</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveDocsPending(idx)} 
                            className="text-error font-semibold hover:underline"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* DB Uploaded files table */}
                <div className="border border-outline-variant rounded-2xl overflow-hidden max-w-2xl bg-white shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                      <tr>
                        <th className="px-4 py-2">Documento</th>
                        <th className="px-4 py-2">Link</th>
                        <th className="px-4 py-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-variant text-xs">
                      {documentos.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-4 py-4 text-center text-on-surface-variant">Nenhum documento cadastrado no banco.</td>
                        </tr>
                      ) : (
                        documentos.map(doc => (
                          <tr key={doc.id}>
                            <td className="px-4 py-2.5 font-medium">{doc.nome}</td>
                            <td className="px-4 py-2.5">
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                                Abrir Arquivo
                              </a>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteDbDoc(doc)}
                                className="text-error hover:underline"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABS: SAÚDE */}
            {activeTab === 'saude' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-3">Patologia ou Condição do Beneficiário (Múltipla Seleção) *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {pathologiesList.map(p => {
                      const isSelected = formData.patologias.includes(p)
                      return (
                        <label 
                          key={p}
                          className={`flex items-center gap-2.5 p-3 border rounded-2xl cursor-pointer select-none transition-colors ${
                            isSelected 
                              ? 'bg-primary-container/10 border-primary text-primary font-semibold' 
                              : 'bg-surface border-outline-variant hover:bg-surface-container-low'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handlePathologyToggle(p)}
                            className="rounded text-primary focus:ring-0 w-4 h-4 border-outline-variant"
                          />
                          <span className="text-xs">{p}</span>
                        </label>
                      )
                    })}
                    
                    {/* Other option check */}
                    <label 
                      className={`flex items-center gap-2.5 p-3 border rounded-2xl cursor-pointer select-none transition-colors ${
                        formData.patologias.includes('Outro') 
                          ? 'bg-primary-container/10 border-primary text-primary font-semibold' 
                          : 'bg-surface border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.patologias.includes('Outro')}
                        onChange={() => handlePathologyToggle('Outro')}
                        className="rounded text-primary focus:ring-0 w-4 h-4 border-outline-variant"
                      />
                      <span className="text-xs">Outro</span>
                    </label>
                  </div>
                </div>

                {formData.patologias.includes('Outro') && (
                  <div className="max-w-md">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Descreva a Outra Patologia *</label>
                    <input
                      name="patologia_outro"
                      value={formData.patologia_outro}
                      onChange={handleInputChange}
                      required
                      placeholder="Descreva a condição médica"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                      type="text"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Histórico de Saúde</label>
                    <textarea
                      name="historico_saude"
                      value={formData.historico_saude}
                      onChange={handleInputChange}
                      placeholder="Tratamentos anteriores, medicamentos contínuos, etc."
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Observações Médicas</label>
                    <textarea
                      name="observacoes_medicas"
                      value={formData.observacoes_medicas}
                      onChange={handleInputChange}
                      placeholder="Limitações de locomoção, alergias, etc."
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm h-24"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TABS: MOTIVO / SOCIAL */}
            {activeTab === 'motivo' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Motivo do Recebimento (Parecer Social) *</label>
                  <textarea
                    name="motivo_recebimento"
                    value={formData.motivo_recebimento}
                    onChange={handleInputChange}
                    required
                    placeholder="Explicação detalhada da vulnerabilidade social e motivo da necessidade de receber a cesta básica..."
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm h-32 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Renda Familiar Mensal (R$)</label>
                    <input
                      name="renda_familiar"
                      value={formData.renda_familiar}
                      onChange={handleInputChange}
                      placeholder="0,00"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Nº de Pessoas na Residência</label>
                    <input
                      name="num_pessoas_residencia"
                      value={formData.num_pessoas_residencia}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="number"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Situação de Moradia</label>
                    <select
                      name="situacao_moradia"
                      value={formData.situacao_moradia}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                    >
                      <option value="Própria">Própria</option>
                      <option value="Alugada">Alugada</option>
                      <option value="Cedida">Cedida</option>
                      <option value="Invasão">Invasão</option>
                      <option value="Sem Moradia">Sem Moradia</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TABS: RESPONSÁVEL */}
            {activeTab === 'responsavel' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-primary border-b border-surface-variant pb-2 text-md">Dados do Responsável Pelo Recebimento *</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome Completo *</label>
                    <input
                      name="responsavel_nome"
                      value={formData.responsavel_nome}
                      onChange={handleInputChange}
                      required
                      placeholder="Nome do representante legal / responsável"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Grau de Parentesco</label>
                    <input
                      name="responsavel_parentesco"
                      value={formData.responsavel_parentesco}
                      onChange={handleInputChange}
                      placeholder="Ex: Filho, Cônjuge, Vizinho"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">CPF do Responsável</label>
                    <input
                      name="responsavel_cpf"
                      value={formData.responsavel_cpf}
                      onChange={handleInputChange}
                      placeholder="Apenas números"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Telefone Principal *</label>
                    <input
                      name="responsavel_telefone"
                      value={formData.responsavel_telefone}
                      onChange={handleInputChange}
                      required
                      placeholder="(00) 00000-0000"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">WhatsApp</label>
                    <input
                      name="responsavel_whatsapp"
                      value={formData.responsavel_whatsapp}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                </div>

                <h4 className="font-semibold text-primary border-b border-surface-variant pb-2 text-md mt-6">Endereço do Responsável</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">CEP</label>
                    <input
                      name="responsavel_cep"
                      value={formData.responsavel_cep}
                      onChange={(e) => {
                        handleInputChange(e)
                        handleCepLookup(e.target.value, true)
                      }}
                      placeholder="00000-000"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Rua / Logradouro</label>
                    <input
                      name="responsavel_rua"
                      value={formData.responsavel_rua}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Número</label>
                    <input
                      name="responsavel_numero"
                      value={formData.responsavel_numero}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Complemento</label>
                    <input
                      name="responsavel_complemento"
                      value={formData.responsavel_complemento}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Bairro</label>
                    <input
                      name="responsavel_bairro"
                      value={formData.responsavel_bairro}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Cidade</label>
                    <input
                      name="responsavel_cidade"
                      value={formData.responsavel_cidade}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">Estado (UF)</label>
                    <input
                      name="responsavel_estado"
                      value={formData.responsavel_estado}
                      onChange={handleInputChange}
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm"
                      type="text"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TABS: ENTREGAS */}
            {activeTab === 'entregas' && isEdit && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-primary text-md">Registro de Entregas Mensais</h4>
                    <p className="text-xs text-on-surface-variant">Histórico de cestas básicas distribuídas a este cadastro.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                      setDeliveryFormData({
                        data_entrega: now.toISOString().split('T')[0],
                        mes_referencia: `${months[now.getMonth()]} ${now.getFullYear()}`,
                        entregador: '',
                        observacoes: '',
                        status: 'Entregue'
                      })
                      setDeliveryModalOpen(true)
                    }}
                    className="bg-primary text-on-primary hover:bg-primary-container px-4 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs">local_shipping</span>
                    Registrar Nova Entrega
                  </button>
                </div>

                <div className="border border-outline-variant rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                      <tr>
                        <th className="px-4 py-2.5">Data da Entrega</th>
                        <th className="px-4 py-2.5">Mês de Referência</th>
                        <th className="px-4 py-2.5">Entregador</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-variant text-xs text-on-surface">
                      {entregas.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-4 py-6 text-center text-on-surface-variant">Nenhuma entrega registrada anteriormente.</td>
                        </tr>
                      ) : (
                        entregas.map(e => (
                          <tr key={e.id} className="hover:bg-secondary-container/10">
                            <td className="px-4 py-3">{e.data_entrega ? new Date(e.data_entrega).toLocaleDateString('pt-BR') : '---'}</td>
                            <td className="px-4 py-3 font-semibold">{e.mes_referencia}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{e.entregador || '---'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                e.status === 'Entregue' 
                                  ? 'bg-primary-container text-on-primary-container border-primary/20' 
                                  : 'bg-error-container text-on-error-container border-error/20'
                              }`}>
                                {e.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant truncate max-w-xs" title={e.observacoes}>{e.observacoes || '---'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions form row */}
            <div className="pt-6 border-t border-surface-variant flex justify-between gap-4 mt-8 shrink-0">
              <Link
                to="/cestas"
                className="px-6 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-xl font-semibold text-body-sm transition-colors"
              >
                Cancelar
              </Link>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => processSubmit('Inativo')}
                  disabled={saving}
                  className="px-5 py-3 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-semibold text-body-sm transition-all"
                >
                  Salvar Rascunho
                </button>
                <button
                  type="button"
                  onClick={() => processSubmit('Ativo')}
                  disabled={saving}
                  className="px-6 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-xl font-semibold text-body-sm shadow-sm transition-all"
                >
                  {saving ? 'Salvando...' : 'Salvar Cadastro'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Quick delivery modal */}
      {deliveryModalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-semibold text-primary text-md">Registrar Entrega</h3>
              <button onClick={() => setDeliveryModalOpen(false)} className="p-1 text-on-surface hover:bg-surface-container rounded-xl">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleLogDelivery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Mês de Referência *</label>
                <input
                  type="text"
                  placeholder="Ex: Junho 2026"
                  required
                  value={deliveryFormData.mes_referencia}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, mes_referencia: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Data da Entrega</label>
                  <input
                    type="date"
                    value={deliveryFormData.data_entrega}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, data_entrega: e.target.value }))}
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Entregador</label>
                  <input
                    type="text"
                    value={deliveryFormData.entregador}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, entregador: e.target.value }))}
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Status</label>
                <select
                  value={deliveryFormData.status}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm"
                >
                  <option value="Entregue">Entregue</option>
                  <option value="Não Retirado">Não Retirado</option>
                  <option value="Entrega Parcial">Entrega Parcial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Observações</label>
                <textarea
                  value={deliveryFormData.observacoes}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm h-16"
                />
              </div>

              <div className="pt-4 border-t border-surface-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container shadow-sm"
                >
                  {saving ? 'Gravando...' : 'Gravar Entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printing Ficha Cadastral Screen View */}
      {printOpen && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6 md:p-12 flex flex-col items-center animate-in fade-in duration-200">
          
          {/* Print Controls header */}
          <div className="w-full max-w-3xl flex justify-between items-center pb-6 border-b border-slate-200 mb-8 no-print">
            <h3 className="font-bold text-slate-700 text-lg">Ficha Cadastral do Beneficiário</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir Ficha
              </button>
              <button 
                onClick={() => setPrintOpen(false)}
                className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Fechar
              </button>
            </div>
          </div>

          {/* Paper template container */}
          <div className="w-full max-w-3xl bg-white border border-slate-300 p-8 md:p-10 flex flex-col gap-6 shadow-sm print:border-none print:shadow-none text-slate-800 text-sm leading-relaxed">
            
            {/* Header */}
            <header className="flex justify-between items-center border-b-2 border-slate-300 pb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>church</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-md">SISTEMA PASTORAL</h4>
                  <p className="text-[10px] text-slate-500">Filantropia & Gestão Assistencial</p>
                </div>
              </div>
              <div className="text-right">
                <h3 className="font-bold text-slate-800 text-md uppercase">Ficha de Cesta Básica</h3>
                <p className="text-[10px] text-slate-500">Status: {formData.status.toUpperCase()}</p>
              </div>
            </header>

            {/* Ficha Body */}
            <main className="space-y-6">
              {/* Photo & Main profile details */}
              <div className="flex flex-col sm:flex-row gap-6 border-b border-slate-200 pb-4">
                <div className="w-24 h-24 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                  {formData.foto_url ? (
                    <img src={formData.foto_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-slate-400 text-4xl">person</span>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Nome Beneficiário</span>
                    <span className="font-semibold text-slate-900 text-md">{formData.nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">CPF</span>
                    <span>{formData.cpf || '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Data Nascimento</span>
                    <span>{formData.data_nascimento ? new Date(formData.data_nascimento).toLocaleDateString('pt-BR') : '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Telefone</span>
                    <span>{formData.telefone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Sexo</span>
                    <span>{formData.sexo}</span>
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="border-b border-slate-200 pb-4 space-y-2">
                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Endereço Residencial</h5>
                <p>
                  {formData.rua}, {formData.numero} {formData.complemento && ` - ${formData.complemento}`}<br />
                  {formData.bairro} - {formData.cidade} / {formData.estado} - CEP: {formData.cep}
                </p>
              </div>

              {/* Saúde */}
              <div className="border-b border-slate-200 pb-4 space-y-2">
                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Informações de Saúde & Patologias</h5>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Patologias Registradas</span>
                  <span>{formData.patologias.length > 0 ? formData.patologias.join(', ') : 'Nenhuma'}</span>
                  {formData.patologias.includes('Outro') && formData.patologia_outro && (
                    <span className="block text-xs mt-1 text-slate-600">Descrição Outro: {formData.patologia_outro}</span>
                  )}
                </div>
                {formData.observacoes_medicas && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Observações Médicas</span>
                    <p className="text-xs text-slate-600">{formData.observacoes_medicas}</p>
                  </div>
                )}
              </div>

              {/* Social / Motivo */}
              <div className="border-b border-slate-200 pb-4 space-y-3">
                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Motivos de Assistência Social</h5>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Parecer de Vulnerabilidade</span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-100 italic">"{formData.motivo_recebimento}"</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Renda Familiar</span>
                    <span>{formData.renda_familiar ? formatCurrency(formData.renda_familiar) : '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Membros Domicílio</span>
                    <span>{formData.num_pessoas_residencia} pessoa(s)</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Moradia</span>
                    <span>{formData.situacao_moradia}</span>
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div className="border-b border-slate-200 pb-4 space-y-2">
                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Responsável Legal pelo Recebimento</h5>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Nome Responsável</span>
                    <span className="font-semibold">{formData.responsavel_nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Grau de Parentesco</span>
                    <span>{formData.responsavel_parentesco || '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">CPF Responsável</span>
                    <span>{formData.responsavel_cpf || '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Telefone Responsável</span>
                    <span>{formData.responsavel_telefone}</span>
                  </div>
                </div>
              </div>

            </main>

            {/* Date and Signatures */}
            <footer className="mt-12 space-y-12">
              <div className="text-right text-xs text-slate-400">
                Emitido em: {new Date().toLocaleDateString('pt-BR')}
              </div>
              <div className="grid grid-cols-2 gap-10 pt-6">
                <div className="flex flex-col items-center">
                  <div className="w-full border-t border-dashed border-slate-400 max-w-[200px] mb-2"></div>
                  <span className="text-xs font-semibold text-slate-700">Assinatura do Beneficiário/Responsável</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-full border-t border-dashed border-slate-400 max-w-[200px] mb-2"></div>
                  <span className="text-xs font-semibold text-slate-700">Assinatura do Representante</span>
                </div>
              </div>
            </footer>

          </div>
        </div>
      )}

    </div>
  )
}
