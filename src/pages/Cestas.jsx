import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCestas, deleteCesta, insertCestaEntrega } from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { useAuth } from '../contexts/AuthContext'

export const Cestas = () => {
  const { user } = useAuth()
  const { showToast, confirmDelete } = useFeedback()
  
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [pathologyFilter, setPathologyFilter] = useState('todos')

  // Quick delivery modal states
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null)
  const [deliveryFormData, setDeliveryFormData] = useState({
    data_entrega: new Date().toISOString().split('T')[0],
    mes_referencia: '',
    entregador: user?.profile?.nome || '',
    observacoes: '',
    status: 'Entregue'
  })
  const [saving, setSaving] = useState(false)

  const pathologies = [
    'Diabetes', 'Hipertensão', 'Câncer', 'Doença Cardíaca', 'Doença Renal',
    'HIV/AIDS', 'Deficiência Física', 'Deficiência Intelectual', 'Transtorno Mental',
    'Idoso acima de 60 anos', 'Gestante', 'Criança em vulnerabilidade'
  ]

  const loadBeneficiaries = async () => {
    setLoading(true)
    try {
      const data = await fetchCestas(search, statusFilter, pathologyFilter)
      setBeneficiaries(data)
    } catch (err) {
      showToast('Erro ao carregar cadastros', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadBeneficiaries()
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [search, statusFilter, pathologyFilter])

  const handleDelete = (item) => {
    confirmDelete(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o cadastro de "${item.nome}"? Esta ação é irreversível e removerá todo o histórico de entregas e documentos associados.`,
      async () => {
        try {
          await deleteCesta(item.id)
          showToast('Sucesso', 'Beneficiário excluído com sucesso!')
          loadBeneficiaries()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  const openDeliveryModal = (b) => {
    const now = new Date()
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    const curMonthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`

    setSelectedBeneficiary(b)
    setDeliveryFormData({
      data_entrega: now.toISOString().split('T')[0],
      mes_referencia: curMonthLabel,
      entregador: user?.profile?.nome || '',
      observacoes: '',
      status: 'Entregue'
    })
    setDeliveryModalOpen(true)
  }

  const handleSaveDelivery = async (e) => {
    e.preventDefault()
    if (!deliveryFormData.mes_referencia) {
      showToast('Campo ausente', 'Por favor, preencha o mês de referência.', 'error')
      return
    }

    setSaving(true)
    try {
      await insertCestaEntrega({
        cesta_beneficiario_id: selectedBeneficiary.id,
        data_entrega: deliveryFormData.data_entrega || null,
        mes_referencia: deliveryFormData.mes_referencia,
        entregador: deliveryFormData.entregador,
        observacoes: deliveryFormData.observacoes.trim() || null,
        status: deliveryFormData.status
      })
      showToast('Sucesso', 'Entrega de cesta básica registrada com sucesso!')
      setDeliveryModalOpen(false)
      loadBeneficiaries()
    } catch (err) {
      showToast('Erro ao registrar entrega', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Count active beneficiaries
  const activeCount = beneficiaries.filter(b => b.status === 'Ativo').length

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-surface-variant pb-6">
        <div>
          <h2 className="font-display-lg text-headline-lg text-primary font-semibold">Cesta Básica</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Gerencie os beneficiários cadastrados para distribuição de cestas básicas.</p>
        </div>
        <Link 
          to="/cestas/novo"
          className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-6 py-3 rounded-xl flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Novo Beneficiário
        </Link>
      </div>

      {/* KPI Top card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-primary text-on-primary rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full blur-lg"></div>
          <span className="text-xs font-semibold text-on-primary/80 uppercase tracking-wider relative z-10">Beneficiários Ativos</span>
          <div className="text-display-lg font-bold mt-2 relative z-10">{activeCount}</div>
        </div>
      </div>

      {/* Filters */}
      <section className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-6 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Busca por Nome</label>
          <div className="flex items-center border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest focus-within:border-secondary transition-colors">
            <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-body-md font-body-md text-on-surface placeholder:text-outline-variant focus:ring-0 p-0" 
              placeholder="Digite o nome do beneficiário..." 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter status */}
        <div className="w-full md:w-48">
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Status</label>
          <select 
            className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest text-body-md font-body-md text-on-surface focus:border-secondary focus:ring-0 outline-none transition-colors"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>

        {/* Filter pathology */}
        <div className="w-full md:w-56">
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Patologia / Condição</label>
          <select 
            className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest text-body-md font-body-md text-on-surface focus:border-secondary focus:ring-0 outline-none transition-colors"
            value={pathologyFilter}
            onChange={(e) => setPathologyFilter(e.target.value)}
          >
            <option value="todos">Todas Condições</option>
            {pathologies.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </section>

      {/* Grid view */}
      {loading && beneficiaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant p-6 space-y-4 shadow-sm">
          <div className="h-6 bg-surface-container-high rounded animate-pulse w-full"></div>
          <div className="h-6 bg-surface-container-high rounded animate-pulse w-5/6"></div>
          <div className="h-6 bg-surface-container-high rounded animate-pulse w-4/6"></div>
          <div className="h-6 bg-surface-container-high rounded animate-pulse w-full"></div>
        </div>
      ) : (
        <section className="bg-surface rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Nome Completo</th>
                  <th className="px-6 py-4 font-medium">Telefone</th>
                  <th className="px-6 py-4 font-medium">Condição / Patologia Principal</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
                {beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-on-surface-variant">Nenhum beneficiário encontrado.</td>
                  </tr>
                ) : (
                  beneficiaries.map(b => (
                    <tr key={b.id} className="hover:bg-secondary-container/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {b.foto_url ? (
                            <img src={b.foto_url} alt={b.nome} className="w-8 h-8 rounded-full object-cover border border-outline-variant shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-xs shrink-0">
                              {b.nome ? b.nome.substring(0, 2).toUpperCase() : 'B'}
                            </div>
                          )}
                          <Link to={`/cestas/${b.id}`} className="font-semibold text-primary hover:underline">{b.nome}</Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{b.telefone}</td>
                      <td className="px-6 py-4 truncate max-w-xs text-on-surface-variant">
                        {b.patologias && b.patologias.length > 0 ? b.patologias.join(', ') : 'Nenhuma'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          b.status === 'Ativo' 
                            ? 'bg-primary-container text-on-primary-container border-primary/20' 
                            : 'bg-outline-variant/40 text-on-surface-variant border-outline-variant/50'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                            to={`/cestas/${b.id}`} 
                            className="p-1.5 text-outline hover:text-primary rounded-xl hover:bg-surface-container transition-colors"
                            title="Editar / Detalhes"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Link>
                          <button 
                            type="button"
                            onClick={() => openDeliveryModal(b)}
                            className="p-1.5 text-outline hover:text-primary rounded-xl hover:bg-surface-container transition-colors"
                            title="Registrar Entrega"
                          >
                            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(b)}
                            className="p-1.5 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors"
                            title="Excluir Cadastro"
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
      )}

      {/* Delivery Logging Modal */}
      {deliveryModalOpen && selectedBeneficiary && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3">
              <div>
                <h3 className="font-semibold text-primary text-md">Registrar Entrega de Cesta</h3>
                <p className="text-[11px] text-on-surface-variant">Beneficiário: {selectedBeneficiary.nome}</p>
              </div>
              <button onClick={() => setDeliveryModalOpen(false)} className="p-1 text-on-surface hover:bg-surface-container rounded-xl">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleSaveDelivery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Mês de Referência *</label>
                <input
                  type="text"
                  placeholder="Ex: Junho 2026"
                  required
                  value={deliveryFormData.mes_referencia}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, mes_referencia: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Data de Entrega</label>
                <input
                  type="date"
                  value={deliveryFormData.data_entrega}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, data_entrega: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Quem Fez a Entrega</label>
                <input
                  type="text"
                  value={deliveryFormData.entregador}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, entregador: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Status da Entrega</label>
                <select
                  value={deliveryFormData.status}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm"
                >
                  <option value="Entregue">Entregue</option>
                  <option value="Não Retirado">Não Retirado</option>
                  <option value="Entrega Parcial">Entrega Parcial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Observações</label>
                <textarea
                  value={deliveryFormData.observacoes}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-body-sm h-16 focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-surface-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container shadow-sm"
                >
                  {saving ? 'Registrando...' : 'Registrar Entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
