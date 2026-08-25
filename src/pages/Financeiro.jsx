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

  // Predefined lists
  const categoriasEntrada = [
    'Doação em Dinheiro', 'Doação em Produto', 'Evento Beneficente',
    'Parceria Institucional', 'Dízimo', 'Oferta', 'Repasse Governamental', 'Outros'
  ]
  const categoriasSaida = [
    'Alimentação', 'Cesta Básica', 'Medicamentos', 'Aluguel',
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

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await fetchFinanceiroMensal('todos', currentMonth, currentYear)
      setLancamentos(data)
    } catch (err) {
      showToast('Falha ao buscar lançamentos', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    loadData()
  }, [currentMonth, currentYear])

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
      let category = prev.categoria
      if (name === 'tipo') {
        category = value === 'entrada' ? categoriasEntrada[0] : categoriasSaida[0]
      }
      return { ...prev, [name]: value, categoria: category }
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
      ? `Este lançamento está vinculado a uma Ficha de Empréstimo/Aluguel ("${item.descricao}"). Ao excluí-lo aqui no Caderno de Fechamento, o registro na Ficha de Aluguel também será excluído e o estoque de equipamentos será restaurado automaticamente. Deseja confirmar?`
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
              ? 'Lançamento e Ficha de Aluguel vinculada excluídos com sucesso!' 
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
                    <td className="px-5 py-3.5 font-bold text-on-surface">{item.descricao}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low border border-outline-variant/60 text-[10px] font-bold">
                        {item.categoria}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-extrabold ${activeTab === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(item.valor)}
                    </td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{item.forma_pagamento || 'PIX'}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{item.responsavel?.nome || 'Pastoral'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditDrawer(item)} 
                          className="p-1 text-outline hover:text-primary rounded-lg hover:bg-surface-container transition-colors"
                          title="Editar lançamento"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className="p-1 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors"
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
    </div>
  )
}
