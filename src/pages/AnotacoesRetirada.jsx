import React, { useEffect, useState } from 'react'
import { 
  fetchAnotacoesRetirada, 
  fetchItensRetirada, 
  createItemRetirada, 
  createAnotacaoRetirada,
  fetchBeneficiarios,
  deleteAnotacaoRetirada,
  updateAnotacaoRetirada
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { useAuth } from '../contexts/AuthContext'

export const AnotacoesRetirada = () => {
  const { showToast, confirmDelete } = useFeedback()
  
  // Data lists
  const [anotacoes, setAnotacoes] = useState([])
  const [itens, setItens] = useState([])
  const [beneficiarios, setBeneficiarios] = useState([])
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  
  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [editingAnotacaoId, setEditingAnotacaoId] = useState(null)

  // Form states - New Annotation
  const [selectedBeneficiario, setSelectedBeneficiario] = useState(null)
  const [beneficiarioSearch, setBeneficiarioSearch] = useState('')
  const [showBeneficiarioDropdown, setShowBeneficiarioDropdown] = useState(false)
  const [dataRetirada, setDataRetirada] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [quantidades, setQuantidades] = useState({}) // { item_id: quantidade }

  // Form states - New Item
  const [novoItemNome, setNovoItemNome] = useState('')
  const [novoItemUnidade, setNovoItemUnidade] = useState('Unidade')

  // Load all initial data
  const loadData = async () => {
    setLoading(true)
    try {
      const [anotacoesData, itensData, beneficiariosData] = await Promise.all([
        fetchAnotacoesRetirada(),
        fetchItensRetirada(),
        fetchBeneficiarios('', 'ativo')
      ])
      setAnotacoes(anotacoesData)
      setItens(itensData)
      setBeneficiarios(beneficiariosData)
      
      // Initialize quantities to 0
      const initialQuants = {}
      itensData.forEach(item => {
        initialQuants[item.id] = 0
      })
      setQuantidades(initialQuants)
    } catch (err) {
      showToast('Erro ao carregar dados', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered beneficiaries for the search-select combobox
  const filteredBeneficiarios = beneficiarios.filter(b => 
    b.nome.toLowerCase().includes(beneficiarioSearch.toLowerCase())
  )

  const handleOpenModal = () => {
    setEditingAnotacaoId(null)
    setSelectedBeneficiario(null)
    setBeneficiarioSearch('')
    setDataRetirada(new Date().toISOString().split('T')[0])
    setObservacoes('')
    
    // Reset quantities to 0
    const initialQuants = {}
    itens.forEach(item => {
      initialQuants[item.id] = 0
    })
    setQuantidades(initialQuants)
    setModalOpen(true)
  }

  const handleEdit = (anot) => {
    setEditingAnotacaoId(anot.id)
    setSelectedBeneficiario(anot.beneficiario)
    setBeneficiarioSearch(anot.beneficiario?.nome || '')
    setDataRetirada(anot.data_retirada)
    setObservacoes(anot.observacoes || '')
    
    // Initialize all items to 0 first
    const initialQuants = {}
    itens.forEach(item => {
      initialQuants[item.id] = 0
    })
    
    // Set actual quantities from the selected annotation
    anot.anotacoes_itens?.forEach(subItem => {
      if (subItem.item?.id) {
        initialQuants[subItem.item.id] = subItem.quantidade
      }
    })
    
    setQuantidades(initialQuants)
    setModalOpen(true)
  }

  const handleDelete = (anot) => {
    confirmDelete(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir esta anotação de retirada para "${anot.beneficiario?.nome}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteAnotacaoRetirada(anot.id)
          showToast('Sucesso', 'Anotação excluída com sucesso!', 'success')
          loadData()
        } catch (err) {
          showToast('Erro ao excluir', err.message, 'error')
        }
      }
    )
  }

  const handleIncrement = (itemId) => {
    setQuantidades(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }))
  }

  const handleDecrement = (itemId) => {
    setQuantidades(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) - 1)
    }))
  }

  const handleQuantityChange = (itemId, val) => {
    const parsed = parseInt(val, 10)
    setQuantidades(prev => ({
      ...prev,
      [itemId]: isNaN(parsed) ? 0 : Math.max(0, parsed)
    }))
  }

  const handleSaveAnotacao = async (e) => {
    e.preventDefault()
    if (!selectedBeneficiario) {
      showToast('Campo obrigatório', 'Por favor, selecione um beneficiário.', 'error')
      return
    }

    // Filter items with quantity > 0
    const itensParaSalvar = Object.entries(quantidades)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        item_id: itemId,
        quantidade: qty
      }))

    if (itensParaSalvar.length === 0) {
      showToast('Nenhum item selecionado', 'Por favor, selecione a quantidade de pelo menos um item.', 'error')
      return
    }

    setSaving(true)
    try {
      if (editingAnotacaoId) {
        await updateAnotacaoRetirada(
          editingAnotacaoId,
          selectedBeneficiario.id,
          dataRetirada,
          observacoes,
          itensParaSalvar
        )
        showToast('Sucesso', 'Anotação de retirada atualizada com sucesso!', 'success')
      } else {
        await createAnotacaoRetirada(
          selectedBeneficiario.id,
          dataRetirada,
          observacoes,
          itensParaSalvar
        )
        showToast('Sucesso', 'Anotação de retirada salva com sucesso!', 'success')
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      showToast('Erro ao salvar', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateItem = async (e) => {
    e.preventDefault()
    if (!novoItemNome.trim()) {
      showToast('Campo obrigatório', 'Por favor, digite o nome do item.', 'error')
      return
    }

    setSavingItem(true)
    try {
      await createItemRetirada(novoItemNome.trim(), novoItemUnidade)
      showToast('Sucesso', 'Item cadastrado com sucesso!', 'success')
      setNovoItemNome('')
      setNovoItemUnidade('Unidade')
      // Refresh items list
      const updatedItens = await fetchItensRetirada()
      setItens(updatedItens)
      setQuantidades(prev => ({
        ...prev,
        ...Object.fromEntries(updatedItens.map(i => [i.id, prev[i.id] || 0]))
      }))
    } catch (err) {
      showToast('Erro ao cadastrar', err.message, 'error')
    } finally {
      setSavingItem(false)
    }
  }

  // Filter annotations based on search bar
  const filteredAnotacoes = anotacoes.filter(anot => {
    const nomeBeneficiario = anot.beneficiario?.nome || ''
    const obs = anot.observacoes || ''
    const matchSearch = nomeBeneficiario.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        obs.toLowerCase().includes(searchQuery.toLowerCase())
    return matchSearch
  })

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anotações de Retirada</h1>
          <p className="text-sm text-gray-500">Histórico de cobertores, roupas e utensílios retirados pelos beneficiários</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-surface text-on-surface text-sm font-semibold rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            Gerenciar Itens
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/95 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nova Anotação
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-surface rounded-xl border border-surface-variant flex flex-col flex-1 min-h-0 overflow-hidden shadow-[0px_4px_12px_rgba(0,0,0,0.02)]">
        {/* Filters and search */}
        <div className="p-4 border-b border-surface-variant flex flex-col sm:flex-row items-center gap-4 bg-surface-container-low/30">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
            <input
              type="text"
              placeholder="Buscar por beneficiário ou observações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-outline">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Carregando histórico...</span>
            </div>
          ) : filteredAnotacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-outline gap-2">
              <span className="material-symbols-outlined text-[48px]">receipt_long</span>
              <p className="text-sm font-medium">Nenhuma anotação de retirada cadastrada.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 tracking-wider">Beneficiário</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 tracking-wider">Data da Retirada</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 tracking-wider">Itens Retirados</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 tracking-wider">Observações</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {filteredAnotacoes.map((anot) => (
                  <tr key={anot.id} className="hover:bg-surface-container-low/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900 block">
                        {anot.beneficiario?.nome || 'Beneficiário Não Identificado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(anot.data_retirada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {anot.anotacoes_itens?.map((subItem) => (
                          <span 
                            key={subItem.id} 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#f0f4eb] text-[#3d5a2a] border border-[#d6e3cb]"
                          >
                            {subItem.item?.nome}: <strong>{subItem.quantidade}</strong> {subItem.item?.unidade_medida?.toLowerCase()}
                          </span>
                        ))}
                        {(!anot.anotacoes_itens || anot.anotacoes_itens.length === 0) && (
                          <span className="text-xs text-outline italic">Nenhum item registrado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={anot.observacoes}>
                      {anot.observacoes || <span className="text-outline italic">Sem observações</span>}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(anot)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-surface-container rounded-lg transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(anot)}
                          className="p-1.5 text-error hover:bg-error-container/20 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal - New/Edit Annotation */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-xl max-w-xl w-full border border-surface-variant shadow-xl flex flex-col max-h-[90vh]">
            <header className="p-6 border-b border-surface-variant flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingAnotacaoId ? 'Editar Anotação de Retirada' : 'Nova Anotação de Retirada'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleSaveAnotacao} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Beneficiary Autocomplete SearchSelect */}
              <div className="flex flex-col gap-1 relative">
                <label className="text-xs font-semibold text-gray-700">Beneficiário <span className="text-error">*</span></label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Pesquisar por nome do beneficiário..."
                    value={beneficiarioSearch}
                    onChange={(e) => {
                      setBeneficiarioSearch(e.target.value)
                      setShowBeneficiarioDropdown(true)
                      if (selectedBeneficiario && selectedBeneficiario.nome !== e.target.value) {
                        setSelectedBeneficiario(null)
                      }
                    }}
                    onFocus={() => setShowBeneficiarioDropdown(true)}
                    className="w-full pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                  {selectedBeneficiario && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-primary text-xs font-bold bg-primary-container px-2 py-0.5 rounded-full">
                      Selecionado
                    </span>
                  )}
                </div>

                {/* Dropdown list */}
                {showBeneficiarioDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowBeneficiarioDropdown(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                      {filteredBeneficiarios.length === 0 ? (
                        <div className="p-3 text-sm text-outline text-center">Nenhum beneficiário encontrado</div>
                      ) : (
                        filteredBeneficiarios.map(b => (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => {
                              setSelectedBeneficiario(b)
                              setBeneficiarioSearch(b.nome)
                              setShowBeneficiarioDropdown(false)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex flex-col border-b border-surface-variant/40 last:border-b-0"
                          >
                            <span className="font-medium text-gray-900">{b.nome}</span>
                            <span className="text-[11px] text-outline">CPF: {b.cpf || 'Não cadastrado'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Date Input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">Data da Retirada</label>
                <input
                  type="date"
                  value={dataRetirada}
                  onChange={(e) => setDataRetirada(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>

              {/* Quantities selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-700">Quantidade de Itens Retirados</label>
                <div className="border border-surface-variant rounded-lg divide-y divide-surface-variant max-h-60 overflow-y-auto">
                  {itens.length === 0 ? (
                    <div className="p-4 text-center text-sm text-outline">
                      Nenhum item cadastrado no sistema.
                    </div>
                  ) : (
                    itens.map(item => (
                      <div key={item.id} className="p-3 flex items-center justify-between bg-surface-container-low/10">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900">{item.nome}</span>
                          <span className="text-[11px] text-outline">Unidade: {item.unidade_medida}</span>
                        </div>
                        
                        {/* Selector Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item.id)}
                            className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-lg flex items-center justify-center border border-outline-variant/60 transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={quantidades[item.id] || 0}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="w-12 py-1 text-center bg-transparent border-none font-bold text-sm text-on-surface focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleIncrement(item.id)}
                            className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-lg flex items-center justify-center border border-outline-variant/60 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Observations */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">Observações</label>
                <textarea
                  placeholder="Informações adicionais sobre o estado dos itens ou observações do atendimento..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                />
              </div>
            </form>

            <footer className="p-6 border-t border-surface-variant flex justify-end gap-3 bg-surface-container-low/20">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-outline-variant text-sm font-semibold rounded-lg hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAnotacao}
                disabled={saving}
                className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/95 transition-colors disabled:opacity-75 flex items-center gap-2"
              >
                {saving ? 'Salvando...' : 'Salvar Anotação'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Manage / Add Items */}
      {configOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-xl max-w-md w-full border border-surface-variant shadow-xl flex flex-col max-h-[85vh]">
            <header className="p-6 border-b border-surface-variant flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Gerenciar Itens de Retirada</h2>
              <button 
                onClick={() => setConfigOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Form to create item */}
              <form onSubmit={handleCreateItem} className="p-4 bg-surface-container-low border border-surface-variant/80 rounded-xl flex flex-col gap-4">
                <h3 className="text-sm font-bold text-gray-800">Cadastrar Novo Item</h3>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-600">Nome do Item</label>
                  <input
                    type="text"
                    placeholder="Ex: Cobertor de Casal, Sapato Infantil"
                    value={novoItemNome}
                    onChange={(e) => setNovoItemNome(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-600">Unidade de Medida</label>
                  <select
                    value={novoItemUnidade}
                    onChange={(e) => setNovoItemUnidade(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Unidade">Unidade</option>
                    <option value="Par">Par</option>
                    <option value="Kilo">Kilo</option>
                    <option value="Pacote">Pacote</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={savingItem}
                  className="w-full py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary/95 transition-colors disabled:opacity-75"
                >
                  {savingItem ? 'Salvando...' : 'Adicionar Item'}
                </button>
              </form>

              {/* Items List */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-gray-800">Itens Cadastrados</h3>
                <div className="border border-surface-variant rounded-lg divide-y divide-surface-variant max-h-48 overflow-y-auto">
                  {itens.map(item => (
                    <div key={item.id} className="p-3 flex items-center justify-between bg-surface-container-low/10">
                      <span className="text-sm font-semibold text-gray-900">{item.nome}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#f0f4eb] text-[#3d5a2a] border border-[#d6e3cb]">
                        {item.unidade_medida}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="p-6 border-t border-surface-variant flex justify-end bg-surface-container-low/20">
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-850 transition-colors"
              >
                Concluir
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
