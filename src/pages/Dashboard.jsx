import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDashboardData, insertMensagemLog } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useFeedback } from '../contexts/FeedbackContext'

export const Dashboard = () => {
  const { showToast } = useFeedback()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Productivity widgets states
  const [rentalsExpiring, setRentalsExpiring] = useState([])
  const [basketProgress, setBasketProgress] = useState({ delivered: 0, total: 0, pendingList: [] })
  const [templates, setTemplates] = useState([])
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const result = await fetchDashboardData()
        setData(result)

        // Load secondary data for productivity cards
        const now = new Date()
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
        const currentMonthRef = `${months[now.getMonth()]} ${now.getFullYear()}`

        let rData = null
        try {
          const { data, error } = await supabase.from('contratos_equipamento').select('*, equipamento:equipamentos(*)').eq('status', 'ativo').is('deletado_em', null)
          if (error) throw error
          rData = data
        } catch (e) {
          console.warn('Dashboard secondary query warning (contratos_equipamento):', e.message)
        }

        let cData = null
        try {
          const { data, error } = await supabase.from('beneficiarios_cesta').select('*').eq('status', 'Ativo').is('deletado_em', null)
          if (error) throw error
          cData = data
        } catch (e) {
          console.warn('Dashboard secondary query warning (beneficiarios_cesta):', e.message)
        }

        let dData = null
        try {
          const { data, error } = await supabase.from('entregas_cesta').select('*').eq('mes_referencia', currentMonthRef)
          if (error) throw error
          dData = data
        } catch (e) {
          console.warn('Dashboard secondary query warning (entregas_cesta):', e.message)
        }

        let tData = null
        try {
          const { data, error } = await supabase.from('modelos_mensagem').select('*').eq('ativo', true).is('deletado_em', null)
          if (error) throw error
          tData = data
        } catch (e) {
          console.warn('Dashboard secondary query warning (modelos_mensagem):', e.message)
        }

        let confData = null
        try {
          const { data, error } = await supabase.from('configuracoes').select('*').limit(1)
          if (error) throw error
          confData = data
        } catch (e) {
          console.warn('Dashboard secondary query warning (configuracoes):', e.message)
        }

        if (rData) {
          // calculate rentals expiring in next 7 days
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const expiring = rData.map(r => {
            if (!r.dia_vencimento) return null
            let due = new Date(now.getFullYear(), now.getMonth(), r.dia_vencimento)
            if (due < today) {
              due = new Date(now.getFullYear(), now.getMonth() + 1, r.dia_vencimento)
            }
            const diffTime = due.getTime() - today.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return {
              ...r,
              dataVencimento: due.toLocaleDateString('pt-BR'),
              diasFaltando: diffDays
            }
          }).filter(r => r !== null && r.diasFaltando >= 0 && r.diasFaltando <= 7)
          .sort((a, b) => a.diasFaltando - b.diasFaltando)

          setRentalsExpiring(expiring)
        }

        if (cData) {
          const deliveredIds = new Set((dData || []).map(d => d.beneficiario_id))
          const delivered = cData.filter(c => deliveredIds.has(c.id)).length
          const total = cData.length
          const pendingList = cData.filter(c => !deliveredIds.has(c.id))

          setBasketProgress({ delivered, total, pendingList })
        }

        if (tData) setTemplates(tData)
        if (confData && confData.length > 0) setConfig(confData[0])

      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const handleDashboardWhatsAppClick = async (templateTitle, recipient, type) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const profileId = user?.id
      
      const template = templates.find(t => t.titulo.toLowerCase().includes(templateTitle.toLowerCase()))
      let rawText = ''
      let templateId = null
      if (template) {
        rawText = template.texto
        templateId = String(template.id).startsWith('default-') ? null : template.id
      } else {
        if (templateTitle.toLowerCase().includes('cobrança')) {
          rawText = 'Olá, {nome}! Tudo bem? Passando para lembrar que o aluguel referente ao mês de {mes} está disponível para pagamento. O valor é de {valor}. Qualquer dúvida estamos à disposição. Deus abençoe! Equipe {instituicao}.'
        } else {
          rawText = 'Olá, {nome}! Gostaríamos de confirmar que a cesta básica do mês de {mes} está disponível para retirada. Por favor, entre em contato para agendar a retirada ou aguarde nosso aviso. Deus abençoe! Equipe {instituicao}.'
        }
      }

      const name = type === 'locatario' ? recipient.locatario_nome : recipient.nome
      const whatsappNum = type === 'locatario' ? recipient.locatario_whatsapp || recipient.locatario_telefone : recipient.whatsapp || recipient.telefone
      
      if (!whatsappNum) {
        showToast('Erro de contato', 'Este contato não possui número de WhatsApp válido.', 'error')
        return
      }

      const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long' })
      const monthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)
      const instName = config?.nome_instituicao || 'Sistema Pastoral'
      
      let valorStr = '0,00'
      if (type === 'locatario' && recipient.valor_aluguel) {
        valorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recipient.valor_aluguel)
      }

      let text = rawText
        .replace(/\{nome\}/g, name)
        .replace(/\[nome\]/g, name)
        .replace(/\bnome\b/g, name)

        .replace(/\{mes\}/g, monthCapitalized)
        .replace(/\[mes\]/g, monthCapitalized)
        .replace(/\bmes\b/g, monthCapitalized)

        .replace(/\{instituicao\}/g, instName)
        .replace(/\[instituicao\]/g, instName)
        .replace(/\binstituicao\b/g, instName)

        .replace(/\{valor\}/g, valorStr)
        .replace(/\[valor\]/g, valorStr)
        .replace(/\bvalor\b/g, valorStr)

      let cleanNum = whatsappNum.replace(/\D/g, '')
      if (cleanNum.length === 10 || cleanNum.length === 11) {
        cleanNum = '55' + cleanNum
      }

      const waLink = `https://wa.me/${cleanNum}?text=${encodeURIComponent(text)}`

      if (profileId) {
        const entTipo = type === 'locatario' ? 'aluguel' : 'cesta'
        
        await insertMensagemLog({
          perfil_id: profileId,
          destinatario_id: recipient.id,
          destinatario_tipo: entTipo,
          modelo_id: templateId,
          enviado_em: new Date().toISOString()
        })
        
        try {
          await supabase.from('historico_contatos').insert([{
            perfil_id: profileId,
            entidade_tipo: entTipo,
            entidade_id: recipient.id,
            modelo_id: templateId,
            canal: 'whatsapp'
          }])
        } catch (e) {
          console.warn('Could not write to old historico_contatos:', e)
        }
      }

      window.open(waLink, '_blank')
      showToast('WhatsApp Aberto', 'Redirecionando para o WhatsApp...', 'success')
    } catch (err) {
      console.error('Error handling WhatsApp click:', err)
      showToast('Erro ao enviar', 'Ocorreu um erro ao processar o envio: ' + err.message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium">Carregando painel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-error-container text-on-error-container rounded-xl border border-error/20 flex items-start gap-3">
        <span className="material-symbols-outlined text-error">error</span>
        <div>
          <h3 className="font-semibold mb-1">Erro ao carregar o dashboard</h3>
          <p className="text-body-sm">{error}</p>
        </div>
      </div>
    )
  }

  const {
    ativosCestas,
    ativosAlugueis,
    totalEntradasMes,
    totalSaidasMes,
    saldoMes,
    totalCadastrosGerais,
    historicoGrafico,
    beneficiariosRecentes,
    financeiroRecente,
    entregasCestasMes
  } = data

  const estoque = config?.estoque_cestas ?? 0
  const isStockLow = estoque < 10

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val)
  }

  const maxGraphVal = Math.max(
    ...historicoGrafico.map(m => Math.max(m.entradas, m.saidas)),
    1000 // default minimum
  )

  const totalCestas = ativosCestas || 0
  const entreguesCestas = entregasCestasMes || 0
  const pctEntregues = totalCestas > 0 ? Math.round((entreguesCestas / totalCestas) * 100) : 0
  const pctPendentes = 100 - pctEntregues
  const pendentesCestas = Math.max(0, totalCestas - entreguesCestas)

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        
        {/* Card 1: Saldo do Mês (Highlighted 4 Cols) */}
        <div className="md:col-span-4 bg-primary text-on-primary rounded-xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -top-10 opacity-10">
            <span className="material-symbols-outlined text-[150px]">account_balance_wallet</span>
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <span className="material-symbols-outlined">account_balance</span>
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-primary/80">Saldo do Mês</h3>
          </div>
          <div className="relative z-10">
            <p className="font-display-lg text-headline-lg md:text-display-lg font-bold">{formatCurrency(saldoMes)}</p>
            <p className="font-label-sm text-label-sm text-on-primary/70 mt-2">Diferença entre entradas e saídas deste mês</p>
          </div>
        </div>

        {/* Card 2: Beneficiários Cesta Ativos (2 Cols) */}
        <div className="md:col-span-2 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined">shopping_bag</span>
            </div>
            <div className={`text-right ${isStockLow ? 'animate-pulse text-amber-600 font-bold' : 'text-on-surface-variant'}`}>
              <span className="text-[10px] block uppercase font-semibold">Estoque</span>
              <span className="text-body-md font-bold">{estoque}</span>
            </div>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Cestas Ativas</p>
            <p className="font-headline-md text-headline-md text-on-surface font-semibold">{ativosCestas}</p>
            <p className="text-[10px] text-outline mt-1">Beneficiários ativos do mês</p>
          </div>
        </div>

        {/* Card 3: Contratos Aluguel Ativos (2 Cols) */}
        <div className="md:col-span-2 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
              <span className="material-symbols-outlined">home</span>
            </div>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Aluguéis Ativos</p>
            <p className="font-headline-md text-headline-md text-on-surface font-semibold">{ativosAlugueis}</p>
            <p className="text-[10px] text-outline mt-1">Contratos vigentes ativos</p>
          </div>
        </div>

        {/* Card 4: Entradas do Mês (2 Cols) */}
        <div className="md:col-span-2 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Entradas do Mês</p>
            <p className="font-headline-md text-headline-md text-primary font-semibold">{formatCurrency(totalEntradasMes)}</p>
          </div>
        </div>

        {/* Card 5: Saídas do Mês (2 Cols) */}
        <div className="md:col-span-2 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined">trending_down</span>
            </div>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Saídas do Mês</p>
            <p className="font-headline-md text-headline-md text-error font-semibold">{formatCurrency(totalSaidasMes)}</p>
          </div>
        </div>

      </div>

      {/* Second Row: Stats charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mt-4">
        {/* Financial Flow Line Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-outline-variant p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-headline-md text-primary font-semibold">Movimentação Financeira</h3>
          </div>
          <div className="flex-1 min-h-[250px] flex items-end gap-2 text-label-sm text-outline relative pt-6 pl-10">
            {/* Y-Axis scale lines */}
            <div className="absolute left-0 top-0 bottom-8 w-full flex flex-col justify-between border-l border-b border-surface-variant pb-2">
              <div className="w-full border-t border-dashed border-outline-variant/30 relative">
                <span className="absolute -top-2.5 -left-10 text-[9px] font-semibold">{formatCurrency(maxGraphVal)}</span>
              </div>
              <div className="w-full border-t border-dashed border-outline-variant/30 relative">
                <span className="absolute -top-2.5 -left-10 text-[9px] font-semibold">{formatCurrency(maxGraphVal * 0.5)}</span>
              </div>
              <div className="w-full relative">
                <span className="absolute -top-2.5 -left-10 text-[9px] font-semibold">R$ 0</span>
              </div>
            </div>
            
            {/* Dynamic visual columns */}
            <div className="flex-1 flex justify-around items-end h-[200px] z-10 pb-4">
              {historicoGrafico.map((m, idx) => {
                const entradaPct = (m.entradas / maxGraphVal) * 100
                const saidaPct = (m.saidas / maxGraphVal) * 100
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 group w-full max-w-[60px]">
                    <div className="flex gap-1.5 items-end h-[160px] w-full justify-center">
                      <div 
                        style={{ height: `${Math.max(entradaPct, 3)}%` }} 
                        className="w-3 bg-primary/60 rounded-t-sm group-hover:bg-primary transition-colors duration-200"
                        title={`Entradas: ${formatCurrency(m.entradas)}`}
                      ></div>
                      <div 
                        style={{ height: `${Math.max(saidaPct, 3)}%` }} 
                        className="w-3 bg-secondary/50 rounded-t-sm group-hover:bg-secondary transition-colors duration-200"
                        title={`Saídas: ${formatCurrency(m.saidas)}`}
                      ></div>
                    </div>
                    <span className="text-[11px] font-semibold text-on-surface-variant">{m.mes}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2 font-label-sm text-label-sm font-semibold">
              <span className="w-3 h-3 rounded-sm bg-primary/60"></span> Entradas
            </div>
            <div className="flex items-center gap-2 font-label-sm text-label-sm font-semibold">
              <span className="w-3 h-3 rounded-sm bg-secondary/50"></span> Saídas
            </div>
          </div>
        </div>

        {/* Benefits breakdown donut (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-outline-variant p-6 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-headline-md text-primary font-semibold">Entregas de Cesta do Mês</h3>
          </div>
          <div className="relative w-40 h-40 my-auto flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Fatia 2: Bege/Cinza Suave (Pendentes/Não Registradas) */}
              <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#dfc29f" strokeDasharray={`${pctPendentes} ${pctEntregues}`} strokeDashoffset={-pctEntregues} strokeWidth="6"></circle>
              {/* Fatia 1: Verde Oliva (Entregues) */}
              <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#556b2f" strokeDasharray={`${pctEntregues} ${100 - pctEntregues}`} strokeDashoffset="0" strokeWidth="6"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-bold text-headline-md text-primary">{pctEntregues}%</span>
              <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">Entregues</span>
            </div>
          </div>
          <div className="w-full flex flex-col gap-2 mt-6">
            <div className="flex justify-between items-center text-body-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span> Entregues
              </div>
              <span className="font-bold text-on-surface">{entreguesCestas} ({pctEntregues}%)</span>
            </div>
            <div className="flex justify-between items-center text-body-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#dfc29f]"></span> Pendentes
              </div>
              <span className="font-bold text-on-surface">{pendentesCestas} ({pctPendentes}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tables grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter mt-4 pb-8">
        
        {/* Left Side: Recent Registrations */}
        <div className="bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-surface-variant flex justify-between items-center">
              <h3 className="font-semibold text-primary text-md">Cadastros de Beneficiários Recentes</h3>
              <Link className="font-label-sm text-label-sm text-primary hover:underline font-semibold" to="/beneficiarios">Ver todos</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-3 font-medium">Nome</th>
                    <th className="px-6 py-3 font-medium">Data</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-surface-variant">
                  {beneficiariosRecentes.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-on-surface-variant">Nenhum beneficiário cadastrado.</td>
                    </tr>
                  ) : (
                    beneficiariosRecentes.map((b) => (
                      <tr key={b.id} className="hover:bg-secondary-container/10 transition-colors">
                        <td className="px-6 py-4 font-semibold">
                          <Link to={`/beneficiarios/${b.id}`} className="hover:text-primary transition-colors">{b.nome}</Link>
                        </td>
                        <td className="px-6 py-4 text-outline">
                          {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            b.status === 'ativo' 
                              ? 'bg-primary-container text-on-primary-container border-primary/20' 
                              : 'bg-outline-variant/40 text-on-surface-variant border-outline-variant/50'
                          }`}>
                            {b.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Recent financial entries */}
        <div className="bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-surface-variant flex justify-between items-center">
              <h3 className="font-semibold text-primary text-md">Últimos Lançamentos Financeiros</h3>
              <Link className="font-label-sm text-label-sm text-primary hover:underline font-semibold" to="/financeiro">Ver todos</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-3 font-medium">Descrição</th>
                    <th className="px-6 py-3 font-medium">Data</th>
                    <th className="px-6 py-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-surface-variant">
                  {financeiroRecente.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-on-surface-variant">Nenhum lançamento financeiro.</td>
                    </tr>
                  ) : (
                    financeiroRecente.map((item) => (
                      <tr key={item.id} className="hover:bg-secondary-container/10 transition-colors">
                        <td className="px-6 py-4 font-semibold flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[16px] ${
                            item.tipo === 'entrada' ? 'text-primary' : 'text-error'
                          }`}>
                            {item.tipo === 'entrada' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                          <span>{item.descricao}</span>
                        </td>
                        <td className="px-6 py-4 text-outline">
                          {new Date(item.data).toLocaleDateString('pt-BR')}
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold ${
                          item.tipo === 'entrada' ? 'text-primary' : 'text-error'
                        }`}>
                          {item.tipo === 'entrada' ? '+' : '-'} {formatCurrency(item.valor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Total Registers Card */}
          <div className="bg-surface-container-low p-4 border-t border-outline-variant flex justify-between items-center text-xs font-semibold text-on-surface-variant">
            <span>Total de Cadastros Gerais no Sistema</span>
            <span className="bg-primary text-on-primary px-3 py-1 rounded-full text-xs font-bold">{totalCadastrosGerais}</span>
          </div>
        </div>

      </div>

      {/* Productivity Cards Grid */}
      {(() => {
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter mt-6 pb-8">
            {/* Left Side: Aluguéis a Vencer */}
            <div className="bg-white border-2 border-amber-200 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-amber-100 bg-amber-50/50 flex justify-between items-center">
                  <h3 className="font-semibold text-[#8b5a2b] text-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#d97706]">warning</span>
                    Aluguéis a Vencer (Próximos 7 Dias)
                  </h3>
                  <span className="bg-amber-100 text-[#b45309] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                    Atenção
                  </span>
                </div>
                
                <div className="p-6">
                  {rentalsExpiring.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-green-500 text-[36px]">check_circle</span>
                      <p className="text-body-sm font-semibold text-green-700">Tudo em dia!</p>
                      <p className="text-xs text-outline">Nenhum vencimento de aluguel nos próximos 7 dias.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="font-label-sm text-label-sm text-on-surface-variant border-b border-surface-variant">
                          <tr>
                            <th className="pb-3 font-semibold">Locatário</th>
                            <th className="pb-3 font-semibold">Vencimento</th>
                            <th className="pb-3 font-semibold text-right">Valor</th>
                            <th className="pb-3 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-surface-variant">
                          {rentalsExpiring.map((r) => {
                            const hasWhatsApp = r.locatario_whatsapp || r.locatario_telefone
                            return (
                              <tr key={r.id} className="hover:bg-amber-50/20 transition-colors">
                                <td className="py-3.5 pr-2">
                                  <p className="font-semibold text-body-sm text-slate-800">{r.locatario_nome}</p>
                                  <p className="text-[10px] text-outline truncate max-w-[200px]">{r.equipamento?.nome || '---'}</p>
                                </td>
                                <td className="py-3.5">
                                  <span className="text-body-sm font-medium">{r.dataVencimento}</span>
                                  <span className="block text-[10px] text-amber-600 font-semibold">
                                    {r.diasFaltando === 0 ? 'Vence hoje' : `Em ${r.diasFaltando} dias`}
                                  </span>
                                </td>
                                <td className="py-3.5 text-right font-bold text-slate-800">
                                  {formatCurrency(r.valor_mensal)}
                                </td>
                                <td className="py-3.5 text-right flex justify-end">
                                  {hasWhatsApp ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDashboardWhatsAppClick('Cobrança', r, 'locatario')}
                                      className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors hover:scale-105 active:scale-95 shadow-sm"
                                      title="Enviar cobrança via WhatsApp"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">chat</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-red-500 font-semibold">Sem tel.</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Entregas de Cesta do Mês */}
            <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-surface-variant flex justify-between items-center">
                  <h3 className="font-semibold text-primary text-md flex items-center gap-2">
                    <span className="material-symbols-outlined">local_shipping</span>
                    Entregas de Cesta do Mês
                  </h3>
                  <span className="bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                    {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Progress Indicator */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end text-xs font-semibold">
                      <span className="text-on-surface-variant">Progresso das Entregas</span>
                      <span className="text-primary font-bold">
                        {basketProgress.delivered} de {basketProgress.total} cestas ({basketProgress.total > 0 ? Math.round((basketProgress.delivered / basketProgress.total) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-3">
                      <div 
                        style={{ width: `${basketProgress.total > 0 ? (basketProgress.delivered / basketProgress.total) * 100 : 0}%` }}
                        className="bg-primary h-3 rounded-full transition-all duration-500"
                      ></div>
                    </div>
                  </div>

                  {/* Pending List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-outline-variant uppercase tracking-wider">
                      Beneficiários Pendentes ({basketProgress.pendingList.length})
                    </h4>
                    
                    {basketProgress.pendingList.length === 0 ? (
                      <div className="text-center py-6 text-green-700 font-semibold text-body-sm bg-green-50/50 border border-green-100 rounded-xl">
                        <p>Todas as cestas entregues!</p>
                        <p className="text-[11px] text-outline font-normal mt-0.5">Parabéns, nenhuma pendência neste mês.</p>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                         {basketProgress.pendingList.map(c => {
                          const hasWhatsApp = c.whatsapp || c.telefone
                          return (
                            <div key={c.id} className="flex justify-between items-center p-3 hover:bg-surface-container rounded-lg border border-outline-variant/60 transition-colors font-body-sm text-body-sm text-on-surface">
                              <div>
                                <p className="text-body-sm font-semibold text-slate-800">{c.nome}</p>
                                <p className="text-[10px] text-outline">{c.telefone || 'Sem telefone'}</p>
                              </div>
                              <div>
                                {hasWhatsApp ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDashboardWhatsAppClick('Confirmação', c, 'beneficiario')}
                                    className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors hover:scale-105 active:scale-95 shadow-sm"
                                    title="Enviar lembrete de retirada"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">chat</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-red-500 font-semibold">Sem tel.</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
