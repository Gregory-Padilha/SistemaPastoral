import React, { useEffect, useState } from 'react'
import { fetchFinanceiroMensal, insertLancamento, updateLancamento, deleteLancamento, fetchConfiguracoes } from '../lib/queries'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const Financeiro = () => {
  const { user } = useAuth()
  const { showToast, confirmDelete } = useFeedback()

  // Period Navigation State
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  // Data states
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState('entrada')

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingLancamento, setEditingLancamento] = useState(null)
  const [formData, setFormData] = useState({
    tipo: 'entrada',
    data: '',
    descricao: '',
    categoria: '',
    valor: '',
    forma_pagamento: 'PIX',
    responsavel: '',
    observacoes: ''
  })
  const [saving, setSaving] = useState(false)

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [selectedReceiptItem, setSelectedReceiptItem] = useState(null)

  // Predefined lists
  const categoriasEntrada = [
    'Doação em Dinheiro', 'Doação em Produto', 'Evento Beneficente',
    'Parceria Institucional', 'Dízimo', 'Oferta', 'Repasse Governamental',
    'Aluguel', 'Caução de Aluguel', 'Outros'
  ]
  const categoriasSaida = [
    'Alimentação', 'Cesta Básica', 'Medicamentos', 'Aluguel', 'Caução de Aluguel',
    'Água e Luz', 'Transporte', 'Material de Limpeza', 'Material de Escritório',
    'Manutenção', 'Auxílio Emergencial', 'Outros'
  ]
  const formasPagamento = ['Dinheiro', 'PIX', 'Transferência Bancária', 'Cartão de Débito/Crédito', 'Cheque', 'Doação Direta']

  const loadConfig = async () => {
    try {
      const data = await fetchConfiguracoes()
      setConfig(data)
    } catch (err) {
      console.error(err)
    }
  }

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchFinanceiroMensal('todos', currentMonth, currentYear)
      setLancamentos(data)
    } catch (err) {
      if (!silent) showToast('Falha ao buscar lançamentos', err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    loadData(false)
  }, [currentMonth, currentYear])

  useEffect(() => {
    const handleSilentRefresh = () => {
      if (!drawerOpen) {
        loadData(true)
      }
    }
    window.addEventListener('app:silent-refresh', handleSilentRefresh)
    window.addEventListener('focus', handleSilentRefresh)
    return () => {
      window.removeEventListener('app:silent-refresh', handleSilentRefresh)
      window.removeEventListener('focus', handleSilentRefresh)
    }
  }, [drawerOpen, currentMonth, currentYear])

  // Aggregate stats
  const totalEntradas = lancamentos
    .filter(l => l.tipo === 'entrada')
    .reduce((sum, item) => sum + parseFloat(item.valor || 0), 0)

  const totalSaidas = lancamentos
    .filter(l => l.tipo === 'saida')
    .reduce((sum, item) => sum + parseFloat(item.valor || 0), 0)

  const saldo = totalEntradas - totalSaidas

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(prev => prev - 1)
    } else {
      setCurrentMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(prev => prev + 1)
    } else {
      setCurrentMonth(prev => prev + 1)
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val || 0)
  }

  const getMonthName = (m) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return months[m - 1]
  }

  const openNewDrawer = (tipo) => {
    setEditingLancamento(null)
    setFormData({
      tipo: tipo,
      data: new Date().toISOString().split('T')[0],
      descricao: '',
      categoria: tipo === 'entrada' ? categoriasEntrada[0] : categoriasSaida[0],
      valor: '',
      forma_pagamento: 'PIX',
      responsavel: user?.profile?.nome || '',
      observacoes: ''
    })
    setDrawerOpen(true)
  }

  const openEditDrawer = (l) => {
    setEditingLancamento(l)
    setFormData({
      tipo: l.tipo,
      data: l.data,
      descricao: l.descricao,
      categoria: l.categoria,
      valor: l.valor.toString(),
      forma_pagamento: l.forma_pagamento || 'PIX',
      responsavel: l.responsavel_id ? (l.responsavel?.nome || '') : (user?.profile?.nome || ''),
      observacoes: l.observacoes || ''
    })
    setDrawerOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      if (name === 'tipo') {
        const defaultCat = value === 'entrada' ? categoriasEntrada[0] : categoriasSaida[0]
        return { ...prev, tipo: value, categoria: defaultCat }
      }
      return { ...prev, [name]: value }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    const missingFields = []
    if (!formData.data) missingFields.push('Data')
    if (!formData.descricao.trim()) missingFields.push('Descrição')
    if (!formData.valor || parseFloat(formData.valor) <= 0) missingFields.push('Valor')
    if (!formData.categoria) missingFields.push('Categoria')
    
    if (missingFields.length > 0) {
      showToast(
        'Campos obrigatórios ausentes',
        `Por favor preencha: ${missingFields.join(', ')}`,
        'error'
      )
      return
    }

    setSaving(true)
    try {
      const payload = {
        tipo: formData.tipo,
        data: formData.data,
        descricao: formData.descricao.trim(),
        categoria: formData.categoria,
        valor: parseFloat(formData.valor),
        forma_pagamento: formData.forma_pagamento,
        observacoes: formData.observacoes.trim() || null,
        responsavel_id: user?.id || null
      }

      if (editingLancamento) {
        await updateLancamento(editingLancamento.id, payload)
        showToast('Sucesso', 'Lançamento atualizado com sucesso!')
      } else {
        await insertLancamento(payload)
        showToast('Sucesso', 'Novo lançamento adicionado com sucesso!')
      }

      setDrawerOpen(false)
      loadData()
    } catch (err) {
      showToast('Erro ao salvar', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (item) => {
    const isAluguelLinked = !!item.contrato_id
    const confirmMessage = isAluguelLinked
      ? `Este lançamento está vinculado ao pagamento de uma Ficha de Empréstimo/Aluguel ("${item.descricao}"). Ao excluí-lo aqui no Caderno de Fechamento, o mês correspondente na Ficha de Aluguel voltará a ficar Não Pago (em vermelho), sem apagar a ficha do locatário. Deseja confirmar?`
      : `Tem certeza que deseja excluir o lançamento "${item.descricao}" no valor de ${formatCurrency(item.valor)}? Esta ação não poderá ser desfeita.`

    confirmDelete(
      'Confirmar Exclusão',
      confirmMessage,
      async () => {
        try {
          await deleteLancamento(item.id)
          showToast(
            'Sucesso', 
            isAluguelLinked 
              ? 'Lançamento excluído e status do mês na Ficha de Aluguel retornado para Não Pago!' 
              : 'Lançamento excluído com sucesso!'
          )
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  const categorySummaryMap = {}
  categoriasEntrada.forEach(c => { categorySummaryMap[c] = { tipo: 'entrada', total: 0 } })
  categoriasSaida.forEach(c => { categorySummaryMap[c] = { tipo: 'saida', total: 0 } })

  lancamentos.forEach(l => {
    if (categorySummaryMap[l.categoria]) {
      categorySummaryMap[l.categoria].total += parseFloat(l.valor || 0)
    } else {
      categorySummaryMap[l.categoria] = { tipo: l.tipo, total: parseFloat(l.valor || 0) }
    }
  })

  // Export PDF document
  const handleExportPDF = () => {
    if (lancamentos.length === 0) {
      showToast('Exportar PDF', 'Não há dados para exportar no período selecionado.', 'error')
      return
    }

    try {
      const doc = new jsPDF()
      const instName = config?.nome_instituicao || 'Sistema Pastoral'
      const instCnpj = config?.cnpj ? `CNPJ: ${config.cnpj}` : ''
      const periodLabel = `${getMonthName(currentMonth)} de ${currentYear}`

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(62, 82, 25)
      doc.text(instName, 14, 20)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      if (instCnpj) doc.text(instCnpj, 14, 26)
      doc.text(`Caderno de Fechamento Financeiro - Período: ${periodLabel}`, 14, 32)
      doc.line(14, 36, 196, 36)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 30, 30)
      doc.text(`Entradas Totais: ${formatCurrency(totalEntradas)}`, 14, 44)
      doc.text(`Saídas Totais: ${formatCurrency(totalSaidas)}`, 14, 50)
      doc.text(`Saldo Consolidado: ${formatCurrency(saldo)}`, 14, 56)

      const categoriesRows = Object.keys(categorySummaryMap)
        .map(key => ({ name: key, ...categorySummaryMap[key] }))
        .filter(c => c.total > 0)
        .map(c => [
          c.name,
          c.tipo === 'entrada' ? 'Entrada' : 'Saída',
          formatCurrency(c.total)
        ])

      autoTable(doc, {
        startY: 62,
        head: [['Categoria', 'Tipo', 'Total Acumulado']],
        body: categoriesRows,
        theme: 'striped',
        headStyles: { fillColor: [62, 82, 25] },
        bodyStyles: { fontSize: 9 }
      })

      const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 30
      doc.line(40, finalY, 170, finalY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Assinatura do Responsável', 105, finalY + 6, { align: 'center' })

      doc.save(`fechamento-${currentMonth}-${currentYear}.pdf`)
      showToast('PDF Gerado', 'Relatório baixado com sucesso!', 'success')
    } catch (err) {
      showToast('Erro ao exportar', err.message, 'error')
    }
  }

  // Number to words in Portuguese
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

  const handleOpenReceiptModal = (item) => {
    setSelectedReceiptItem(item)
    setReceiptModalOpen(true)
  }

  const handleDownloadReceiptPDF = (item) => {
    try {
      const doc = new jsPDF()
      const instName = config?.nome_instituicao || 'Sistema Pastoral'
      const instCnpj = config?.cnpj ? `CNPJ: ${config.cnpj}` : ''
      const instEndereco = config?.endereco || ''
      const instCidade = config?.cidade || ''
      const numRecibo = (item.id || '0000').substring(0, 8).toUpperCase()
      const valorFormatado = formatCurrency(item.valor)
      const valorExtenso = numberToWords(parseFloat(item.valor || 0))
      const dataFormatada = new Date(item.data).toLocaleDateString('pt-BR')
      const isEntrada = item.tipo === 'entrada'

      // Header Green/Accent Banner
      if (isEntrada) {
        doc.setFillColor(62, 82, 25)
      } else {
        doc.setFillColor(159, 18, 57)
      }
      doc.rect(0, 0, 210, 35, 'F')

      // Header Text
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(255, 255, 255)
      doc.text(instName.toUpperCase(), 14, 16)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(230, 245, 220)
      if (instCnpj) doc.text(instCnpj, 14, 23)
      if (instEndereco) doc.text(`${instEndereco}${instCidade ? ` - ${instCidade}` : ''}`, 14, 29)

      // Receipt Title & Number on right
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(255, 255, 255)
      doc.text(isEntrada ? 'RECIBO DE ENTRADA' : 'COMPROVANTE DE SAÍDA', 196, 16, { align: 'right' })
      doc.setFontSize(9)
      doc.text(`Nº: REC-${numRecibo}`, 196, 24, { align: 'right' })

      // Value Box
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(isEntrada ? 62 : 159, isEntrada ? 82 : 18, isEntrada ? 25 : 57)
      doc.setLineWidth(0.5)
      doc.roundedRect(14, 45, 182, 22, 3, 3, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(isEntrada ? 62 : 159, isEntrada ? 82 : 18, isEntrada ? 25 : 57)
      doc.text(isEntrada ? 'VALOR RECEBIDO:' : 'VALOR PAGO:', 20, 54)

      doc.setFontSize(16)
      doc.text(valorFormatado, 190, 59, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`Forma de Pagamento: ${item.forma_pagamento || 'PIX'} | Categoria: ${item.categoria || 'Lançamento Geral'}`, 20, 62)

      // Body Text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)

      const bodyText = `Declaramos para os devidos fins que ${isEntrada ? 'recebemos' : 'pagamos'} a importância supra de ${valorExtenso} (${valorFormatado}), referente a: ${item.descricao || item.categoria}.`
      const splitBody = doc.splitTextToSize(bodyText, 182)
      doc.text(splitBody, 14, 80)

      let currentY = 80 + (splitBody.length * 6) + 6

      if (item.observacoes) {
        doc.setFillColor(250, 250, 250)
        doc.setDrawColor(220, 220, 220)
        doc.roundedRect(14, currentY, 182, 18, 2, 2, 'FD')
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(`Observações / Detalhes: ${item.observacoes}`, 18, currentY + 7, { maxWidth: 174 })
        currentY += 26
      }

      // Date of Emission
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text(`Data do Lançamento: ${dataFormatada}`, 14, currentY + 8)
      doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 196, currentY + 8, { align: 'right' })

      // Signature Section
      const sigY = currentY + 38
      doc.line(60, sigY, 150, sigY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.text(instName, 105, sigY + 6, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`Responsável: ${item.responsavel?.nome || user?.email || 'Tesouraria Pastoral'}`, 105, sigY + 11, { align: 'center' })

      doc.save(`recibo-${item.categoria.toLowerCase().replace(/\s+/g, '-')}-${numRecibo}.pdf`)
      showToast('Recibo Baixado', 'O arquivo PDF do recibo foi gerado com sucesso!', 'success')
    } catch (err) {
      showToast('Erro ao gerar recibo', err.message, 'error')
    }
  }

  const handlePrintReceiptWindow = (item) => {
    const printWindow = window.open('', '_blank');
    const valorFormated = parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const valorExtenso = numberToWords(parseFloat(item.valor || 0));
    const instName = config?.nome_instituicao || 'Sistema Pastoral';
    const instCnpj = config?.cnpj ? `CNPJ: ${config.cnpj}` : '';
    const instEndereco = config?.endereco ? `${config.endereco}${config.cidade ? ` - ${config.cidade}` : ''}` : '';
    const numRecibo = (item.id || '0000').substring(0, 8).toUpperCase();
    const dataFormatada = new Date(item.data).toLocaleDateString('pt-BR');
    const isEntrada = item.tipo === 'entrada';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo - ${numRecibo}</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; background: #fff; line-height: 1.5; }
            .receipt-card { border: 2px solid ${isEntrada ? '#3e5219' : '#9f1239'}; border-radius: 16px; padding: 32px; max-width: 720px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand-logo { width: 44px; height: 44px; background: ${isEntrada ? '#3e5219' : '#9f1239'}; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
            .title-box { text-align: right; }
            .title-box h2 { margin: 0; color: ${isEntrada ? '#3e5219' : '#9f1239'}; font-size: 20px; font-weight: 800; }
            .title-box p { margin: 4px 0 0 0; color: #64748b; font-size: 12px; font-family: monospace; }
            .amount-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
            .amount-label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; }
            .amount-value { font-size: 24px; font-weight: 800; color: ${isEntrada ? '#3e5219' : '#9f1239'}; }
            .body-text { font-size: 14px; color: #334155; margin-bottom: 24px; text-align: justify; }
            .details-box { background: #f8fafc; border-left: 4px solid ${isEntrada ? '#3e5219' : '#9f1239'}; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #475569; margin-bottom: 30px; }
            .footer { border-top: 1.5px solid #e2e8f0; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
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
                <div class="brand-logo">✝</div>
                <div>
                  <h3 style="margin:0; font-size:16px; font-weight:800; color:#1e293b;">${instName}</h3>
                  <div style="font-size:11px; color:#64748b;">${instCnpj} ${instEndereco ? `• ${instEndereco}` : ''}</div>
                </div>
              </div>
              <div class="title-box">
                <h2>${isEntrada ? 'RECIBO DE ENTRADA' : 'COMPROVANTE DE SAÍDA'}</h2>
                <p>Nº: REC-${numRecibo}</p>
              </div>
            </div>

            <div class="amount-box">
              <div>
                <div class="amount-label">${isEntrada ? 'Valor Recebido:' : 'Valor Pago:'}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Forma: <strong>${item.forma_pagamento || 'PIX'}</strong> | Categoria: <strong>${item.categoria || 'Lançamento Geral'}</strong></div>
              </div>
              <div class="amount-value">R$ ${valorFormated}</div>
            </div>

            <div class="body-text">
              Declaramos para os devidos fins que ${isEntrada ? 'recebemos' : 'pagamos'} a importância de <strong>${valorExtenso}</strong> (R$ ${valorFormated}), referente a: <strong>${item.descricao || item.categoria}</strong>.
            </div>

            ${item.observacoes ? `
              <div class="details-box">
                <strong>Observações:</strong> ${item.observacoes}
              </div>
            ` : ''}

            <div class="footer">
              <div class="meta">
                <div><strong>Data do Lançamento:</strong> ${dataFormatada}</div>
                <div><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-name">${item.responsavel?.nome || user?.email || 'Tesouraria Pastoral'}</div>
                <div class="signature-role">${isEntrada ? 'Responsável pelo Recebimento' : 'Responsável pelo Pagamento'}</div>
              </div>
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

  const activeLancamentos = lancamentos.filter(l => l.tipo === activeTab)

  return (
    <div className="flex flex-col gap-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Fluxo de Caixa & Tesouraria
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Caderno de Fechamento Financeiro
          </h2>
          <p className="text-xs text-on-surface-variant">
            Gerencie entradas, saídas, doações e gere o balanço contábil mensal.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-surface border border-outline-variant/80 hover:border-primary/50 text-on-surface hover:text-primary rounded-2xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Exportar PDF
          </button>
          <button 
            onClick={() => openNewDrawer('entrada')}
            className="bg-emerald-700 text-white hover:bg-emerald-800 px-4 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            + Entrada
          </button>
          <button 
            onClick={() => openNewDrawer('saida')}
            className="bg-rose-700 text-white hover:bg-rose-800 px-4 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            - Saída
          </button>
        </div>
      </div>

      {/* Overview summaries KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-3xl p-5 border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total de Entradas</span>
            <div className="text-2xl font-extrabold text-emerald-700">{formatCurrency(totalEntradas)}</div>
            <p className="text-[10px] text-outline font-medium">Doações, dízimos e ofertas</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[26px]">trending_up</span>
          </div>
        </div>
        
        <div className="bg-surface rounded-3xl p-5 border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Total de Saídas</span>
            <div className="text-2xl font-extrabold text-rose-700">{formatCurrency(totalSaidas)}</div>
            <p className="text-[10px] text-outline font-medium">Alimentos, contas e auxílios</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[26px]">trending_down</span>
          </div>
        </div>

        <div className={`rounded-3xl p-5 border shadow-xs flex items-center justify-between ${
          saldo >= 0 
            ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary border-primary/30' 
            : 'bg-gradient-to-br from-amber-600 to-amber-700 text-white border-amber-500'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85 block">Saldo do Mês</span>
            <div className="text-2xl font-extrabold">{formatCurrency(saldo)}</div>
            <p className="text-[10px] opacity-80 font-medium">{saldo >= 0 ? 'Superávit no período' : 'Déficit no período'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[26px]">account_balance_wallet</span>
          </div>
        </div>
      </div>

      {/* Date Navigation & Period Bar */}
      <div className="flex items-center justify-between bg-surface px-6 py-3.5 rounded-2xl border border-outline-variant/80 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Período Contábil:</span>
          <strong className="text-sm font-bold text-primary">{getMonthName(currentMonth)} de {currentYear}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center transition-colors"
            title="Mês anterior"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button 
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center transition-colors"
            title="Próximo mês"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Tabs selectors & Table */}
      <section className="bg-surface rounded-3xl border border-outline-variant/80 shadow-xs overflow-hidden">
        <div className="border-b border-surface-variant/80 flex bg-surface-container-lowest p-2 gap-2">
          <button
            onClick={() => setActiveTab('entrada')}
            className={`py-2 px-5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'entrada'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            Entradas ({lancamentos.filter(l => l.tipo === 'entrada').length})
          </button>
          <button
            onClick={() => setActiveTab('saida')}
            className={`py-2 px-5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'saida'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            Saídas ({lancamentos.filter(l => l.tipo === 'saida').length})
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Data</th>
                <th className="px-5 py-3.5">Descrição</th>
                <th className="px-5 py-3.5">Categoria</th>
                <th className="px-5 py-3.5 text-right">Valor</th>
                <th className="px-5 py-3.5">Forma</th>
                <th className="px-5 py-3.5">Responsável</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-outline">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <span>Carregando lançamentos...</span>
                  </td>
                </tr>
              ) : activeLancamentos.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-outline">
                    Nenhum registro de {activeTab === 'entrada' ? 'entrada' : 'saída'} neste mês.
                  </td>
                </tr>
              ) : (
                activeLancamentos.map(item => (
                  <tr key={item.id} className="hover:bg-secondary-container/15 transition-colors group">
                    <td className="px-5 py-3.5 text-outline font-mono whitespace-nowrap">
                      {new Date(item.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 max-w-sm">
                      <div className="font-bold text-on-surface">{item.descricao}</div>
                      {item.observacoes && (
                        <div className="text-[11px] text-on-surface-variant font-normal mt-0.5 line-clamp-1" title={item.observacoes}>
                          {item.observacoes}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.categoria === 'Caução de Aluguel'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : item.categoria === 'Aluguel'
                          ? 'bg-primary/10 text-primary border-primary/25'
                          : 'bg-surface-container-low border-outline-variant/60 text-on-surface'
                      }`}>
                        {item.categoria}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-extrabold ${activeTab === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(item.valor)}
                    </td>
                    <td className="px-5 py-3.5 text-on-surface-variant font-medium">{item.forma_pagamento || 'PIX'}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{item.responsavel?.nome || 'Pastoral'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button 
                          onClick={() => handleOpenReceiptModal(item)} 
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded-xl hover:bg-emerald-100/70 transition-colors inline-flex items-center"
                          title="Gerar / Baixar Recibo"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                        </button>
                        <button 
                          onClick={() => openEditDrawer(item)} 
                          className="p-1.5 text-outline hover:text-primary rounded-xl hover:bg-surface-container transition-colors inline-flex items-center"
                          title="Editar lançamento"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className="p-1.5 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors inline-flex items-center"
                          title="Excluir lançamento"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary report breakdown */}
      <section className="bg-surface rounded-3xl border border-outline-variant/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-variant/80 pb-3">
          <span className="material-symbols-outlined text-primary text-[20px]">summarize</span>
          <div>
            <h3 className="font-bold text-primary text-sm">Resumo Consolidado por Categoria</h3>
            <p className="text-[11px] text-outline">Demonstrativo sintético para prestação de contas no mês.</p>
          </div>
        </div>

        <div className="max-w-2xl border border-outline-variant/80 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3 text-right">Total Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
              {Object.keys(categorySummaryMap)
                .map(key => ({ name: key, ...categorySummaryMap[key] }))
                .filter(c => c.total > 0).length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-5 py-8 text-center text-outline">
                      Sem lançamentos para exibir no balanço consolidado deste mês.
                    </td>
                  </tr>
                ) : (
                  Object.keys(categorySummaryMap)
                    .map(key => ({ name: key, ...categorySummaryMap[key] }))
                    .filter(c => c.total > 0)
                    .map(c => (
                      <tr key={c.name} className="hover:bg-secondary-container/10 transition-colors">
                        <td className="px-5 py-3 font-bold">{c.name}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.tipo === 'entrada' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}>
                            {c.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-right font-extrabold ${c.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatCurrency(c.total)}
                        </td>
                      </tr>
                    ))
                )}
              <tr className="bg-surface-container-low font-bold">
                <td className="px-5 py-3" colSpan="2">Subtotal de Entradas</td>
                <td className="px-5 py-3 text-right text-emerald-700">{formatCurrency(totalEntradas)}</td>
              </tr>
              <tr className="bg-surface-container-low font-bold">
                <td className="px-5 py-3" colSpan="2">Subtotal de Saídas</td>
                <td className="px-5 py-3 text-right text-rose-700">{formatCurrency(totalSaidas)}</td>
              </tr>
              <tr className="bg-surface-container-high/60 font-extrabold text-sm border-t border-outline-variant">
                <td className="px-5 py-3.5" colSpan="2">Saldo Líquido</td>
                <td className={`px-5 py-3.5 text-right ${saldo >= 0 ? 'text-primary' : 'text-rose-700'}`}>
                  {formatCurrency(saldo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer Panel */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-on-background/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setDrawerOpen(false)}></div>
          
          <div className="relative bg-surface w-full md:w-[460px] h-full shadow-2xl flex flex-col border-l border-surface-variant z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-surface-variant/80 flex justify-between items-center bg-surface-container-low">
              <div>
                <h3 className="font-bold text-primary text-base">
                  {editingLancamento ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                <p className="text-xs text-on-surface-variant">Preencha os dados do registro financeiro.</p>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-on-surface hover:bg-surface-container rounded-xl"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form inputs */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-on-surface">Tipo de Lançamento *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange({ target: { name: 'tipo', value: 'entrada' } })}
                    className={`py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                      formData.tipo === 'entrada' 
                        ? 'bg-emerald-700 text-white shadow-xs' 
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange({ target: { name: 'tipo', value: 'saida' } })}
                    className={`py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                      formData.tipo === 'saida' 
                        ? 'bg-rose-700 text-white shadow-xs' 
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                    Saída
                  </button>
                </div>
              </div>

              {/* Data & Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">Data *</label>
                  <input
                    name="data"
                    type="date"
                    value={formData.data}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs font-semibold focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">Valor (R$) *</label>
                  <input
                    name="valor"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs font-bold focus:border-primary outline-none font-mono"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Descrição *</label>
                <input
                  name="descricao"
                  type="text"
                  placeholder="Ex: Doação Campanha do Quilo"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Categoria *</label>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none"
                >
                  {formData.tipo === 'entrada' 
                    ? categoriasEntrada.map(c => <option key={c} value={c}>{c}</option>)
                    : categoriasSaida.map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Forma de Recebimento / Pagamento *</label>
                <select
                  name="forma_pagamento"
                  value={formData.forma_pagamento}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-semibold focus:border-primary outline-none"
                >
                  {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Responsável / Operador</label>
                <input
                  name="responsavel"
                  type="text"
                  placeholder="Nome do voluntário"
                  value={formData.responsavel}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-medium focus:border-primary outline-none"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">Observações Opcionais</label>
                <textarea
                  name="observacoes"
                  placeholder="Notas e detalhes adicionais..."
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded-xl px-3.5 py-2.5 bg-surface text-xs font-medium focus:border-primary outline-none h-20"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-surface-variant/80 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-xl font-bold text-xs hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-on-primary hover:bg-primary-container rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95"
                >
                  {saving ? 'Salvando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visualizar / Baixar / Imprimir Recibo Financeiro */}
      {receiptModalOpen && selectedReceiptItem && (
        <div className="fixed inset-0 bg-on-background/60 backdrop-blur-[2px] z-50 overflow-y-auto p-4 md:p-8 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl border border-surface-variant p-6 md:p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Controls Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-surface-variant pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  selectedReceiptItem.tipo === 'entrada' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">
                    {selectedReceiptItem.tipo === 'entrada' ? 'Recibo de Entrada' : 'Comprovante de Saída'}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    Nº: REC-{(selectedReceiptItem.id || '0000').substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handlePrintReceiptWindow(selectedReceiptItem)}
                  className="px-3.5 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/80 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReceiptPDF(selectedReceiptItem)}
                  className="px-3.5 py-2 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptModalOpen(false)
                    setSelectedReceiptItem(null)
                  }}
                  className="p-2 text-outline hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </header>

            {/* Visual Receipt Paper Preview */}
            <div className={`border-2 rounded-2xl p-6 md:p-8 flex flex-col gap-6 bg-surface shadow-xs relative ${
              selectedReceiptItem.tipo === 'entrada' ? 'border-primary/40' : 'border-rose-300'
            }`}>
              {/* Receipt Header */}
              <div className="flex justify-between items-start border-b border-surface-variant/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                    selectedReceiptItem.tipo === 'entrada' ? 'bg-primary text-on-primary' : 'bg-rose-700 text-white'
                  }`}>
                    ✝
                  </div>
                  <div>
                    <h4 className="font-extrabold text-on-surface text-sm">{config?.nome_instituicao || 'Sistema Pastoral'}</h4>
                    <p className="text-[11px] text-on-surface-variant">
                      {config?.cnpj ? `CNPJ: ${config.cnpj}` : ''} {config?.endereco ? `• ${config.endereco}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                    selectedReceiptItem.tipo === 'entrada' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {selectedReceiptItem.tipo === 'entrada' ? 'Recibo de Quitação' : 'Comprovante'}
                  </span>
                  <p className="text-[10px] text-outline mt-1 font-mono">
                    Nº: REC-{(selectedReceiptItem.id || '0000').substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Amount Highlight Banner */}
              <div className={`rounded-xl p-4 flex justify-between items-center border ${
                selectedReceiptItem.tipo === 'entrada' 
                  ? 'bg-primary/5 border-primary/20 text-primary' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                    {selectedReceiptItem.tipo === 'entrada' ? 'Valor Recebido:' : 'Valor Pago:'}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Forma: <strong>{selectedReceiptItem.forma_pagamento || 'PIX'}</strong> | Categoria: <strong>{selectedReceiptItem.categoria || 'Geral'}</strong>
                  </span>
                </div>
                <span className="text-2xl font-black">{formatCurrency(selectedReceiptItem.valor)}</span>
              </div>

              {/* Body Statement */}
              <div className="space-y-4 text-xs md:text-sm text-on-surface leading-relaxed">
                <p>
                  Declaramos para os devidos fins que <strong>{selectedReceiptItem.tipo === 'entrada' ? 'recebemos' : 'pagamos'}</strong> a quantia de <strong>{numberToWords(parseFloat(selectedReceiptItem.valor || 0))}</strong> ({formatCurrency(selectedReceiptItem.valor)}), referente a:
                </p>
                <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/60 font-semibold text-primary">
                  {selectedReceiptItem.descricao}
                </div>

                {selectedReceiptItem.observacoes && (
                  <div className="bg-surface-container-low p-3 rounded-xl border-l-4 border-primary text-xs text-on-surface-variant">
                    <strong>Observações / Detalhes:</strong> {selectedReceiptItem.observacoes}
                  </div>
                )}
              </div>

              {/* Meta & Signatures */}
              <div className="border-t border-surface-variant/80 pt-6 mt-4 flex flex-col sm:flex-row justify-between items-end gap-6">
                <div className="text-[11px] text-outline space-y-1">
                  <div><strong>Data do Lançamento:</strong> {new Date(selectedReceiptItem.data).toLocaleDateString('pt-BR')}</div>
                  <div><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
                </div>

                <div className="flex flex-col items-center w-full sm:w-56 text-center">
                  <div className="w-full border-t border-dashed border-outline/70 mb-1.5"></div>
                  <span className="text-xs font-bold text-on-surface">
                    {selectedReceiptItem.responsavel?.nome || user?.email || 'Tesouraria Pastoral'}
                  </span>
                  <span className="text-[10px] text-outline">Responsável pelo Registro</span>
                </div>
              </div>

            </div>

            {/* Modal Bottom Close */}
            <div className="flex justify-end pt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setReceiptModalOpen(false)
                  setSelectedReceiptItem(null)
                }}
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
