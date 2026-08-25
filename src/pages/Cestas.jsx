import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { 
  fetchBeneficiariosCestas, 
  deleteBeneficiarioCesta, 
  fetchHistoricoEntregasCestas,
  insertHistoricoEntregaCesta,
  deleteHistoricoEntregaCesta
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'

export const Cestas = () => {
  const { showToast, confirmDelete } = useFeedback()
  
  const [beneficiariosCestas, setBeneficiariosCestas] = useState([])
  const [historicoEntregas, setHistoricoEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Selected year
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  // Status editing modal state
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    beneficiarioId: null,
    beneficiarioNome: '',
    mesIndex: null,
    mesLabel: '',
    initialStatus: 'Nao Entregue',
    selectedStatus: 'Nao Entregue'
  })
  const [savingStatus, setSavingStatus] = useState(false)

  const mesesAbreviados = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ]

  const mesesCompletos = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const loadData = async () => {
    setLoading(true)
    try {
      const [listData, historyData] = await Promise.all([
        fetchBeneficiariosCestas(search, statusFilter),
        fetchHistoricoEntregasCestas(currentYear)
      ])
      setBeneficiariosCestas(listData)
      setHistoricoEntregas(historyData)
    } catch (err) {
      showToast('Erro ao carregar dados', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadData()
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [search, statusFilter, currentYear])

  const handleUnenroll = (item) => {
    confirmDelete(
      'Desvincular Recorrência',
      `Tem certeza que deseja remover "${item.beneficiario?.nome}" do grupo de Cestas Básicas? Isso não apagará o cadastro dele, apenas removerá o controle de entregas mensais.`,
      async () => {
        try {
          await deleteBeneficiarioCesta(item.id)
          showToast('Sucesso', 'Beneficiário desvinculado com sucesso!')
          loadData()
        } catch (err) {
          showToast('Erro ao desvincular', err.message, 'error')
        }
      }
    )
  }

  const isMonthDelivered = (beneficiarioId, mesIndex) => {
    return historicoEntregas.some(h => 
      h.beneficiario_id === beneficiarioId && 
      h.mes_referencia === mesIndex && 
      h.ano_referencia === currentYear
    )
  }

  const handleMonthClick = (benef, mesIdx) => {
    const delivered = isMonthDelivered(benef.id, mesIdx)
    const initial = delivered ? 'Entregue' : 'Nao Entregue'

    setStatusModal({
      isOpen: true,
      beneficiarioId: benef.id,
      beneficiarioNome: benef.nome,
      mesIndex: mesIdx,
      mesLabel: mesesCompletos[mesIdx - 1],
      initialStatus: initial,
      selectedStatus: initial
    })
  }

  const submittingRef = useRef(false)

  const handleSaveStatus = async (e) => {
    e.preventDefault()
    if (submittingRef.current || !statusModal.beneficiarioId) return
    
    submittingRef.current = true
    setSavingStatus(true)
    try {
      const { beneficiarioId, mesIndex, initialStatus, selectedStatus } = statusModal

      if (initialStatus === selectedStatus) {
        setStatusModal(prev => ({ ...prev, isOpen: false }))
        return
      }

      if (selectedStatus === 'Entregue') {
        await insertHistoricoEntregaCesta(
          beneficiarioId,
          mesIndex,
          currentYear,
          'Entrega confirmada no controle mensal'
        )
        showToast('Sucesso', `Entrega de ${statusModal.mesLabel}/${currentYear} confirmada!`)
      } else {
        await deleteHistoricoEntregaCesta(
          beneficiarioId,
          mesIndex,
          currentYear
        )
        showToast('Sucesso', `Entrega de ${statusModal.mesLabel}/${currentYear} desmarcada!`)
      }

      setStatusModal({
        isOpen: false,
        beneficiarioId: null,
        beneficiarioNome: '',
        mesIndex: null,
        mesLabel: '',
        initialStatus: 'Nao Entregue',
        selectedStatus: 'Nao Entregue'
      })
      loadData()
    } catch (err) {
      showToast('Erro ao atualizar status', err.message, 'error')
    } finally {
      setSavingStatus(false)
      submittingRef.current = false
    }
  }

  const today = new Date()
  const currentMonthIdx = today.getMonth() + 1
  const activeCount = beneficiariosCestas.length
  const totalEntregasAno = historicoEntregas.length
  const entregasMesAtual = historicoEntregas.filter(h => h.mes_referencia === currentMonthIdx && h.ano_referencia === currentYear).length
  const pctMes = activeCount > 0 ? Math.round((entregasMesAtual / activeCount) * 100) : 0

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Alimentação & Cestas
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Controle Recorrente de Cestas
          </h2>
          <p className="text-xs text-on-surface-variant">
            Acompanhe a distribuição mensal, confirme entregas e vincule novas famílias assistidas.
          </p>
        </div>
        <Link 
          to="/cestas/novo"
          className="bg-primary text-on-primary hover:bg-primary-container px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Vincular Beneficiário
        </Link>
      </div>

      {/* KPI Top cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">diversity_1</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Famílias Vinculadas</span>
            <p className="text-xl font-extrabold text-on-surface leading-tight">{activeCount}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Entregas do Mês</span>
            <p className="text-xl font-extrabold text-emerald-700 leading-tight">
              {entregasMesAtual} <span className="text-xs text-on-surface-variant font-medium">({pctMes}%)</span>
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">inventory_2</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Total Entregue no Ano</span>
            <p className="text-xl font-extrabold text-secondary leading-tight">{totalEntregasAno}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Ano de Acompanhamento</span>
            <span className="text-xl font-extrabold text-on-surface leading-tight">{currentYear}</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentYear(prev => prev - 1)}
              className="w-8 h-8 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center transition-colors"
              title="Ano anterior"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button 
              onClick={() => setCurrentYear(prev => prev + 1)}
              className="w-8 h-8 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center transition-colors"
              title="Próximo ano"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 p-4 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <div className="flex items-center border border-outline-variant/80 rounded-xl px-3.5 py-2 bg-surface-container-low focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all">
            <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-xs font-semibold text-on-surface placeholder:text-outline/70 p-0" 
              placeholder="Buscar por nome ou CPF..." 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter status */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'ativo', label: 'Ativos' },
            { id: 'inativo', label: 'Inativos' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === item.id 
                  ? 'bg-primary text-on-primary shadow-2xs' 
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Grid view */}
      {loading && beneficiariosCestas.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] gap-2">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-outline">Carregando controle de cestas...</p>
        </div>
      ) : (
        <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-[26%]">Beneficiário</th>
                  <th className="px-5 py-3.5 text-center">Calendário de Entregas ({currentYear})</th>
                  <th className="px-5 py-3.5 text-right w-[10%]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                {beneficiariosCestas.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center text-outline">
                      Nenhum beneficiário vinculado neste ciclo.
                    </td>
                  </tr>
                ) : (
                  beneficiariosCestas.map(item => {
                    const b = item.beneficiario
                    return (
                      <tr key={item.id} className="hover:bg-secondary-container/15 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <Link to={`/beneficiarios/${b?.id}`} className="font-bold text-on-surface hover:text-primary transition-colors block">
                              {b?.nome}
                            </Link>
                            <span className="text-[10px] text-outline font-mono">CPF: {b?.cpf || 'Sem CPF'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-center gap-1.5 overflow-x-auto py-1">
                            {mesesAbreviados.map((nomeMes, idx) => {
                              const mesNum = idx + 1
                              const delivered = isMonthDelivered(b?.id, mesNum)
                              
                              const isFuture = currentYear > today.getFullYear() || (currentYear === today.getFullYear() && mesNum > currentMonthIdx)
                              
                              let tagClass = 'bg-surface-container-low text-outline border-outline-variant/60 hover:border-primary/40'
                              
                              if (delivered) {
                                tagClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold hover:bg-emerald-200 shadow-2xs'
                              } else if (!isFuture) {
                                tagClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold hover:bg-rose-100'
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleMonthClick(b, mesNum)}
                                  className={`px-2.5 py-1 rounded-xl border text-[11px] select-none text-center min-w-[40px] cursor-pointer transition-all active:scale-95 ${tagClass}`}
                                  title={`Alterar status de ${nomeMes}/${currentYear}`}
                                >
                                  {nomeMes}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleUnenroll(item)} 
                              className="p-1 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" 
                              title="Desvincular Recorrência"
                            >
                              <span className="material-symbols-outlined text-[18px]">link_off</span>
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

      {/* Flexible Status Editing Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl shadow-xl w-full max-w-sm border border-outline-variant/80 p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant/80 pb-3 shrink-0">
              <h3 className="font-bold text-primary text-base flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
                Status de Entrega
              </h3>
              <button 
                onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div className="text-xs text-on-surface-variant">
                Defina o status para <strong className="text-on-surface">"{statusModal.beneficiarioNome}"</strong> referente a <strong className="text-primary">{statusModal.mesLabel} de {currentYear}</strong>:
              </div>

              {/* Radio selection buttons */}
              <div className="grid grid-cols-2 gap-3">
                <label className={`border rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  statusModal.selectedStatus === 'Entregue' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-2xs' 
                    : 'border-outline-variant hover:bg-surface-container text-on-surface-variant'
                }`}>
                  <input
                    type="radio"
                    name="delivery_status"
                    value="Entregue"
                    checked={statusModal.selectedStatus === 'Entregue'}
                    onChange={() => setStatusModal(prev => ({ ...prev, selectedStatus: 'Entregue' }))}
                    className="sr-only"
                  />
                  <span className="material-symbols-outlined text-[28px] text-emerald-600">check_circle</span>
                  <span className="text-xs font-bold">Entregue</span>
                </label>

                <label className={`border rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  statusModal.selectedStatus === 'Nao Entregue' 
                    ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold shadow-2xs' 
                    : 'border-outline-variant hover:bg-surface-container text-on-surface-variant'
                }`}>
                  <input
                    type="radio"
                    name="delivery_status"
                    value="Nao Entregue"
                    checked={statusModal.selectedStatus === 'Nao Entregue'}
                    onChange={() => setStatusModal(prev => ({ ...prev, selectedStatus: 'Nao Entregue' }))}
                    className="sr-only"
                  />
                  <span className="material-symbols-outlined text-[28px] text-rose-600">cancel</span>
                  <span className="text-xs font-bold">Não Entregue</span>
                </label>
              </div>

              <div className="pt-3 border-t border-surface-variant/80 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container shadow-xs transition-all active:scale-95"
                >
                  {savingStatus ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
