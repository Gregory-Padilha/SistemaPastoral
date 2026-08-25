import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  fetchItensRetirada, 
  insertItemRetirada, 
  updateItemRetirada,
  deleteItemRetirada,
  fetchAnotacoesRetirada, 
  insertAnotacaoRetirada,
  updateAnotacaoRetirada,
  deleteAnotacaoRetirada
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'

export const Retiradas = () => {
  const { showToast, confirmDelete } = useFeedback()
  const [anotacoes, setAnotacoes] = useState([])
  const [itens, setItens] = useState([])
  const [beneficiarios, setBeneficiarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Modals state
  const [newAnotacaoOpen, setNewAnotacaoOpen] = useState(false)
  const [manageItensOpen, setManageItensOpen] = useState(false)

  // CRUD Edit states
  const [editingAnotacao, setEditingAnotacao] = useState(null)
  const [editingItem, setEditingItem] = useState(null)

  // New/Edit annotation form state
  const [selectedBeneficiario, setSelectedBeneficiario] = useState('')
  const [searchBeneficiario, setSearchBeneficiario] = useState('')
  const [showBeneficiarioDropdown, setShowBeneficiarioDropdown] = useState(false)
  const [dataRetirada, setDataRetirada] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [quantidades, setQuantidades] = useState({}) // { item_id: qty }

  // New/Edit item form state
  const [newItemNome, setNewItemNome] = useState('')
  const [newItemUnidade, setNewItemUnidade] = useState('UN')

  const loadData = async () => {
    setLoading(true)
    try {
      const [anotacoesData, itensData] = await Promise.all([
        fetchAnotacoesRetirada(),
        fetchItensRetirada()
      ])
      setAnotacoes(anotacoesData)
      setItens(itensData)

      // Only reset quantities if we're not currently editing an annotation
      if (!editingAnotacao) {
        const initialQtys = {}
        itensData.forEach(item => {
          initialQtys[item.id] = 0
        })
        setQuantidades(initialQtys)
      }

      // Fetch beneficiarios for search/select dropdown
      const { data: benefs, error: bError } = await supabase
        .from('beneficiarios')
        .select('id, nome')
        .is('deletado_em', null)
        .order('nome')
      if (bError) throw bError
      setBeneficiarios(benefs || [])
    } catch (err) {
      showToast('Erro ao carregar dados', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleQtyChange = (itemId, change) => {
    setQuantidades(prev => {
      const current = prev[itemId] || 0
      const nextVal = Math.max(0, current + change)
      return { ...prev, [itemId]: nextVal }
    })
  }

  const handleSaveAnotacao = async (e) => {
    e.preventDefault()
    if (!selectedBeneficiario) {
      showToast('Erro', 'Por favor, selecione um beneficiário.', 'error')
      return
    }

    // Build list of items with qty > 0
    const selectedItensPayload = Object.keys(quantidades)
      .filter(itemId => quantidades[itemId] > 0)
      .map(itemId => ({
        item_id: itemId,
        quantidade: quantidades[itemId]
      }))

    if (selectedItensPayload.length === 0) {
      showToast('Aviso', 'Selecione pelo menos 1 item com quantidade maior que zero.', 'warning')
      return
    }

    setSaving(true)
    try {
      const header = {
        beneficiario_id: selectedBeneficiario,
        data_retirada: dataRetirada,
        observacoes: observacoes || null
      }

      if (editingAnotacao) {
        await updateAnotacaoRetirada(editingAnotacao.id, header, selectedItensPayload)
        showToast('Sucesso', 'Anotação de retirada atualizada com sucesso!')
      } else {
        await insertAnotacaoRetirada(header, selectedItensPayload)
        showToast('Sucesso', 'Anotação de retirada cadastrada com sucesso!')
      }
      
      closeAnotacaoModal()
      loadData()
    } catch (err) {
      showToast('Erro ao salvar', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const closeAnotacaoModal = () => {
    setSelectedBeneficiario('')
    setSearchBeneficiario('')
    setObservacoes('')
    setDataRetirada(new Date().toISOString().split('T')[0])
    setEditingAnotacao(null)
    
    const resetQtys = {}
    itens.forEach(item => {
      resetQtys[item.id] = 0
    })
    setQuantidades(resetQtys)
    setNewAnotacaoOpen(false)
  }

  const handleEditAnotacao = (anotacao) => {
    setEditingAnotacao(anotacao)
    setSelectedBeneficiario(anotacao.beneficiario_id)
    setSearchBeneficiario(anotacao.beneficiario?.nome || '')
    setDataRetirada(anotacao.data_retirada)
    setObservacoes(anotacao.observacoes || '')

    // Populate quantities
    const editQtys = {}
    itens.forEach(item => {
      const activeMatch = (anotacao.anotacoes_itens || []).find(ai => ai.item?.nome === item.nome)
      editQtys[item.id] = activeMatch ? activeMatch.quantidade : 0
    })
    setQuantidades(editQtys)
    setNewAnotacaoOpen(true)
  }

  const handleDeleteAnotacao = (anotacao) => {
    confirmDelete(
      'Confirmar Exclusão',
      `Deseja realmente excluir a anotação de retirada para "${anotacao.beneficiario?.nome || 'este beneficiário'}" do dia ${formatDate(anotacao.data_retirada)}?`,
      async () => {
        try {
          await deleteAnotacaoRetirada(anotacao.id)
          showToast('Sucesso', 'Anotação excluída com sucesso!')
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!newItemNome.trim()) return

    setSaving(true)
    try {
      const payload = {
        nome: newItemNome.trim(),
        unidade_medida: newItemUnidade,
        ativo: true
      }

      if (editingItem) {
        await updateItemRetirada(editingItem.id, payload)
        showToast('Sucesso', 'Item atualizado com sucesso!')
        setEditingItem(null)
      } else {
        await insertItemRetirada(payload)
        showToast('Sucesso', 'Item cadastrado com sucesso!')
      }

      setNewItemNome('')
      setNewItemUnidade('UN')
      loadData()
    } catch (err) {
      showToast('Erro ao cadastrar', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEditItem = (item) => {
    setEditingItem(item)
    setNewItemNome(item.nome)
    setNewItemUnidade(item.unidade_medida)
  }

  const handleDeleteItem = (item) => {
    confirmDelete(
      'Confirmar Exclusão',
      `Deseja realmente excluir o item "${item.nome}"?`,
      async () => {
        try {
          await deleteItemRetirada(item.id)
          showToast('Sucesso', 'Item excluído com sucesso!')
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  // Filter beneficiarios based on search input
  const filteredBeneficiarios = beneficiarios.filter(b => 
    b.nome.toLowerCase().includes(searchBeneficiario.toLowerCase())
  )

  const formatDate = (dateStr) => {
    if (!dateStr) return '---'
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  const totalAnotacoes = anotacoes.length
  const totalItensEntregues = anotacoes.reduce((sum, a) => {
    return sum + (a.anotacoes_itens || []).reduce((iSum, i) => iSum + (parseInt(i.quantidade) || 0), 0)
  }, 0)
  const uniqueBenefs = new Set(anotacoes.map(a => a.beneficiario_id)).size

  // Grouped items count for instant real-time breakdown
  const itensBreakdown = anotacoes.reduce((acc, a) => {
    (a.anotacoes_itens || []).forEach(ai => {
      const name = ai.item?.nome || 'Outros'
      acc[name] = (acc[name] || 0) + (parseInt(ai.quantidade) || 0)
    })
    return acc
  }, {})

  const filteredAnotacoes = anotacoes.filter(a => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const matchBenef = a.beneficiario?.nome?.toLowerCase().includes(term)
    const matchObs = a.observacoes?.toLowerCase().includes(term)
    const matchDate = a.data_retirada?.includes(term)
    const matchItems = (a.anotacoes_itens || []).some(ai => ai.item?.nome?.toLowerCase().includes(term))
    return matchBenef || matchObs || matchDate || matchItems
  })

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Doações & Diário de Campo
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display-lg font-bold text-primary mt-1">
            Anotações de Retirada
          </h2>
          <p className="text-xs text-on-surface-variant">
            Registre entregas pontuais de roupas, cobertores, fraldas e donativos às famílias.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setManageItensOpen(true)}
            className="border border-outline-variant text-on-surface hover:bg-surface-container px-4 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            Catálogo de Itens
          </button>
          <button 
            onClick={() => setNewAnotacaoOpen(true)}
            className="bg-primary text-on-primary hover:bg-primary-container px-5 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_notes</span>
            Nova Anotação
          </button>
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">assignment</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Total de Registros</span>
            <p className="text-xl font-extrabold text-on-surface leading-tight">{totalAnotacoes.toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Donativos Entregues</span>
            <p className="text-xl font-extrabold text-emerald-700 leading-tight">{totalItensEntregues.toLocaleString('pt-BR')} un</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">diversity_3</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">Famílias Atendidas</span>
            <p className="text-xl font-extrabold text-secondary leading-tight">{uniqueBenefs.toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Category distribution summary chips */}
      {Object.keys(itensBreakdown).length > 0 && (
        <div className="bg-surface rounded-2xl border border-outline-variant/70 p-4 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">pie_chart</span>
              Detalhamento dos Donativos Entregues ({totalItensEntregues.toLocaleString('pt-BR')} un no total)
            </span>
            <span className="text-[10px] text-on-surface-variant font-bold bg-primary/10 px-2 py-0.5 rounded-full text-primary">Tempo Real</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(itensBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([name, qty], idx) => (
                <div 
                  key={idx} 
                  className="bg-surface-container-low border border-outline-variant/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs"
                >
                  <span className="font-bold text-on-surface">{name}:</span>
                  <span className="font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full text-[11px]">
                    {qty.toLocaleString('pt-BR')} un
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Search Filter Bar */}
      <section className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 p-3.5 flex items-center gap-3">
        <div className="flex-1 flex items-center border border-outline-variant rounded-xl px-3.5 py-2 bg-surface-container-lowest focus-within:border-primary transition-all">
          <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
          <input 
            className="bg-transparent border-none outline-none w-full text-xs md:text-sm font-medium text-on-surface placeholder:text-outline/70 focus:ring-0 p-0" 
            placeholder="Buscar por beneficiário, item doado (ex: calça, blusa) ou observações..." 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="text-outline hover:text-error text-xs font-bold px-1"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* Historic Table */}
      {loading && anotacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] gap-2">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-outline">Carregando anotações de retirada...</p>
        </div>
      ) : (
        <section className="bg-surface rounded-3xl shadow-xs border border-outline-variant/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant/80 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-36">Data</th>
                  <th className="px-5 py-3.5">Beneficiário</th>
                  <th className="px-5 py-3.5">Itens Retirados</th>
                  <th className="px-5 py-3.5">Observações</th>
                  <th className="px-5 py-3.5 text-right w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                {filteredAnotacoes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-outline">
                      {searchTerm ? 'Nenhuma anotação encontrada com os termos buscados.' : 'Nenhuma anotação registrada ainda.'}
                    </td>
                  </tr>
                ) : (
                  filteredAnotacoes.map(a => (
                    <tr key={a.id} className="hover:bg-secondary-container/15 transition-colors group">
                      <td className="px-5 py-3.5 text-outline font-mono whitespace-nowrap">
                        {formatDate(a.data_retirada)}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-on-surface">
                        {a.beneficiario?.nome || '---'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5 max-w-xl">
                          {a.anotacoes_itens && a.anotacoes_itens.length > 0 ? (
                            a.anotacoes_itens.map((ai, index) => (
                              <span 
                                key={index} 
                                className="inline-flex items-center px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold"
                              >
                                {ai.quantidade}x {ai.item?.nome} {ai.item?.unidade_medida !== 'UN' ? `(${ai.item?.unidade_medida})` : ''}
                              </span>
                            ))
                          ) : (
                            <span className="text-outline">Nenhum item</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-on-surface-variant italic truncate max-w-xs">
                        {a.observacoes || '---'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditAnotacao(a)}
                            className="p-1 text-outline hover:text-primary rounded-lg hover:bg-surface-container transition-colors"
                            title="Editar Anotação"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAnotacao(a)}
                            className="p-1 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors"
                            title="Excluir Anotação"
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

      {/* Modal: Nova Anotação */}
      {newAnotacaoOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg border border-surface-variant p-6 flex flex-col gap-5 max-h-[90vh]">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-semibold text-primary text-headline-sm">
                {editingAnotacao ? 'Editar Anotação de Retirada' : 'Nova Anotação de Retirada'}
              </h3>
              <button 
                onClick={closeAnotacaoModal} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleSaveAnotacao} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Beneficiary Select Search Dropdown */}
              <div className="relative">
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Beneficiário *</label>
                <div className="flex items-center border border-outline-variant rounded-lg px-3 py-2 bg-surface focus-within:border-primary">
                  <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
                  <input
                    type="text"
                    placeholder={selectedBeneficiario 
                      ? beneficiarios.find(b => b.id === selectedBeneficiario)?.nome 
                      : "Buscar beneficiário pelo nome..."
                    }
                    value={searchBeneficiario}
                    onChange={(e) => {
                      setSearchBeneficiario(e.target.value)
                      setShowBeneficiarioDropdown(true)
                    }}
                    onFocus={() => setShowBeneficiarioDropdown(true)}
                    className="bg-transparent border-none outline-none w-full text-body-sm placeholder:text-outline p-0"
                  />
                  {selectedBeneficiario && (
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedBeneficiario('')
                        setSearchBeneficiario('')
                      }}
                      className="text-xs text-outline hover:text-error ml-2"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {showBeneficiarioDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-surface-variant">
                    {filteredBeneficiarios.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-on-surface-variant text-center">Nenhum beneficiário encontrado</div>
                    ) : (
                      filteredBeneficiarios.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedBeneficiario(b.id)
                            setSearchBeneficiario('')
                            setShowBeneficiarioDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-secondary-container/30 transition-colors flex justify-between items-center"
                        >
                          <span className="font-semibold text-gray-900">{b.nome}</span>
                          {selectedBeneficiario === b.id && (
                            <span className="material-symbols-outlined text-primary text-[16px]">check</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Data Retirada */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Data da Retirada *</label>
                <input
                  type="date"
                  required
                  value={dataRetirada}
                  onChange={(e) => setDataRetirada(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary outline-none"
                />
              </div>

              {/* Items selectors list */}
              <div className="space-y-2">
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Selecione os Itens e Quantidades</label>
                
                <div className="border border-outline-variant rounded-lg divide-y divide-surface-variant bg-surface max-h-60 overflow-y-auto">
                  {itens.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-on-surface-variant">
                      Nenhum item cadastrado. Use o botão "Gerenciar Itens" para cadastrar itens primeiro.
                    </div>
                  ) : (
                    itens.map(item => {
                      const qty = quantidades[item.id] || 0
                      return (
                        <div key={item.id} className="flex justify-between items-center px-4 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-gray-900">{item.nome}</p>
                            <p className="text-[10px] text-on-surface-variant">Unidade: {item.unidade_medida}</p>
                          </div>
                          
                          {/* Stepper controls */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.id, -1)}
                              className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-gray-800 transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                setQuantidades(prev => ({ ...prev, [item.id]: Math.max(0, val) }))
                              }}
                              className="w-12 text-center border border-outline-variant rounded py-1 text-xs font-bold text-gray-900 bg-surface outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.id, 1)}
                              className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-gray-800 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Doação de inverno, roupas em bom estado..."
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary h-20 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-surface-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAnotacaoModal}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container shadow-sm transition-all"
                >
                  {saving ? 'Gravando...' : 'Salvar Anotação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerenciar Itens */}
      {manageItensOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md border border-surface-variant p-6 flex flex-col gap-4 max-h-[85vh]">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-semibold text-primary text-headline-sm">Gerenciar Itens de Retirada</h3>
              <button 
                onClick={() => {
                  setManageItensOpen(false)
                  setEditingItem(null)
                  setNewItemNome('')
                  setNewItemUnidade('UN')
                }} 
                className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            {/* Quick add/edit form */}
            <form onSubmit={handleSaveItem} className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                {editingItem ? 'Editar Item de Retirada' : 'Cadastrar Novo Item'}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Blusa, Cobertor"
                    value={newItemNome}
                    onChange={(e) => setNewItemNome(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-xs focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <select
                    value={newItemUnidade}
                    onChange={(e) => setNewItemUnidade(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-xs focus:border-primary outline-none"
                  >
                    <option value="UN">UN</option>
                    <option value="PAR">PAR</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null)
                      setNewItemNome('')
                      setNewItemUnidade('UN')
                    }}
                    className="flex-1 bg-surface border border-outline-variant hover:bg-surface-container text-xs font-semibold py-2 rounded-lg transition-colors shadow-sm text-on-surface"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold py-2 rounded-lg transition-colors shadow-sm"
                >
                  {saving ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Adicionar Item'}
                </button>
              </div>
            </form>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Itens Disponíveis</h4>
              <div className="border border-outline-variant rounded-lg divide-y divide-surface-variant bg-surface">
                {itens.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-on-surface-variant">Nenhum item cadastrado ainda.</div>
                ) : (
                  itens.map(item => (
                    <div key={item.id} className="flex justify-between items-center px-4 py-2 hover:bg-secondary-container/10 transition-colors group/item">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{item.nome}</span>
                        <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded border border-outline-variant/30 font-medium">
                          {item.unidade_medida}
                        </span>
                      </div>
                      
                      {/* Item edit/delete actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          className="p-1 hover:bg-surface-container text-outline hover:text-primary rounded"
                          title="Editar Item"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 hover:bg-error-container/20 text-outline hover:text-error rounded"
                          title="Excluir Item"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="pt-3 border-t border-surface-variant flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setManageItensOpen(false)
                  setEditingItem(null)
                  setNewItemNome('')
                  setNewItemUnidade('UN')
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
