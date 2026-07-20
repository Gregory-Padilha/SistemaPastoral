import React, { useEffect, useState } from 'react'
import { fetchFinanceiroMensal, insertLancamento, updateLancamento, deleteLancamento, fetchConfiguracoes } from '../lib/queries'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { supabase } from '../lib/supabase'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export const Financeiro = () => {
  const { user } = useAuth()
  const { showToast, confirmDelete } = useFeedback()

  // Period Navigation State
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1) // 1-12
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  // Data states
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState('entrada') // entrada, saida

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
  const formasPagamento = ['Dinheiro', 'PIX', 'Transferência Bancária', 'Cheque', 'Doação']

  // Load config & data
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
    .reduce((sum, item) => sum + parseFloat(item.valor), 0)

  const totalSaidas = lancamentos
    .filter(l => l.tipo === 'saida')
    .reduce((sum, item) => sum + parseFloat(item.valor), 0)

  const saldo = totalEntradas - totalSaidas

  // Navigation handlers
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

  // Currency utility
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val)
  }

  const getMonthName = (m) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return months[m - 1]
  }

  // Drawer handlers
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
      // automatically change default category if user toggles type inside drawer
      let category = prev.categoria
      if (name === 'tipo') {
        category = value === 'entrada' ? categoriasEntrada[0] : categoriasSaida[0]
      }
      return { ...prev, [name]: value, categoria: category }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    // Validations
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
    confirmDelete(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o lançamento "${item.descricao}" no valor de ${formatCurrency(item.valor)}? Esta ação não poderá ser desfeita.`,
      async () => {
        try {
          await deleteLancamento(item.id)
          showToast('Sucesso', 'Lançamento excluído com sucesso!')
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  // Summary categories lists logic
  const categorySummaryMap = {}
  categoriasEntrada.forEach(c => { categorySummaryMap[c] = { tipo: 'entrada', total: 0 } })
  categoriasSaida.forEach(c => { categorySummaryMap[c] = { tipo: 'saida', total: 0 } })

  lancamentos.forEach(l => {
    if (categorySummaryMap[l.categoria]) {
      categorySummaryMap[l.categoria].total += parseFloat(l.valor)
    } else {
      // Dynamic fallback for custom database categories
      categorySummaryMap[l.categoria] = { tipo: l.tipo, total: parseFloat(l.valor) }
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

      // Header Brand Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(62, 82, 25) // Primary olive
      doc.text(instName, 14, 20)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      if (instCnpj) doc.text(instCnpj, 14, 26)
      doc.text(`Caderno de Fechamento Financeiro - Período: ${periodLabel}`, 14, 32)
      doc.line(14, 36, 196, 36)

      // Totals
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 30, 30)
      doc.text(`Entradas Totais: ${formatCurrency(totalEntradas)}`, 14, 44)
      doc.text(`Saídas Totais: ${formatCurrency(totalSaidas)}`, 14, 50)
      doc.text(`Saldo Consolidado: ${formatCurrency(saldo)}`, 14, 56)

      // Summary Table of Categories
      const categoriesRows = Object.keys(categorySummaryMap)
        .map(key => ({ name: key, ...categorySummaryMap[key] }))
        .filter(c => c.total > 0)
        .map(c => [
          c.name,
          c.tipo === 'entrada' ? 'Entrada' : 'Saída',
          formatCurrency(c.total)
        ])

      doc.autoTable({
        startY: 62,
        head: [['Categoria', 'Tipo', 'Total Acumulado']],
        body: categoriesRows,
        theme: 'striped',
        headStyles: { fillColor: [62, 82, 25] },
        bodyStyles: { fontSize: 9 }
      })

      // Signature Area
      const finalY = doc.lastAutoTable.finalY + 30
      doc.line(40, finalY, 170, finalY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Assinatura do Responsável', 105, finalY + 6, { align: 'center' })

      doc.save(`fechamento-${currentMonth}-${currentYear}.pdf`)
    } catch (err) {
      showToast('Erro ao exportar', err.message, 'error')
    }
  }

  const activeLancamentos = lancamentos.filter(l => l.tipo === activeTab)

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-variant pb-6">
        <div>
          <h2 className="font-display-lg text-headline-lg text-primary font-semibold">Caderno de Fechamento</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Controle financeiro centralizado, balanços e relatórios mensais.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => openNewDrawer('entrada')}
            className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-4 py-2.5 rounded-xl flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Entrada
          </button>
          <button 
            onClick={() => openNewDrawer('saida')}
            className="bg-error text-on-error hover:bg-error/90 px-4 py-2.5 rounded-xl flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
            Saída
          </button>
        </div>
      </div>

      {/* Overview summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-outline-variant shadow-sm flex flex-col">
          <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Total de Entradas</span>
          <div className="text-display-lg-mobile font-bold text-green-600 mt-2">{formatCurrency(totalEntradas)}</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-outline-variant shadow-sm flex flex-col">
          <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Total de Saídas</span>
          <div className="text-display-lg-mobile font-bold text-red-600 mt-2">{formatCurrency(totalSaidas)}</div>
        </div>

        <div className={`rounded-2xl p-5 border shadow-sm flex flex-col ${
          saldo >= 0 
            ? 'bg-blue-50 border-blue-200 text-blue-900' 
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <span className="text-xs font-semibold uppercase tracking-wider">Saldo do Mês</span>
          <div className={`text-display-lg-mobile font-bold mt-2 ${saldo >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
            {formatCurrency(saldo)}
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4 bg-surface p-4 rounded-2xl border border-outline-variant/60 shadow-sm self-center w-full max-w-sm">
        <button 
          onClick={handlePrevMonth}
          className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="font-semibold text-primary text-md">
          {getMonthName(currentMonth)} de {currentYear}
        </span>
        <button 
          onClick={handleNextMonth}
          className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Tabs selectors */}
      <section className="bg-surface rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="border-b border-surface-variant flex bg-surface-container-low/40 px-6">
          <button
            onClick={() => setActiveTab('entrada')}
            className={`py-4 px-6 text-body-sm font-semibold border-b-2 transition-all ${
              activeTab === 'entrada'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Entradas
          </button>
          <button
            onClick={() => setActiveTab('saida')}
            className={`py-4 px-6 text-body-sm font-semibold border-b-2 transition-all ${
              activeTab === 'saida'
                ? 'border-error text-error font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Saídas
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/60 border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium text-right">Valor</th>
                <th className="px-6 py-4 font-medium">Forma</th>
                <th className="px-6 py-4 font-medium">Responsável</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <span className="text-on-surface-variant text-xs">Buscando lançamentos...</span>
                  </td>
                </tr>
              ) : activeLancamentos.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-on-surface-variant">Nenhum registro para esta aba no período selecionado.</td>
                </tr>
              ) : (
                activeLancamentos.map(item => (
                  <tr key={item.id} className="hover:bg-secondary-container/10 transition-colors group">
                    <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                      {new Date(item.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">{item.descricao}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{item.categoria}</td>
                    <td className={`px-6 py-4 text-right font-bold ${activeTab === 'entrada' ? 'text-primary' : 'text-error'}`}>
                      {formatCurrency(item.valor)}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{item.forma_pagamento}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{item.responsavel?.nome || 'Instituição'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditDrawer(item)} 
                          className="p-1.5 text-outline hover:text-tertiary rounded hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className="p-1.5 text-outline hover:text-error rounded hover:bg-error-container/20 transition-colors"
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
      <section className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-6 space-y-6">
        <div className="border-b border-surface-variant pb-4 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-primary text-md">Resumo do Fechamento Financeiro</h3>
            <p className="text-xs text-on-surface-variant">Balanço consolidado por categorias no período selecionado.</p>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={lancamentos.length === 0}
            className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-4 py-2.5 rounded-xl flex items-center gap-2 font-label-md text-label-md shadow-sm transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Exportar Fechamento PDF
          </button>
        </div>

        <div className="max-w-2xl border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Categoria</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium text-right">Total Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
              {Object.keys(categorySummaryMap)
                .map(key => ({ name: key, ...categorySummaryMap[key] }))
                .filter(c => c.total > 0).length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-on-surface-variant">
                      Sem lançamentos para exibir no balanço consolidado.
                    </td>
                  </tr>
                ) : (
                  Object.keys(categorySummaryMap)
                    .map(key => ({ name: key, ...categorySummaryMap[key] }))
                    .filter(c => c.total > 0)
                    .map(c => (
                      <tr key={c.name} className="hover:bg-secondary-container/10 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-primary">{c.name}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            c.tipo === 'entrada' 
                              ? 'bg-primary-container text-on-primary-container border-primary/20' 
                              : 'bg-error-container text-on-error-container border-error/20'
                          }`}>
                            {c.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className={`px-6 py-3.5 text-right font-bold ${c.tipo === 'entrada' ? 'text-primary' : 'text-error'}`}>
                          {formatCurrency(c.total)}
                        </td>
                      </tr>
                    ))
                )}
              {/* Balances summary rows */}
              <tr className="bg-surface-container-low font-bold">
                <td className="px-6 py-3" colSpan="2">Subtotal de Entradas</td>
                <td className="px-6 py-3 text-right text-primary">{formatCurrency(totalEntradas)}</td>
              </tr>
              <tr className="bg-surface-container-low font-bold">
                <td className="px-6 py-3" colSpan="2">Subtotal de Saídas</td>
                <td className="px-6 py-3 text-right text-error">{formatCurrency(totalSaidas)}</td>
              </tr>
              <tr className="bg-surface-container-high/60 font-black text-body-md border-t border-outline-variant">
                <td className="px-6 py-4" colSpan="2">Saldo Final Consolidado</td>
                <td className={`px-6 py-4 text-right ${saldo >= 0 ? 'text-primary' : 'text-error'}`}>
                  {formatCurrency(saldo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer Panel - Side drawer coming from the right (not modal) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop (semi transparent) */}
          <div className="absolute inset-0 bg-on-surface/20" onClick={() => setDrawerOpen(false)}></div>
          
          {/* Drawer container panel */}
          <div className="relative bg-surface w-full md:w-[460px] h-full shadow-2xl flex flex-col border-l border-surface-variant">
            {/* Header */}
            <div className="px-6 py-5 border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary font-semibold">
                  {editingLancamento ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                <p className="text-body-sm text-on-surface-variant">Insira as informações de fluxo financeiro.</p>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-on-surface hover:bg-surface-container rounded-xl"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Form inputs */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Type Switcher */}
              <div className="space-y-2">
                <label className="block text-label-sm font-semibold text-on-surface">Tipo de Lançamento *</label>
                <div className="flex border border-outline-variant rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleInputChange({ target: { name: 'tipo', value: 'entrada' } })}
                    className={`flex-1 py-2.5 font-semibold text-body-sm transition-all outline-none ${
                      formData.tipo === 'entrada' 
                        ? 'bg-primary text-on-primary shadow-sm' 
                        : 'bg-surface text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange({ target: { name: 'tipo', value: 'saida' } })}
                    className={`flex-1 py-2.5 font-semibold text-body-sm transition-all outline-none ${
                      formData.tipo === 'saida' 
                        ? 'bg-error text-on-error shadow-sm' 
                        : 'bg-surface text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Saída
                  </button>
                </div>
              </div>

              {/* Data & Valor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Data *</label>
                  <input
                    name="data"
                    type="date"
                    value={formData.data}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Valor (R$) *</label>
                  <input
                    name="valor"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Descrição *</label>
                <input
                  name="descricao"
                  type="text"
                  placeholder="Ex: Campanha do Agasalho 2026"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Categoria *</label>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                >
                  {formData.tipo === 'entrada' 
                    ? categoriasEntrada.map(c => <option key={c} value={c}>{c}</option>)
                    : categoriasSaida.map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Forma de Recebimento / Pagamento *</label>
                <select
                  name="forma_pagamento"
                  value={formData.forma_pagamento}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                >
                  {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Responsável</label>
                <input
                  name="responsavel"
                  type="text"
                  placeholder="Nome do operador"
                  value={formData.responsavel}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Observações Opcionais</label>
                <textarea
                  name="observacoes"
                  placeholder="Notas adicionais sobre este lançamento..."
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none h-24"
                />
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-surface-variant flex justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-5 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-xl font-semibold text-body-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-xl font-semibold text-body-sm shadow-sm transition-all"
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
