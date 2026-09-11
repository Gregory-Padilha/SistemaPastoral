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
import { maskCPF, maskPhone, maskCEP, validateCPF } from '../utils/masks'
import { jsPDF } from 'jspdf'

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
    locatario_cep: '', locatario_rua: '', locatario_numero: '',
    locatario_complemento: '', locatario_bairro: '', locatario_cidade: '', locatario_estado: '',
    destinatario_tipo: 'proprio', // 'proprio' | 'outro'
    destinatario_nome: '', destinatario_cpf: '',
    destinatario_telefone: '', destinatario_parentesco: '',
    destinatario_observacoes: '',
    destinatario_cep: '', destinatario_rua: '', destinatario_numero: '',
    destinatario_complemento: '', destinatario_bairro: '', destinatario_cidade: '', destinatario_estado: '',
    imovel_endereco: '', imovel_tipo: 'Cadeira de Rodas', imovel_descricao: '',
    valor_aluguel: '0', data_inicio: new Date().toISOString().split('T')[0], data_fim: '',
    dia_vencimento: '1', forma_pagamento: 'Doação',
    clausulas_especiais: '', observacoes: '', status: 'Ativo',
    equipamento_id: '',
    valor_caucao: '0',
    caucao_pago: true,
    forma_pagamento_caucao: 'PIX',
    data_caucao: new Date().toISOString().split('T')[0],
    caucao_observacoes: ''
  })

  // Stock and Beneficiaries
  const [equipamentos, setEquipamentos] = useState([])
  const [beneficiariosList, setBeneficiariosList] = useState([])
  const [selectedBeneficiarioId, setSelectedBeneficiarioId] = useState('')
  const [selectedDestinatarioBenefId, setSelectedDestinatarioBenefId] = useState('')

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

  // Receipt visual states
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null)
  const [caucaoReceiptOpen, setCaucaoReceiptOpen] = useState(false)

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
        locatario_cep: data.locatario_cep || '',
        locatario_rua: data.locatario_rua || '',
        locatario_numero: data.locatario_numero || '',
        locatario_complemento: data.locatario_complemento || '',
        locatario_bairro: data.locatario_bairro || '',
        locatario_cidade: data.locatario_cidade || '',
        locatario_estado: data.locatario_estado || '',
        destinatario_tipo: data.destinatario_tipo || 'proprio',
        destinatario_nome: data.destinatario_nome || '',
        destinatario_cpf: data.destinatario_cpf || '',
        destinatario_telefone: data.destinatario_telefone || '',
        destinatario_parentesco: data.destinatario_parentesco || '',
        destinatario_observacoes: data.destinatario_observacoes || '',
        destinatario_cep: data.destinatario_cep || '',
        destinatario_rua: data.destinatario_rua || '',
        destinatario_numero: data.destinatario_numero || '',
        destinatario_complemento: data.destinatario_complemento || '',
        destinatario_bairro: data.destinatario_bairro || '',
        destinatario_cidade: data.destinatario_cidade || '',
        destinatario_estado: data.destinatario_estado || '',
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
        equipamento_id: data.equipamento_id || '',
        valor_caucao: data.valor_caucao !== undefined && data.valor_caucao !== null ? data.valor_caucao.toString() : '0',
        caucao_pago: data.caucao_pago !== undefined ? !!data.caucao_pago : false,
        forma_pagamento_caucao: data.forma_pagamento_caucao || data.forma_pagamento || 'PIX',
        data_caucao: data.data_caucao || data.data_inicio || new Date().toISOString().split('T')[0],
        caucao_observacoes: data.caucao_observacoes || ''
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

    if (name === 'locatario_cpf' || name === 'destinatario_cpf') {
      formattedValue = maskCPF(value)
    } else if (name === 'locatario_telefone' || name === 'locatario_whatsapp' || name === 'destinatario_telefone') {
      formattedValue = maskPhone(value)
    } else if (name === 'locatario_cep' || name === 'destinatario_cep') {
      formattedValue = maskCEP(value)
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

  // Automatic ViaCEP lookup on blur
  const handleCepBlur = async (type = 'locatario') => {
    const rawCep = type === 'locatario' ? formData.locatario_cep : formData.destinatario_cep
    const cleanCep = (rawCep || '').replace(/\D/g, '')
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            [`${type}_rua`]: data.logradouro || prev[`${type}_rua`],
            [`${type}_bairro`]: data.bairro || prev[`${type}_bairro`],
            [`${type}_cidade`]: data.localidade || prev[`${type}_cidade`],
            [`${type}_estado`]: data.uf || prev[`${type}_estado`]
          }))
          showToast('Endereço Localizado', `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`, 'success')
        }
      } catch (err) {
        console.warn('ViaCEP lookup failed:', err)
      }
    }
  }

  // Copy Locatário address to Destinatário (Paciente)
  const handleCopyLocatarioAddress = () => {
    if (!formData.locatario_rua && !formData.locatario_cep) {
      showToast('Aviso', 'Preencha primeiro o endereço do locatário/responsável.', 'info')
      return
    }
    setFormData(prev => ({
      ...prev,
      destinatario_cep: prev.locatario_cep,
      destinatario_rua: prev.locatario_rua,
      destinatario_numero: prev.locatario_numero,
      destinatario_complemento: prev.locatario_complemento,
      destinatario_bairro: prev.locatario_bairro,
      destinatario_cidade: prev.locatario_cidade,
      destinatario_estado: prev.locatario_estado
    }))
    showToast('Endereço Copiado', 'O endereço do responsável foi copiado para o paciente!', 'success')
  }

  // Beneficiary quick-fill for Locatário
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
        locatario_email: b.email || prev.locatario_email,
        locatario_cep: b.cep ? maskCEP(b.cep) : prev.locatario_cep,
        locatario_rua: b.rua || prev.locatario_rua,
        locatario_numero: b.numero || prev.locatario_numero,
        locatario_complemento: b.complemento || prev.locatario_complemento,
        locatario_bairro: b.bairro || prev.locatario_bairro,
        locatario_cidade: b.cidade || prev.locatario_cidade,
        locatario_estado: b.estado || prev.locatario_estado
      }))
      showToast('Dados preenchidos', `Dados e endereço de ${b.nome} carregados como locatário!`, 'success')
    }
  }

  // Beneficiary quick-fill for Destinatário (Paciente)
  const handleSelectDestinatarioBenef = (e) => {
    const bId = e.target.value
    setSelectedDestinatarioBenefId(bId)
    if (!bId) return

    const b = beneficiariosList.find(item => item.id === bId)
    if (b) {
      setFormData(prev => ({
        ...prev,
        destinatario_nome: b.nome || prev.destinatario_nome,
        destinatario_cpf: b.cpf ? maskCPF(b.cpf) : prev.destinatario_cpf,
        destinatario_telefone: b.telefone ? maskPhone(b.telefone) : (b.whatsapp ? maskPhone(b.whatsapp) : prev.destinatario_telefone),
        destinatario_observacoes: b.observacoes || prev.destinatario_observacoes,
        destinatario_cep: b.cep ? maskCEP(b.cep) : prev.destinatario_cep,
        destinatario_rua: b.rua || prev.destinatario_rua,
        destinatario_numero: b.numero || prev.destinatario_numero,
        destinatario_complemento: b.complemento || prev.destinatario_complemento,
        destinatario_bairro: b.bairro || prev.destinatario_bairro,
        destinatario_cidade: b.cidade || prev.destinatario_cidade,
        destinatario_estado: b.estado || prev.destinatario_estado
      }))
      showToast('Dados preenchidos', `Dados e endereço de ${b.nome} carregados para o paciente/destinatário!`, 'success')
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
            if (selected.categoria) {
              current.imovel_tipo = selected.categoria
            } else {
              const nameLower = selected.nome_equipamento.toLowerCase()
              if (nameLower.includes('cadeira') && nameLower.includes('roda')) current.imovel_tipo = 'Cadeira de Rodas'
              else if (nameLower.includes('muleta')) current.imovel_tipo = 'Muletas'
              else if (nameLower.includes('andador')) current.imovel_tipo = 'Andador'
              else if (nameLower.includes('cama')) current.imovel_tipo = 'Cama Hospitalar'
              else if (nameLower.includes('mesa') || nameLower.includes('cadeira')) current.imovel_tipo = 'Cadeiras / Mesas'
              else if (nameLower.includes('som') || nameLower.includes('ilumina')) current.imovel_tipo = 'Som / Iluminação'
            }

            // Auto fill suggested fee if available
            if (parseFloat(selected.valor_aluguel_sugerido || 0) > 0 && (!current.valor_unitario || current.valor_unitario === '0')) {
              current.valor_unitario = selected.valor_aluguel_sugerido.toString()
            }

            // Auto suggest caução if empty
            if (parseFloat(selected.valor_caucao_sugerido || 0) > 0) {
              setFormData(prev => {
                if (!prev.valor_caucao || prev.valor_caucao === '0' || prev.valor_caucao === '0.00') {
                  return { ...prev, valor_caucao: selected.valor_caucao_sugerido.toString() }
                }
                return prev
              })
            }
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
    if (!formData.locatario_nome.trim()) missing.push('Nome do Locatário / Responsável')
    if (formData.destinatario_tipo === 'outro' && !formData.destinatario_nome?.trim()) {
      missing.push('Nome do Paciente / Usuário do Equipamento')
    }
    
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
      showToast('CPF Inválido', 'Por favor, confira os números do CPF do locatário.', 'error')
      setCpfError(true)
      return
    }

    if (formData.destinatario_tipo === 'outro' && formData.destinatario_cpf && !validateCPF(formData.destinatario_cpf)) {
      showToast('CPF do Destinatário Inválido', 'Por favor, confira os números do CPF informado para o paciente/destinatário.', 'error')
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
        itens: itens,
        valor_caucao: parseFloat(formData.valor_caucao || '0'),
        caucao_pago: formData.caucao_pago,
        forma_pagamento_caucao: formData.forma_pagamento_caucao || 'PIX',
        data_caucao: formData.data_caucao || formData.data_inicio || new Date().toISOString().split('T')[0],
        caucao_observacoes: formData.caucao_observacoes || '',
        destinatario_tipo: formData.destinatario_tipo || 'proprio',
        destinatario_nome: formData.destinatario_nome || '',
        destinatario_cpf: formData.destinatario_cpf || '',
        destinatario_telefone: formData.destinatario_telefone || '',
        destinatario_parentesco: formData.destinatario_parentesco || '',
        destinatario_observacoes: formData.destinatario_observacoes || '',
        locatario_cep: formData.locatario_cep || null,
        locatario_rua: formData.locatario_rua || null,
        locatario_numero: formData.locatario_numero || null,
        locatario_complemento: formData.locatario_complemento || null,
        locatario_bairro: formData.locatario_bairro || null,
        locatario_cidade: formData.locatario_cidade || null,
        locatario_estado: formData.locatario_estado || null,
        destinatario_cep: formData.destinatario_cep || null,
        destinatario_rua: formData.destinatario_rua || null,
        destinatario_numero: formData.destinatario_numero || null,
        destinatario_complemento: formData.destinatario_complemento || null,
        destinatario_bairro: formData.destinatario_bairro || null,
        destinatario_cidade: formData.destinatario_cidade || null,
        destinatario_estado: formData.destinatario_estado || null
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

  const handleDownloadCaucaoPDF = () => {
    try {
      const doc = new jsPDF()
      const instName = 'SISTEMA PASTORAL'
      const numRecibo = (id || 'NOVO').substring(0, 8).toUpperCase()
      const valorFormatado = formatCurrency(parseFloat(formData.valor_caucao || '0'))
      const valorExtenso = numberToWords(parseFloat(formData.valor_caucao || '0'))
      const dataFormatada = formData.data_caucao ? new Date(formData.data_caucao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')

      // Amber header banner
      doc.setFillColor(180, 83, 9)
      doc.rect(0, 0, 210, 32, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(255, 255, 255)
      doc.text(instName, 14, 15)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(254, 243, 199)
      doc.text('Filantropia & Gestão Inteligente', 14, 22)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(255, 255, 255)
      doc.text('RECIBO DE CAUÇÃO DE GARANTIA', 196, 15, { align: 'right' })
      doc.setFontSize(9)
      doc.text(`Nº: CAUCAO-${numRecibo}`, 196, 23, { align: 'right' })

      // Amount Box
      doc.setFillColor(254, 243, 199)
      doc.setDrawColor(217, 119, 6)
      doc.setLineWidth(0.5)
      doc.roundedRect(14, 40, 182, 20, 2, 2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(180, 83, 9)
      doc.text('VALOR DO CAUÇÃO RECEBIDO:', 20, 48)

      doc.setFontSize(16)
      doc.text(valorFormatado, 190, 53, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`Forma de Pagamento: ${formData.forma_pagamento_caucao || 'PIX'}`, 20, 55)

      // Body text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)

      const locEnderecoPdf = formData.locatario_rua 
        ? `${formData.locatario_rua}${formData.locatario_numero ? ', nº ' + formData.locatario_numero : ''}${formData.locatario_bairro ? ' - ' + formData.locatario_bairro : ''}${formData.locatario_cidade ? ', ' + formData.locatario_cidade : ''}${formData.locatario_estado ? '/' + formData.locatario_estado : ''}` 
        : ''
      const destEnderecoPdf = formData.destinatario_rua 
        ? `${formData.destinatario_rua}${formData.destinatario_numero ? ', nº ' + formData.destinatario_numero : ''}${formData.destinatario_bairro ? ' - ' + formData.destinatario_bairro : ''}${formData.destinatario_cidade ? ', ' + formData.destinatario_cidade : ''}${formData.destinatario_estado ? '/' + formData.destinatario_estado : ''}` 
        : ''

      const destTextPdf = formData.destinatario_tipo === 'outro' && formData.destinatario_nome
        ? ` (em benefício do paciente ${formData.destinatario_nome}${formData.destinatario_parentesco ? ` - ${formData.destinatario_parentesco}` : ''}${destEnderecoPdf ? `, com endereço em: ${destEnderecoPdf}` : ''})`
        : ''

      const bodyText = `Recebemos de ${formData.locatario_nome || 'Beneficiário'}, CPF: ${formData.locatario_cpf || 'Não informado'}${locEnderecoPdf ? `, residente em ${locEnderecoPdf}` : ''}, a quantia de ${valorExtenso} (${valorFormatado}), paga via ${formData.forma_pagamento_caucao || 'PIX'}, a título de CAUÇÃO DE GARANTIA pelo empréstimo e uso dos seguintes equipamentos${destTextPdf}:`
      const splitBody = doc.splitTextToSize(bodyText, 182)
      doc.text(splitBody, 14, 68)

      let tableY = 68 + (splitBody.length * 5) + 4

      // List of items
      doc.setFillColor(245, 245, 245)
      doc.rect(14, tableY, 182, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      doc.text('Equipamento / Objeto', 18, tableY + 5)
      doc.text('S/N', 110, tableY + 5)
      doc.text('Qtd', 145, tableY + 5)
      doc.text('Estado', 165, tableY + 5)

      tableY += 8
      doc.setFont('helvetica', 'normal')
      itens.forEach((it, i) => {
        doc.text(it.nome_equipamento || 'Equipamento', 18, tableY + (i * 6))
        doc.text(it.numero_serie || '---', 110, tableY + (i * 6))
        doc.text((it.quantidade || 1).toString(), 145, tableY + (i * 6))
        doc.text(it.descricao || 'Bom', 165, tableY + (i * 6))
      })

      tableY += (itens.length * 6) + 8

      // Conditions box
      doc.setFillColor(250, 250, 250)
      doc.setDrawColor(220, 220, 220)
      doc.roundedRect(14, tableY, 182, 28, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(180, 83, 9)
      doc.text('Termos e Condições de Devolução do Caução:', 18, tableY + 6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      const terms = 'O valor do caução permanecerá sob custódia da instituição durante o empréstimo e será restituído integralmente ao beneficiário/locatário no momento da devolução dos equipamentos na sede da pastoral, desde que entregues limpos, sem avarias e em perfeito estado de funcionamento e conservação.'
      const splitTerms = doc.splitTextToSize(terms, 174)
      doc.text(splitTerms, 18, tableY + 12)

      // Signatures
      const sigY = tableY + 44
      doc.line(20, sigY, 90, sigY)
      doc.line(120, sigY, 190, sigY)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      doc.text(formData.locatario_nome || 'Locatário', 55, sigY + 5, { align: 'center' })
      doc.text('Representante da Pastoral', 155, sigY + 5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      doc.text('Locatário / Beneficiário', 55, sigY + 9, { align: 'center' })
      doc.text('Responsável pelo Recebimento', 155, sigY + 9, { align: 'center' })

      doc.save(`recibo-caucao-${formData.locatario_nome ? formData.locatario_nome.toLowerCase().replace(/\s+/g, '-') : 'locatario'}.pdf`)
      showToast('Recibo Baixado', 'O arquivo PDF do recibo de caução foi gerado!', 'success')
    } catch (err) {
      showToast('Erro ao gerar PDF', err.message, 'error')
    }
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
                        <div className="md:col-span-8 space-y-1">
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

                        {/* Quantidade com Stepper */}
                        <div className="md:col-span-4 space-y-1">
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
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-xs">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={item.valor_unitario}
                              onChange={(e) => handleItemChange(index, 'valor_unitario', e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
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

                {/* Caixa de Valor Total da Taxa */}
                <div className="bg-surface rounded-xl p-3 border border-primary/30 shadow-sm flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-on-surface-variant">Taxa de Uso / Mensal</span>
                    <span className="text-xs text-outline font-medium">Contribuição do equipamento</span>
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
            {/* SEÇÃO 2: CAUÇÃO DE GARANTIA (DEPÓSITO DE SEGURANÇA) */}
            {/* ======================================================== */}
            <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 md:p-8 space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant/80 pb-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">security</span>
                  </div>
                  <div>
                    <h3 className="text-primary font-bold text-lg">2. Caução de Garantia</h3>
                    <p className="text-xs text-on-surface-variant">
                      Depósito de garantia pago na hora do aluguel e registrado automaticamente no Caderno de Fechamento.
                    </p>
                  </div>
                </div>

                {parseFloat(formData.valor_caucao || '0') > 0 && (
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                      formData.caucao_pago 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {formData.caucao_pago ? '✓ Pago no Ato' : '⏳ Pendente'}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Valor do Caução */}
                <div className="md:col-span-5 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Valor do Caução (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700 font-bold text-sm">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="valor_caucao"
                      value={formData.valor_caucao}
                      onChange={handleInputChange}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold text-amber-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  {/* Botões rápidos de sugestão */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-outline uppercase mr-1">Sugerir:</span>
                    {['0', '50', '100', '150', '200'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, valor_caucao: val }))}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          formData.valor_caucao === val
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-low text-on-surface-variant hover:border-primary/50'
                        }`}
                      >
                        {val === '0' ? 'Isento' : `R$ ${val}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Forma de Pagamento do Caução */}
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Forma de Pagamento do Caução</label>
                  <div className="relative">
                    <select
                      name="forma_pagamento_caucao"
                      value={formData.forma_pagamento_caucao}
                      onChange={handleInputChange}
                      disabled={parseFloat(formData.valor_caucao || '0') <= 0}
                      className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50 disabled:bg-surface-container-low"
                    >
                      <option value="PIX">PIX</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Transferência Bancária">Transferência Bancária</option>
                      <option value="Cartão de Débito/Crédito">Cartão de Débito/Crédito</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                {/* Status de Quitação do Caução */}
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Quitação do Caução</label>
                  <select
                    name="caucao_pago"
                    value={formData.caucao_pago ? 'true' : 'false'}
                    onChange={(e) => setFormData(prev => ({ ...prev, caucao_pago: e.target.value === 'true' }))}
                    disabled={parseFloat(formData.valor_caucao || '0') <= 0}
                    className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50 disabled:bg-surface-container-low"
                  >
                    <option value="true">Pago no ato da retirada</option>
                    <option value="false">Pendente / A receber</option>
                  </select>
                </div>

                {/* Observações / Condições do Caução */}
                <div className="md:col-span-12 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Condições / Observações do Caução</label>
                  <input
                    type="text"
                    name="caucao_observacoes"
                    value={formData.caucao_observacoes}
                    onChange={handleInputChange}
                    placeholder="Ex: Valor a ser devolvido ao beneficiário após inspeção e devolução dos equipamentos em perfeito estado."
                    className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                  />
                </div>

                {/* Card de Informação e Total no Ato */}
                {parseFloat(formData.valor_caucao || '0') > 0 && (
                  <div className="md:col-span-12 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-surface border border-amber-500/30 p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-amber-700 text-[22px]">menu_book</span>
                        <div>
                          <p className="text-xs font-bold text-on-surface">
                            Lançamento no Caderno de Fechamento
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            Ao salvar, uma entrada de <strong className="text-amber-900 font-bold">{formatCurrency(parseFloat(formData.valor_caucao))}</strong> via <strong>{formData.forma_pagamento_caucao}</strong> será registrada no livro caixa sob a categoria <em>"Caução de Aluguel"</em>.
                          </p>
                        </div>
                      </div>

                      <div className="bg-surface rounded-xl px-4 py-2 border border-amber-500/20 shadow-xs text-right shrink-0">
                        <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Total Inicial a Receber</span>
                        <span className="text-base font-black text-primary">
                          {formatCurrency((parseFloat(formData.valor_aluguel || '0') + parseFloat(formData.valor_caucao || '0')))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ======================================================== */}
            {/* SEÇÃO 3: DADOS DO LOCATÁRIO & DESTINATÁRIO */}
            {/* ======================================================== */}
            <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 md:p-8 space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant/80 pb-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">person</span>
                  </div>
                  <div>
                    <h3 className="text-primary font-bold text-lg">3. Locatário / Responsável</h3>
                    <p className="text-xs text-on-surface-variant">
                      Identificação de quem está retirando e respondendo pelo equipamento na pastoral.
                    </p>
                  </div>
                </div>

                {/* Selecionar de Beneficiários Cadastrados para Locatário */}
                {beneficiariosList.length > 0 && (
                  <div className="w-full sm:w-auto">
                    <select
                      value={selectedBeneficiarioId}
                      onChange={handleSelectBeneficiario}
                      className="w-full sm:w-64 px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold text-primary focus:border-primary outline-none"
                    >
                      <option value="">🔍 Buscar Locatário Cadastrado...</option>
                      {beneficiariosList.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.nome} {b.cpf ? `(${b.cpf})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Campos do Locatário */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Nome Completo */}
                <div className="md:col-span-7 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Nome do Locatário / Responsável *</label>
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
                  <label className="block text-xs font-bold text-on-surface">CPF do Locatário</label>
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

                {/* ======================================================== */}
                {/* ENDEREÇO RESIDENCIAL DO LOCATÁRIO / RESPONSÁVEL */}
                {/* ======================================================== */}
                <div className="md:col-span-12 pt-3 mt-1 border-t border-surface-variant/70 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[17px]">home_pin</span>
                      Endereço do Locatário / Responsável
                    </span>
                    <span className="text-[11px] font-medium text-outline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-primary">bolt</span>
                      Preenchimento automático por CEP
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                    {/* CEP */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">CEP</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                          search
                        </span>
                        <input
                          type="text"
                          name="locatario_cep"
                          value={formData.locatario_cep}
                          onChange={handleInputChange}
                          onBlur={() => handleCepBlur('locatario')}
                          placeholder="00000-000"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                        />
                      </div>
                    </div>

                    {/* Logradouro / Rua */}
                    <div className="md:col-span-6 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">Logradouro (Rua, Avenida, Alameda)</label>
                      <input
                        type="text"
                        name="locatario_rua"
                        value={formData.locatario_rua}
                        onChange={handleInputChange}
                        placeholder="Ex: Rua das Palmeiras"
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      />
                    </div>

                    {/* Número */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">Número</label>
                      <input
                        type="text"
                        name="locatario_numero"
                        value={formData.locatario_numero}
                        onChange={handleInputChange}
                        placeholder="123 ou S/N"
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      />
                    </div>

                    {/* Complemento */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">Complemento</label>
                      <input
                        type="text"
                        name="locatario_complemento"
                        value={formData.locatario_complemento}
                        onChange={handleInputChange}
                        placeholder="Apto 12, Bloco B, Casa fundos..."
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      />
                    </div>

                    {/* Bairro */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">Bairro</label>
                      <input
                        type="text"
                        name="locatario_bairro"
                        value={formData.locatario_bairro}
                        onChange={handleInputChange}
                        placeholder="Ex: Centro"
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      />
                    </div>

                    {/* Cidade */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">Cidade</label>
                      <input
                        type="text"
                        name="locatario_cidade"
                        value={formData.locatario_cidade}
                        onChange={handleInputChange}
                        placeholder="Cidade"
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                      />
                    </div>

                    {/* Estado (UF) */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-bold text-on-surface">Estado (UF)</label>
                      <input
                        type="text"
                        maxLength="2"
                        name="locatario_estado"
                        value={formData.locatario_estado}
                        onChange={(e) => setFormData(prev => ({ ...prev, locatario_estado: e.target.value.toUpperCase() }))}
                        placeholder="UF"
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold uppercase focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-center"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* ======================================================== */}
              {/* SUB-SEÇÃO: PARA QUEM É ESTE EQUIPAMENTO */}
              {/* ======================================================== */}
              <div className="pt-5 border-t border-surface-variant/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">accessibility_new</span>
                      Destinação do Equipamento *
                    </span>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Informe se o equipamento será utilizado pela própria pessoa que está retirando ou por outra pessoa.
                    </p>
                  </div>
                </div>

                {/* Radio Cards Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Opção 1: Para ela mesma */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, destinatario_tipo: 'proprio' }))}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-start gap-3 select-none ${
                      formData.destinatario_tipo === 'proprio'
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-outline-variant/60 bg-surface hover:border-outline-variant hover:bg-surface-container-lowest'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      formData.destinatario_tipo === 'proprio'
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline text-transparent'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs md:text-sm text-on-surface">
                        <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                        <span>Para ele(a) mesmo(a)</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-tight">
                        O próprio locatário ({formData.locatario_nome ? formData.locatario_nome.split(' ')[0] : 'responsável'}) utilizará o equipamento em sua residência cadastrada.
                      </p>
                    </div>
                  </div>

                  {/* Opção 2: Para outra pessoa */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, destinatario_tipo: 'outro' }))}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-start gap-3 select-none ${
                      formData.destinatario_tipo === 'outro'
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-outline-variant/60 bg-surface hover:border-outline-variant hover:bg-surface-container-lowest'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      formData.destinatario_tipo === 'outro'
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline text-transparent'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs md:text-sm text-on-surface">
                        <span className="material-symbols-outlined text-[18px] text-primary">personal_injury</span>
                        <span>Para outra pessoa (Paciente / Terceiro)</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-tight">
                        O equipamento é para um familiar, paciente acamado, idoso, dependente ou vizinho.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Campos da Outra Pessoa (quando destinatario_tipo === 'outro') */}
                {formData.destinatario_tipo === 'outro' && (
                  <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-surface to-surface p-5 md:p-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-primary/20 pb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold">
                          <span className="material-symbols-outlined text-[18px]">personal_injury</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-primary text-sm">
                            Dados do Paciente / Usuário do Equipamento
                          </h4>
                          <p className="text-[11px] text-on-surface-variant">
                            Preencha quem vai fazer o uso real dos itens retirados e o endereço onde o equipamento ficará.
                          </p>
                        </div>
                      </div>

                      {beneficiariosList.length > 0 && (
                        <div className="w-full sm:w-auto">
                          <select
                            value={selectedDestinatarioBenefId}
                            onChange={handleSelectDestinatarioBenef}
                            className="w-full sm:w-60 px-3 py-1.5 bg-surface border border-outline-variant rounded-xl text-xs font-semibold text-primary focus:border-primary outline-none"
                          >
                            <option value="">🔍 Puxar de Beneficiários...</option>
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
                      
                      {/* Nome do Paciente/Destinatário */}
                      <div className="md:col-span-7 space-y-1">
                        <label className="block text-xs font-bold text-on-surface">
                          Nome do Paciente / Usuário do Equipamento *
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                            person_heart
                          </span>
                          <input
                            type="text"
                            name="destinatario_nome"
                            required={formData.destinatario_tipo === 'outro'}
                            value={formData.destinatario_nome}
                            onChange={handleInputChange}
                            placeholder="Ex: Maria das Dores Silva"
                            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                          />
                        </div>
                      </div>

                      {/* Grau de Parentesco / Relação */}
                      <div className="md:col-span-5 space-y-1">
                        <label className="block text-xs font-bold text-on-surface">
                          Parentesco / Relação com Locatário
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                            diversity_1
                          </span>
                          <input
                            type="text"
                            name="destinatario_parentesco"
                            value={formData.destinatario_parentesco}
                            onChange={handleInputChange}
                            placeholder="Ex: Mãe, Filho(a), Esposa, Vizinho..."
                            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                          />
                        </div>
                        {/* Quick preset chips */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {['Mãe/Pai', 'Filho(a)', 'Cônjuge', 'Irmão(ã)', 'Neto(a)', 'Vizinho(a)', 'Paciente'].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, destinatario_parentesco: chip }))}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                formData.destinatario_parentesco === chip
                                  ? 'bg-primary text-on-primary border-primary'
                                  : 'bg-surface border-outline-variant/60 text-on-surface-variant hover:border-primary/40'
                              }`}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CPF do Paciente/Destinatário */}
                      <div className="md:col-span-6 space-y-1">
                        <label className="block text-xs font-bold text-on-surface">
                          CPF do Paciente / Destinatário (Opcional)
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                            fingerprint
                          </span>
                          <input
                            type="text"
                            name="destinatario_cpf"
                            value={formData.destinatario_cpf}
                            onChange={handleInputChange}
                            placeholder="000.000.000-00"
                            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                          />
                        </div>
                      </div>

                      {/* Telefone / WhatsApp do Destinatário */}
                      <div className="md:col-span-6 space-y-1">
                        <label className="block text-xs font-bold text-on-surface">
                          Telefone / Contato do Paciente (Opcional)
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                            call
                          </span>
                          <input
                            type="text"
                            name="destinatario_telefone"
                            value={formData.destinatario_telefone}
                            onChange={handleInputChange}
                            placeholder="(00) 00000-0000"
                            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                          />
                        </div>
                      </div>

                      {/* Condição / Observações do Paciente */}
                      <div className="md:col-span-12 space-y-1">
                        <label className="block text-xs font-bold text-on-surface">
                          Condição de Saúde / Motivo do Uso (Opcional)
                        </label>
                        <input
                          type="text"
                          name="destinatario_observacoes"
                          value={formData.destinatario_observacoes}
                          onChange={handleInputChange}
                          placeholder="Ex: Paciente acamado, pós-operatório de fêmur, em reabilitação motora..."
                          className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                        />
                      </div>

                      {/* ======================================================== */}
                      {/* ENDEREÇO DO PACIENTE / LOCAL DE USO DO EQUIPAMENTO */}
                      {/* ======================================================== */}
                      <div className="md:col-span-12 pt-3 border-t border-primary/20 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                              <span className="material-symbols-outlined text-[17px]">location_on</span>
                              Endereço do Paciente / Local onde ficará o equipamento
                            </span>
                            <p className="text-[11px] text-on-surface-variant">
                              Informe onde o paciente reside ou onde o equipamento será mantido durante o uso.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleCopyLocatarioAddress}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 shrink-0"
                            title="Copiar os dados de endereço preenchidos no locatário acima"
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                            Mesmo Endereço do Responsável
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                          {/* CEP Destinatário */}
                          <div className="md:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">CEP</label>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                                search
                              </span>
                              <input
                                type="text"
                                name="destinatario_cep"
                                value={formData.destinatario_cep}
                                onChange={handleInputChange}
                                onBlur={() => handleCepBlur('destinatario')}
                                placeholder="00000-000"
                                className="w-full pl-9 pr-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                              />
                            </div>
                          </div>

                          {/* Logradouro / Rua Destinatário */}
                          <div className="md:col-span-6 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">Logradouro (Rua, Avenida)</label>
                            <input
                              type="text"
                              name="destinatario_rua"
                              value={formData.destinatario_rua}
                              onChange={handleInputChange}
                              placeholder="Ex: Rua São José"
                              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>

                          {/* Número Destinatário */}
                          <div className="md:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">Número</label>
                            <input
                              type="text"
                              name="destinatario_numero"
                              value={formData.destinatario_numero}
                              onChange={handleInputChange}
                              placeholder="123 ou S/N"
                              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>

                          {/* Complemento Destinatário */}
                          <div className="md:col-span-4 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">Complemento</label>
                            <input
                              type="text"
                              name="destinatario_complemento"
                              value={formData.destinatario_complemento}
                              onChange={handleInputChange}
                              placeholder="Apto, Casa 2, Quarto..."
                              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>

                          {/* Bairro Destinatário */}
                          <div className="md:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">Bairro</label>
                            <input
                              type="text"
                              name="destinatario_bairro"
                              value={formData.destinatario_bairro}
                              onChange={handleInputChange}
                              placeholder="Bairro"
                              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>

                          {/* Cidade Destinatário */}
                          <div className="md:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">Cidade</label>
                            <input
                              type="text"
                              name="destinatario_cidade"
                              value={formData.destinatario_cidade}
                              onChange={handleInputChange}
                              placeholder="Cidade"
                              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/70"
                            />
                          </div>

                          {/* Estado Destinatário */}
                          <div className="md:col-span-2 space-y-1">
                            <label className="block text-xs font-bold text-on-surface">Estado (UF)</label>
                            <input
                              type="text"
                              maxLength="2"
                              name="destinatario_estado"
                              value={formData.destinatario_estado}
                              onChange={(e) => setFormData(prev => ({ ...prev, destinatario_estado: e.target.value.toUpperCase() }))}
                              placeholder="UF"
                              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold uppercase focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-center"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SEÇÃO 4: CONTROLE, PRAZOS E TERMOS */}
            {/* ======================================================== */}
            <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 md:p-8 space-y-6">
              
              <div className="flex items-center gap-3 border-b border-surface-variant/80 pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                </div>
                <div>
                  <h3 className="text-primary font-bold text-lg">4. Prazos e Condições</h3>
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
                  <label className="block text-xs font-bold text-on-surface">Forma de Contribuição Mensal</label>
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
            
            {/* Bloco de Caução no Painel Lateral (quando há caução ou em edição) */}
            {parseFloat(formData.valor_caucao || '0') > 0 && (
              <div className="bg-surface rounded-2xl border border-amber-500/30 shadow-sm p-6 space-y-4 bg-gradient-to-b from-amber-500/5 to-surface">
                <div className="flex justify-between items-start border-b border-surface-variant/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-[20px]">security</span>
                    <div>
                      <h4 className="font-bold text-on-surface text-sm">Caução de Garantia</h4>
                      <p className="text-[11px] text-on-surface-variant">Depósito de segurança</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                    formData.caucao_pago 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {formData.caucao_pago ? 'Pago no Ato' : 'Pendente'}
                  </span>
                </div>

                <div className="flex justify-between items-baseline bg-surface-container-low/60 rounded-xl p-3 border border-outline-variant/60">
                  <span className="text-xs font-semibold text-on-surface-variant">Valor do Caução:</span>
                  <span className="text-lg font-black text-amber-800">
                    {formatCurrency(parseFloat(formData.valor_caucao))}
                  </span>
                </div>

                <div className="text-xs text-on-surface-variant space-y-1 font-medium">
                  <div className="flex justify-between">
                    <span>Forma:</span>
                    <span className="font-bold text-on-surface">{formData.forma_pagamento_caucao}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Caderno de Fechamento:</span>
                    <span className="font-bold text-emerald-700">✓ Sincronizado</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCaucaoReceiptOpen(true)}
                  className="w-full py-2.5 px-4 bg-amber-600/10 hover:bg-amber-600/20 text-amber-800 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-amber-600/30 shadow-xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  Emitir Recibo de Caução
                </button>
              </div>
            )}

            {isEdit ? (
              <div className="bg-surface rounded-2xl border border-outline-variant/80 shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-surface-variant/80 pb-4">
                  <div>
                    <h3 className="font-bold text-primary text-base">Contribuições & Recibos</h3>
                    <p className="text-xs text-on-surface-variant">Mensalidades deste contrato.</p>
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
                            <p className="font-semibold text-xs">Nenhum pagamento mensal registrado.</p>
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

      {/* Modal: Registrar Contribuição Mensal */}
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

      {/* Full screen monthly payment receipt visualizer modal */}
      {receiptOpen && selectedReceiptPayment && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6 md:p-12 flex flex-col items-center animate-in fade-in duration-200">
          
          {/* Controls */}
          <div className="w-full max-w-3xl flex justify-between items-center pb-6 border-b border-slate-200 mb-8 no-print">
            <h3 className="font-bold text-slate-700 text-lg">Visualização do Recibo de Mensalidade</h3>
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
                <p className="text-xs text-slate-500 mt-1">Nº: {selectedReceiptPayment.id?.substring(0, 8).toUpperCase()}</p>
              </div>
            </header>

            {/* Receipt body */}
            <main className="space-y-6 text-sm text-slate-800 relative z-10 leading-relaxed">
              <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-100 rounded-xl">
                <span className="font-semibold text-slate-700">VALOR RECEBIDO:</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(selectedReceiptPayment.valor_pago)}</span>
              </div>

              {(() => {
                const locEndereco = formData.locatario_rua 
                  ? `${formData.locatario_rua}${formData.locatario_numero ? ', nº ' + formData.locatario_numero : ''}${formData.locatario_bairro ? ' - ' + formData.locatario_bairro : ''}${formData.locatario_cidade ? ', ' + formData.locatario_cidade : ''}${formData.locatario_estado ? '/' + formData.locatario_estado : ''}` 
                  : ''
                const destEndereco = formData.destinatario_rua 
                  ? `${formData.destinatario_rua}${formData.destinatario_numero ? ', nº ' + formData.destinatario_numero : ''}${formData.destinatario_bairro ? ' - ' + formData.destinatario_bairro : ''}${formData.destinatario_cidade ? ', ' + formData.destinatario_cidade : ''}${formData.destinatario_estado ? '/' + formData.destinatario_estado : ''}` 
                  : ''

                return (
                  <p>
                    Recebemos de <strong className="text-slate-900">{formData.locatario_nome}</strong>, inscrito no CPF sob o nº <strong className="text-slate-900">{formData.locatario_cpf || '---'}</strong>
                    {locEndereco && (
                      <span>, residente em <strong className="text-slate-900">{locEndereco}</strong></span>
                    )}
                    {formData.destinatario_tipo === 'outro' && formData.destinatario_nome && (
                      <span> (em benefício do paciente <strong className="text-slate-900">{formData.destinatario_nome}</strong>{formData.destinatario_parentesco ? ` - ${formData.destinatario_parentesco}` : ''}{destEndereco ? `, com endereço em: ${destEndereco}` : ''})</span>
                    )}
                    , a quantia supra de <strong className="text-slate-900">{numberToWords(selectedReceiptPayment.valor_pago)}</strong>, referente ao empréstimo/aluguel dos equipamentos descritos abaixo, correspondente à: <strong className="text-slate-900">{selectedReceiptPayment.mes_referencia}</strong>.
                  </p>
                )
              })()}

              {/* Items Table in Receipt */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item / Equipamento</th>
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
                <span className="text-[10px] text-slate-500">
                  Locatário / Responsável
                  {formData.destinatario_tipo === 'outro' && formData.destinatario_nome ? ` (por ${formData.destinatario_nome})` : ''}
                </span>
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

      {/* Full screen CAUÇÃO receipt visualizer modal */}
      {caucaoReceiptOpen && parseFloat(formData.valor_caucao || '0') > 0 && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6 md:p-12 flex flex-col items-center animate-in fade-in duration-200">
          
          {/* Controls */}
          <div className="w-full max-w-3xl flex justify-between items-center pb-6 border-b border-slate-200 mb-8 no-print">
            <h3 className="font-bold text-amber-800 text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-700">security</span>
              Visualização do Recibo de Caução de Garantia
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir Recibo
              </button>
              <button 
                onClick={handleDownloadCaucaoPDF}
                className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Baixar PDF
              </button>
              <button 
                onClick={() => setCaucaoReceiptOpen(false)}
                className="px-4 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Fechar
              </button>
            </div>
          </div>

          {/* Receipt template container */}
          <div className="w-full max-w-3xl bg-white border-2 border-amber-300 p-8 md:p-12 flex flex-col gap-8 shadow-sm print:border-none print:shadow-none relative rounded-xl">
            
            {/* Background seal */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
              <span className="material-symbols-outlined text-[300px]">security</span>
            </div>

            {/* Header */}
            <header className="flex justify-between items-start border-b-2 border-amber-200 pb-6 relative z-10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-700 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">SISTEMA PASTORAL</h4>
                  <p className="text-xs text-slate-500">Filantropia & Gestão Inteligente</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="font-bold text-amber-900 text-xl tracking-tight">RECIBO DE CAUÇÃO DE GARANTIA</h2>
                <p className="text-xs text-slate-500 mt-1 font-mono">Nº: CAUCAO-{(id || 'NOVO').substring(0, 8).toUpperCase()}</p>
              </div>
            </header>

            {/* Receipt body */}
            <main className="space-y-6 text-sm text-slate-800 relative z-10 leading-relaxed">
              <div className="flex justify-between items-center bg-amber-50/70 p-4 border border-amber-200 rounded-xl">
                <div>
                  <span className="block text-xs uppercase font-bold text-amber-800">VALOR DO CAUÇÃO RECEBIDO:</span>
                  <span className="text-xs text-slate-600">Forma de Pagamento: <strong>{formData.forma_pagamento_caucao || 'PIX'}</strong></span>
                </div>
                <span className="text-2xl font-black text-amber-900">{formatCurrency(parseFloat(formData.valor_caucao || '0'))}</span>
              </div>

              {(() => {
                const locEndereco = formData.locatario_rua 
                  ? `${formData.locatario_rua}${formData.locatario_numero ? ', nº ' + formData.locatario_numero : ''}${formData.locatario_bairro ? ' - ' + formData.locatario_bairro : ''}${formData.locatario_cidade ? ', ' + formData.locatario_cidade : ''}${formData.locatario_estado ? '/' + formData.locatario_estado : ''}` 
                  : ''
                const destEndereco = formData.destinatario_rua 
                  ? `${formData.destinatario_rua}${formData.destinatario_numero ? ', nº ' + formData.destinatario_numero : ''}${formData.destinatario_bairro ? ' - ' + formData.destinatario_bairro : ''}${formData.destinatario_cidade ? ', ' + formData.destinatario_cidade : ''}${formData.destinatario_estado ? '/' + formData.destinatario_estado : ''}` 
                  : ''

                return (
                  <p>
                    Recebemos de <strong className="text-slate-900">{formData.locatario_nome}</strong>, inscrito no CPF sob o nº <strong className="text-slate-900">{formData.locatario_cpf || 'Não informado'}</strong>
                    {locEndereco && (
                      <span>, residente em <strong className="text-slate-900">{locEndereco}</strong></span>
                    )}
                    {formData.destinatario_tipo === 'outro' && formData.destinatario_nome && (
                      <span> (em benefício do paciente <strong className="text-slate-900">{formData.destinatario_nome}</strong>{formData.destinatario_parentesco ? ` - ${formData.destinatario_parentesco}` : ''}{destEndereco ? `, com endereço em: ${destEndereco}` : ''})</span>
                    )}
                    , a quantia de <strong className="text-slate-900">{numberToWords(parseFloat(formData.valor_caucao || '0'))}</strong> ({formatCurrency(parseFloat(formData.valor_caucao || '0'))}), paga via <strong className="text-slate-900">{formData.forma_pagamento_caucao || 'PIX'}</strong>, a título de <strong>CAUÇÃO DE GARANTIA</strong> pelo empréstimo e uso dos seguintes equipamentos:
                  </p>
                )
              })()}

              {/* Items Table in Receipt */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Equipamento / Objeto</th>
                      <th className="p-2.5">Nº de Série</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5">Observações / Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itens.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold text-slate-900">{it.nome_equipamento || 'Equipamento'}</td>
                        <td className="p-2.5 font-mono text-slate-500">{it.numero_serie || '---'}</td>
                        <td className="p-2.5 text-center font-bold">{it.quantidade || 1}</td>
                        <td className="p-2.5 text-slate-600">{it.descricao || 'Em perfeito estado'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cláusula de Devolução do Caução */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">info</span>
                  Termos e Condições de Devolução do Caução:
                </p>
                <p className="leading-relaxed">
                  O valor do caução acima discriminado permanecerá sob a guarda e custódia da instituição durante todo o período em que os equipamentos estiverem em posse do locatário. Este montante será <strong>restituído integralmente ao beneficiário/locatário</strong> no momento da devolução dos equipamentos na sede da pastoral, desde que entregues limpos, sem avarias e em perfeito estado de funcionamento e conservação.
                </p>
                {formData.caucao_observacoes && (
                  <p className="text-slate-600 italic pt-1 border-t border-slate-200">
                    <strong>Observações Específicas:</strong> {formData.caucao_observacoes}
                  </p>
                )}
              </div>

              <div className="text-right text-xs text-slate-500 mt-6">
                Data de Pagamento do Caução: {formData.data_caucao ? new Date(formData.data_caucao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
              </div>
            </main>

            {/* Signatures block */}
            <footer className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-12 mt-8 relative z-10">
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-dashed border-slate-400 max-w-[220px] mb-2"></div>
                <span className="text-xs font-semibold text-slate-700">{formData.locatario_nome}</span>
                <span className="text-[10px] text-slate-500">Locatário / Beneficiário</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-dashed border-slate-400 max-w-[220px] mb-2"></div>
                <span className="text-xs font-semibold text-slate-700">Representante da Instituição</span>
                <span className="text-[10px] text-slate-500">Responsável pelo Recebimento</span>
              </div>
            </footer>

          </div>
        </div>
      )}

    </div>
  )
}
