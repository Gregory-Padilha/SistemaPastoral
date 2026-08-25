import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchConfiguracoes } from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export const Relatorios = () => {
  const { showToast } = useFeedback()
  const [reportType, setReportType] = useState('beneficiarios')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [opFilter, setOpFilter] = useState('todos')
  const [formaFilter, setFormaFilter] = useState('todos')
  
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)

  const totalEntradasBancarias = data
    .filter(f => f.tipo === 'entrada')
    .reduce((sum, item) => sum + parseFloat(item.valor || 0), 0)

  const totalSaidasBancarias = data
    .filter(f => f.tipo === 'saida')
    .reduce((sum, item) => sum + parseFloat(item.valor || 0), 0)

  const saldoLiquidoBancario = totalEntradasBancarias - totalSaidasBancarias

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const settings = await fetchConfiguracoes()
        setConfig(settings)
      } catch (err) {
        console.error('Erro ao buscar configuracoes:', err)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]
    
    setStartDate(firstDay)
    setEndDate(today)
  }, [])

  const setDatePreset = (preset) => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    if (preset === 'hoje') {
      setStartDate(today)
      setEndDate(today)
    } else if (preset === 'este_mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      setStartDate(firstDay)
      setEndDate(today)
    } else if (preset === 'mes_anterior') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      setStartDate(firstDay)
      setEndDate(lastDay)
    } else if (preset === 'ano_atual') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
      setStartDate(firstDay)
      setEndDate(today)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      let result = []
      
      if (reportType === 'beneficiarios') {
        let query = supabase.from('beneficiarios').select('*').is('deletado_em', null)
        if (startDate) {
          query = query.gte('criado_em', `${startDate}T00:00:00Z`)
        }
        if (endDate) {
          query = query.lte('criado_em', `${endDate}T23:59:59Z`)
        }
        
        const { data: dbData, error: dbError } = await query.order('nome')
        if (dbError) throw dbError
        result = dbData || []
        
      } else if (reportType === 'financeiro') {
        let query = supabase.from('financeiro').select('*, responsavel:perfis(nome)').is('deletado_em', null)
        if (startDate) {
          query = query.gte('data', startDate)
        }
        if (endDate) {
          query = query.lte('data', endDate)
        }
        
        const { data: dbData, error: dbError } = await query.order('data', { ascending: false })
        if (dbError) throw dbError
        result = dbData || []
        
      } else if (reportType === 'atendimentos') {
        let query = supabase.from('atendimentos').select('*, beneficiario:beneficiarios(nome), responsavel:perfis(nome)')
        if (startDate) {
          query = query.gte('data', startDate)
        }
        if (endDate) {
          query = query.lte('data', endDate)
        }
        
        const { data: dbData, error: dbError } = await query.order('data', { ascending: false })
        if (dbError) throw dbError
        result = dbData || []
      } else if (reportType === 'movimentacao_bancaria') {
        let query = supabase.from('financeiro').select('*, responsavel:perfis(nome)').is('deletado_em', null)
        if (startDate) {
          query = query.gte('data', startDate)
        }
        if (endDate) {
          query = query.lte('data', endDate)
        }
        
        const { data: dbData, error: dbError } = await query.order('data', { ascending: false })
        if (dbError) throw dbError
        
        let filtered = (dbData || []).filter(f => {
          const forma = (f.forma_pagamento || '').toLowerCase()
          return forma.includes('pix') || forma.includes('transferencia') || forma.includes('transferência') || forma.includes('cheque')
        })
        
        if (opFilter !== 'todos') {
          filtered = filtered.filter(f => f.tipo === opFilter)
        }
        
        if (formaFilter !== 'todos') {
          if (formaFilter === 'Pix') {
            filtered = filtered.filter(f => (f.forma_pagamento || '').toLowerCase().includes('pix'))
          } else if (formaFilter === 'Transferência') {
            filtered = filtered.filter(f => !(f.forma_pagamento || '').toLowerCase().includes('pix'))
          }
        }
        
        result = filtered
      }
      
      setData(result)
    } catch (err) {
      setError('Erro ao buscar dados: ' + err.message)
      showToast('Erro de Banco', 'Não foi possível carregar os relatórios: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchData()
    }
  }, [reportType, startDate, endDate, opFilter, formaFilter])

  const handleExportPDF = () => {
    if (data.length === 0) {
      showToast('Aviso', 'Não há dados para exportar!', 'warning')
      return
    }

    try {
      const doc = new jsPDF()
      const instName = config?.nome_instituicao || 'Sistema Pastoral'
      const instCnpj = config?.cnpj ? `CNPJ: ${config.cnpj}` : ''
      const reportTitle = reportType === 'beneficiarios' 
        ? 'Relatório de Beneficiários Cadastrados' 
        : reportType === 'financeiro' 
          ? 'Relatório Geral de Fluxo Financeiro' 
          : reportType === 'atendimentos'
            ? 'Relatório de Atendimentos e Visitas'
            : 'Relatório de Movimentação Bancária e Pix'

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(62, 82, 25)
      doc.text(instName, 14, 20)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      if (instCnpj) doc.text(instCnpj, 14, 26)
      doc.text(reportTitle, 14, 32)
      doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, 14, 38)
      
      doc.line(14, 42, 196, 42)

      let columns = []
      let rows = []

      if (reportType === 'beneficiarios') {
        columns = ['Nome', 'CPF', 'Telefone', 'Moradia', 'Status', 'Cadastro']
        rows = data.map(b => [
          b.nome,
          b.cpf || '---',
          b.telefone || '---',
          b.tipo_moradia || '---',
          b.status === 'ativo' ? 'Ativo' : 'Inativo',
          new Date(b.criado_em).toLocaleDateString('pt-BR')
        ])
      } else if (reportType === 'financeiro') {
        columns = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Responsável']
        rows = data.map(f => [
          new Date(f.data).toLocaleDateString('pt-BR'),
          f.descricao,
          f.categoria || '---',
          f.tipo === 'entrada' ? 'Entrada' : 'Saída',
          parseFloat(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          f.responsavel?.nome || '---'
        ])
      } else if (reportType === 'atendimentos') {
        columns = ['Data', 'Tipo de Atendimento', 'Beneficiário', 'Responsável', 'Observações']
        rows = data.map(a => [
          new Date(a.data).toLocaleDateString('pt-BR'),
          a.tipo,
          a.beneficiario?.nome || '---',
          a.responsavel?.nome || '---',
          a.observacoes || '---'
        ])
      } else if (reportType === 'movimentacao_bancaria') {
        columns = ['Data', 'Tipo', 'Descrição / Origem', 'Categoria', 'Forma', 'Valor (R$)', 'Responsável']
        rows = data.map(f => [
          new Date(f.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
          f.tipo === 'entrada' ? 'Entrada' : 'Saída',
          f.descricao,
          f.categoria || '---',
          f.forma_pagamento || '---',
          parseFloat(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          f.responsavel?.nome || '---'
        ])

        rows.push(['', '', '', '', '', '', ''])
        rows.push(['', '', 'BALANÇO CONSOLIDADO', '', '', '', ''])
        rows.push(['', '', 'Total de Entradas:', '', '', `R$ ${totalEntradasBancarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, ''])
        rows.push(['', '', 'Total de Saídas:', '', '', `R$ ${totalSaidasBancarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, ''])
        rows.push(['', '', 'Saldo Líquido da Conta:', '', '', `R$ ${saldoLiquidoBancario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, ''])
      }

      autoTable(doc, {
        startY: 46,
        head: [columns],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [62, 82, 25], textColor: [255, 255, 255] },
        bodyStyles: { fontSize: 9 }
      })

      doc.save(`relatorio-${reportType}-${Date.now()}.pdf`)
      showToast('PDF Gerado', 'Relatório baixado com sucesso!', 'success')
    } catch (err) {
      showToast('Erro de exportação', 'Erro ao exportar PDF: ' + err.message, 'error')
    }
  }

  const handleExportExcel = () => {
    if (data.length === 0) {
      showToast('Aviso', 'Não há dados para exportar!', 'warning')
      return
    }

    try {
      const wb = XLSX.utils.book_new()
      let wsData = []

      if (reportType === 'beneficiarios') {
        wsData = data.map(b => ({
          Nome: b.nome,
          CPF: b.cpf || '',
          'Data de Nascimento': b.data_nascimento || '',
          Sexo: b.sexo || '',
          Telefone: b.telefone || '',
          WhatsApp: b.whatsapp || '',
          Email: b.email || '',
          Status: b.status === 'ativo' ? 'Ativo' : 'Inativo',
          'Data de Cadastro': new Date(b.criado_em).toLocaleDateString('pt-BR')
        }))
      } else if (reportType === 'financeiro') {
        wsData = data.map(f => ({
          Data: new Date(f.data).toLocaleDateString('pt-BR'),
          Descrição: f.descricao,
          Categoria: f.categoria || '',
          Tipo: f.tipo === 'entrada' ? 'Entrada' : 'Saída',
          'Valor (R$)': parseFloat(f.valor),
          'Forma de Pagamento': f.forma_pagamento || '',
          Responsável: f.responsavel?.nome || '',
          Observações: f.observacoes || ''
        }))
      } else if (reportType === 'atendimentos') {
        wsData = data.map(a => ({
          Data: new Date(a.data).toLocaleDateString('pt-BR'),
          Tipo: a.tipo,
          Beneficiário: a.beneficiario?.nome || '',
          Responsável: a.responsavel?.nome || '',
          Observações: a.observacoes || ''
        }))
      } else if (reportType === 'movimentacao_bancaria') {
        wsData = data.map(f => ({
          Data: new Date(f.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
          Tipo: f.tipo === 'entrada' ? 'Entrada' : 'Saída',
          'Descrição / Origem': f.descricao,
          Categoria: f.categoria || '',
          Forma: f.forma_pagamento || '',
          'Valor (R$)': parseFloat(f.valor),
          Responsável: f.responsavel?.nome || ''
        }))

        wsData.push({})
        wsData.push({ 'Descrição / Origem': 'BALANÇO CONSOLIDADO' })
        wsData.push({ 'Descrição / Origem': 'Total de Entradas', 'Valor (R$)': totalEntradasBancarias })
        wsData.push({ 'Descrição / Origem': 'Total de Saídas', 'Valor (R$)': totalSaidasBancarias })
        wsData.push({ 'Descrição / Origem': 'Saldo Líquido no Período', 'Valor (R$)': saldoLiquidoBancario })
      }

      const ws = XLSX.utils.json_to_sheet(wsData)
      let sheetName = 'Movimentação Bancária'
      if (reportType === 'beneficiarios') sheetName = 'Beneficiários'
      else if (reportType === 'financeiro') sheetName = 'Financeiro'
      else if (reportType === 'atendimentos') sheetName = 'Atendimentos'

      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      XLSX.writeFile(wb, `relatorio-${reportType}-${Date.now()}.xlsx`)
      showToast('Planilha Gerada', 'Arquivo Excel exportado com sucesso!', 'success')
    } catch (err) {
      showToast('Erro de exportação', 'Erro ao exportar Excel: ' + err.message, 'error')
    }
  }

  const reportTypesList = [
    { id: 'beneficiarios', label: 'Beneficiários', desc: 'Famílias atendidas e cadastros sociais', icon: 'group' },
    { id: 'financeiro', label: 'Financeiro Geral', desc: 'Entradas, saídas e livro caixa', icon: 'payments' },
    { id: 'atendimentos', label: 'Atendimentos', desc: 'Visitas e auxílios prestados', icon: 'volunteer_activism' },
    { id: 'movimentacao_bancaria', label: 'Movimentação Bancária', desc: 'Pix, transferências e depósitos', icon: 'account_balance' }
  ]

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Auditoria & Prestação de Contas
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Central de Relatórios
          </h2>
          <p className="text-xs text-on-surface-variant">
            Gere relatórios gerenciais e exporte dados consolidados em PDF e Excel.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPDF}
            disabled={loading || data.length === 0}
            className="px-4 py-2.5 bg-surface border border-outline-variant/80 hover:border-primary/50 text-on-surface hover:text-primary rounded-2xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Baixar PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={loading || data.length === 0}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Report Types Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypesList.map(item => {
          const isSelected = reportType === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setReportType(item.id)}
              className={`p-5 rounded-3xl border text-left transition-all flex flex-col justify-between gap-3 ${
                isSelected 
                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30' 
                  : 'border-outline-variant/70 bg-surface hover:border-primary/40'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-primary'
              }`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <div>
                <span className="font-bold text-xs md:text-sm text-on-surface block">{item.label}</span>
                <span className="text-[11px] text-outline mt-0.5 block">{item.desc}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Configuration Filter Card */}
      <section className="bg-surface rounded-3xl shadow-xs border border-outline-variant/80 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-variant/80 pb-4">
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            Filtros do Período
          </span>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setDatePreset('hoje')}
              className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface-variant rounded-xl text-[11px] font-bold transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('este_mes')}
              className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface-variant rounded-xl text-[11px] font-bold transition-colors"
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('mes_anterior')}
              className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface-variant rounded-xl text-[11px] font-bold transition-colors"
            >
              Mês Anterior
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('ano_atual')}
              className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface-variant rounded-xl text-[11px] font-bold transition-colors"
            >
              Ano Atual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Picker: Start */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-on-surface">Data Inicial</label>
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-low text-xs font-semibold focus:border-primary outline-none"
              type="date"
            />
          </div>

          {/* Date Picker: End */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-on-surface">Data Final</label>
            <input
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-low text-xs font-semibold focus:border-primary outline-none"
              type="date"
            />
          </div>

          {reportType === 'movimentacao_bancaria' && (
            <>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-on-surface">Operação</label>
                <select
                  value={opFilter}
                  onChange={(e) => setOpFilter(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-low text-xs font-semibold focus:border-primary outline-none"
                >
                  <option value="todos">Todas (Entradas e Saídas)</option>
                  <option value="entrada">Apenas Receitas (Pix/Entrada)</option>
                  <option value="saida">Apenas Despesas (Pix/Saída)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-on-surface">Forma</label>
                <select
                  value={formaFilter}
                  onChange={(e) => setFormaFilter(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-low text-xs font-semibold focus:border-primary outline-none"
                >
                  <option value="todos">Todos (Pix e Banco)</option>
                  <option value="Pix">Apenas Pix</option>
                  <option value="Transferência">Conta Bancária / TED</option>
                </select>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Preview Section */}
      <section className="bg-surface rounded-3xl shadow-xs border border-outline-variant/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-variant/80 bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">preview</span>
            <h3 className="font-bold text-primary text-sm">
              Pré-visualização dos Dados
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
            {data.length} {data.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {error && (
          <div className="p-6 text-center text-error font-semibold text-xs">{error}</div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-semibold text-outline">Carregando relatório...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-outline text-xs">
              Nenhum dado encontrado para o período e parâmetros selecionados.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  {reportType === 'beneficiarios' && (
                    <>
                      <th className="px-5 py-3.5">Nome</th>
                      <th className="px-5 py-3.5">CPF</th>
                      <th className="px-5 py-3.5">Telefone</th>
                      <th className="px-5 py-3.5">Moradia</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Data Cadastro</th>
                    </>
                  )}
                  {reportType === 'financeiro' && (
                    <>
                      <th className="px-5 py-3.5">Data</th>
                      <th className="px-5 py-3.5">Descrição</th>
                      <th className="px-5 py-3.5">Categoria</th>
                      <th className="px-5 py-3.5">Tipo</th>
                      <th className="px-5 py-3.5 text-right">Valor</th>
                      <th className="px-5 py-3.5">Responsável</th>
                    </>
                  )}
                  {reportType === 'atendimentos' && (
                    <>
                      <th className="px-5 py-3.5">Data</th>
                      <th className="px-5 py-3.5">Tipo</th>
                      <th className="px-5 py-3.5">Beneficiário</th>
                      <th className="px-5 py-3.5">Responsável</th>
                      <th className="px-5 py-3.5">Observações</th>
                    </>
                  )}
                  {reportType === 'movimentacao_bancaria' && (
                    <>
                      <th className="px-5 py-3.5">Data</th>
                      <th className="px-5 py-3.5">Tipo</th>
                      <th className="px-5 py-3.5">Descrição</th>
                      <th className="px-5 py-3.5">Categoria</th>
                      <th className="px-5 py-3.5">Forma</th>
                      <th className="px-5 py-3.5 text-right">Valor</th>
                      <th className="px-5 py-3.5">Responsável</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                {reportType === 'beneficiarios' && data.map(b => (
                  <tr key={b.id} className="hover:bg-secondary-container/15 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-on-surface">{b.nome}</td>
                    <td className="px-5 py-3.5 text-outline font-mono text-[11px]">{b.cpf || '---'}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{b.telefone || '---'}</td>
                    <td className="px-5 py-3.5">{b.tipo_moradia || '---'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        b.status === 'ativo' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}>
                        {b.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-outline">
                      {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {reportType === 'financeiro' && data.map(f => (
                  <tr key={f.id} className="hover:bg-secondary-container/15 transition-colors">
                    <td className="px-5 py-3.5 text-outline font-mono whitespace-nowrap">
                      {new Date(f.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-on-surface">{f.descricao}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{f.categoria || '---'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        f.tipo === 'entrada' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {f.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-extrabold ${f.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {parseFloat(f.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{f.responsavel?.nome || '---'}</td>
                  </tr>
                ))}
                {reportType === 'atendimentos' && data.map(a => (
                  <tr key={a.id} className="hover:bg-secondary-container/15 transition-colors">
                    <td className="px-5 py-3.5 text-outline font-mono whitespace-nowrap">
                      {new Date(a.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-primary">{a.tipo}</td>
                    <td className="px-5 py-3.5 font-bold text-on-surface">{a.beneficiario?.nome || '---'}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{a.responsavel?.nome || '---'}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant truncate max-w-xs">{a.observacoes || '---'}</td>
                  </tr>
                ))}
                {reportType === 'movimentacao_bancaria' && data.map(f => (
                  <tr key={f.id} className="hover:bg-secondary-container/15 transition-colors">
                    <td className="px-5 py-3.5 text-outline font-mono whitespace-nowrap">
                      {new Date(f.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        f.tipo === 'entrada' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {f.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-on-surface">{f.descricao}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{f.categoria || '---'}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{f.forma_pagamento || '---'}</td>
                    <td className={`px-5 py-3.5 text-right font-extrabold ${f.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {parseFloat(f.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{f.responsavel?.nome || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
