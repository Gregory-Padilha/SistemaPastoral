import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFeedback } from '../contexts/FeedbackContext'
import { useAuth } from '../contexts/AuthContext'
import { 
  fetchBeneficiarios, 
  fetchCestas, 
  fetchAlugueis, 
  fetchConfiguracoes,
  fetchModelos,
  insertModelo,
  updateModelo,
  deleteModelo,
  insertContatoLog,
  fetchUltimoContato,
  fetchUltimaEntrega,
  insertMensagemLog,
  fetchMensagensHistory
} from '../lib/queries'
import { mapSupabaseError } from '../lib/errorMapper'
import { supabase } from '../lib/supabase'

export const Mensagens = () => {
  const { showToast, confirmDelete } = useFeedback()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const textareaRef = useRef(null)
  const drawerTextareaRef = useRef(null)

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('enviar') // 'enviar' | 'modelos'

  // Data States
  const [recipients, setRecipients] = useState([])
  const [configuracoes, setConfiguracoes] = useState(null)
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)

  // Autocomplete & Selection States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Message Editor States
  const [useModel, setUseModel] = useState(true) // true = Usar Modelo, false = Escrever Manualmente
  const [selectedModelId, setSelectedModelId] = useState('')
  const [messageText, setMessageText] = useState('')

  // Model Drawer States (Create/Edit)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingModel, setEditingModel] = useState(null) // null = Novo Modelo, object = Edit Modelo
  const [drawerTitle, setDrawerTitle] = useState('')
  const [drawerCategory, setDrawerCategory] = useState('Geral')
  const [drawerText, setDrawerText] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Productivity filters and logs
  const [quickFilter, setQuickFilter] = useState('livre') // 'livre' | 'atraso' | 'pendentes'
  const [lastContact, setLastContact] = useState(null)
  const [lastDeliveryDate, setLastDeliveryDate] = useState(null)
  const [recentContactWarning, setRecentContactWarning] = useState(null)

  // Load initial data
  const loadData = async () => {
    setLoading(true)
    try {
      const [benefList, cestasList, aluguelList, configData, modelsList] = await Promise.all([
        fetchBeneficiarios().catch(() => []),
        fetchCestas().catch(() => []),
        fetchAlugueis().catch(() => []),
        fetchConfiguracoes().catch(() => null),
        fetchModelos().catch(() => [])
      ])

      // Fetch deliveries this month for pendentes basket checking
      const now = new Date()
      const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
      const currentMonthRef = `${months[now.getMonth()]} ${now.getFullYear()}`
      
      const { data: deliveriesThisMonth } = await supabase
        .from('entregas_cesta')
        .select('beneficiario_id')
        .eq('mes_referencia', currentMonthRef)

      const deliveredIds = new Set((deliveriesThisMonth || []).map(d => d.beneficiario_id))

      // Consolidated Recipients List
      const consolidated = [
        ...benefList.map(b => ({
          id: b.id,
          nome: b.nome,
          telefone: b.telefone || '',
          whatsapp: b.whatsapp || '',
          tipo: 'Beneficiário',
          statusOriginal: b.status || 'Ativo',
          valor_aluguel: null,
          dia_vencimento: null
        })),
        ...cestasList.map(c => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone || '',
          whatsapp: c.whatsapp || '',
          tipo: 'Cesta Básica',
          statusOriginal: c.status || 'Ativo',
          valor_aluguel: null,
          dia_vencimento: null,
          deliveredThisMonth: deliveredIds.has(c.id)
        })),
        ...aluguelList.map(a => ({
          id: a.id,
          nome: a.locatario_nome,
          telefone: a.locatario_telefone || '',
          whatsapp: a.locatario_whatsapp || '',
          tipo: 'Locatário',
          statusOriginal: a.status || 'Ativo',
          valor_aluguel: a.valor_aluguel || null,
          dia_vencimento: a.dia_vencimento || null
        }))
      ]

      const defaultModels = [
        {
          id: 'default-1',
          titulo: 'Cobrança de Aluguel',
          categoria: 'Financeiro',
          texto: 'Olá, {nome}! Tudo bem? Passando para lembrar que o aluguel referente ao mês de {mes} está disponível para pagamento. O valor é de {valor}. Qualquer dúvida estamos à disposição. Deus abençoe! Equipe {instituicao}.',
          sistema_padrao: true
        },
        {
          id: 'default-2',
          titulo: 'Como Você Está',
          categoria: 'Acompanhamento',
          texto: 'Olá, {nome}! A equipe da {instituicao} está entrando em contato para saber como você está. Caso precise de algum apoio ou tenha alguma necessidade, não hesite em nos contatar. Estamos aqui para ajudar. Deus abençoe você e sua família!',
          sistema_padrao: true
        },
        {
          id: 'default-3',
          titulo: 'Confirmação de Cesta Básica',
          categoria: 'Cesta Básica',
          texto: 'Olá, {nome}! Gostaríamos de confirmar que a cesta básica do mês de {mes} está disponível para retirada. Por favor, entre em contato para agendar a retirada ou aguarde nosso aviso. Deus abençoe! Equipe {instituicao}.',
          sistema_padrao: true
        }
      ]

      const finalModels = modelsList.length > 0 ? modelsList : defaultModels

      setRecipients(consolidated)
      setConfiguracoes(configData)
      setModelos(finalModels)

      // Check URL search parameters
      const useModeloId = searchParams.get('useModelo')
      const targetRecipientId = searchParams.get('recipientId')
      const targetRecipientType = searchParams.get('recipientType')

      if (targetRecipientId) {
        const found = consolidated.find(r => r.id === targetRecipientId && (!targetRecipientType || r.tipo === targetRecipientType))
        if (found) {
          setSelectedRecipient(found)
          setSearchQuery(found.nome)
        }
      }

      if (useModeloId) {
        const matchedModel = finalModels.find(m => m.id === useModeloId)
        if (matchedModel) {
          setActiveTab('enviar')
          setUseModel(true)
          setSelectedModelId(useModeloId)
          setMessageText(matchedModel.texto)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
      showToast('Erro ao carregar', 'Ocorreu um erro ao carregar as informações do sistema.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [searchParams])

  // Fetch selected recipient extras (last contact and last delivery)
  useEffect(() => {
    const fetchRecipientExtras = async () => {
      if (!selectedRecipient) {
        setLastContact(null)
        setLastDeliveryDate(null)
        setRecentContactWarning(null)
        return
      }

      let entTipo = 'geral'
      if (selectedRecipient.tipo === 'Cesta Básica') entTipo = 'cesta'
      if (selectedRecipient.tipo === 'Locatário') entTipo = 'aluguel'

      try {
        const lastCon = await fetchUltimoContato(selectedRecipient.id, entTipo)
        setLastContact(lastCon)
      } catch (err) {
        console.error('Error fetching last contact details:', err)
      }

      try {
        const lastMsg = await fetchMensagensHistory(selectedRecipient.id, entTipo)
        if (lastMsg) {
          const sentTime = new Date(lastMsg.enviado_em).getTime()
          const nowTime = new Date().getTime()
          const diffHours = (nowTime - sentTime) / (1000 * 60 * 60)
          if (diffHours <= 24) {
            setRecentContactWarning(lastMsg)
          } else {
            setRecentContactWarning(null)
          }
        } else {
          setRecentContactWarning(null)
        }
      } catch (err) {
        console.error('Error fetching message warning history:', err)
        setRecentContactWarning(null)
      }

      if (selectedRecipient.tipo === 'Cesta Básica') {
        try {
          const lastDel = await fetchUltimaEntrega(selectedRecipient.id)
          setLastDeliveryDate(lastDel)
        } catch (err) {
          console.error('Error fetching last delivery:', err)
        }
      } else {
        setLastDeliveryDate(null)
      }
    }

    fetchRecipientExtras()
  }, [selectedRecipient])

  // Clear query params on unmount or tab switch
  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    // Clear URL parameters
    setSearchParams({})
  }

  // Get filtered recipients lists for quick filters
  const getFilteredRecipients = () => {
    if (quickFilter === 'atraso') {
      return recipients.filter(r => r.tipo === 'Locatário' && r.statusOriginal === 'Em Atraso')
    }
    if (quickFilter === 'pendentes') {
      return recipients.filter(r => r.tipo === 'Cesta Básica' && r.statusOriginal === 'Ativo' && !r.deliveredThisMonth)
    }
    return recipients
  }

  // Autocomplete Suggestions
  const filteredSuggestions = searchQuery.trim().length > 0
    ? getFilteredRecipients().filter(r => r.nome.toLowerCase().includes(searchQuery.toLowerCase()))
    : (quickFilter !== 'livre' ? getFilteredRecipients() : [])

  // Dynamic Variable Replacements
  const getReplacedMessage = (rawText, recipient) => {
    if (!rawText) return ''
    let text = rawText

    const name = recipient ? recipient.nome : '[Nome]'
    const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long' })
    const monthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)
    const instName = configuracoes?.nome_instituicao || 'Sistema Pastoral'

    let valorStr = '[Valor]'
    if (recipient?.tipo === 'Locatário' && recipient.valor_aluguel) {
      valorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recipient.valor_aluguel)
    }

    let vencimentoStr = '[Vencimento]'
    if (recipient?.tipo === 'Locatário' && recipient.dia_vencimento) {
      vencimentoStr = `dia ${recipient.dia_vencimento}`
    }

    let ultimaEntregaStr = '[Última Entrega]'
    if (recipient?.tipo === 'Cesta Básica') {
      if (lastDeliveryDate) {
        ultimaEntregaStr = new Date(lastDeliveryDate).toLocaleDateString('pt-BR')
      } else {
        ultimaEntregaStr = 'sem registro'
      }
    }

    // Replace curly, bracketed and plain variables
    text = text
      .replace(/\{nome\}/g, name)
      .replace(/\[nome\]/g, name)
      .replace(/\bnome\b/g, name)

      .replace(/\{mes\}/g, monthCapitalized)
      .replace(/\[mes\]/g, monthCapitalized)
      .replace(/\bmes\b/g, monthCapitalized)

      .replace(/\{instituicao\}/g, instName)
      .replace(/\[instituicao\]/g, instName)
      .replace(/\binstituicao\b/g, instName)

      .replace(/\{valor\}/g, valorStr)
      .replace(/\[valor\]/g, valorStr)
      .replace(/\bvalor\b/g, valorStr)

      .replace(/\{vencimento\}/g, vencimentoStr)
      .replace(/\[vencimento\]/g, vencimentoStr)
      .replace(/\bvencimento\b/g, vencimentoStr)

      .replace(/\{ultima_entrega\}/g, ultimaEntregaStr)
      .replace(/\[ultima_entrega\]/g, ultimaEntregaStr)
      .replace(/\bultima_entrega\b/g, ultimaEntregaStr)

    return text
  }

  // Handle Model Dropdown Change
  const handleModelChange = (modelId) => {
    setSelectedModelId(modelId)
    const matched = modelos.find(m => m.id === modelId)
    if (matched) {
      setMessageText(matched.texto)
    } else {
      setMessageText('')
    }
  }

  // Variable insertion at cursor helper
  const handleInsertVariable = (variableKey, isDrawer = false) => {
    const textarea = isDrawer ? drawerTextareaRef.current : textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentText = textarea.value
    const insertionText = `{${variableKey}}`
    const newText = currentText.substring(0, start) + insertionText + currentText.substring(end)

    if (isDrawer) {
      setDrawerText(newText)
      setTimeout(() => {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = start + insertionText.length
      }, 0)
    } else {
      setMessageText(newText)
      setTimeout(() => {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = start + insertionText.length
      }, 0)
    }
  }

  // Construct wa.me link
  const cleanNumber = (num) => {
    if (!num) return ''
    let cleaned = num.replace(/\D/g, '')
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '55' + cleaned
    }
    return cleaned
  }

  const getWhatsAppLink = () => {
    const whatsappNum = selectedRecipient?.whatsapp || selectedRecipient?.telefone
    if (!whatsappNum) return ''
    const cleanNum = cleanNumber(whatsappNum)
    const finalMsg = getReplacedMessage(messageText, selectedRecipient)
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(finalMsg)}`
  }

  const handleOpenWhatsApp = async () => {
    const link = getWhatsAppLink()
    if (!link) {
      showToast('Erro de contato', 'Selecione um destinatário com WhatsApp válido.', 'error')
      return
    }

    // Insert log to database
    const profileId = user?.id
    if (profileId && selectedRecipient) {
      let entTipo = 'geral'
      if (selectedRecipient.tipo === 'Cesta Básica') entTipo = 'cesta'
      if (selectedRecipient.tipo === 'Locatário') entTipo = 'aluguel'

      const isDefaultModel = selectedModelId && String(selectedModelId).startsWith('default-')
      const cleanModelId = isDefaultModel ? null : (selectedModelId || null)

      try {
        // 1. Insert into historico_mensagens (consolidated table)
        await insertMensagemLog({
          perfil_id: profileId,
          destinatario_id: selectedRecipient.id,
          destinatario_tipo: entTipo,
          modelo_id: cleanModelId,
          enviado_em: new Date().toISOString()
        })

        // 2. Insert log trace to older historico_contatos
        await insertContatoLog({
          perfil_id: profileId,
          entidade_tipo: entTipo,
          entidade_id: selectedRecipient.id,
          modelo_id: cleanModelId,
          canal: 'whatsapp'
        })

        // Refresh last contact details badge and warning
        const updated = await fetchUltimoContato(selectedRecipient.id, entTipo)
        setLastContact(updated)

        const updatedMsg = await fetchMensagensHistory(selectedRecipient.id, entTipo)
        if (updatedMsg) {
          const sentTime = new Date(updatedMsg.enviado_em).getTime()
          const nowTime = new Date().getTime()
          const diffHours = (nowTime - sentTime) / (1000 * 60 * 60)
          if (diffHours <= 24) {
            setRecentContactWarning(updatedMsg)
          } else {
            setRecentContactWarning(null)
          }
        }
      } catch (err) {
        console.error('Error writing contact log:', err)
      }
    }

    window.open(link, '_blank')
    showToast('WhatsApp Aberto', 'Mensagem enviada para o redirecionamento.', 'success')
  }

  const handleCopyLink = () => {
    const link = getWhatsAppLink()
    if (!link) {
      showToast('Erro de contato', 'Selecione um destinatário com WhatsApp válido.', 'error')
      return
    }
    navigator.clipboard.writeText(link)
    showToast('Link Copiado', 'Link do WhatsApp copiado para a área de transferência.', 'success')
  }

  // Handle Model CRUD Ops
  const handleOpenNewModel = () => {
    setEditingModel(null)
    setDrawerTitle('')
    setDrawerCategory('Geral')
    setDrawerText('')
    setShowPreview(false)
    setIsDrawerOpen(true)
  }

  const handleOpenEditModel = (model) => {
    if (typeof model.id === 'string' && model.id.startsWith('default-')) {
      showToast('Tabela Ausente', 'Crie a tabela modelos_mensagem no Supabase primeiro para editar ou excluir modelos.', 'error')
      return
    }
    setEditingModel(model)
    setDrawerTitle(model.titulo)
    setDrawerCategory(model.categoria)
    setDrawerText(model.texto)
    setShowPreview(false)
    setIsDrawerOpen(true)
  }

  const handleSaveModel = async (e) => {
    e.preventDefault()
    if (!drawerTitle.trim() || !drawerText.trim()) {
      showToast('Campos Obrigatórios', 'Título e Texto são obrigatórios.', 'error')
      return
    }

    try {
      const payload = {
        titulo: drawerTitle,
        categoria: drawerCategory,
        texto: drawerText,
        ativo: true
      }

      if (editingModel) {
        await updateModelo(editingModel.id, payload)
        showToast('Modelo Atualizado', 'O modelo de mensagem foi salvo com sucesso.', 'success')
      } else {
        await insertModelo(payload)
        showToast('Modelo Criado', 'O novo modelo de mensagem foi salvo com sucesso.', 'success')
      }

      setIsDrawerOpen(false)
      loadData()
    } catch (err) {
      console.error('Error saving model:', err)
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    }
  }

  const handleDeleteModel = (model) => {
    if (typeof model.id === 'string' && model.id.startsWith('default-')) {
      showToast('Tabela Ausente', 'Crie a tabela modelos_mensagem no Supabase primeiro para editar ou excluir modelos.', 'error')
      return
    }
    confirmDelete(
      'Excluir Modelo',
      `Tem certeza que deseja excluir o modelo "${model.titulo}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteModelo(model.id)
          showToast('Modelo Excluído', 'O modelo foi removido com sucesso.', 'success')
          loadData()
        } catch (err) {
          console.error('Error deleting model:', err)
          const mapped = mapSupabaseError(err)
          showToast(mapped.title, mapped.message, 'error')
        }
      }
    )
  }

  const handleUseModelFromList = (model) => {
    setActiveTab('enviar')
    setUseModel(true)
    setSelectedModelId(model.id)
    setMessageText(model.texto)
  }

  // Category badges helper
  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Financeiro':
        return 'bg-blue-50 text-blue-800 border-blue-200'
      case 'Acompanhamento':
        return 'bg-purple-50 text-purple-800 border-purple-200'
      case 'Cesta Básica':
        return 'bg-orange-50 text-orange-800 border-orange-200'
      case 'Aluguel':
        return 'bg-teal-50 text-teal-800 border-teal-200'
      case 'Geral':
        return 'bg-green-50 text-green-800 border-green-200'
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Upper Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-surface-variant pb-4">
        <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant">
          <button
            onClick={() => handleTabSwitch('enviar')}
            className={`px-6 py-2.5 rounded-lg text-body-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'enviar'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            Enviar Mensagem
          </button>
          <button
            onClick={() => handleTabSwitch('modelos')}
            className={`px-6 py-2.5 rounded-lg text-body-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'modelos'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
            Modelos de Mensagem
          </button>
        </div>

        {activeTab === 'modelos' && (
          <button
            onClick={handleOpenNewModel}
            className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-6 py-3 rounded-lg flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Novo Modelo
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-body-sm text-outline font-medium">Carregando dados da central...</p>
        </div>
      ) : activeTab === 'enviar' ? (
        /* ==================== TAB: ENVIAR MENSAGEM ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1 & 2: Form & Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recipient Selection Card */}
            <div className="bg-surface rounded-xl shadow-sm border border-outline-variant p-6 space-y-4">
              <h3 className="text-body-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">person</span>
                Selecionar Destinatário
              </h3>

              {/* Filtros Inteligentes */}
              <div className="flex flex-wrap gap-2 pt-1 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setQuickFilter('livre')
                    setSearchQuery('')
                    setSelectedRecipient(null)
                    setShowSuggestions(false)
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    quickFilter === 'livre'
                      ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                      : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">search</span>
                  Busca Livre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickFilter('atraso')
                    setSearchQuery('')
                    setSelectedRecipient(null)
                    setShowSuggestions(true)
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    quickFilter === 'atraso'
                      ? 'bg-red-50 text-red-700 border-red-200 shadow-sm'
                      : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Locatários em Atraso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickFilter('pendentes')
                    setSearchQuery('')
                    setSelectedRecipient(null)
                    setShowSuggestions(true)
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    quickFilter === 'pendentes'
                      ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm'
                      : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                  Cestas Pendentes do Mês
                </button>
              </div>
              
              <div className="relative">
                <div className="flex items-center bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                  <span className="material-symbols-outlined text-outline mr-2">search</span>
                  <input
                    type="text"
                    placeholder="Digite o nome da pessoa para buscar..."
                    className="bg-transparent border-none text-body-sm outline-none w-full text-on-surface placeholder:text-outline/70 py-0.5"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                  />
                  {(searchQuery || quickFilter !== 'livre' || selectedRecipient) && (
                    <button 
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedRecipient(null)
                        setQuickFilter('livre')
                        setSearchParams({})
                        setShowSuggestions(false)
                      }}
                      className="text-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  )}
                </div>

                {/* Suggestions List Dropdown */}
                {showSuggestions && (searchQuery.trim().length > 0 || quickFilter !== 'livre') && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant rounded-xl shadow-lg z-25 max-h-60 overflow-y-auto">
                      {filteredSuggestions.length === 0 ? (
                        <div className="p-4 text-center text-body-sm text-outline">
                          Nenhum destinatário encontrado
                        </div>
                      ) : (
                        <div className="py-2">
                          {filteredSuggestions.map((item) => {
                            const isWhatsAppOk = item.whatsapp || item.telefone
                            return (
                              <button
                                key={`${item.tipo}-${item.id}`}
                                onClick={() => {
                                  setSelectedRecipient(item)
                                  setSearchQuery(item.nome)
                                  setShowSuggestions(false)
                                  setSearchParams({ recipientId: item.id, recipientType: item.tipo })
                                }}
                                className="w-full px-4 py-2.5 hover:bg-surface-container flex items-center justify-between text-left transition-colors"
                              >
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-body-sm font-semibold text-on-surface truncate">{item.nome}</span>
                                    <span className="text-[10px] bg-surface-container-high text-on-surface-variant font-medium px-2 py-0.5 rounded-full uppercase shrink-0">
                                      {item.tipo}
                                    </span>
                                  </div>
                                  <span className="text-xs text-outline block mt-0.5">
                                    {isWhatsAppOk ? `WhatsApp: ${item.whatsapp || item.telefone}` : 'Sem WhatsApp cadastrado'}
                                  </span>
                                </div>
                                {!isWhatsAppOk && (
                                  <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase shrink-0 font-semibold">
                                    Inativo
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Alerta de Contato Recente (24h) */}
              {selectedRecipient && recentContactWarning && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 shrink-0">warning</span>
                  <div>
                    <p className="font-semibold text-[13px] text-amber-800">Mensagem Enviada Recentemente</p>
                    <p className="mt-1">
                      Esta pessoa já recebeu um contato feito por <strong className="font-bold">{recentContactWarning.perfil?.nome || 'Usuário do Sistema'}</strong> em{' '}
                      <strong className="font-bold">
                        {new Date(recentContactWarning.enviado_em).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(recentContactWarning.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>. Evite mensagens duplicadas.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Message Editing Card */}
            <div className="bg-surface rounded-xl shadow-sm border border-outline-variant p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-surface-variant pb-4">
                <h3 className="text-body-lg font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">edit_square</span>
                  Escrever Mensagem
                </h3>
                
                {/* Toggle Editor Mode */}
                <div className="flex items-center bg-surface-container-low border border-outline-variant rounded-lg p-0.5">
                  <button
                    onClick={() => setUseModel(true)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      useModel 
                        ? 'bg-surface text-primary shadow-sm font-bold' 
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Usar Modelo
                  </button>
                  <button
                    onClick={() => setUseModel(false)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      !useModel 
                        ? 'bg-surface text-primary shadow-sm font-bold' 
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {useModel && (
                <div className="space-y-2">
                  <label className="text-label-sm text-outline-variant block font-semibold">Escolher Modelo de Mensagem</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none shadow-sm transition-all"
                  >
                    <option value="">-- Selecione um Modelo --</option>
                    {modelos.map(m => (
                      <option key={m.id} value={m.id}>{m.titulo} ({m.categoria})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Textarea */}
              <div className="space-y-2">
                <label className="text-label-sm text-outline-variant block font-semibold">Texto da Mensagem</label>
                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escreva sua mensagem aqui. Use variáveis clicando nos botões abaixo."
                  rows={6}
                  className="w-full border border-outline-variant rounded-xl px-4 py-3 bg-surface text-body-md focus:border-primary focus:ring-0 outline-none shadow-sm transition-all resize-none"
                />
              </div>

              {/* Variables Insertion Panel */}
              <div className="space-y-2">
                <span className="text-[11px] text-outline font-semibold uppercase tracking-wider block">Inserir Variável no Cursor:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('nome')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                    title="Nome do destinatário"
                  >
                    <span className="material-symbols-outlined text-[14px]">badge</span>
                    {'{nome}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('mes')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                    title="Mês corrente"
                  >
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {'{mes}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('instituicao')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                    title="Nome da instituição"
                  >
                    <span className="material-symbols-outlined text-[14px]">church</span>
                    {'{instituicao}'}
                  </button>
                  {(!selectedRecipient || selectedRecipient.tipo === 'Locatário') && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('valor')}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                        title="Valor do contrato"
                      >
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        {'{valor}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('vencimento')}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                        title="Dia do vencimento"
                      >
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {'{vencimento}'}
                      </button>
                    </>
                  )}
                  {(!selectedRecipient || selectedRecipient.tipo === 'Cesta Básica') && (
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('ultima_entrega')}
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                      title="Data da última entrega de cesta"
                    >
                      <span className="material-symbols-outlined text-[14px]">history</span>
                      {'{ultima_entrega}'}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-surface-variant flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  disabled={!selectedRecipient || !(selectedRecipient.whatsapp || selectedRecipient.telefone) || !messageText.trim()}
                  className="flex-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 px-6 rounded-lg font-semibold text-body-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined">chat</span>
                  Abrir no WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!selectedRecipient || !(selectedRecipient.whatsapp || selectedRecipient.telefone) || !messageText.trim()}
                  className="px-6 py-3.5 border border-outline text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-body-md transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  Copiar Link
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Live Preview & Contact Card */}
          <div className="space-y-6">
            {/* Selected Recipient Card */}
            <div className="bg-surface rounded-xl shadow-sm border border-outline-variant p-6 space-y-4">
              <h3 className="text-body-md font-bold text-outline-variant uppercase tracking-wider">
                Dados do Destinatário
              </h3>
              
              {selectedRecipient ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-body-lg">
                      {selectedRecipient.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-body-sm text-on-surface leading-tight">
                        {selectedRecipient.nome}
                      </h4>
                      <span className="text-[11px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase inline-block mt-1">
                        {selectedRecipient.tipo}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-surface-variant pt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-outline">Telefone:</span>
                      <span className="font-medium text-on-surface">{selectedRecipient.telefone || '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-outline">WhatsApp:</span>
                      {selectedRecipient.whatsapp ? (
                        <span className="font-semibold text-green-600 flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          {selectedRecipient.whatsapp}
                        </span>
                      ) : (
                        <span className="font-medium text-red-500">Não cadastrado</span>
                      )}
                    </div>
                    {selectedRecipient.tipo === 'Locatário' && selectedRecipient.valor_aluguel && (
                      <div className="flex justify-between">
                        <span className="text-outline">Valor Contrato:</span>
                        <span className="font-semibold text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedRecipient.valor_aluguel)}
                        </span>
                      </div>
                    )}
                    {selectedRecipient.tipo === 'Cesta Básica' && (
                      <div className="flex justify-between">
                        <span className="text-outline">Última Entrega:</span>
                        <span className="font-semibold text-primary">
                          {lastDeliveryDate 
                            ? new Date(lastDeliveryDate).toLocaleDateString('pt-BR') 
                            : 'Sem registro'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Histórico de Contato Badge */}
                  {lastContact ? (
                    <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs space-y-1">
                      <div className="text-primary font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">history</span>
                        Histórico de Contato
                      </div>
                      <div className="text-on-surface">
                        Último contato: <span className="font-semibold">{new Date(lastContact.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span> às <span className="font-semibold">{new Date(lastContact.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-outline text-[10px]">
                        Por: {lastContact.perfil?.nome || 'Usuário do Sistema'}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-surface-container rounded-xl border border-outline-variant/40 text-xs text-outline italic text-center">
                      Sem histórico de contato recente.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-[36px] text-outline/50 block">contact_page</span>
                  <p className="text-xs text-outline mt-2">Nenhum destinatário selecionado ainda</p>
                </div>
              )}
            </div>

            {/* Live Message Preview Card */}
            <div className="bg-surface rounded-xl shadow-sm border border-outline-variant p-6 space-y-4">
              <h3 className="text-body-md font-bold text-outline-variant uppercase tracking-wider">
                Visualização Real
              </h3>
              
              <div className="bg-[#efeae2] rounded-xl p-4 border border-[#e1dbd2] flex flex-col h-64 overflow-y-auto shadow-inner relative justify-between">
                {/* Simulated WhatsApp bubble */}
                <div className="self-end bg-[#d9fdd3] text-on-surface max-w-[85%] rounded-lg p-3 text-xs leading-normal shadow-sm border border-[#c1e8ba] relative after:content-[''] after:absolute after:top-0 after:-right-2 after:border-[8px] after:border-transparent after:border-l-[#d9fdd3] after:border-t-[#d9fdd3]">
                  {messageText.trim() ? (
                    <p className="whitespace-pre-wrap">{getReplacedMessage(messageText, selectedRecipient)}</p>
                  ) : (
                    <p className="text-outline italic">Sua mensagem aparecerá aqui...</p>
                  )}
                  <span className="text-[9px] text-[#667781] block text-right mt-1.5">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-[10px] text-outline text-center mt-4">
                  * As variáveis dinâmicas são convertidas em tempo real.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== TAB: MODELOS DE MENSAGEM ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modelos.length === 0 ? (
            <div className="col-span-full bg-surface border border-outline-variant rounded-xl p-12 text-center flex flex-col items-center justify-center gap-4">
              <span className="material-symbols-outlined text-[48px] text-outline/50">chat_bubble_outline</span>
              <div>
                <h4 className="text-body-sm font-bold text-on-surface">Nenhum modelo cadastrado</h4>
                <p className="text-xs text-outline mt-1">Crie seu primeiro modelo de mensagem rápida no botão do topo.</p>
              </div>
            </div>
          ) : (
            modelos.map((item) => (
              <div 
                key={item.id}
                className="bg-surface border border-outline-variant rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-body-sm text-on-surface truncate pr-2">
                      {item.titulo}
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border shrink-0 ${getCategoryColor(item.categoria)}`}>
                      {item.categoria}
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">
                    {item.texto}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/60 rounded-b-xl flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleUseModelFromList(item)}
                    className="text-xs font-semibold text-primary hover:text-primary-container hover:bg-primary/5 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Usar
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModel(item)}
                      className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    {item.sistema_padrao ? (
                      <span 
                        className="p-1.5 text-outline hover:text-on-surface rounded-lg flex items-center justify-center cursor-help"
                        title="Modelo base do sistema"
                      >
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteModel(item)}
                        className="p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ==================== LATERAL DRAWER (CREATE/EDIT) ==================== */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity"
          ></div>

          {/* Drawer Panel */}
          <div className="relative bg-surface w-full max-w-lg h-full shadow-2xl border-l border-surface-variant flex flex-col animate-in slide-in-from-right duration-250 z-10">
            {/* Header */}
            <div className="h-20 border-b border-surface-variant px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">chat_bubble</span>
                <h3 className="font-headline-md text-on-surface font-semibold text-base">
                  {editingModel ? 'Editar Modelo' : 'Novo Modelo de Mensagem'}
                </h3>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Form Scrollable Area */}
            <form onSubmit={handleSaveModel} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title Field */}
              <div className="space-y-1.5">
                <label className="text-label-sm text-outline-variant block font-semibold">Título do Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cobrança de Aluguel"
                  value={drawerTitle}
                  onChange={(e) => setDrawerTitle(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none shadow-sm transition-all"
                />
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-label-sm text-outline-variant block font-semibold">Categoria</label>
                <select
                  value={drawerCategory}
                  onChange={(e) => setDrawerCategory(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none shadow-sm transition-all"
                >
                  <option value="Financeiro">Financeiro</option>
                  <option value="Acompanhamento">Acompanhamento</option>
                  <option value="Cesta Básica">Cesta Básica</option>
                  <option value="Aluguel">Aluguel</option>
                  <option value="Geral">Geral</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Textarea message text */}
              <div className="space-y-1.5">
                <label className="text-label-sm text-outline-variant block font-semibold">Texto da Mensagem *</label>
                <textarea
                  ref={drawerTextareaRef}
                  required
                  placeholder="Digite o texto modelo. Insira variáveis abaixo."
                  rows={8}
                  value={drawerText}
                  onChange={(e) => setDrawerText(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl px-4 py-3 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none shadow-sm transition-all resize-none"
                />
              </div>

              {/* Variables Panel */}
              <div className="space-y-2">
                <span className="text-[11px] text-outline font-semibold uppercase tracking-wider block">Inserir Variável no Cursor:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('nome', true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">badge</span>
                    {'{nome}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('mes', true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {'{mes}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('instituicao', true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">church</span>
                    {'{instituicao}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('valor', true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    {'{valor}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('vencimento', true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">event</span>
                    {'{vencimento}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('ultima_entrega', true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-primary border border-outline-variant text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">history</span>
                    {'{ultima_entrega}'}
                  </button>
                </div>
              </div>

              {/* Live Preview Toggle */}
              <div className="border border-outline-variant rounded-xl p-4 bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Pré-visualização Simulação</span>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    {showPreview ? 'Ocultar' : 'Pré-visualizar'}
                  </button>
                </div>

                {showPreview && (
                  <div className="bg-[#efeae2] rounded-lg p-3 border border-[#e1dbd2] text-xs max-h-36 overflow-y-auto leading-relaxed shadow-inner">
                    <p className="whitespace-pre-wrap">
                      {getReplacedMessage(drawerText, {
                        nome: 'João da Silva',
                        tipo: 'Locatário',
                        valor_aluguel: 750.00
                      })}
                    </p>
                  </div>
                )}
              </div>
            </form>

            {/* Footer buttons */}
            <div className="h-20 border-t border-surface-variant px-6 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-5 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-semibold text-body-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSaveModel}
                className="px-5 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-lg font-semibold text-body-sm shadow-sm transition-all"
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
