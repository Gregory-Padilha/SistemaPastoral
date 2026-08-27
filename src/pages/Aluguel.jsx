import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  fetchAlugueis, 
  deleteAluguel,
  fetchEstoqueEquipamentos, 
  insertEquipamento,
  updateEquipamento,
  deleteEquipamento,
  fetchHistoricoPagamentosAluguel,
  insertHistoricoPagamentoAluguel,
  deleteHistoricoPagamentoAluguel,
  fetchConfiguracoes
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { jsPDF } from 'jspdf'

export const Aluguel = () => {
  const { showToast, confirmDelete } = useFeedback()
  const [contracts, setContracts] = useState([])
  const [estoque, setEstoque] = useState([])
  const [pagamentosRecorrentes, setPagamentosRecorrentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [config, setConfig] = useState(null)

  // Caução Receipt Modal State
  const [caucaoReceiptModal, setCaucaoReceiptModal] = useState({
    isOpen: false,
    contract: null
  })
  
  // Selected year
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  // Floating detached tooltip state
  const [activeTooltip, setActiveTooltip] = useState(null)

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState('contratos') // 'contratos' or 'estoque'

  // Modal state for adding/editing equipment
  const [newEqModalOpen, setNewEqModalOpen] = useState(false)
  const [editingEquipamento, setEditingEquipamento] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newEqFormData, setNewEqFormData] = useState({
    nome_equipamento: '',
    numero_serie: '',
    quantidade_total: '1',
    estado_conservacao: 'Bom estado',
    localizacao: 'Depósito Central',
    valor_caucao_sugerido: '0',
    valor_aluguel_sugerido: '0',
    observacoes: ''
  })

  const equipamentosPresets = [
    'Cadeira de Rodas',
    'Cadeira de Banho',
    'Muletas',
    'Andador',
    'Cama Hospitalar',
    'Colchão Casca de Ovo',
    'Tipoia',
    'Bota Ortopédica',
    'Inalador / Nebulizador',
    'Outros'
  ]

  const estadosConservacao = [
    'Novo / Excelente',
    'Bom estado',
    'Usado com marcas',
    'Necessita Manutenção'
  ]

  const getCategoryIcon = (nome = '') => {
    const c = (nome || '').toLowerCase()
    if (c.includes('banho')) return 'bathtub'
    if (c.includes('roda')) return 'accessible'
    if (c.includes('muleta')) return 'blind'
    if (c.includes('andador')) return 'assist_walker'
    if (c.includes('cama')) return 'bed'
    if (c.includes('colch')) return 'single_bed'
    if (c.includes('tipoi')) return 'health_and_safety'
    if (c.includes('bota') || c.includes('ortop')) return 'footprint'
    if (c.includes('inala') || c.includes('nebul')) return 'air'
    return 'inventory_2'
  }

  // Monthly payment status modal state
  const [payModal, setPayModal] = useState({
    isOpen: false,
    contract: null,
    mesIndex: null,
    mesLabel: '',
    initialStatus: 'Nao Pago', // 'Pago' | 'Nao Pago'
    selectedStatus: 'Nao Pago'  // 'Pago' | 'Nao Pago'
  })
  const [savingPayStatus, setSavingPayStatus] = useState(false)

  const mesesAbreviados = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ]

  const mesesCompletos = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [contractsData, paymentsData, stockData, configData] = await Promise.all([
        fetchAlugueis(search).catch(() => []),
        fetchHistoricoPagamentosAluguel(currentYear).catch(() => []),
        fetchEstoqueEquipamentos().catch(() => []),
        fetchConfiguracoes().catch(() => null)
      ])
      setContracts(contractsData || [])
      setPagamentosRecorrentes(paymentsData || [])
      if (configData) setConfig(configData)
      
      const filteredStock = search
        ? (stockData || []).filter(e => 
            (e.nome_equipamento && e.nome_equipamento.toLowerCase().includes(search.toLowerCase())) || 
            (e.numero_serie && e.numero_serie.toLowerCase().includes(search.toLowerCase())) ||
            (e.localizacao && e.localizacao.toLowerCase().includes(search.toLowerCase()))
          )
        : (stockData || [])
      setEstoque(filteredStock)
    } catch (err) {
      if (!silent) showToast('Erro ao carregar dados', err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadData(false)
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [search, activeTab, currentYear])

  useEffect(() => {
    const handleSilentRefresh = () => {
      if (!payModal?.isOpen && !newEqModalOpen) {
        loadData(true)
      }
    }
    window.addEventListener('app:silent-refresh', handleSilentRefresh)
    window.addEventListener('focus', handleSilentRefresh)
    return () => {
      window.removeEventListener('app:silent-refresh', handleSilentRefresh)
      window.removeEventListener('focus', handleSilentRefresh)
    }
  }, [payModal?.isOpen, newEqModalOpen, search, activeTab, currentYear])

  const handleOpenAddModal = () => {
    setEditingEquipamento(null)
    setNewEqFormData({
      nome_equipamento: '',
      numero_serie: '',
      quantidade_total: '1',
      estado_conservacao: 'Bom estado',
      localizacao: 'Depósito Central',
      valor_caucao_sugerido: '0',
      valor_aluguel_sugerido: '0',
      observacoes: ''
    })
    setNewEqModalOpen(true)
  }

  const handleOpenEditModal = (eq) => {
    setEditingEquipamento(eq)
    setNewEqFormData({
      nome_equipamento: eq.nome_equipamento || '',
      numero_serie: eq.numero_serie || '',
      quantidade_total: (eq.quantidade_total || 1).toString(),
      estado_conservacao: eq.estado_conservacao || 'Bom estado',
      localizacao: eq.localizacao || 'Depósito Central',
      valor_caucao_sugerido: (eq.valor_caucao_sugerido || 0).toString(),
      valor_aluguel_sugerido: (eq.valor_aluguel_sugerido || 0).toString(),
      observacoes: eq.observacoes || ''
    })
    setNewEqModalOpen(true)
  }

  const handleDeleteEquipment = (eq) => {
    confirmDelete(
      'Excluir Equipamento',
      `Tem certeza que deseja remover "${eq.nome_equipamento}" do estoque?`,
      async () => {
        try {
          await deleteEquipamento(eq.id)
          showToast('Sucesso', 'Equipamento removido do estoque!')
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  const handleAddEquipmentSubmit = async (e) => {
    e.preventDefault()
    if (!newEqFormData.nome_equipamento.trim()) {
      showToast('Atenção', 'Informe o nome do equipamento.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nome_equipamento: newEqFormData.nome_equipamento.trim(),
        numero_serie: newEqFormData.numero_serie.trim() || null,
        quantidade_total: parseInt(newEqFormData.quantidade_total || '1'),
        estado_conservacao: newEqFormData.estado_conservacao || 'Bom estado',
        localizacao: newEqFormData.localizacao.trim() || 'Depósito Central',
        valor_caucao_sugerido: parseFloat(newEqFormData.valor_caucao_sugerido || '0'),
        valor_aluguel_sugerido: parseFloat(newEqFormData.valor_aluguel_sugerido || '0'),
        observacoes: newEqFormData.observacoes.trim() || null
      }

      if (editingEquipamento) {
        await updateEquipamento(editingEquipamento.id, payload)
        showToast('Sucesso', 'Equipamento atualizado com sucesso!')
      } else {
        await insertEquipamento(payload)
        showToast('Sucesso', 'Novo equipamento adicionado ao estoque!')
      }

      setNewEqModalOpen(false)
      setEditingEquipamento(null)
      loadData()
    } catch (err) {
      showToast('Erro ao salvar', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Monthly payment check logic
  const isMonthPaid = (contratoId, mesIndex) => {
    return pagamentosRecorrentes.some(p => 
      p.contrato_id === contratoId && 
      p.mes_referencia === mesIndex && 
      p.ano_referencia === currentYear
    )
  }

  // Check if a month is equal to or later than the contract start month
  const shouldShowMonth = (startDateStr, mesNum) => {
    if (!startDateStr) return true
    const startDate = new Date(startDateStr)
    const startYear = startDate.getUTCFullYear()
    const startMonth = startDate.getUTCMonth() + 1 // 1-indexed
    
    if (currentYear > startYear) return true
    if (currentYear < startYear) return false
    return mesNum >= startMonth
  }

  const handleMonthClick = (contract, mesIdx) => {
    const paid = isMonthPaid(contract.id, mesIdx)
    const initial = paid ? 'Pago' : 'Nao Pago'

    setPayModal({
      isOpen: true,
      contract: contract,
      mesIndex: mesIdx,
      mesLabel: mesesCompletos[mesIdx - 1],
      initialStatus: initial,
      selectedStatus: initial
    })
  }

  const submittingRef = React.useRef(false)

  const handleSavePayStatus = async (e) => {
    e.preventDefault()
    if (submittingRef.current || !payModal.contract) return

    submittingRef.current = true
    setSavingPayStatus(true)
    try {
      const { contract, mesIndex } = payModal

      await insertHistoricoPagamentoAluguel(
        contract.id,
        mesIndex,
        currentYear,
        'Pagamento mensal recorrente confirmado'
      )
      showToast('Sucesso', `Pagamento de ${payModal.mesLabel}/${currentYear} confirmado!`)
      
      // Update local modal state to show receipt after success
      setPayModal(prev => ({
        ...prev,
        initialStatus: 'Pago',
        selectedStatus: 'Pago'
      }))
      loadData()
    } catch (err) {
      showToast('Erro ao atualizar pagamento', err.message, 'error')
    } finally {
      setSavingPayStatus(false)
      submittingRef.current = false
    }
  }

  const handleRemovePayStatus = async () => {
    if (submittingRef.current || !payModal.contract) return

    confirmDelete(
      'Remover Confirmação',
      `Tem certeza de que deseja remover a confirmação de pagamento para ${payModal.mesLabel}/${currentYear}?`,
      async () => {
        submittingRef.current = true
        setSavingPayStatus(true)
        try {
          const { contract, mesIndex } = payModal
          await deleteHistoricoPagamentoAluguel(
            contract.id,
            mesIndex,
            currentYear
          )
          showToast('Sucesso', `Pagamento de ${payModal.mesLabel}/${currentYear} desmarcado!`)
          setPayModal(prev => ({
            ...prev,
            isOpen: false
          }))
          loadData()
        } catch (err) {
          showToast('Erro ao remover pagamento', err.message, 'error')
        } finally {
          setSavingPayStatus(false)
          submittingRef.current = false
        }
      }
    )
  }

  const handlePrintReceipt = () => {
    const c = payModal.contract
    if (!c) return

    const valorFormated = parseFloat(c.valor_aluguel || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // Extract items list
    let contractItens = []
    if (Array.isArray(c.itens) && c.itens.length > 0) {
      contractItens = c.itens
    } else if (c.observacoes && c.observacoes.includes('<!--ITENS_JSON:')) {
      try {
        const match = c.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
        if (match && match[1]) contractItens = JSON.parse(match[1])
      } catch (_) {}
    }

    const hasMultiItems = contractItens.length > 0

    const itemsHtml = hasMultiItems
      ? `
        <div style="margin: 15px 0; border: 1px solid #c4d7b2; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #f1f8ee; color: #3d5a2a; text-align: left;">
                <th style="padding: 8px 10px; border-bottom: 1px solid #c4d7b2;">Item / Equipamento</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #c4d7b2; text-align: center;">Qtd</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #c4d7b2;">S/N</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #c4d7b2; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${contractItens.map(it => `
                <tr style="border-bottom: 1px dashed #e2edd9;">
                  <td style="padding: 7px 10px;"><strong>${it.nome_equipamento || 'Equipamento'}</strong> ${it.descricao ? `<span style="font-size: 11px; color: #666;">(${it.descricao})</span>` : ''}</td>
                  <td style="padding: 7px 10px; text-align: center;">${it.quantidade || 1}</td>
                  <td style="padding: 7px 10px; font-family: monospace; font-size: 11px; color: #555;">${it.numero_serie || '---'}</td>
                  <td style="padding: 7px 10px; text-align: right;">R$ ${(parseFloat(it.valor_unitario || 0) * (parseInt(it.quantidade) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="row">
          <span class="label">Equipamento Emprestado:</span>
          <span class="value">${c.estoque_equipamentos?.nome_equipamento || c.imovel_endereco}</span>
        </div>
      `

    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Recibo de Pagamento - ${c.locatario_nome}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .receipt-box { border: 2.5px solid #3d5a2a; padding: 35px; border-radius: 16px; max-width: 600px; margin: 0 auto; background-color: #fafdf8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 2px solid #3d5a2a; padding-bottom: 15px; margin-bottom: 25px; }
            .title { font-size: 26px; color: #3d5a2a; margin: 0; font-weight: bold; letter-spacing: 1px; }
            .subtitle { font-size: 11px; color: #555; text-transform: uppercase; margin-top: 5px; font-weight: 600; letter-spacing: 0.5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px dashed #c4d7b2; padding-bottom: 8px; font-size: 14px; }
            .label { font-weight: bold; color: #444; }
            .value { color: #111; font-weight: 500; }
            .footer { margin-top: 40px; text-align: center; font-size: 13px; color: #555; }
            .signature-line { border-top: 1.5px solid #3d5a2a; width: 280px; margin: 0 auto; margin-top: 40px; }
            .signature-label { font-size: 11px; color: #666; margin-top: 6px; font-weight: 600; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="header">
              <div class="title">RECIBO DE CONTRIBUIÇÃO</div>
              <div class="subtitle">Associação/Pastoral de Assistência</div>
            </div>
            <div class="row">
              <span class="label">Beneficiário / Locatário:</span>
              <span class="value">${c.locatario_nome}</span>
            </div>
            <div class="row">
              <span class="label">CPF:</span>
              <span class="value">${c.locatario_cpf || 'Não Cadastrado'}</span>
            </div>
            ${itemsHtml}
            <div class="row">
              <span class="label">Mês de Referência:</span>
              <span class="value">${payModal.mesLabel} de ${currentYear}</span>
            </div>
            <div class="row">
              <span class="label">Valor da Contribuição:</span>
              <span class="value">R$ ${valorFormated}</span>
            </div>
            <div class="row">
              <span class="label">Forma de Pagamento:</span>
              <span class="value">${c.forma_pagamento || 'PIX'}</span>
            </div>
            <div class="row">
              <span class="label">Data de Emissão:</span>
              <span class="value">${new Date().toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="footer">
              <p>Declaramos para os devidos fins que recebemos a contribuição referente aos equipamentos descritos acima.</p>
              <div class="signature-line"></div>
              <div class="signature-label">Representante da Pastoral</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '---'
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  const handleDeleteContract = (contract) => {
    confirmDelete(
      'Excluir Ficha de Empréstimo',
      `Tem certeza que deseja excluir a ficha de empréstimo de "${contract.locatario_nome}"? Os equipamentos voltarão ao estoque e todos os lançamentos vinculados no Caderno de Fechamento serão excluídos automaticamente.`,
      async () => {
        try {
          await deleteAluguel(contract.id)
          showToast('Sucesso', `Ficha de ${contract.locatario_nome} excluída com sucesso!`)
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
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

  const handleOpenCaucaoReceipt = (contract) => {
    setCaucaoReceiptModal({
      isOpen: true,
      contract: contract
    })
  }

  const handleDownloadCaucaoReceiptPDF = (contract) => {
    try {
      const c = contract || caucaoReceiptModal.contract
      if (!c) return

      const doc = new jsPDF()
      const instName = config?.nome_instituicao || 'SISTEMA PASTORAL'
      const numRecibo = (c.id || '0000').substring(0, 8).toUpperCase()
      const valorFormatado = formatCurrency(parseFloat(c.valor_caucao || '0'))
      const valorExtenso = numberToWords(parseFloat(c.valor_caucao || '0'))
      const dataFormatada = c.data_caucao ? new Date(c.data_caucao).toLocaleDateString('pt-BR') : (c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'))

      // Extract items list
      let contractItens = []
      if (Array.isArray(c.itens) && c.itens.length > 0) {
        contractItens = c.itens
      } else if (c.observacoes && c.observacoes.includes('<!--ITENS_JSON:')) {
        try {
          const match = c.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
          if (match && match[1]) contractItens = JSON.parse(match[1])
        } catch (_) {}
      }

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
      doc.text(`Forma de Pagamento: ${c.forma_pagamento_caucao || c.forma_pagamento || 'PIX'}`, 20, 55)

      // Body text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)

      const bodyText = `Recebemos de ${c.locatario_nome || 'Beneficiário'}, CPF: ${c.locatario_cpf || 'Não informado'}, a quantia de ${valorExtenso} (${valorFormatado}), paga via ${c.forma_pagamento_caucao || c.forma_pagamento || 'PIX'}, a título de CAUÇÃO DE GARANTIA pelo empréstimo e uso dos seguintes equipamentos:`
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
      if (contractItens.length > 0) {
        contractItens.forEach((it, i) => {
          doc.text(it.nome_equipamento || 'Equipamento', 18, tableY + (i * 6))
          doc.text(it.numero_serie || '---', 110, tableY + (i * 6))
          doc.text((it.quantidade || 1).toString(), 145, tableY + (i * 6))
          doc.text(it.descricao || 'Bom', 165, tableY + (i * 6))
        })
        tableY += (contractItens.length * 6) + 8
      } else {
        doc.text(c.estoque_equipamentos?.nome_equipamento || c.imovel_endereco || 'Equipamento', 18, tableY)
        doc.text(c.estoque_equipamentos?.numero_serie || '---', 110, tableY)
        doc.text('1', 145, tableY)
        doc.text('Bom', 165, tableY)
        tableY += 14
      }

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
      doc.text(c.locatario_nome || 'Locatário', 55, sigY + 5, { align: 'center' })
      doc.text('Representante da Pastoral', 155, sigY + 5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      doc.text('Locatário / Beneficiário', 55, sigY + 9, { align: 'center' })
      doc.text('Responsável pelo Recebimento', 155, sigY + 9, { align: 'center' })

      doc.save(`recibo-caucao-${c.locatario_nome ? c.locatario_nome.toLowerCase().replace(/\s+/g, '-') : 'locatario'}.pdf`)
      showToast('Recibo Baixado', 'O arquivo PDF do recibo de caução foi gerado!', 'success')
    } catch (err) {
      showToast('Erro ao gerar PDF', err.message, 'error')
    }
  }

  const handlePrintCaucaoReceipt = (contract) => {
    const c = contract || caucaoReceiptModal.contract
    if (!c) return

    const valorFormated = parseFloat(c.valor_caucao || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const valorExtenso = numberToWords(parseFloat(c.valor_caucao || '0'))
    const instName = config?.nome_instituicao || 'Sistema Pastoral'
    const numRecibo = (c.id || '0000').substring(0, 8).toUpperCase()
    const dataFormatada = c.data_caucao ? new Date(c.data_caucao).toLocaleDateString('pt-BR') : (c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'))

    // Extract items list
    let contractItens = []
    if (Array.isArray(c.itens) && c.itens.length > 0) {
      contractItens = c.itens
    } else if (c.observacoes && c.observacoes.includes('<!--ITENS_JSON:')) {
      try {
        const match = c.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
        if (match && match[1]) contractItens = JSON.parse(match[1])
      } catch (_) {}
    }

    const printWindow = window.open('', '_blank')
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo de Caução - ${c.locatario_nome}</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; background: #fff; line-height: 1.5; }
            .receipt-card { border: 2px solid #b45309; border-radius: 16px; padding: 32px; max-width: 720px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #fef3c7; padding-bottom: 20px; margin-bottom: 24px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand-logo { width: 44px; height: 44px; background: #b45309; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
            .title-box { text-align: right; }
            .title-box h2 { margin: 0; color: #b45309; font-size: 20px; font-weight: 800; }
            .title-box p { margin: 4px 0 0 0; color: #64748b; font-size: 12px; font-family: monospace; }
            .amount-box { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
            .amount-label { font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; }
            .amount-value { font-size: 24px; font-weight: 800; color: #78350f; }
            .body-text { font-size: 14px; color: #334155; margin-bottom: 20px; text-align: justify; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .items-table th { background: #f8fafc; padding: 8px 12px; font-weight: 700; text-align: left; border-bottom: 1px solid #e2e8f0; }
            .items-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
            .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; font-size: 11px; color: #475569; margin-bottom: 30px; }
            .footer { border-top: 1.5px solid #e2e8f0; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
            .signature { text-align: center; width: 220px; }
            .signature-line { border-top: 1.5px dashed #94a3b8; margin-bottom: 6px; }
            .signature-name { font-size: 11px; font-weight: 700; color: #1e293b; }
            .signature-role { font-size: 10px; color: #64748b; }
            .meta { font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="header">
              <div class="brand">
                <div class="brand-logo">🛡️</div>
                <div>
                  <h3 style="margin:0; font-size:16px; font-weight:800; color:#1e293b;">${instName}</h3>
                  <div style="font-size:11px; color:#64748b;">Filantropia & Gestão Inteligente</div>
                </div>
              </div>
              <div class="title-box">
                <h2>RECIBO DE CAUÇÃO DE GARANTIA</h2>
                <p>Nº: CAUCAO-${numRecibo}</p>
              </div>
            </div>

            <div class="amount-box">
              <div>
                <div class="amount-label">Valor do Caução Recebido:</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Forma: <strong>${c.forma_pagamento_caucao || c.forma_pagamento || 'PIX'}</strong></div>
              </div>
              <div class="amount-value">R$ ${valorFormated}</div>
            </div>

            <div class="body-text">
              Recebemos de <strong>${c.locatario_nome}</strong>, CPF: <strong>${c.locatario_cpf || 'Não informado'}</strong>, a quantia de <strong>${valorExtenso}</strong> (R$ ${valorFormated}), paga via <strong>${c.forma_pagamento_caucao || c.forma_pagamento || 'PIX'}</strong>, a título de <strong>CAUÇÃO DE GARANTIA</strong> pelo empréstimo e uso dos seguintes equipamentos:
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Equipamento / Objeto</th>
                  <th>Nº de Série</th>
                  <th style="text-align: center;">Qtd</th>
                  <th>Observações / Estado</th>
                </tr>
              </thead>
              <tbody>
                ${contractItens.length > 0 
                  ? contractItens.map(it => `
                    <tr>
                      <td><strong>${it.nome_equipamento || 'Equipamento'}</strong></td>
                      <td style="font-family: monospace;">${it.numero_serie || '---'}</td>
                      <td style="text-align: center; font-weight: bold;">${it.quantidade || 1}</td>
                      <td>${it.descricao || 'Em perfeito estado'}</td>
                    </tr>
                  `).join('')
                  : `
                    <tr>
                      <td><strong>${c.estoque_equipamentos?.nome_equipamento || c.imovel_endereco || 'Equipamento'}</strong></td>
                      <td style="font-family: monospace;">${c.estoque_equipamentos?.numero_serie || '---'}</td>
                      <td style="text-align: center; font-weight: bold;">1</td>
                      <td>Em perfeito estado</td>
                    </tr>
                  `
                }
              </tbody>
            </table>

            <div class="terms-box">
              <strong style="color: #92400e; display: block; margin-bottom: 4px;">Termos e Condições de Devolução do Caução:</strong>
              O valor do caução permanecerá sob a guarda e custódia da instituição durante todo o período em que os equipamentos estiverem em posse do locatário. Este montante será <strong>restituído integralmente ao beneficiário/locatário</strong> no momento da devolução dos equipamentos na sede da pastoral, desde que entregues limpos, sem avarias e em perfeito estado de funcionamento e conservação.
              ${c.caucao_observacoes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1;"><strong>Observações:</strong> ${c.caucao_observacoes}</div>` : ''}
            </div>

            <div class="footer">
              <div class="meta">
                <div><strong>Data do Pagamento do Caução:</strong> ${dataFormatada}</div>
                <div><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-name">${c.locatario_nome}</div>
                <div class="signature-role">Locatário / Beneficiário</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-name">Representante da Pastoral</div>
                <div class="signature-role">Responsável pelo Recebimento</div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const filteredContracts = contracts.filter(c => {
    if (statusFilter === 'todos') return true;
    
    // Status filter logic
    if (statusFilter === 'Devolvido') return c.status === 'Devolvido'
    
    const today = new Date().toISOString().split('T')[0]
    const isOverdue = c.data_fim && today > c.data_fim
    
    if (statusFilter === 'Ativo') return c.status === 'Ativo' && !isOverdue
    if (statusFilter === 'Atrasado') return c.status === 'Ativo' && isOverdue
    return true
  })

  const statsAtivos = contracts.filter(c => c.status === 'Ativo').length
  const statsDevolvidos = contracts.filter(c => c.status === 'Devolvido').length
  const statsEstoqueTotal = estoque.reduce((sum, e) => sum + (parseInt(e.quantidade_total) || 0), 0)
  const statsEstoqueDisp = estoque.reduce((sum, e) => sum + (parseInt(e.quantidade_disponivel) || 0), 0)

  return (
    <div className="flex flex-col gap-stack-lg pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-surface-variant pb-6 gap-4">
        <div>
          <nav className="flex items-center text-on-surface-variant font-label-sm text-label-sm mb-1 space-x-2">
            <span className="text-primary font-bold">Pastoral</span>
            <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <span>Controle de Empréstimos & Aluguéis</span>
          </nav>
          <h2 className="font-display-lg text-2xl md:text-3xl text-primary font-bold tracking-tight">
            Empréstimos e Equipamentos
          </h2>
          <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
            Gerencie o estoque e o empréstimo de cadeiras de rodas, muletas, andadores e camas hospitalares.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'estoque' ? (
            <button 
              onClick={handleOpenAddModal}
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs md:text-sm font-bold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Cadastrar Equipamento
            </button>
          ) : (
            <Link 
              to="/aluguel/novo"
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs md:text-sm font-bold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Nova Ficha de Empréstimo
            </Link>
          )}
        </div>
      </div>

      {/* KPI Stats Row (Dinâmico para Contratos vs Estoque) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {activeTab === 'estoque' ? (
          <>
            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">category</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Modelos no Acervo</span>
                <p className="text-lg font-extrabold text-primary">{estoque.length} tipos</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Prontos / Disponíveis</span>
                <p className="text-lg font-extrabold text-emerald-800">{statsEstoqueDisp} un</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">person_check</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Emprestados</span>
                <p className="text-lg font-extrabold text-blue-800">{Math.max(0, statsEstoqueTotal - statsEstoqueDisp)} un</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Total no Estoque</span>
                <p className="text-lg font-extrabold text-on-surface">{statsEstoqueTotal} un</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">assignment</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Empréstimos Ativos</span>
                <p className="text-lg font-extrabold text-primary">{statsAtivos}</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Devolvidos</span>
                <p className="text-lg font-extrabold text-emerald-800">{statsDevolvidos}</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Estoque Disponível</span>
                <p className="text-lg font-extrabold text-secondary">{statsEstoqueDisp} un</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">apps</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Estoque Total</span>
                <p className="text-lg font-extrabold text-on-surface">{statsEstoqueTotal} un</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs Selector and Year Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-surface-container-low border border-outline-variant/80 rounded-2xl p-1 w-full max-w-md shadow-xs">
          <button
            onClick={() => {
              setSearch('')
              setActiveTab('contratos')
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'contratos' 
                ? 'bg-primary text-on-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Fichas de Empréstimo
          </button>
          <button
            onClick={() => {
              setSearch('')
              setActiveTab('estoque')
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'estoque' 
                ? 'bg-primary text-on-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Estoque de Equipamentos
          </button>
        </div>

        {activeTab === 'contratos' && (
          <div className="bg-surface rounded-2xl px-4 py-2 border border-outline-variant/80 shadow-xs flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Ano Contábil:</span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setCurrentYear(prev => prev - 1)}
                className="p-1 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="text-xs md:text-sm font-extrabold text-primary font-mono">{currentYear}</span>
              <button 
                onClick={() => setCurrentYear(prev => prev + 1)}
                className="p-1 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 p-4 md:p-5 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <label className="block text-xs font-bold text-on-surface mb-1">Busca Rápida</label>
          <div className="flex items-center border border-outline-variant rounded-xl px-3.5 py-2 bg-surface-container-lowest focus-within:border-primary transition-all">
            <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-xs md:text-sm font-medium text-on-surface placeholder:text-outline/70 focus:ring-0 p-0" 
              placeholder={activeTab === 'contratos' ? "Buscar por nome do locatário, CPF ou equipamento..." : "Buscar por nome do equipamento ou nº de série..."}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {activeTab === 'contratos' && (
          <div className="w-full md:w-52">
            <label className="block text-xs font-bold text-on-surface mb-1">Filtrar por Status</label>
            <select 
              className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs md:text-sm font-medium focus:border-primary outline-none transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="Ativo">🟢 Ativos</option>
              <option value="Devolvido">🔵 Devolvidos</option>
              <option value="Atrasado">🔴 Atrasados</option>
            </select>
          </div>
        )}
      </section>

      {/* Main content grid */}
      {loading && (activeTab === 'contratos' ? filteredContracts.length === 0 : estoque.length === 0) ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : activeTab === 'contratos' ? (
        // Contracts tab with recurrent payment tracking monthly column
        <section className="bg-surface rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium w-[20%]">Locatário / Beneficiário</th>
                  <th className="px-6 py-4 font-medium w-[20%]">Equipamento / Objeto</th>
                  <th className="px-6 py-4 font-medium w-[45%] text-center">Controle Recorrente de Pagamentos ({currentYear})</th>
                  <th className="px-6 py-4 font-medium text-right w-[15%]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-on-surface-variant">Nenhum empréstimo ou aluguel cadastrado.</td>
                  </tr>
                ) : (
                  filteredContracts.map(c => {
                    return (
                      <tr key={c.id} className="hover:bg-secondary-container/10 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <Link to={`/aluguel/${c.id}`} className="font-semibold text-primary hover:underline block">{c.locatario_nome}</Link>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-on-surface-variant font-mono">Retirada: {formatDate(c.data_inicio)}</span>
                              {parseFloat(c.valor_caucao || '0') > 0 && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  c.caucao_pago 
                                    ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`} title={`Caução: R$ ${parseFloat(c.valor_caucao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${c.forma_pagamento_caucao || 'PIX'}) - ${c.caucao_pago ? 'Pago no ato' : 'Pendente'}`}>
                                  <span className="material-symbols-outlined text-[12px]">security</span>
                                  Caução: R$ {parseFloat(c.valor_caucao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({c.caucao_pago ? 'Pago' : 'Pendente'})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant max-w-xs">
                          {(() => {
                            let itemsList = []
                            if (Array.isArray(c.itens) && c.itens.length > 0) {
                              itemsList = c.itens
                            } else if (typeof c.itens === 'string') {
                              try { itemsList = JSON.parse(c.itens) } catch (_) {}
                            } else if (c.observacoes && c.observacoes.includes('<!--ITENS_JSON:')) {
                              try {
                                const match = c.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
                                if (match && match[1]) itemsList = JSON.parse(match[1])
                              } catch (_) {}
                            }

                            if (!itemsList || itemsList.length === 0) {
                              itemsList = [{
                                nome_equipamento: c.estoque_equipamentos?.nome_equipamento || c.imovel_endereco || 'Equipamento',
                                quantidade: 1,
                                numero_serie: c.estoque_equipamentos?.numero_serie || '',
                                valor_unitario: c.valor_aluguel || 0
                              }]
                            }

                            const totalQty = itemsList.reduce((sum, item) => sum + (parseInt(item.quantidade) || 1), 0)
                            const isMulti = itemsList.length > 1 || totalQty > 1 || c.imovel_tipo === 'Múltiplos Itens'
                            const firstItem = itemsList[0] || {}

                            return (
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-on-surface truncate" title={firstItem.nome_equipamento || c.imovel_endereco}>
                                    {firstItem.nome_equipamento || c.imovel_endereco}
                                  </span>
                                  {itemsList.length > 1 && (
                                    <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                      +{itemsList.length - 1} outros
                                    </span>
                                  )}
                                </div>

                                {/* Detached Hover Trigger Badge with Smart Auto-Positioning */}
                                <button
                                  type="button"
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const modalWidth = 320
                                    const spaceBelow = window.innerHeight - rect.bottom
                                    const spaceAbove = rect.top

                                    let top = 0
                                    let placement = 'bottom'

                                    // If not enough room below (less than 260px) and more room above, display ABOVE
                                    if (spaceBelow < 260 && spaceAbove > spaceBelow) {
                                      top = rect.top - 8
                                      placement = 'top'
                                    } else {
                                      top = rect.bottom + 8
                                      placement = 'bottom'
                                    }

                                    const left = Math.max(16, Math.min(rect.left, window.innerWidth - modalWidth - 24))

                                    setActiveTooltip({
                                      itemsList,
                                      totalQty,
                                      valorAluguel: c.valor_aluguel,
                                      valorCaucao: c.valor_caucao,
                                      caucaoPago: c.caucao_pago,
                                      formaCaucao: c.forma_pagamento_caucao,
                                      locatarioNome: c.locatario_nome,
                                      top,
                                      left,
                                      placement
                                    })
                                  }}
                                  onMouseLeave={() => {
                                    setActiveTooltip(null)
                                  }}
                                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full transition-all border shadow-2xs cursor-help ${
                                    isMulti
                                      ? 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/25'
                                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border-outline-variant/60'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    {isMulti ? 'inventory_2' : 'info'}
                                  </span>
                                  <span>
                                    {totalQty} {totalQty === 1 ? 'item retirado' : 'itens retirados'}
                                  </span>
                                  <span className="material-symbols-outlined text-[13px] opacity-70">
                                    help
                                  </span>
                                </button>
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1 overflow-x-auto py-1">
                            {mesesAbreviados.map((nomeMes, idx) => {
                              const mesNum = idx + 1
                              
                              if (!shouldShowMonth(c.data_inicio, mesNum)) {
                                return null // Hide months before rental start
                              }

                              const paid = isMonthPaid(c.id, mesNum)
                              let tagClass = 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'

                              if (paid) {
                                tagClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleMonthClick(c, mesNum)}
                                  className={`px-2 py-0.5 rounded border text-[10px] font-bold select-none text-center min-w-[38px] cursor-pointer transition-colors ${tagClass}`}
                                  title={`Mapear pagamento de ${nomeMes}/${currentYear}`}
                                >
                                  {nomeMes}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            {parseFloat(c.valor_caucao || '0') > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenCaucaoReceipt(c)}
                                className="p-1.5 text-amber-700 hover:text-amber-900 rounded-xl hover:bg-amber-100 transition-colors inline-flex items-center"
                                title="Gerar / Baixar Recibo de Caução"
                              >
                                <span className="material-symbols-outlined text-[20px]">security</span>
                              </button>
                            )}
                            <Link 
                              to={`/aluguel/${c.id}`} 
                              className="p-1.5 text-outline hover:text-primary rounded-xl hover:bg-surface-container transition-colors inline-flex items-center"
                              title="Editar / Ver Detalhes"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteContract(c)}
                              className="p-1.5 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors inline-flex items-center"
                              title="Excluir Ficha de Empréstimo"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        // Equipment tab
        <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Equipamento</th>
                  <th className="px-6 py-4">Identificação & Local</th>
                  <th className="px-6 py-4 text-center">Valores Sugeridos</th>
                  <th className="px-6 py-4 text-center">Disponibilidade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/70 text-xs text-on-surface">
                {estoque.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-14 text-center text-on-surface-variant">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-3xl">inventory_2</span>
                      </div>
                      <p className="font-bold text-sm text-on-surface">Nenhum equipamento cadastrado no estoque.</p>
                      <p className="text-xs text-on-surface-variant mt-1">Cadastre cadeiras de rodas, muletas, andadores e outros itens para controle.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container shadow-xs inline-flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        Cadastrar Primeiro Equipamento
                      </button>
                    </td>
                  </tr>
                ) : (
                  estoque.map(eq => {
                    const total = parseInt(eq.quantidade_total) || 1
                    const disp = parseInt(eq.quantidade_disponivel) || 0
                    const perc = Math.min(100, Math.max(0, Math.round((disp / total) * 100)))
                    const iconName = getCategoryIcon(eq.nome_equipamento)

                    return (
                      <tr key={eq.id} className="hover:bg-secondary-container/10 transition-colors group">
                        {/* Equipamento */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                              <span className="material-symbols-outlined text-[20px]">{iconName}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-on-surface text-sm block truncate">
                                {eq.nome_equipamento}
                              </span>
                              {eq.observacoes && (
                                <p className="text-[10px] text-outline truncate max-w-xs mt-0.5" title={eq.observacoes}>
                                  {eq.observacoes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Identificação & Localização */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px] text-outline">tag</span>
                              <span className="font-mono text-xs text-on-surface-variant font-medium">
                                {eq.numero_serie || 'Sem Nº de Série'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-outline font-medium flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[13px]">location_on</span>
                                {eq.localizacao || 'Depósito Central'}
                              </span>
                              {eq.estado_conservacao && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                                  eq.estado_conservacao.includes('Excelente') || eq.estado_conservacao.includes('Novo')
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : eq.estado_conservacao.includes('Bom')
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : eq.estado_conservacao.includes('Manutenção')
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}>
                                  {eq.estado_conservacao}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Valores Sugeridos */}
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex flex-col items-center gap-0.5">
                            {parseFloat(eq.valor_caucao_sugerido || 0) > 0 ? (
                              <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px] text-amber-700">security</span>
                                Caução: R$ {parseFloat(eq.valor_caucao_sugerido).toFixed(2).replace('.', ',')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-outline">Caução: Isento</span>
                            )}

                            {parseFloat(eq.valor_aluguel_sugerido || 0) > 0 ? (
                              <span className="text-[10px] font-semibold text-primary">
                                Taxa: R$ {parseFloat(eq.valor_aluguel_sugerido).toFixed(2).replace('.', ',')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-outline">Taxa: Gratuito</span>
                            )}
                          </div>
                        </td>

                        {/* Disponibilidade & Barra */}
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex flex-col items-center w-28 mx-auto">
                            <span className="font-extrabold text-xs text-on-surface">
                              <strong className={disp > 0 ? 'text-primary' : 'text-error'}>{disp}</strong> de {total} un
                            </span>
                            <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-1.5 overflow-hidden border border-outline-variant/40">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  perc > 50 ? 'bg-primary' : perc > 0 ? 'bg-amber-500' : 'bg-rose-500'
                                }`} 
                                style={{ width: `${perc}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            disp > 0 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${disp > 0 ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                            {disp > 0 ? 'Disponível' : 'Esgotado'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(eq)}
                              className="p-1.5 text-outline hover:text-primary rounded-xl hover:bg-surface-container transition-colors inline-flex items-center"
                              title="Editar Equipamento"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEquipment(eq)}
                              className="p-1.5 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors inline-flex items-center"
                              title="Excluir Equipamento"
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

      {/* Modal: Add/Edit Equipment */}
      {newEqModalOpen && (
        <div className="fixed inset-0 bg-on-background/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl border border-surface-variant p-6 md:p-8 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <header className="flex justify-between items-start border-b border-surface-variant pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                </div>
                <div>
                  <h3 className="font-bold text-primary text-lg">
                    {editingEquipamento ? 'Editar Equipamento do Estoque' : 'Cadastrar Novo Equipamento'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {editingEquipamento 
                      ? 'Atualize as informações, localização e quantidades disponíveis deste item.' 
                      : 'Cadastre itens no acervo para controle de estoque e preenchimento ágil nos empréstimos.'
                    }
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setNewEqModalOpen(false)
                  setEditingEquipamento(null)
                }} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            {/* Presets Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Sugestões Rápidas de Equipamento:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {equipamentosPresets.map(preset => {
                  const isSelected = newEqFormData.nome_equipamento === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setNewEqFormData(prev => ({
                          ...prev,
                          nome_equipamento: preset
                        }))
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-primary text-on-primary border-primary shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant hover:border-primary/50 hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{getCategoryIcon(preset)}</span>
                      {preset}
                    </button>
                  )
                })}
              </div>
            </div>

            <form onSubmit={handleAddEquipmentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Nome do Equipamento (Full Width) */}
                <div className="md:col-span-12 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Nome do Equipamento / Modelo *</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      inventory_2
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Cadeira de Rodas Ortobrás Reforçada"
                      value={newEqFormData.nome_equipamento}
                      onChange={e => setNewEqFormData(prev => ({ ...prev, nome_equipamento: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-semibold focus:border-primary outline-none transition-all placeholder:text-outline/70"
                    />
                  </div>
                </div>

                {/* Nº de Série / Patrimônio */}
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Nº de Série / Patrimônio / Tombo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      tag
                    </span>
                    <input
                      type="text"
                      placeholder="Ex: CR-0012 ou SN-92842749"
                      value={newEqFormData.numero_serie}
                      onChange={e => setNewEqFormData(prev => ({ ...prev, numero_serie: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-mono focus:border-primary outline-none transition-all placeholder:text-outline/70"
                    />
                  </div>
                </div>

                {/* Localização / Almoxarifado */}
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Local de Armazenamento</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      location_on
                    </span>
                    <input
                      type="text"
                      placeholder="Ex: Depósito Central - Prateleira A"
                      value={newEqFormData.localizacao}
                      onChange={e => setNewEqFormData(prev => ({ ...prev, localizacao: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-outline/70"
                    />
                  </div>
                </div>

                {/* Quantidade Total */}
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Quantidade Total *</label>
                  <div className="flex items-center border border-outline-variant rounded-xl bg-surface overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setNewEqFormData(prev => ({ ...prev, quantidade_total: Math.max(1, (parseInt(prev.quantidade_total) || 1) - 1).toString() }))}
                      className="px-3 py-2.5 hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center font-bold"
                    >
                      <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newEqFormData.quantidade_total}
                      onChange={e => setNewEqFormData(prev => ({ ...prev, quantidade_total: e.target.value }))}
                      className="w-full text-center py-2 bg-transparent text-xs md:text-sm font-bold focus:outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setNewEqFormData(prev => ({ ...prev, quantidade_total: ((parseInt(prev.quantidade_total) || 1) + 1).toString() }))}
                      className="px-3 py-2.5 hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center font-bold"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                </div>

                {/* Estado de Conservação */}
                <div className="md:col-span-8 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Estado de Conservação</label>
                  <select
                    value={newEqFormData.estado_conservacao}
                    onChange={e => setNewEqFormData(prev => ({ ...prev, estado_conservacao: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-medium focus:border-primary outline-none transition-all"
                  >
                    {estadosConservacao.map(est => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>

                {/* Valor Sugerido de Caução */}
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Valor Sugerido de Caução (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700 font-bold text-xs">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00 (Isento)"
                      value={newEqFormData.valor_caucao_sugerido}
                      onChange={e => setNewEqFormData(prev => ({ ...prev, valor_caucao_sugerido: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold text-amber-900 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Taxa / Contribuição Sugerida */}
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Taxa Mensal Sugerida (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-xs">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00 (Gratuito)"
                      value={newEqFormData.valor_aluguel_sugerido}
                      onChange={e => setNewEqFormData(prev => ({ ...prev, valor_aluguel_sugerido: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm font-bold text-primary focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Observações / Detalhes */}
                <div className="md:col-span-12 space-y-1">
                  <label className="block text-xs font-bold text-on-surface">Observações & Detalhes Técnicos</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Suporta até 130kg, doação recebida em bom estado, acompanha apoio de pés regulável..."
                    value={newEqFormData.observacoes}
                    onChange={e => setNewEqFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs md:text-sm focus:border-primary outline-none transition-all placeholder:text-outline/70 resize-none"
                  />
                </div>

              </div>

              {/* Botões de Ação */}
              <div className="pt-4 border-t border-surface-variant flex justify-end items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNewEqModalOpen(false)
                    setEditingEquipamento(null)
                  }}
                  className="px-5 py-2.5 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {editingEquipamento ? 'save' : 'add_circle'}
                  </span>
                  {saving 
                    ? 'Salvando...' 
                    : editingEquipamento 
                    ? 'Salvar Alterações' 
                    : 'Cadastrar Equipamento'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerenciar Pagamento (Direto) */}
      {payModal.isOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3 shrink-0">
              <h3 className="font-semibold text-primary text-headline-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[22px]">payments</span>
                Gerenciar Pagamento
              </h3>
              <button 
                onClick={() => setPayModal(prev => ({ ...prev, isOpen: false }))} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            {payModal.initialStatus === 'Pago' ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 text-[24px] shrink-0">check_circle</span>
                  <div>
                    <h4 className="font-semibold text-sm">Pagamento Confirmado</h4>
                    <p className="text-xs mt-0.5 text-emerald-700">
                      O aluguel para <strong>"{payModal.contract?.locatario_nome}"</strong> referente a <strong>{payModal.mesLabel} de {currentYear}</strong> já está pago.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                    Gerar Recibo de Pagamento
                  </button>
                </div>

                <div className="pt-4 border-t border-surface-variant flex justify-end items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setPayModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePayStatus} className="space-y-4">
                <div className="text-body-sm text-on-surface-variant">
                  Confirmar o pagamento do aluguel para <strong className="text-gray-900">"{payModal.contract?.locatario_nome}"</strong> referente ao mês de <strong className="text-primary">{payModal.mesLabel} de {currentYear}</strong>?
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs">
                  Ao confirmar, uma entrada no valor de <strong>R$ {parseFloat(payModal.contract?.valor_aluguel || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> será lançada automaticamente no Caderno de Fechamento.
                </div>

                <div className="pt-3 border-t border-surface-variant flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPayModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayStatus}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    {savingPayStatus ? 'Confirmando...' : 'Confirmar Pagamento'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Detached Fixed Floating Tooltip Card rendered over entire page with auto-flip */}
      {activeTooltip && (
        <div 
          style={{ 
            position: 'fixed', 
            top: `${activeTooltip.top}px`, 
            left: `${activeTooltip.left}px`,
            transform: activeTooltip.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 99999 
          }}
          className="bg-surface rounded-3xl p-4 shadow-2xl w-80 pointer-events-none border-2 border-primary/30 animate-in fade-in zoom-in-95 duration-150 ring-4 ring-black/5 backdrop-blur-md"
        >
          {/* Arrow pointing to trigger button */}
          {activeTooltip.placement === 'top' ? (
            <div className="absolute left-6 -bottom-1.5 w-3 h-3 bg-surface border-b border-r border-primary/30 rotate-45"></div>
          ) : (
            <div className="absolute left-6 -top-1.5 w-3 h-3 bg-surface border-t border-l border-primary/30 rotate-45"></div>
          )}

          <div className="flex items-center justify-between border-b border-surface-variant/80 pb-2 mb-2.5 relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary">
              <span className="material-symbols-outlined text-[17px]">inventory_2</span>
              Itens Deste Empréstimo
            </div>
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-extrabold px-2.5 py-0.5 rounded-full">
              Total: {activeTooltip.totalQty} un
            </span>
          </div>

          <ul className="space-y-1.5 text-xs max-h-56 overflow-y-auto pr-0.5 relative z-10">
            {activeTooltip.itemsList.map((it, idx) => (
              <li key={idx} className="flex justify-between items-start gap-2 bg-surface-container-low/90 p-2.5 rounded-xl border border-outline-variant/60">
                <div className="min-w-0">
                  <span className="font-bold text-on-surface block truncate">
                    {it.quantidade || 1}x {it.nome_equipamento || it.imovel_tipo || 'Item'}
                  </span>
                  {it.numero_serie && (
                    <span className="text-[10px] text-outline font-mono block">Nº Série: {it.numero_serie}</span>
                  )}
                </div>
                {parseFloat(it.valor_unitario) > 0 && (
                  <span className="text-[11px] font-extrabold text-primary shrink-0 font-mono">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(it.valor_unitario) * (parseInt(it.quantidade) || 1))}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-2.5 pt-2 border-t border-surface-variant/80 space-y-1.5 text-xs relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-on-surface-variant">Taxa de Uso / Mensal:</span>
              <span className="font-extrabold text-primary text-xs font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(activeTooltip.valorAluguel || 0))}
              </span>
            </div>

            {parseFloat(activeTooltip.valorCaucao || 0) > 0 && (
              <div className="flex justify-between items-center pt-1 border-t border-dashed border-amber-300/80 text-amber-900">
                <span className="text-[11px] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-amber-700">security</span>
                  Caução ({activeTooltip.caucaoPago ? 'Pago' : 'Pendente'}):
                </span>
                <span className="font-black text-xs font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(activeTooltip.valorCaucao))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal: Visualizar / Baixar / Imprimir Recibo de Caução */}
      {caucaoReceiptModal.isOpen && caucaoReceiptModal.contract && (
        <div className="fixed inset-0 bg-on-background/60 backdrop-blur-[2px] z-50 overflow-y-auto p-4 md:p-8 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl border border-surface-variant p-6 md:p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Controls Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-surface-variant pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">security</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Recibo de Caução de Garantia</h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    Nº: CAUCAO-{(caucaoReceiptModal.contract.id || '0000').substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handlePrintCaucaoReceipt(caucaoReceiptModal.contract)}
                  className="px-3.5 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/80 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCaucaoReceiptPDF(caucaoReceiptModal.contract)}
                  className="px-3.5 py-2 bg-amber-700 text-white hover:bg-amber-800 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setCaucaoReceiptModal({ isOpen: false, contract: null })}
                  className="p-2 text-outline hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </header>

            {/* Visual Preview */}
            <div className="border-2 border-amber-300 rounded-2xl p-6 md:p-8 flex flex-col gap-6 bg-surface shadow-xs relative">
              {/* Receipt Header */}
              <div className="flex justify-between items-start border-b border-surface-variant/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center font-black text-lg">
                    🛡️
                  </div>
                  <div>
                    <h4 className="font-extrabold text-on-surface text-sm">{config?.nome_instituicao || 'Sistema Pastoral'}</h4>
                    <p className="text-[11px] text-on-surface-variant">Filantropia & Gestão Inteligente</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-300">
                    Caução de Garantia
                  </span>
                  <p className="text-[10px] text-outline mt-1 font-mono">
                    Nº: CAUCAO-{(caucaoReceiptModal.contract.id || '0000').substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Amount Box */}
              <div className="rounded-xl p-4 flex justify-between items-center bg-amber-50/70 border border-amber-200 text-amber-900">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                    Valor do Caução Recebido:
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Forma: <strong>{caucaoReceiptModal.contract.forma_pagamento_caucao || caucaoReceiptModal.contract.forma_pagamento || 'PIX'}</strong>
                  </span>
                </div>
                <span className="text-2xl font-black">{formatCurrency(parseFloat(caucaoReceiptModal.contract.valor_caucao || '0'))}</span>
              </div>

              {/* Body */}
              <div className="space-y-4 text-xs md:text-sm text-on-surface leading-relaxed">
                <p>
                  Recebemos de <strong className="text-on-surface">{caucaoReceiptModal.contract.locatario_nome}</strong>, CPF sob nº <strong className="text-on-surface">{caucaoReceiptModal.contract.locatario_cpf || 'Não informado'}</strong>, a quantia de <strong>{numberToWords(parseFloat(caucaoReceiptModal.contract.valor_caucao || '0'))}</strong> ({formatCurrency(parseFloat(caucaoReceiptModal.contract.valor_caucao || '0'))}), paga via <strong>{caucaoReceiptModal.contract.forma_pagamento_caucao || caucaoReceiptModal.contract.forma_pagamento || 'PIX'}</strong>, a título de <strong>CAUÇÃO DE GARANTIA</strong>.
                </p>

                {/* Items */}
                <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/60">
                  <span className="text-[11px] font-bold text-on-surface-variant block mb-1.5 uppercase tracking-wider">Itens do Empréstimo:</span>
                  {(() => {
                    let cItens = []
                    const c = caucaoReceiptModal.contract
                    if (Array.isArray(c.itens) && c.itens.length > 0) {
                      cItens = c.itens
                    } else if (c.observacoes && c.observacoes.includes('<!--ITENS_JSON:')) {
                      try {
                        const match = c.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
                        if (match && match[1]) cItens = JSON.parse(match[1])
                      } catch (_) {}
                    }
                    if (cItens.length > 0) {
                      return (
                        <div className="space-y-1.5">
                          {cItens.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-primary">
                                • {it.quantidade || 1}x {it.nome_equipamento || 'Equipamento'} {it.numero_serie ? `(S/N: ${it.numero_serie})` : ''}
                              </span>
                              {it.descricao && <span className="text-[11px] text-on-surface-variant italic">({it.descricao})</span>}
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div className="text-xs font-semibold text-primary">
                        {c.estoque_equipamentos?.nome_equipamento || c.imovel_endereco || 'Equipamentos Emprestados'}
                      </div>
                    )
                  })()}
                </div>

                {/* Terms */}
                <div className="bg-amber-50/50 p-3 rounded-xl border-l-4 border-amber-600 text-xs text-amber-950 space-y-1">
                  <strong className="block font-bold text-amber-900">Termos de Devolução do Caução:</strong>
                  <p className="text-[11px] leading-relaxed">
                    O valor permanecerá sob guarda da instituição durante o empréstimo e será restituído integralmente na devolução dos equipamentos em perfeito estado na sede da pastoral.
                  </p>
                </div>
              </div>

              {/* Meta & Signatures */}
              <div className="border-t border-surface-variant/80 pt-6 mt-2 flex flex-col sm:flex-row justify-between items-end gap-6">
                <div className="text-[11px] text-outline space-y-1">
                  <div><strong>Data do Caução:</strong> {caucaoReceiptModal.contract.data_caucao ? new Date(caucaoReceiptModal.contract.data_caucao).toLocaleDateString('pt-BR') : (caucaoReceiptModal.contract.data_inicio ? new Date(caucaoReceiptModal.contract.data_inicio).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'))}</div>
                  <div><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
                </div>

                <div className="flex flex-col items-center w-full sm:w-56 text-center">
                  <div className="w-full border-t border-dashed border-outline/70 mb-1.5"></div>
                  <span className="text-xs font-bold text-on-surface">
                    {caucaoReceiptModal.contract.locatario_nome}
                  </span>
                  <span className="text-[10px] text-outline">Locatário / Beneficiário</span>
                </div>
              </div>

            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setCaucaoReceiptModal({ isOpen: false, contract: null })}
                className="px-5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
