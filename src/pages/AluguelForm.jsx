import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  fetchAluguelById, 
  insertAluguel, 
  updateAluguel, 
  insertPagamentoAluguel, 
  fetchEstoqueEquipamentos,
  fetchBeneficiarios 
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { mapSupabaseError } from '../lib/errorMapper'
import { maskCPF, maskPhone, validateCPF } from '../utils/masks'

const createNewItem = (preset = {}) => ({
  id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
  equipamento_id: preset.equipamento_id || '',
  nome_equipamento: preset.nome_equipamento || '',
  imovel_tipo: preset.imovel_tipo || 'Cadeira de Rodas',
  numero_serie: preset.numero_serie || '',
  descricao: preset.descricao || '',
  quantidade: preset.quantidade !== undefined ? preset.quantidade : 1,
  valor_unitario: preset.valor_unitario !== undefined ? preset.valor_unitario : 0
})

export const AluguelForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useFeedback()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cpfError, setCpfError] = useState(false)

  // Multi-item state
  const [itens, setItens] = useState([createNewItem()])

  // Form states
  const [formData, setFormData] = useState({
    locatario_nome: '', locatario_cpf: '',
    locatario_telefone: '', locatario_whatsapp: '', locatario_email: '',
    imovel_endereco: '', imovel_tipo: 'Cadeira de Rodas', imovel_descricao: '',
    valor_aluguel: '0', data_inicio: new Date().toISOString().split('T')[0], data_fim: '',
    dia_vencimento: '1', forma_pagamento: 'Doação',
    clausulas_especiais: '', observacoes: '', status: 'Ativo',
    equipamento_id: ''
  })

  // Stock and Beneficiaries
  const [equipamentos, setEquipamentos] = useState([])
  const [beneficiariosList, setBeneficiariosList] = useState([])
  const [selectedBeneficiarioId, setSelectedBeneficiarioId] = useState('')

  // Payment/Contribution log states
  const [pagamentos, setPagamentos] = useState([])
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payFormData, setPayFormData] = useState({
    mes_referencia: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    valor_pago: '',
    forma_pagamento: '',
    status: 'Pago'
  })

  // Receipt visual state
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null)

  const loadInitialData = async () => {
    try {
      const [stockData, benefsData] = await Promise.all([
        fetchEstoqueEquipamentos().catch(() => []),
        fetchBeneficiarios().catch(() => [])
      ])
      setEquipamentos(stockData || [])
      setBeneficiariosList(benefsData || [])
    } catch (err) {
      console.error('Error loading aux data:', err)
    }
  }

  const loadContractDetails = async () => {
    setLoading(true)
    try {
      const data = await fetchAluguelById(id)
      setFormData({
        locatario_nome: data.locatario_nome || '',
        locatario_cpf: data.locatario_cpf || '',
        locatario_telefone: data.locatario_telefone || '',
        locatario_whatsapp: data.locatario_whatsapp || '',
        locatario_email: data.locatario_email || '',
        imovel_endereco: data.imovel_endereco || '',
        imovel_tipo: data.imovel_tipo || 'Cadeira de Rodas',
        imovel_descricao: data.imovel_descricao || '',
        valor_aluguel: data.valor_aluguel !== undefined && data.valor_aluguel !== null ? data.valor_aluguel.toString() : '0',
        data_inicio: data.data_inicio || '',
        data_fim: data.data_fim || '',
        dia_vencimento: data.dia_vencimento ? data.dia_vencimento.toString() : '1',
        forma_pagamento: data.forma_pagamento || 'Doação',
        clausulas_especiais: data.clausulas_especiais || '',
        observacoes: data.observacoes || '',
        status: data.status || 'Ativo',
        equipamento_id: data.equipamento_id || ''
      })

      // Load items
      if (Array.isArray(data.itens) && data.itens.length > 0) {
        setItens(data.itens.map(it => ({
          ...it,
          id: it.id || 'item-' + Math.random().toString(36).substring(2, 7),
          quantidade: it.quantidade || 1,
          valor_unitario: it.valor_unitario !== undefined ? it.valor_unitario : 0
        })))
      } else {
        // Fallback for single item
        setItens([createNewItem({
          equipamento_id: data.equipamento_id || '',
          nome_equipamento: data.imovel_endereco || '',
          imovel_tipo: data.imovel_tipo || 'Cadeira de Rodas',
          descricao: data.imovel_descricao || '',
          quantidade: 1,
          valor_unitario: data.valor_aluguel || 0
        })])
      }

      const activePayments = (data.financeiro || [])
        .filter(f => f.deletado_em === null)
        .map(f => ({
          id: f.id,
          mes_referencia: f.mes_referencia,
          data_pagamento: f.data,
          valor_pago: f.valor,
          status: 'Pago'
        }))
      setPagamentos(activePayments)
    } catch (err) {
      showToast('Erro ao carregar detalhes', err.message, 'error')
      navigate('/aluguel')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
    if (isEdit) {
      loadContractDetails()
    }
  }, [id])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value

    if (name === 'locatario_cpf') {
      formattedValue = maskCPF(value)
    } else if (name === 'locatario_telefone' || name === 'locatario_whatsapp') {
      formattedValue = maskPhone(value)
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }))
  }

  const handleCpfBlur = () => {
    if (formData.locatario_cpf) {
      const isValid = validateCPF(formData.locatario_cpf)
      setCpfError(!isValid)
    } else {
      setCpfError(false)
    }
  }

  // Beneficiary quick-fill
  const handleSelectBeneficiario = (e) => {
    const bId = e.target.value
    setSelectedBeneficiarioId(bId)
    if (!bId) return

    const b = beneficiariosList.find(item => item.id === bId)
    if (b) {
      setFormData(prev => ({
        ...prev,
        locatario_nome: b.nome || prev.locatario_nome,
        locatario_cpf: b.cpf ? maskCPF(b.cpf) : prev.locatario_cpf,
        locatario_telefone: b.telefone ? maskPhone(b.telefone) : prev.locatario_telefone,
        locatario_whatsapp: b.whatsapp ? maskPhone(b.whatsapp) : (b.telefone ? maskPhone(b.telefone) : prev.locatario_whatsapp),
        locatario_email: b.email || prev.locatario_email
      }))
      showToast('Dados preenchidos', `Dados de ${b.nome} carregados com sucesso!`, 'success')
    }
  }

  // Multi-item management handlers
  const handleAddItem = () => {
    setItens(prev => [...prev, createNewItem()])
  }

  const handleRemoveItem = (index) => {
    if (itens.length <= 1) {
      showToast('Aviso', 'A ficha deve conter no mínimo 1 item.', 'info')
      return
    }
    const updated = itens.filter((_, i) => i !== index)
    setItens(updated)
    
    // Recalculate total
    const newTotal = updated.reduce((sum, it) => sum + ((parseFloat(it.valor_unitario) || 0) * (parseInt(it.quantidade) || 1)), 0)
    setFormData(prev => ({ ...prev, valor_aluguel: newTotal.toString() }))
  }

  const handleItemChange = (index, field, value) => {
    setItens(prev => {
      const updated = [...prev]
      const current = { ...updated[index] }

      if (field === 'equipamento_id') {
        current.equipamento_id = value
        if (value === 'custom') {
          current.equipamento_id = ''
          current.nome_equipamento = ''
          current.numero_serie = ''
        } else {
          const selected = equipamentos.find(eq => eq.id === value)
          if (selected) {
            current.nome_equipamento = selected.nome_equipamento
            current.numero_serie = selected.numero_serie || ''
            
            // Auto detect item type
            const nameLower = selected.nome_equipamento.toLowerCase()
            if (nameLower.includes('cadeira') && nameLower.includes('roda')) current.imovel_tipo = 'Cadeira de Rodas'
            else if (nameLower.includes('muleta')) current.imovel_tipo = 'Muletas'
            else if (nameLower.includes('andador')) current.imovel_tipo = 'Andador'
            else if (nameLower.includes('cama')) current.imovel_tipo = 'Cama Hospitalar'
            else if (nameLower.includes('mesa') || nameLower.includes('cadeira')) current.imovel_tipo = 'Cadeiras / Mesas'
            else if (nameLower.includes('som') || nameLower.includes('ilumina')) current.imovel_tipo = 'Som / Iluminação'
          }
        }
      } else if (field === 'quantidade') {
        current.quantidade = Math.max(1, parseInt(value) || 1)
      } else if (field === 'valor_unitario') {
        current.valor_unitario = value
      } else {
        current[field] = value
      }

      updated[index] = current

      // Update total price automatically
      const newTotal = updated.reduce((sum, it) => sum + ((parseFloat(it.valor_unitario) || 0) * (parseInt(it.quantidade) || 1)), 0)
      setFormData(f => ({ ...f, valor_aluguel: newTotal.toString() }))

      return updated
    })
  }

  const handleQuantityStep = (index, delta) => {
    const currentQty = parseInt(itens[index].quantidade) || 1
    const newQty = Math.max(1, currentQty + delta)
    handleItemChange(index, 'quantidade', newQty)
  }

  // Calculated totals
  const totalItensCount = useMemo(() => {
    return itens.reduce((sum, it) => sum + (parseInt(it.quantidade) || 1), 0)
  }, [itens])

  const totalCalculado = useMemo(() => {
    return itens.reduce((sum, it) => sum + ((parseFloat(it.valor_unitario) || 0) * (parseInt(it.quantidade) || 1)), 0)
  }, [itens])

  // Estimated duration calculation
  const durationDays = useMemo(() => {
    if (!formData.data_inicio || !formData.data_fim) return null
    const d1 = new Date(formData.data_inicio)
    const d2 = new Date(formData.data_fim)
    const diffTime = d2.getTime() - d1.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 0 ? diffDays : null
  }, [formData.data_inicio, formData.data_fim])

  const handleSave = async (e) => {
    e.preventDefault()

    // Validations
    const missing = []
    if (!formData.locatario_nome.trim()) missing.push('Nome do Locatário / Beneficiário')
    
    // Check if all items have a name or stock item selected
    const invalidItems = itens.some(it => !it.nome_equipamento?.trim() && !it.equipamento_id)
    if (invalidItems) {
      missing.push('Informe o nome ou selecione todos os equipamentos adicionados')
    }

    if (missing.length > 0) {
      showToast('Campos obrigatórios ausentes', `Preencha: ${missing.join(', ')}`, 'error')
      return
    }

    if (formData.locatario_cpf && !validateCPF(formData.locatario_cpf)) {
      showToast('CPF Inválido', 'Por favor, confira os números do CPF.', 'error')
      setCpfError(true)
      return
    }

    setSaving(true)
    try {
      // Build summary title of items (e.g., "2x Cadeira de Rodas, 1x Andador")
      const summaryEndereco = itens
        .map(it => `${it.quantidade > 1 ? `${it.quantidade}x ` : ''}${it.nome_equipamento || 'Equipamento'}`)
        .join(', ')

      const primaryTipo = itens.length === 1 ? itens[0].imovel_tipo : 'Múltiplos Itens'
      
      const summaryDescricao = itens
        .map(it => {
          const parts = [`${it.quantidade}x ${it.nome_equipamento || 'Item'}`]
          if (it.numero_serie) parts.push(`S/N: ${it.numero_serie}`)
          if (it.descricao) parts.push(`(${it.descricao})`)
          return parts.join(' - ')
        })
        .join('; ')

      const payload = {
        ...formData,
        imovel_endereco: summaryEndereco,
        imovel_tipo: primaryTipo,
        imovel_descricao: summaryDescricao || formData.imovel_descricao,
        equipamento_id: itens[0]?.equipamento_id || null,
        valor_aluguel: parseFloat(formData.valor_aluguel || totalCalculado || '0'),
        dia_vencimento: parseInt(formData.dia_vencimento || '1'),
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null,
        itens: itens
      }

      if (isEdit) {
        await updateAluguel(id, payload)
        showToast('Sucesso', 'Registro atualizado com sucesso!')
      } else {
        await insertAluguel(payload)
        showToast('Sucesso', 'Empréstimo/aluguel criado com sucesso!')
      }
      navigate('/aluguel')
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Payment register handler
  const handleLogPayment = async (e) => {
    e.preventDefault()
    if (!payFormData.mes_referencia || !payFormData.valor_pago) {
      showToast('Campos ausentes', 'Preencha a descrição/mês de referência e o valor.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        aluguel_id: id,
        mes_referencia: payFormData.mes_referencia,
        data_pagamento: payFormData.data_pagamento || null,
        valor_pago: parseFloat(payFormData.valor_pago),
        forma_pagamento: payFormData.forma_pagamento || formData.forma_pagamento || 'PIX',
        status: payFormData.status
      }

      await insertPagamentoAluguel(payload)
      showToast('Sucesso', 'Pagamento/Contribuição registrado com sucesso!')
      setPayModalOpen(false)
      setPayFormData({
        mes_referencia: '',
        data_pagamento: new Date().toISOString().split('T')[0],
        valor_pago: '',
        forma_pagamento: '',
        status: 'Pago'
      })
      loadContractDetails()
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
    }).format(val || 0)
  }

  // Simple number to text spelling out in Portuguese
  const numberToWords = (num) => {
    if (!num) return ''
    const integerPart = Math.floor(num)
    
    const spell = (n) => {
      const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
      const tens = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
      const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
      const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
      
      if (n === 0) return 'zero'
      if (n === 100) return 'cem'
      
      let out = []
      if (n >= 1000) {
        const thousands = Math.floor(n / 1000)
        out.push(thousands === 1 ? 'mil' : `${spell(thousands)} mil`)
        n = n % 1000
      }
      if (n >= 100) {
        out.push(hundreds[Math.floor(n / 100)])
        n = n % 100
      }
      if (n >= 20) {
        out.push(tens[Math.floor(n / 10)])
        n = n % 10
      } else if (n >= 10) {
        out.push(teens[n - 10])
        n = 0
      }
      if (n > 0) {
        out.push(units[n])
      }
      return out.filter(x => x).join(' e ')
    }

    const valueWords = spell(integerPart)
    return `${valueWords} reais`.toUpperCase()
  }

  const handleOpenReceipt = (payment) => {
    setSelectedReceiptPayment(payment)
    setReceiptOpen(true)
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant pb-6 gap-4">
        <div>
          <nav className="flex items-center text-on-surface-variant font-label-sm text-label-sm mb-1 space-x-2">
            <Link to="/aluguel" className="hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Empréstimos & Aluguéis
            </Link>
            <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <span className="text-primary font-bold">{isEdit ? 'Editar Empréstimo' : 'Novo Registro'}</span>
          </nav>
          <h2 className="font-display-lg text-2xl md:text-3xl text-primary font-bold tracking-tight">
            {isEdit ? 'Ficha de Empréstimo / Aluguel' : 'Novo Empréstimo de Equipamentos'}
          </h2>
          <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
            Cadastre os itens emprestados, o beneficiário responsável e as condições de devolução.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/aluguel"
            className="px-4 py-2.5 border border-outline-variant text-on-surface hover:bg-surface-container rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm"
          >
            Cancelar
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{isEdit ? 'Salvar Alterações' : 'Concluir Empréstimo'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-on-surface-variant">Carregando dados da ficha...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Main Form Area */}
          <form onSubmit={handleSave} className="lg:col-span-8 space-y-8">
            
            {/* ======================================================== */}
            {/* SEÇÃO 1: MULTI-EQUIPAMENTOS / ITENS */}
            {/* ======================================================== */}
            <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 md:p-8 space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant/80 pb-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">medical_services</span>
                  </div>
                  <div>
                    <h3 className="text-primary font-bold text-lg">1. Equipamentos & Objetos</h3>
                    <p className="text-xs text-on-surface-variant">
                      Adicione um ou mais equipamentos do estoque para este mesmo locatário.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                    {itens.length} {itens.length === 1 ? 'item selecionado' : 'itens selecionados'}
                  </span>
                </div>
              </div>

              {/* Lista de Itens */}
              <div className="space-y-4">
                {itens.map((item, index) => {
                  const selectedStock = equipamentos.find(e => e.id === item.equipamento_id)
                  const subtotalItem = (parseFloat(item.valor_unitario) || 0) * (parseInt(item.quantidade) || 1)

                  return (
                    <div 
                      key={item.id || index}
                      className="rounded-2xl border border-outline-variant/70 bg-gradient-to-b from-surface-container-lowest to-surface-container-low/30 p-5 md:p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 space-y-4 relative"
                    >
                      {/* Item Top Header */}
                      <div className="flex justify-between items-center border-b border-surface-variant/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center justify-center shadow-xs">
                            {index + 1}
                          </span>
                          <span className="text-xs md:text-sm font-bold text-on-surface">
                            {item.nome_equipamento || `Equipamento #${index + 1}`}
                          </span>
                          {selectedStock && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                              selectedStock.quantidade_disponivel > 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              Disp: {selectedStock.quantidade_disponivel} un
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-primary">
                            Subtotal: {formatCurrency(subtotalItem)}
                          </span>

                          {itens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                              title="Remover item"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Item Inputs Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        
                        {/* Equipamento / Estoque */}
                        <div className="md:col-span-6 space-y-1">
                          <label className="block text-xs font-bold text-on-surface">
                            Equipamento / Objeto *
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                              inventory_2
                            </span>
                            <select
                              value={item.equipamento_id ? item.equipamento_id : (item.nome_equipamento ? 'custom' : '')}
                              onChange={(e) => handleItemChange(index, 'equipamento_id', e.target.value)}
                              className="w-full pl-9 pr-8 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            >
                              <option value="">-- Selecione um equipamento do estoque --</option>
                              {equipamentos.map(eq => (
                                <option key={eq.id} value={eq.id}>
                                  {eq.nome_equipamento} {eq.numero_serie ? `(S/N: ${eq.numero_serie})` : ''} — [Disp: {eq.quantidade_disponivel}]
                                </option>
                              ))}
                              <option value="custom">✏️ Outro (Digitar nome manualmente)</option>
                            </select>
                          </div>

                          {(!item.equipamento_id || item.equipamento_id === 'custom') && (
                            <input
                              type="text"
                              placeholder="Digite o nome do equipamento..."
                              value={item.nome_equipamento}
                              onChange={(e) => handleItemChange(index, 'nome_equipamento', e.target.value)}
                              required
                              className="w-full mt-2 px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          )}
                        </div>

                        {/* Categoria / Tipo */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-xs font-bold text-on-surface">Tipo / Categoria</label>
                          <div className="relative">
                            <select
                              value={item.imovel_tipo}
                              onChange={(e) => handleItemChange(index, 'imovel_tipo', e.target.value)}
                              className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            >
                              <option value="Cadeira de Rodas">Cadeira de Rodas</option>
                              <option value="Muletas">Muletas</option>
                              <option value="Andador">Andador</option>
                              <option value="Cama Hospitalar">Cama Hospitalar</option>
                              <option value="Cadeiras / Mesas">Cadeiras / Mesas</option>
                              <option value="Som / Iluminação">Som / Iluminação</option>
                              <option value="Outro">Outro</option>
                            </select>
                          </div>
                        </div>

                        {/* Quantidade com Stepper */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-xs font-bold text-on-surface">Quantidade *</label>
                          <div className="flex items-center border border-outline-variant rounded-xl bg-surface overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleQuantityStep(index, -1)}
                              className="px-3 py-2.5 hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center font-bold"
                            >
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.quantidade}
                              onChange={(e) => handleItemChange(index, 'quantidade', e.target.value)}
                              className="w-full text-center py-2 bg-transparent text-xs md:text-sm font-bold focus:outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityStep(index, 1)}
                              className="px-3 py-2.5 hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center font-bold"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                        </div>

                        {/* Nº de Série */}
                        <div className="md:col-span-4 space-y-1">
                          <label className="block text-xs font-bold text-on-surface">Nº de Série / Patrimônio</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                              qr_code
                            </span>
                            <input
                              type="text"
                              placeholder="Ex: SN-9281, Patr #14"
                              value={item.numero_serie}
                              onChange={(e) => handleItemChange(index, 'numero_serie', e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>
                        </div>

                        {/* Estado de Conservação */}
                        <div className="md:col-span-5 space-y-1">
                          <label className="block text-xs font-bold text-on-surface">Estado / Avarias</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                              notes
                            </span>
                            <input
                              type="text"
                              placeholder="Ex: Bom estado, com pequenos arranhões"
                              value={item.descricao}
                              onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>
                        </div>

                        {/* Valor Unitário */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-xs font-bold text-on-surface">Taxa Unitária (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline font-bold text-xs">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={item.valor_unitario}
                              onChange={(e) => handleItemChange(index, 'valor_unitario', e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Botão Adicionar Outro Item */}
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-3.5 border-2 border-dashed border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs md:text-sm rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-xs"
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Adicionar Outro Equipamento ou Objeto
              </button>

              {/* Card Resumo Financeiro e Itens */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-surface p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Resumo dos Equipamentos</span>
                    <p className="text-sm md:text-base font-bold text-on-surface">
                      {totalItensCount} {totalItensCount === 1 ? 'unidade' : 'unidades'} em {itens.length} {itens.length === 1 ? 'item' : 'itens distintos'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, valor_aluguel: '0', forma_pagamento: 'Doação' }))
                          setItens(prev => prev.map(it => ({ ...it, valor_unitario: 0 })))
                        }}
                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[13px]">volunteer_activism</span>
                        Zerar (Empréstimo Gratuito)
                      </button>
                      <span className="text-outline">•</span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, valor_aluguel: totalCalculado.toString() }))}
                        className="text-[11px] font-bold text-on-surface-variant hover:text-primary hover:underline"
                      >
                        Recalcular Soma
                      </button>
                    </div>
                  </div>
                </div>

                {/* Caixa de Valor Total */}
                <div className="bg-surface rounded-xl p-3 border border-primary/30 shadow-sm flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-on-surface-variant">Valor Total / Taxa</span>
                    <span className="text-xs text-outline font-medium">Contribuição geral</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="valor_aluguel"
                      value={formData.valor_aluguel}
                      onChange={handleInputChange}
                      placeholder="0,00"
                      className="w-32 pl-9 pr-3 py-2 bg-surface-container-lowest border border-outline-variant focus:border-primary rounded-lg text-base font-extrabold text-primary text-right outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* ======================================================== */}
            {/* SEÇÃO 2: DADOS DO LOCATÁRIO / BENEFICIÁRIO */}
            {/* ======================================================== */}
            <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 md:p-8 space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant/80 pb-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">person</span>
                  </div>
                  <div>
                    <h3 className="text-primary font-bold text-lg">2. Locatário / Beneficiário</h3>
                    <p className="text-xs text-on-surface-variant">
                      Identificação de quem está retirando os equipamentos na pastoral.
                    </p>
                  </div>
                </div>

                {/* Selecionar de Beneficiários Cadastrados */}
                {beneficiariosList.length > 0 && (
                  <div className="w-full sm:w-auto">
                    <select
                      value={selectedBeneficiarioId}
                      onChange={handleSelectBeneficiario}
                      className="w-full sm:w-64 px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold text-primary focus:border-primary outline-none"
                    >
                      <option value="">🔍 Buscar Beneficiário Cadastrado...</option>
                      {beneficiariosList.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.nome} {b.cpf ? `(${b.cpf})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Nome Completo */}
                <div className="md:col-span-7 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Nome Completo *</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      badge
                    </span>
                    <input
                      name="locatario_nome"
                      value={formData.locatario_nome}
                      onChange={handleInputChange}
                      required
                      placeholder="Nome completo de quem está retirando"
                      className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      type="text"
                    />
                  </div>
                </div>

                {/* CPF */}
                <div className="md:col-span-5 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">CPF</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      fingerprint
                    </span>
                    <input
                      name="locatario_cpf"
                      value={formData.locatario_cpf}
                      onChange={handleInputChange}
                      onBlur={handleCpfBlur}
                      placeholder="000.000.000-00"
                      className={`w-full pl-9 pr-4 py-2.5 bg-surface border rounded-xl text-xs md:text-sm font-mono focus:ring-1 outline-none transition-all ${
                        cpfError 
                          ? 'border-error bg-error-container/20 text-error focus:border-error focus:ring-error' 
                          : 'border-outline-variant focus:border-primary focus:ring-primary'
                      }`}
                      type="text"
                    />
                  </div>
                  {cpfError && (
                    <p className="text-error text-[11px] font-semibold mt-0.5">CPF inválido. Por favor, confira os números.</p>
                  )}
                </div>

                {/* Telefone / WhatsApp */}
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Telefone / WhatsApp</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      call
                    </span>
                    <input
                      name="locatario_telefone"
                      value={formData.locatario_telefone}
                      onChange={handleInputChange}
                      placeholder="(00) 00000-0000"
                      className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      type="text"
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">E-mail</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      mail
                    </span>
                    <input
                      name="locatario_email"
                      value={formData.locatario_email}
                      onChange={handleInputChange}
                      placeholder="nome@email.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      type="email"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* ======================================================== */}
            {/* SEÇÃO 3: CONTROLE, PRAZOS E TERMOS */}
            {/* ======================================================== */}
            <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 md:p-8 space-y-6">
              
              <div className="flex items-center gap-3 border-b border-surface-variant/80 pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                </div>
                <div>
                  <h3 className="text-primary font-bold text-lg">3. Prazos e Condições</h3>
                  <p className="text-xs text-on-surface-variant">
                    Controle de datas, forma de contribuição e termos de responsabilidade.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Data de Retirada */}
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Data de Retirada</label>
                  <div className="relative">
                    <input
                      name="data_inicio"
                      type="date"
                      value={formData.data_inicio}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Previsão de Devolução */}
                <div className="md:col-span-4 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-on-surface">Previsão de Devolução</label>
                    {durationDays !== null && (
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {durationDays} dias
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      name="data_fim"
                      type="date"
                      value={formData.data_fim}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Forma de Contribuição</label>
                  <select
                    name="forma_pagamento"
                    value={formData.forma_pagamento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Doação">Doação (Gratuito)</option>
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Status */}
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Status do Empréstimo</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Ativo">Ativo (Equipamento Emprestado)</option>
                    <option value="Devolvido">Devolvido (Retornou ao Estoque)</option>
                    <option value="Atrasado">Atrasado</option>
                  </select>
                </div>

                {/* Termos de Compromisso / Observações */}
                <div className="md:col-span-12 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-on-surface">
                      Termos de Compromisso & Observações
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const standardText = 'Declaro que recebi os equipamentos em perfeito estado de funcionamento e conservação, comprometendo-me a utilizá-los adequadamente e devolvê-los na data estipulada.'
                        setFormData(prev => ({
                          ...prev,
                          clausulas_especiais: prev.clausulas_especiais ? `${prev.clausulas_especiais}\n\n${standardText}` : standardText
                        }))
                      }}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_notes</span>
                      Inserir Termo Padrão
                    </button>
                  </div>
                  <textarea
                    name="clausulas_especiais"
                    value={formData.clausulas_especiais}
                    onChange={handleInputChange}
                    placeholder="Regras de conservação, termos de empréstimo assinado, observações sobre o beneficiário..."
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all h-28 placeholder:text-outline/70 leading-relaxed"
                  />
                </div>

              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex justify-between items-center">
              <Link
                to="/aluguel"
                className="px-5 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs md:text-sm transition-all shadow-xs"
              >
                Voltar à Lista
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Concluir Empréstimo'}
              </button>
            </div>

          </form>

          {/* Side Pane: Payment History (Edit only) & Quick Infos */}
          <div className="lg:col-span-4 space-y-6">
            {isEdit ? (
              <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-surface-variant/80 pb-4">
                  <div>
                    <h3 className="font-bold text-primary text-base">Contribuições & Recibos</h3>
                    <p className="text-xs text-on-surface-variant">Lançamentos recebidos deste contrato.</p>
                  </div>
                  <button
                    onClick={() => setPayModalOpen(true)}
                    className="bg-primary text-on-primary hover:bg-primary-container px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">payments</span>
                    Registrar
                  </button>
                </div>

                <div className="overflow-hidden border border-outline-variant/80 rounded-xl bg-surface">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-surface-variant">
                      <tr>
                        <th className="px-3.5 py-2.5">Referência</th>
                        <th className="px-3.5 py-2.5 text-right">Valor</th>
                        <th className="px-3.5 py-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-variant text-xs">
                      {pagamentos.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-3xl text-outline mb-1">receipt</span>
                            <p className="font-semibold text-xs">Nenhum pagamento registrado.</p>
                            <p className="text-[11px] text-outline mt-0.5">Clique em "Registrar" para lançar uma contribuição.</p>
                          </td>
                        </tr>
                      ) : (
                        pagamentos.map(p => (
                          <tr key={p.id} className="hover:bg-secondary-container/10 transition-colors">
                            <td className="px-3.5 py-3">
                              <p className="font-bold text-on-surface">{p.mes_referencia}</p>
                              <p className="text-[10px] text-on-surface-variant">
                                {p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : 'Sem data'}
                              </p>
                            </td>
                            <td className="px-3.5 py-3 text-right font-extrabold text-primary">
                              {formatCurrency(p.valor_pago)}
                            </td>
                            <td className="px-3.5 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenReceipt(p)}
                                className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                Recibo
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-surface to-surface-container-low border border-outline-variant/80 rounded-2xl p-6 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">info</span>
                </div>
                <h4 className="text-sm font-bold text-on-surface">Histórico de Contribuições</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Assim que você salvar esta ficha de empréstimo, você poderá registrar as contribuições mensais e gerar recibos oficiais personalizados para impressão.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Registrar Contribuição */}
      {payModalOpen && (
        <div className="fixed inset-0 bg-on-background/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3 shrink-0">
              <h3 className="font-bold text-primary text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>
                Registrar Contribuição / Taxa
              </h3>
              <button onClick={() => setPayModalOpen(false)} className="p-1 text-on-surface hover:bg-surface-container rounded-lg">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleLogPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Descrição / Mês de Referência *</label>
                <input
                  type="text"
                  placeholder="Ex: Contribuição Janeiro 2026, Taxa de Manutenção"
                  required
                  value={payFormData.mes_referencia}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, mes_referencia: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs md:text-sm focus:border-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Data Pagamento</label>
                  <input
                    type="date"
                    value={payFormData.data_pagamento}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, data_pagamento: e.target.value }))}
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs md:text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Valor Pago (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payFormData.valor_pago}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, valor_pago: e.target.value }))}
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs md:text-sm font-bold text-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Status</label>
                <select
                  value={payFormData.status}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs md:text-sm"
                >
                  <option value="Pago">Recebido (Pago)</option>
                  <option value="Pendente">Pendente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Forma de Pagamento</label>
                <select
                  value={payFormData.forma_pagamento || formData.forma_pagamento || 'PIX'}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs md:text-sm"
                >
                  <option value="Doação">Doação (Gratuito)</option>
                  <option value="PIX">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="pt-4 border-t border-surface-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2.5 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container shadow-sm transition-all"
                >
                  {saving ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full screen receipt visualizer modal */}
      {receiptOpen && selectedReceiptPayment && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6 md:p-12 flex flex-col items-center animate-in fade-in duration-200">
          
          {/* Controls */}
          <div className="w-full max-w-3xl flex justify-between items-center pb-6 border-b border-slate-200 mb-8 no-print">
            <h3 className="font-bold text-slate-700 text-lg">Visualização do Recibo</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir Recibo
              </button>
              <button 
                onClick={() => setReceiptOpen(false)}
                className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Fechar
              </button>
            </div>
          </div>

          {/* Receipt template container */}
          <div className="w-full max-w-3xl bg-white border-2 border-slate-300 p-8 md:p-12 flex flex-col gap-8 shadow-sm print:border-none print:shadow-none relative rounded-xl">
            
            {/* Background seal */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
              <span className="material-symbols-outlined text-[300px]">church</span>
            </div>

            {/* Header */}
            <header className="flex justify-between items-start border-b-2 border-slate-200 pb-6 relative z-10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>church</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">SISTEMA PASTORAL</h4>
                  <p className="text-xs text-slate-500">Filantropia & Gestão Inteligente</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="font-bold text-slate-800 text-xl">RECIBO DE EMPRÉSTIMO / ALUGUEL</h2>
                <p className="text-xs text-slate-500 mt-1">Nº: {selectedReceiptPayment.id.substring(0, 8).toUpperCase()}</p>
              </div>
            </header>

            {/* Receipt body */}
            <main className="space-y-6 text-sm text-slate-800 relative z-10 leading-relaxed">
              <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-100 rounded-xl">
                <span className="font-semibold text-slate-700">VALOR RECEBIDO:</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(selectedReceiptPayment.valor_pago)}</span>
              </div>

              <p>
                Recebemos de <strong className="text-slate-900">{formData.locatario_nome}</strong>, inscrito no CPF sob o nº <strong className="text-slate-900">{formData.locatario_cpf || '---'}</strong>, a quantia supra de <strong className="text-slate-900">{numberToWords(selectedReceiptPayment.valor_pago)}</strong>, referente ao empréstimo/aluguel dos equipamentos descritos abaixo, correspondente à: <strong className="text-slate-900">{selectedReceiptPayment.mes_referencia}</strong>.
              </p>

              {/* Items Table in Receipt */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item / Equipamento</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">S/N</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5 text-right">Vlr. Unitário</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itens.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold text-slate-900">{it.nome_equipamento || 'Equipamento'}</td>
                        <td className="p-2.5 text-slate-600">{it.imovel_tipo}</td>
                        <td className="p-2.5 font-mono text-slate-500">{it.numero_serie || '---'}</td>
                        <td className="p-2.5 text-center font-bold">{it.quantidade || 1}</td>
                        <td className="p-2.5 text-right">{formatCurrency(it.valor_unitario)}</td>
                        <td className="p-2.5 text-right font-semibold">{formatCurrency((parseFloat(it.valor_unitario) || 0) * (parseInt(it.quantidade) || 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p>
                Dando plena quitação pelo valor recebido.
              </p>

              <div className="text-right text-xs text-slate-500 mt-8">
                Data de Emissão: {selectedReceiptPayment.data_pagamento ? new Date(selectedReceiptPayment.data_pagamento).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
              </div>
            </main>

            {/* Signatures block */}
            <footer className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-12 mt-12 relative z-10">
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-dashed border-slate-400 max-w-[220px] mb-2"></div>
                <span className="text-xs font-semibold text-slate-700">{formData.locatario_nome}</span>
                <span className="text-[10px] text-slate-500">Locatário / Beneficiário</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-dashed border-slate-400 max-w-[220px] mb-2"></div>
                <span className="text-xs font-semibold text-slate-700">Representante da Instituição</span>
                <span className="text-[10px] text-slate-500">Responsável</span>
              </div>
            </footer>

          </div>
        </div>
      )}

    </div>
  )
}
