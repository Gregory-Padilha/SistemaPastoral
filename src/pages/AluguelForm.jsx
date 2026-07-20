import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  fetchAluguelById, 
  insertAluguel, 
  updateAluguel, 
  insertPagamentoAluguel, 
  fetchEquipamentos, 
  fetchBeneficiarios,
  decrementEstoqueDisponivel,
  incrementEstoqueDisponivel
} from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { supabase } from '../lib/supabase'
import { mapSupabaseError } from '../lib/errorMapper'

export const AluguelForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useFeedback()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [equipamentosList, setEquipamentosList] = useState([])
  const [beneficiariosList, setBeneficiariosList] = useState([])
  const [initialStatus, setInitialStatus] = useState('')

  // Contract form states
  const [formData, setFormData] = useState({
    locatario_nome: '', locatario_cpf: '',
    locatario_telefone: '', locatario_whatsapp: '', locatario_email: '',
    locatario_endereco: '', locatario_cep: '', locatario_rua: '', locatario_numero: '',
    locatario_complemento: '', locatario_bairro: '', locatario_cidade: '', locatario_estado: '',
    equipamento_id: '', beneficiario_id: '',
    data_inicio: '', data_previsao_devolucao: '', data_devolucao_real: '',
    dia_vencimento: '10', valor_mensal: '', forma_pagamento: 'PIX',
    clausulas_especiais: '', observacoes: '', status: 'ativo', motivo: ''
  })

  // Payment log states
  const [pagamentos, setPagamentos] = useState([])
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payFormData, setPayFormData] = useState({
    mes_referencia: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: new Date().toISOString().split('T')[0],
    valor_pago: '',
    forma_pagamento: 'PIX',
    status: 'Pago'
  })

  // Receipt visual state
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null)

  const loadInitialData = async () => {
    try {
      const [eqs, bens] = await Promise.all([
        fetchEquipamentos(),
        fetchBeneficiarios('', 'ativo')
      ])
      setEquipamentosList(eqs)
      setBeneficiariosList(bens)
    } catch (err) {
      showToast('Erro ao carregar dados auxiliares', err.message, 'error')
    }
  }

  const loadContractDetails = async () => {
    setLoading(true)
    try {
      const data = await fetchAluguelById(id)
      setFormData({
        locatario_nome: data.locatario_nome || '',
        locatario_cpf: data.locatario_cpf || '',
        locatario_telefone: data.locatario_telefone || '',
        locatario_whatsapp: data.locatario_whatsapp || '',
        locatario_email: data.locatario_email || '',
        locatario_endereco: data.locatario_endereco || '',
        locatario_cep: data.locatario_cep || '',
        locatario_rua: data.locatario_rua || '',
        locatario_numero: data.locatario_numero || '',
        locatario_complemento: data.locatario_complemento || '',
        locatario_bairro: data.locatario_bairro || '',
        locatario_cidade: data.locatario_cidade || '',
        locatario_estado: data.locatario_estado || '',
        equipamento_id: data.equipamento_id || '',
        beneficiario_id: data.beneficiario_id || '',
        data_inicio: data.data_inicio || '',
        data_previsao_devolucao: data.data_previsao_devolucao || '',
        data_devolucao_real: data.data_devolucao_real || '',
        dia_vencimento: data.dia_vencimento ? data.dia_vencimento.toString() : '10',
        valor_mensal: data.valor_mensal ? data.valor_mensal.toString() : '',
        forma_pagamento: data.forma_pagamento || 'PIX',
        clausulas_especiais: data.clausulas_especiais || '',
        observacoes: data.observacoes || '',
        status: data.status || 'ativo',
        motivo: data.motivo || ''
      })
      setInitialStatus(data.status || 'ativo')
      setPagamentos(data.pagamentos_equipamento || [])
    } catch (err) {
      showToast('Erro ao carregar detalhes', err.message, 'error')
      navigate('/aluguel')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
    if (isEdit) {
      loadContractDetails()
    }
  }, [id])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()

    // Validations
    const missing = []
    if (!formData.locatario_nome.trim()) missing.push('Nome do Locatário')
    if (!formData.equipamento_id) missing.push('Equipamento')
    if (formData.valor_mensal === '' || parseFloat(formData.valor_mensal) < 0) missing.push('Valor Mensal')
    if (!formData.dia_vencimento) missing.push('Dia do Vencimento')

    if (missing.length > 0) {
      showToast('Campos obrigatórios ausentes', `Preencha: ${missing.join(', ')}`, 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        valor_mensal: parseFloat(formData.valor_mensal),
        dia_vencimento: parseInt(formData.dia_vencimento),
        equipamento_id: formData.equipamento_id || null,
        beneficiario_id: formData.beneficiario_id || null,
        data_previsao_devolucao: formData.data_previsao_devolucao || null,
        data_devolucao_real: formData.data_devolucao_real || null
      }

      if (isEdit) {
        await updateAluguel(id, payload)
        if (initialStatus === 'ativo' && payload.status === 'encerrado') {
          await incrementEstoqueDisponivel(payload.equipamento_id)
        } else if (initialStatus === 'encerrado' && payload.status === 'ativo') {
          await decrementEstoqueDisponivel(payload.equipamento_id)
        }
        showToast('Sucesso', 'Contrato atualizado com sucesso!')
      } else {
        await insertAluguel(payload)
        await decrementEstoqueDisponivel(payload.equipamento_id)
        showToast('Sucesso', 'Contrato de aluguel criado com sucesso!')
      }
      navigate('/aluguel')
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePayInputChange = (e) => {
    const { name, value } = e.target
    setPayFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!payFormData.mes_referencia) {
      showToast('Erro', 'Por favor, preencha o mês de referência.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        contrato_id: id,
        mes_referencia: payFormData.mes_referencia,
        data_vencimento: payFormData.data_vencimento || null,
        data_pagamento: payFormData.data_pagamento || null,
        valor_pago: parseFloat(payFormData.valor_pago) || 0,
        forma_pagamento: payFormData.forma_pagamento,
        status: payFormData.status
      }

      await insertPagamentoAluguel(payload)
      showToast('Sucesso', 'Pagamento registrado com sucesso!')
      setPayModalOpen(false)
      loadContractDetails()
    } catch (err) {
      showToast('Erro ao registrar pagamento', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val)
  }

  const getSpellOutValue = (val) => {
    if (!val) return ''
    const valueNum = parseFloat(val)
    if (isNaN(valueNum)) return ''

    const integerPart = Math.floor(valueNum)

    const spell = (n) => {
      const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
      const tens = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
      const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
      const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

      if (n === 0) return 'zero'
      if (n === 100) return 'cem'

      let out = []
      const h = Math.floor(n / 100)
      const t = Math.floor((n % 100) / 10)
      const u = n % 10

      if (h > 0) out.push(hundreds[h])
      if (t === 1) {
        out.push(teens[u])
      } else {
        if (t > 0) out.push(tens[t])
        if (u > 0) out.push(units[u])
      }

      return out.filter(x => x).join(' e ')
    }

    const valueWords = spell(integerPart)
    return `${valueWords} reais`.toUpperCase()
  }

  const handleOpenReceipt = (payment) => {
    setSelectedReceiptPayment(payment)
    setReceiptOpen(true)
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-surface-variant pb-6">
        <div>
          <nav className="flex items-center text-on-surface-variant font-label-sm text-label-sm mb-1 space-x-2">
            <Link to="/aluguel" className="hover:text-primary">Equipamentos</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-medium">{isEdit ? 'Editar Contrato' : 'Novo Contrato'}</span>
          </nav>
          <h2 className="font-display-lg text-headline-lg text-primary font-semibold">
            {isEdit ? 'Contrato de Locação' : 'Novo Contrato de Locação'}
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Form Area */}
          <form onSubmit={handleSave} className="lg:col-span-8 bg-surface rounded-xl border border-outline-variant shadow-sm p-6 md:p-8 space-y-8">
                {/* SEÇÃO EQUIPAMENTO */}
            <div className="space-y-4">
              <h3 className="text-primary font-semibold border-b border-surface-variant pb-2 font-headline-md text-md">1. Dados do Equipamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Equipamento *</label>
                  <select
                    name="equipamento_id"
                    value={formData.equipamento_id}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  >
                    <option value="">Selecione um equipamento...</option>
                    {equipamentosList.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nome_equipamento} {eq.numero_serie ? `(S/N: ${eq.numero_serie})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Beneficiário Associado (Opcional)</label>
                  <select
                    name="beneficiario_id"
                    value={formData.beneficiario_id}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  >
                    <option value="">Nenhum beneficiário...</option>
                    {beneficiariosList.map(ben => (
                      <option key={ben.id} value={ben.id}>
                        {ben.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Valor do Aluguel Mensal (R$) *</label>
                  <input
                    name="valor_mensal"
                    value={formData.valor_mensal}
                    onChange={handleInputChange}
                    required
                    placeholder="0,00"
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="number"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO LOCATÁRIO */}
            <div className="space-y-4">
              <h3 className="text-primary font-semibold border-b border-surface-variant pb-2 font-headline-md text-md">2. Dados do Locatário</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Nome Completo *</label>
                  <input
                    name="locatario_nome"
                    value={formData.locatario_nome}
                    onChange={handleInputChange}
                    required
                    placeholder="Nome completo do locatário/inquilino"
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">E-mail</label>
                  <input
                    name="locatario_email"
                    value={formData.locatario_email}
                    onChange={handleInputChange}
                    placeholder="nome@email.com"
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="email"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">CPF</label>
                  <input
                    name="locatario_cpf"
                    value={formData.locatario_cpf}
                    onChange={handleInputChange}
                    placeholder="Apenas números"
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Telefone</label>
                  <input
                    name="locatario_telefone"
                    value={formData.locatario_telefone}
                    onChange={handleInputChange}
                    placeholder="(00) 0000-0000"
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Endereço Completo</label>
                  <input
                    name="locatario_endereco"
                    value={formData.locatario_endereco}
                    onChange={handleInputChange}
                    placeholder="Rua, número, bairro..."
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="text"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO CONTRATO */}
            <div className="space-y-4">
              <h3 className="text-primary font-semibold border-b border-surface-variant pb-2 font-headline-md text-md">3. Dados do Contrato</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Data de Início *</label>
                  <input
                    name="data_inicio"
                    type="date"
                    required
                    value={formData.data_inicio}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Previsão de Devolução</label>
                  <input
                    name="data_previsao_devolucao"
                    type="date"
                    value={formData.data_previsao_devolucao}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Data de Devolução Real</label>
                  <input
                    name="data_devolucao_real"
                    type="date"
                    value={formData.data_devolucao_real}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Dia de Vencimento *</label>
                  <input
                    name="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Forma de Pagamento Padrão</label>
                  <select
                    name="forma_pagamento"
                    value={formData.forma_pagamento}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Doação">Doação</option>
                    <option value="Isento">Isento</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="encerrado">Encerrado</option>
                    <option value="atrasado">Em Atraso</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Motivo (Opcional)</label>
                  <input
                    name="motivo"
                    value={formData.motivo}
                    onChange={handleInputChange}
                    placeholder="Motivo do encerramento ou atraso..."
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary"
                    type="text"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-label-sm font-semibold text-on-surface mb-1">Cláusulas Especiais / Observações do Contrato</label>
                  <textarea
                    name="clausulas_especiais"
                    value={formData.clausulas_especiais}
                    onChange={handleInputChange}
                    placeholder="Cláusulas específicas de carência, reajustes, etc."
                    className="w-full border border-outline-variant rounded-lg px-4 py-2.5 bg-surface text-body-sm focus:border-primary h-24"
                  />
                </div>
              </div>
            </div>

            {/* Actions Form */}
            <div className="pt-6 border-t border-surface-variant flex justify-between">
              <Link
                to="/aluguel"
                className="px-6 py-3 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-semibold text-body-sm transition-colors"
              >
                Voltar
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-lg font-semibold text-body-sm shadow-sm transition-all"
              >
                {saving ? 'Salvando...' : 'Salvar Contrato'}
              </button>
            </div>

          </form>

          {/* Side pane: Payment history (Edit only) */}
          <div className="lg:col-span-4 space-y-6">
            {isEdit ? (
              <>
                <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-semibold text-primary text-md">Histórico de Pagamentos</h3>
                      <p className="text-xs text-on-surface-variant">Lançamentos recebidos.</p>
                    </div>
                    <button
                      onClick={() => setPayModalOpen(true)}
                      className="bg-primary text-on-primary hover:bg-primary-container px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">payments</span>
                      Pagar
                    </button>
                  </div>

                  <div className="overflow-hidden border border-outline-variant rounded-lg bg-surface">
                    <table className="w-full text-left">
                      <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                        <tr>
                          <th className="px-3 py-2">Mês/Ref</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-variant text-xs">
                        {pagamentos.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="px-3 py-6 text-center text-on-surface-variant">
                              Nenhum pagamento registrado.
                            </td>
                          </tr>
                        ) : (
                          pagamentos.map(p => (
                            <tr key={p.id} className="hover:bg-secondary-container/10">
                              <td className="px-3 py-2.5">
                                <p className="font-semibold text-on-surface">{p.mes_referencia}</p>
                                <p className="text-[10px] text-on-surface-variant">
                                  {p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : 'Sem data'}
                                </p>
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-primary">
                                {formatCurrency(p.valor_pago)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceipt(p)}
                                  className="text-primary hover:underline font-semibold text-xs flex items-center justify-end gap-0.5"
                                >
                                  <span className="material-symbols-outlined text-xs">receipt</span>
                                  Recibo
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-secondary-container/10 border border-secondary-container rounded-xl p-5 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">info</span>
                <p className="text-body-sm font-semibold">Configuração do Contrato</p>
                <p className="text-xs mt-1">Após salvar o contrato inicial, você poderá lançar o histórico de pagamentos e gerar os recibos nesta coluna lateral.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay modal form */}
      {payModalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm border border-surface-variant p-6 flex flex-col gap-4">
            <header className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-semibold text-primary text-md">Registrar Pagamento</h3>
              <button onClick={() => setPayModalOpen(false)} className="p-1 text-on-surface hover:bg-surface-container rounded-lg">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleLogPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Mês de Referência *</label>
                <input
                  type="text"
                  placeholder="Ex: Janeiro 2026"
                  required
                  value={payFormData.mes_referencia}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, mes_referencia: e.target.value }))}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Data Pagamento</label>
                  <input
                    type="date"
                    value={payFormData.data_pagamento}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, data_pagamento: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Valor Pago (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payFormData.valor_pago}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, valor_pago: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Status</label>
                <select
                  value={payFormData.status}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm"
                >
                  <option value="Pago">Pago</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Atrasado">Atrasado</option>
                </select>
              </div>

              <div className="pt-4 border-t border-surface-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container shadow-sm"
                >
                  {saving ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full screen receipt visualizer modal */}
      {receiptOpen && selectedReceiptPayment && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6 md:p-12 flex flex-col items-center animate-in fade-in duration-200">
          
          {/* Controls */}
          <div className="w-full max-w-3xl flex justify-between items-center pb-6 border-b border-slate-200 mb-8 no-print">
            <h3 className="font-bold text-slate-700 text-lg">Visualização do Recibo</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir Recibo
              </button>
              <button 
                onClick={() => setReceiptOpen(false)}
                className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Fechar
              </button>
            </div>
          </div>

          {/* Receipt template container */}
          <div className="w-full max-w-3xl bg-white border-2 border-slate-300 p-8 md:p-12 flex flex-col gap-8 shadow-sm print:border-none print:shadow-none relative">
            
            {/* Background seal or decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
              <span className="material-symbols-outlined text-[300px]">church</span>
            </div>

            {/* Header */}
            <header className="flex justify-between items-start border-b-2 border-slate-200 pb-6 relative z-10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>church</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">SISTEMA PASTORAL</h4>
                  <p className="text-xs text-slate-500">Filantropia & Gestão Inteligente</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="font-bold text-slate-800 text-xl">RECIBO DE LOCAÇÃO</h2>
                <p className="text-xs text-slate-500 mt-1">Nº: {selectedReceiptPayment.id.substring(0, 8).toUpperCase()}</p>
              </div>
            </header>

            {/* Receipt body */}
            <main className="space-y-6 text-sm text-slate-800 relative z-10 leading-relaxed">
              <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-100 rounded-lg">
                <span className="font-semibold text-slate-700">VALOR DO RECIBO:</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(selectedReceiptPayment.valor_pago)}</span>
              </div>

              <p>
                Recebemos de <strong className="text-slate-900">{formData.locatario_nome}</strong>, inscrito no CPF sob o nº <strong className="text-slate-900">{formData.locatario_cpf || '---'}</strong>, a quantia supra de <strong className="text-slate-900">{getSpellOutValue(selectedReceiptPayment.valor_pago)}</strong>, referente ao pagamento do aluguel do equipamento <strong className="text-slate-900">{formData.equipamento?.nome_equipamento || equipamentosList.find(e => e.id === formData.equipamento_id)?.nome_equipamento || '---'}</strong>, correspondente ao mês de referência de <strong className="text-slate-900">{selectedReceiptPayment.mes_referencia}</strong>.
              </p>

              <p>
                Dando plena, geral e rasa quitação pelo valor recebido, para nada mais reclamar a título deste pagamento.
              </p>

              <div className="text-right text-xs text-slate-500 mt-8">
                Data de Emissão: {selectedReceiptPayment.data_pagamento ? new Date(selectedReceiptPayment.data_pagamento).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
              </div>
            </main>

            {/* Signatures block */}
            <footer className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-12 mt-12 relative z-10">
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-dashed border-slate-400 max-w-[220px] mb-2"></div>
                <span className="text-xs font-semibold text-slate-700">{formData.locatario_nome}</span>
                <span className="text-[10px] text-slate-500">Locatário / Pagador</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-dashed border-slate-400 max-w-[220px] mb-2"></div>
                <span className="text-xs font-semibold text-slate-700">Representante da Instituição</span>
                <span className="text-[10px] text-slate-500">Locador / Recebedor</span>
              </div>
            </footer>

          </div>
        </div>
      )}

    </div>
  )
}
