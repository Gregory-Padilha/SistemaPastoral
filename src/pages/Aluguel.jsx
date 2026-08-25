import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  fetchAlugueis, 
  deleteAluguel,
  fetchEstoqueEquipamentos, 
  insertEquipamento,
  fetchHistoricoPagamentosAluguel,
  insertHistoricoPagamentoAluguel,
  deleteHistoricoPagamentoAluguel
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'

export const Aluguel = () => {
  const { showToast, confirmDelete } = useFeedback()
  const [contracts, setContracts] = useState([])
  const [estoque, setEstoque] = useState([])
  const [pagamentosRecorrentes, setPagamentosRecorrentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  
  // Selected year
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  // Floating detached tooltip state
  const [activeTooltip, setActiveTooltip] = useState(null)

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState('contratos') // 'contratos' or 'estoque'

  // Modal state for adding equipment
  const [newEqModalOpen, setNewEqModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newEqFormData, setNewEqFormData] = useState({
    nome_equipamento: '',
    numero_serie: '',
    quantidade_total: '1'
  })

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
      const [contractsData, paymentsData, stockData] = await Promise.all([
        fetchAlugueis(search).catch(() => []),
        fetchHistoricoPagamentosAluguel(currentYear).catch(() => []),
        fetchEstoqueEquipamentos().catch(() => [])
      ])
      setContracts(contractsData || [])
      setPagamentosRecorrentes(paymentsData || [])
      
      const filteredStock = search
        ? (stockData || []).filter(e => 
            e.nome_equipamento.toLowerCase().includes(search.toLowerCase()) || 
            (e.numero_serie && e.numero_serie.toLowerCase().includes(search.toLowerCase()))
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

  const handleAddEquipmentSubmit = async (e) => {
    e.preventDefault()
    if (!newEqFormData.nome_equipamento.trim()) return

    setSaving(true)
    try {
      const payload = {
        nome_equipamento: newEqFormData.nome_equipamento.trim(),
        numero_serie: newEqFormData.numero_serie.trim() || null,
        quantidade_total: parseInt(newEqFormData.quantidade_total || '1')
      }
      await insertEquipamento(payload)
      showToast('Sucesso', 'Equipamento adicionado ao estoque!')
      setNewEqFormData({ nome_equipamento: '', numero_serie: '', quantidade_total: '1' })
      setNewEqModalOpen(false)
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
              onClick={() => setNewEqModalOpen(true)}
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs md:text-sm font-bold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Novo Equipamento
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

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                          <div className="flex flex-col gap-0.5">
                            <Link to={`/aluguel/${c.id}`} className="font-semibold text-primary hover:underline block">{c.locatario_nome}</Link>
                            <span className="text-[10px] text-on-surface-variant font-mono">Retirada: {formatDate(c.data_inicio)}</span>
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
        <section className="bg-surface rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Nome do Equipamento</th>
                  <th className="px-6 py-4 font-medium">Nº de Série</th>
                  <th className="px-6 py-4 font-medium text-center">Qtd Total</th>
                  <th className="px-6 py-4 font-medium text-center">Qtd Disponível</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
                {estoque.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-on-surface-variant">Nenhum equipamento cadastrado no estoque.</td>
                  </tr>
                ) : (
                  estoque.map(eq => (
                    <tr key={eq.id} className="hover:bg-secondary-container/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-primary">{eq.nome_equipamento}</td>
                      <td className="px-6 py-4 text-on-surface-variant font-mono text-xs">{eq.numero_serie || 'Sem Nº de Série'}</td>
                      <td className="px-6 py-4 text-center">{eq.quantidade_total}</td>
                      <td className="px-6 py-4 text-center font-bold text-secondary">{eq.quantidade_disponivel}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          eq.quantidade_disponivel > 0 
                            ? 'bg-primary-container text-on-primary-container border-primary/20' 
                            : 'bg-error-container text-on-error-container border-error/20'
                        }`}>
                          {eq.quantidade_disponivel > 0 ? 'Disponível' : 'Esgotado'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Add Equipment */}
      {newEqModalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3 shrink-0">
              <h3 className="font-semibold text-primary text-headline-sm flex items-center gap-2">
                <span className="material-symbols-outlined">inventory</span>
                Cadastrar Novo Equipamento
              </h3>
              <button 
                onClick={() => setNewEqModalOpen(false)} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleAddEquipmentSubmit} className="space-y-4">
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome do Equipamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cadeira de Rodas Ortobrás"
                  value={newEqFormData.nome_equipamento}
                  onChange={e => setNewEqFormData(prev => ({ ...prev, nome_equipamento: e.target.value }))}
                  className="w-full border border-outline-variant rounded-lg px-4 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Nº de Série</label>
                <input
                  type="text"
                  placeholder="Ex: SN-92842749"
                  value={newEqFormData.numero_serie}
                  onChange={e => setNewEqFormData(prev => ({ ...prev, numero_serie: e.target.value }))}
                  className="w-full border border-outline-variant rounded-lg px-4 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Quantidade Total *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newEqFormData.quantidade_total}
                  onChange={e => setNewEqFormData(prev => ({ ...prev, quantidade_total: e.target.value }))}
                  className="w-full border border-outline-variant rounded-lg px-4 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div className="pt-3 border-t border-surface-variant flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setNewEqModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container shadow-sm transition-all"
                >
                  {saving ? 'Adicionando...' : 'Adicionar Equipamento'}
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

          <div className="mt-2.5 pt-2 border-t border-surface-variant/80 flex justify-between items-center text-xs relative z-10">
            <span className="text-[11px] font-bold text-on-surface-variant">Valor Mensal Total:</span>
            <span className="font-extrabold text-primary text-xs font-mono">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(activeTooltip.valorAluguel || 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
