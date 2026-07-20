import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  fetchAlugueis, 
  deleteAluguel, 
  fetchEstoqueEquipamentos, 
  insertEstoqueEquipamento 
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'

export const Aluguel = () => {
  const { showToast, confirmDelete } = useFeedback()
  const [activeTab, setActiveTab] = useState('contratos')
  
  // Contracts states
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Stock states
  const [estoque, setEstoque] = useState([])
  const [loadingEstoque, setLoadingEstoque] = useState(false)
  const [estoqueModalOpen, setEstoqueModalOpen] = useState(false)
  const [savingEstoque, setSavingEstoque] = useState(false)
  const [estoqueForm, setEstoqueForm] = useState({
    nome_equipamento: '',
    numero_serie: '',
    quantidade_total: ''
  })

  const loadContracts = async () => {
    setLoading(true)
    try {
      const data = await fetchAlugueis(search, statusFilter)
      setContracts(data)
    } catch (err) {
      showToast('Erro ao carregar contratos', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadEstoque = async () => {
    setLoadingEstoque(true)
    try {
      const data = await fetchEstoqueEquipamentos()
      setEstoque(data)
    } catch (err) {
      showToast('Erro ao carregar estoque', err.message, 'error')
    } finally {
      setLoadingEstoque(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'contratos') {
      const delayDebounce = setTimeout(() => {
        loadContracts()
      }, 300)
      return () => clearTimeout(delayDebounce)
    } else {
      loadEstoque()
    }
  }, [search, statusFilter, activeTab])

  const handleDelete = (contract) => {
    confirmDelete(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o contrato de aluguel de "${contract.locatario_nome}"? Esta ação não pode ser desfeita e apagará todo o histórico de pagamentos.`,
      async () => {
        try {
          await deleteAluguel(contract.id)
          showToast('Sucesso', 'Contrato excluído com sucesso!')
          loadContracts()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  const handleSaveEstoque = async (e) => {
    e.preventDefault()
    if (!estoqueForm.nome_equipamento.trim() || !estoqueForm.quantidade_total) {
      showToast('Erro', 'Por favor, preencha todos os campos obrigatórios.', 'error')
      return
    }
    const qty = parseInt(estoqueForm.quantidade_total)
    if (isNaN(qty) || qty < 0) {
      showToast('Erro', 'A quantidade total deve ser um número maior ou igual a zero.', 'error')
      return
    }
    setSavingEstoque(true)
    try {
      await insertEstoqueEquipamento({
        nome_equipamento: estoqueForm.nome_equipamento.trim(),
        numero_serie: estoqueForm.numero_serie.trim() || null,
        quantidade_total: qty,
        quantidade_disponivel: qty,
        status: qty > 0 ? 'Disponível' : 'Esgotado'
      })
      showToast('Sucesso', 'Equipamento adicionado ao estoque!')
      setEstoqueModalOpen(false)
      setEstoqueForm({ nome_equipamento: '', numero_serie: '', quantidade_total: '' })
      loadEstoque()
    } catch (err) {
      showToast('Erro ao cadastrar', err.message, 'error')
    } finally {
      setSavingEstoque(false)
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val)
  }

  const getStatusBadge = (status) => {
    const styles = {
      Ativo: 'bg-primary-container text-on-primary-container border-primary/20',
      Encerrado: 'bg-surface-variant text-on-surface-variant border-outline-variant/30',
      'Em Atraso': 'bg-error-container text-on-error-container border-error/20'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.Ativo}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-surface-variant pb-4">
        <div>
          <h2 className="font-display-lg text-headline-lg text-primary font-semibold">Aluguel de Equipamentos</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Gerencie os contratos de locação e controle o estoque físico dos equipamentos.</p>
        </div>
      </div>

      {/* Navigation Tabs and Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant gap-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('contratos')}
            className={`pb-3 font-semibold text-sm transition-all relative ${
              activeTab === 'contratos' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Contratos Ativos
            {activeTab === 'contratos' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('estoque')}
            className={`pb-3 font-semibold text-sm transition-all relative ${
              activeTab === 'estoque' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Estoque / Equipamentos
            {activeTab === 'estoque' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        <div className="pb-2">
          {activeTab === 'contratos' ? (
            <Link 
              to="/aluguel/novo"
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold text-sm transition-all shadow-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Novo Contrato
            </Link>
          ) : (
            <button 
              onClick={() => setEstoqueModalOpen(true)}
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold text-sm transition-all shadow-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Adicionar Equipamento
            </button>
          )}
        </div>
      </div>

      {activeTab === 'contratos' ? (
        <>
          {/* Filters */}
          <section className="bg-surface rounded-xl shadow-sm border border-outline-variant p-6 flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Busca Geral</label>
              <div className="flex items-center border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus-within:border-secondary transition-colors">
                <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
                <input 
                  className="bg-transparent border-none outline-none w-full text-body-md font-body-md text-on-surface placeholder:text-outline-variant focus:ring-0 p-0" 
                  placeholder="Buscar por locatário..." 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Filter status */}
            <div className="w-full md:w-48">
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Status do Contrato</label>
              <select 
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest text-body-md font-body-md text-on-surface focus:border-secondary focus:ring-0 outline-none transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
                <option value="atrasado">Em Atraso</option>
              </select>
            </div>
          </section>

          {/* Listing Grid */}
          {loading && contracts.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <section className="bg-surface rounded-xl shadow-sm border border-outline-variant overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Locatário</th>
                      <th className="px-6 py-4 font-medium">Equipamento</th>
                      <th className="px-6 py-4 font-medium text-right">Aluguel Mensal</th>
                      <th className="px-6 py-4 font-medium text-center">Vencimento (Dia)</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant text-body-sm font-body-sm text-on-surface">
                    {contracts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-10 text-center text-on-surface-variant">Nenhum contrato cadastrado.</td>
                      </tr>
                    ) : (
                      contracts.map(c => (
                        <tr key={c.id} className="hover:bg-secondary-container/10 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-primary">
                            <Link to={`/aluguel/${c.id}`} className="hover:underline">{c.locatario_nome}</Link>
                          </td>
                          <td className="px-6 py-4 text-on-surface-variant truncate max-w-xs">
                            {c.equipamento?.nome_equipamento || '---'} {c.equipamento?.numero_serie ? `(${c.equipamento.numero_serie})` : ''}
                          </td>
                          <td className="px-6 py-4 text-right font-bold">{formatCurrency(c.valor_mensal)}</td>
                          <td className="px-6 py-4 text-center">{c.dia_vencimento ? `Dia ${c.dia_vencimento}` : '---'}</td>
                          <td className="px-6 py-4">{getStatusBadge(c.status === 'ativo' ? 'Ativo' : c.status === 'encerrado' ? 'Encerrado' : 'Em Atraso')}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link 
                                to={`/aluguel/${c.id}`} 
                                className="p-1.5 text-outline hover:text-primary rounded hover:bg-surface-container transition-colors"
                                title="Editar / Ver Detalhes"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </Link>
                              <button 
                                onClick={() => handleDelete(c)}
                                className="p-1.5 text-outline hover:text-error rounded hover:bg-error-container/20 transition-colors"
                                title="Excluir Contrato"
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
        </>
      ) : (
        <>
          {/* Stock Tab View */}
          {loadingEstoque && estoque.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : estoque.length === 0 ? (
            <div className="text-center py-12 bg-surface rounded-xl border border-outline-variant text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-2">inventory_2</span>
              <p className="font-semibold text-sm">Nenhum equipamento cadastrado no estoque.</p>
              <p className="text-xs text-outline mt-1">Adicione itens para poder vinculá-los nos contratos de locação.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {estoque.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-surface rounded-xl border border-outline-variant p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-gray-900 text-body-md leading-tight">
                        {item.nome_equipamento}
                      </h4>
                      {item.quantidade_disponivel === 0 && (
                        <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container border border-error/20 text-[10px] font-bold uppercase shrink-0">
                          Esgotado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant font-mono mt-1">
                      S/N: {item.numero_serie || '---'}
                    </p>
                  </div>

                  <div className="border-t border-surface-variant pt-3 flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-medium">Quantidade</span>
                    <span className="font-bold text-slate-800">
                      Disponível: <span className={item.quantidade_disponivel === 0 ? 'text-error font-extrabold' : 'text-primary'}>{item.quantidade_disponivel}</span> / Total: {item.quantidade_total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Equipment to Stock Modal */}
      {estoqueModalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-surface-variant animate-fade-in">
            <header className="p-6 border-b border-surface-variant flex justify-between items-center bg-surface-container-low shrink-0">
              <h3 className="font-headline-sm text-headline-sm text-primary font-semibold">
                Cadastrar no Estoque
              </h3>
              <button 
                onClick={() => setEstoqueModalOpen(false)}
                className="text-outline hover:text-on-surface hover:bg-surface-container p-1 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleSaveEstoque}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome do Equipamento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cadeira de Rodas, Muleta"
                    value={estoqueForm.nome_equipamento}
                    onChange={(e) => setEstoqueForm(prev => ({ ...prev, nome_equipamento: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Número de Série (S/N) (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: SN-CR-9988"
                    value={estoqueForm.numero_serie}
                    onChange={(e) => setEstoqueForm(prev => ({ ...prev, numero_serie: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Quantidade Inicial em Estoque *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ex: 5"
                    value={estoqueForm.quantidade_total}
                    onChange={(e) => setEstoqueForm(prev => ({ ...prev, quantidade_total: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
                  />
                </div>
              </div>

              <footer className="p-6 border-t border-surface-variant flex justify-end gap-3 bg-surface-container-low shrink-0">
                <button
                  type="button"
                  onClick={() => setEstoqueModalOpen(false)}
                  className="px-5 py-2.5 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEstoque}
                  className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {savingEstoque ? 'Salvando...' : 'Salvar Equipamento'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
