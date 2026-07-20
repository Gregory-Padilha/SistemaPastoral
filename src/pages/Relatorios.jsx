import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchConfiguracoes } from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

export const Relatorios = () => {
  const { showToast } = useFeedback()
  const [reportType, setReportType] = useState('beneficiarios') // beneficiarios, financeiro, atendimentos
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)

  // Load configurations for PDF headers
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

  // Default date ranges (start of current month to today)
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]
    
    setStartDate(firstDay)
    setEndDate(today)
  }, [])

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
      }
      
      setData(result)
    } catch (err) {
      setError('Erro ao buscar dados: ' + err.message)
      showToast('Erro de Banco', 'Não foi possível carregar os relatórios: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load preview data when inputs change
  useEffect(() => {
    if (startDate && endDate) {
      fetchData()
    }
  }, [reportType, startDate, endDate])

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
        ? 'Relatório de Beneficiários' 
        : reportType === 'financeiro' 
          ? 'Relatório Financeiro' 
          : 'Relatório de Atendimentos'

      // Title & Header section
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(62, 82, 25) // Brand primary green
      doc.text(instName, 14, 20)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      if (instCnpj) doc.text(instCnpj, 14, 26)
      doc.text(reportTitle, 14, 32)
      doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, 14, 38)
      
      doc.line(14, 42, 196, 42) // Separator border line

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
      } else {
        columns = ['Data', 'Tipo de Atendimento', 'Beneficiário', 'Responsável', 'Observações']
        rows = data.map(a => [
          new Date(a.data).toLocaleDateString('pt-BR'),
          a.tipo,
          a.beneficiario?.nome || '---',
          a.responsavel?.nome || '---',
          a.observacoes || '---'
        ])
      }

      doc.autoTable({
        startY: 46,
        head: [columns],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [62, 82, 25], textColor: [255, 255, 255] },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [245, 245, 220, 0.2] } // soft light beige shade
      })

      doc.save(`relatorio-${reportType}-${Date.now()}.pdf`)
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
      } else {
        wsData = data.map(a => ({
          Data: new Date(a.data).toLocaleDateString('pt-BR'),
          Tipo: a.tipo,
          Beneficiário: a.beneficiario?.nome || '',
          Responsável: a.responsavel?.nome || '',
          Observações: a.observacoes || ''
        }))
      }

      const ws = XLSX.utils.json_to_sheet(wsData)
      XLSX.utils.book_append_sheet(wb, ws, reportType === 'beneficiarios' ? 'Beneficiários' : reportType === 'financeiro' ? 'Financeiro' : 'Atendimentos')
      XLSX.writeFile(wb, `relatorio-${reportType}-${Date.now()}.xlsx`)
    } catch (err) {
      showToast('Erro de exportação', 'Erro ao exportar Excel: ' + err.message, 'error')
    }
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header */}
      <div className="border-b border-surface-variant pb-6">
        <h2 className="font-display-lg text-headline-lg text-primary font-semibold">Gerador de Relatórios</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Configure os parâmetros abaixo para gerar, visualizar ou exportar dados consolidados do sistema.</p>
      </div>

      {/* Configuration Card */}
      <section className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Report Type */}
          <div className="space-y-2">
            <label className="block text-label-sm font-semibold text-on-surface">Tipo de Relatório</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border border-outline-variant rounded-xl px-4 py-2.5 bg-surface-container-low text-body-md font-body-md text-on-surface focus:border-primary focus:ring-0 outline-none"
            >
              <option value="beneficiarios">Beneficiários</option>
              <option value="financeiro">Financeiro</option>
              <option value="atendimentos">Atendimentos</option>
            </select>
          </div>

          {/* Date Picker: Start */}
          <div className="space-y-2">
            <label className="block text-label-sm font-semibold text-on-surface">Data Inicial</label>
            <div className="relative">
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 bg-surface-container-low text-body-md font-body-md text-on-surface focus:border-primary focus:ring-0 outline-none"
                type="date"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">calendar_today</span>
            </div>
          </div>

          {/* Date Picker: End */}
          <div className="space-y-2">
            <label className="block text-label-sm font-semibold text-on-surface">Data Final</label>
            <div className="relative">
              <input
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 bg-surface-container-low text-body-md font-body-md text-on-surface focus:border-primary focus:ring-0 outline-none"
                type="date"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">event</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end border-t border-surface-variant pt-6 mt-6">
          <button
            onClick={handleExportPDF}
            disabled={loading || data.length === 0}
            className="px-6 py-3 border border-secondary text-secondary hover:bg-secondary-container rounded-xl font-semibold text-body-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            Exportar PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={loading || data.length === 0}
            className="px-6 py-3 border border-secondary text-secondary hover:bg-secondary-container rounded-xl font-semibold text-body-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">table_view</span>
            Exportar Excel
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-xl font-semibold text-body-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">{loading ? 'sync' : 'visibility'}</span>
            {loading ? 'Carregando...' : 'Visualizar / Atualizar'}
          </button>
        </div>
      </section>

      {/* Preview Section */}
      <section className="bg-surface rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-variant bg-surface-container-low/40 flex justify-between items-center">
          <h3 className="font-semibold text-primary text-md">
            Preview do Relatório: <span className="capitalize">{reportType === 'beneficiarios' ? 'Beneficiários' : reportType}</span>
          </h3>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-surface-variant text-on-surface-variant border border-outline-variant/30">
            {data.length} {data.length === 1 ? 'registro encontrado' : 'registros encontrados'}
          </span>
        </div>

        {error && (
          <div className="p-6 text-center text-error font-semibold">{error}</div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              <div className="h-6 bg-surface-container-high rounded animate-pulse w-full"></div>
              <div className="h-6 bg-surface-container-high rounded animate-pulse w-5/6"></div>
              <div className="h-6 bg-surface-container-high rounded animate-pulse w-4/6"></div>
              <div className="h-6 bg-surface-container-high rounded animate-pulse w-full"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-body-md">
              Nenhum dado encontrado para o período e tipo de relatório selecionados.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  {reportType === 'beneficiarios' && (
                    <>
                      <th className="px-6 py-3 font-medium">Nome</th>
                      <th className="px-6 py-3 font-medium">CPF</th>
                      <th className="px-6 py-3 font-medium">Telefone</th>
                      <th className="px-6 py-3 font-medium">Moradia</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Data Cadastro</th>
                    </>
                  )}
                  {reportType === 'financeiro' && (
                    <>
                      <th className="px-6 py-3 font-medium">Data</th>
                      <th className="px-6 py-3 font-medium">Descrição</th>
                      <th className="px-6 py-3 font-medium">Categoria</th>
                      <th className="px-6 py-3 font-medium">Tipo</th>
                      <th className="px-6 py-3 font-medium">Valor</th>
                      <th className="px-6 py-3 font-medium">Responsável</th>
                    </>
                  )}
                  {reportType === 'atendimentos' && (
                    <>
                      <th className="px-6 py-3 font-medium">Data</th>
                      <th className="px-6 py-3 font-medium">Tipo</th>
                      <th className="px-6 py-3 font-medium">Beneficiário</th>
                      <th className="px-6 py-3 font-medium">Responsável</th>
                      <th className="px-6 py-3 font-medium">Observações</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
                {reportType === 'beneficiarios' && data.map(b => (
                  <tr key={b.id} className="hover:bg-secondary-container/10 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-primary">{b.nome}</td>
                    <td className="px-6 py-3.5 text-on-surface-variant">{b.cpf || '---'}</td>
                    <td className="px-6 py-3.5 text-on-surface-variant">{b.telefone || '---'}</td>
                    <td className="px-6 py-3.5">{b.tipo_moradia || '---'}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        b.status === 'ativo' 
                          ? 'bg-primary-container text-on-primary-container border-primary/20' 
                          : 'bg-outline-variant/40 text-on-surface-variant border-outline-variant/50'
                      }`}>
                        {b.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-on-surface-variant">
                      {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {reportType === 'financeiro' && data.map(f => (
                  <tr key={f.id} className="hover:bg-secondary-container/10 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-primary">
                      {new Date(f.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3.5">{f.descricao}</td>
                    <td className="px-6 py-3.5 text-on-surface-variant">{f.categoria || '---'}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        f.tipo === 'entrada' 
                          ? 'bg-primary-container text-on-primary-container border-primary/20' 
                          : 'bg-error-container text-on-error-container border-error/20'
                      }`}>
                        {f.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-bold">
                      R$ {parseFloat(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3.5 text-on-surface-variant">{f.responsavel?.nome || '---'}</td>
                  </tr>
                ))}
                {reportType === 'atendimentos' && data.map(a => (
                  <tr key={a.id} className="hover:bg-secondary-container/10 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-primary">
                      {new Date(a.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3.5 font-medium">{a.tipo}</td>
                    <td className="px-6 py-3.5">{a.beneficiario?.nome || '---'}</td>
                    <td className="px-6 py-3.5 text-on-surface-variant">{a.responsavel?.nome || '---'}</td>
                    <td className="px-6 py-3.5 text-on-surface-variant truncate max-w-xs" title={a.observacoes}>
                      {a.observacoes || '---'}
                    </td>
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
