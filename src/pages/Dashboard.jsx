import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDashboardData, insertMensagemLog, insertHistoricoEntregaCesta } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useFeedback } from '../contexts/FeedbackContext'
import { useAuth } from '../contexts/AuthContext'

export const Dashboard = () => {
  const { showToast } = useFeedback()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Productivity widgets states
  const [rentalsExpiring, setRentalsExpiring] = useState([])
  const [basketProgress, setBasketProgress] = useState({ delivered: 0, total: 0, pendingList: [] })
  const [templates, setTemplates] = useState([])
  const [config, setConfig] = useState(null)
  const [cestasVinculadasCount, setCestasVinculadasCount] = useState(0)

  const loadDashboard = async (silent = false) => {
    if (!silent && !data) setLoading(true)
    try {
      const result = await fetchDashboardData()
      setData(result)

      const now = new Date()
      const currentMonthNum = now.getMonth() + 1
      const currentYear = now.getFullYear()

      // Fetch active rentals for expiring alert
      let rData = null
      try {
        const { data, error } = await supabase
          .from('alugueis')
          .select('*')
          .eq('status', 'Ativo')
          .is('deletado_em', null)
        if (error) throw error
        rData = data
      } catch (e) {
        console.warn('Dashboard secondary query warning (alugueis):', e.message)
      }

      // Fetch linked basket beneficiaries in real-time
      let vinculados = []
      try {
        const { data, error } = await supabase
          .from('beneficiarios_cestas')
          .select(`
            id,
            beneficiario_id,
            beneficiario:beneficiarios (
              id,
              nome,
              telefone,
              whatsapp,
              bairro,
              cidade,
              status
            )
          `)
        if (error) throw error
        vinculados = data || []
        setCestasVinculadasCount(vinculados.length)
      } catch (e) {
        console.warn('Dashboard secondary query warning (beneficiarios_cestas):', e.message)
      }

      // Fetch deliveries for current month in real-time
      let entregasMes = []
      try {
        const { data, error } = await supabase
          .from('historico_entregas_cestas')
          .select('beneficiario_id')
          .eq('mes_referencia', currentMonthNum)
          .eq('ano_referencia', currentYear)
        if (error) throw error
        entregasMes = data || []
      } catch (e) {
        console.warn('Dashboard secondary query warning (historico_entregas_cestas):', e.message)
      }

      // Message templates
      let tData = null
      try {
        const { data, error } = await supabase
          .from('modelos_mensagem')
          .select('*')
          .eq('ativo', true)
          .is('deletado_em', null)
        if (error) throw error
        tData = data
      } catch (e) {
        console.warn('Dashboard secondary query warning (modelos_mensagem):', e.message)
      }

      // Configuracoes
      let confData = null
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('*')
          .limit(1)
        if (error) throw error
        confData = data
      } catch (e) {
        console.warn('Dashboard secondary query warning (configuracoes):', e.message)
      }

      // Process rentals expiring in next 7 days
      if (rData) {
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

      // Process basket deliveries & pending list
      const deliveredBenefIds = new Set(entregasMes.map(e => e.beneficiario_id))
      const delivered = vinculados.filter(v => deliveredBenefIds.has(v.beneficiario_id)).length
      const total = vinculados.length
      const pendingList = vinculados
        .filter(v => !deliveredBenefIds.has(v.beneficiario_id))
        .map(v => v.beneficiario)
        .filter(Boolean)

      setBasketProgress({ delivered, total, pendingList })

      if (tData) setTemplates(tData)
      if (confData && confData.length > 0) setConfig(confData[0])

    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard(false)

    // 1. Live Supabase Realtime Channels
    const channel = supabase
      .channel('dashboard-realtime-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_entregas_cestas' }, () => {
        loadDashboard(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiarios_cestas' }, () => {
        loadDashboard(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiarios' }, () => {
        loadDashboard(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alugueis' }, () => {
        loadDashboard(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro' }, () => {
        loadDashboard(true)
      })
      .subscribe()

    // 2. Realtime sync when switching tabs/focusing browser
    const handleFocus = () => {
      loadDashboard(true)
    }
    window.addEventListener('focus', handleFocus)

    // 3. Fallback fast poll every 3 seconds to guarantee instant real-time sync
    const pollInterval = setInterval(() => {
      loadDashboard(true)
    }, 3000)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
      clearInterval(pollInterval)
    }
  }, [])

  const handleQuickDeliverCesta = async (beneficiario) => {
    const now = new Date()
    const currentMonthNum = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const mesNome = months[now.getMonth()]

    try {
      await insertHistoricoEntregaCesta(
        beneficiario.id,
        currentMonthNum,
        currentYear,
        'Entrega rápida confirmada diretamente pelo Dashboard'
      )
      showToast('Sucesso', `Cesta de ${mesNome} confirmada para ${beneficiario.nome}!`)
      loadDashboard()
    } catch (err) {
      showToast('Erro ao confirmar entrega', err.message, 'error')
    }
  }

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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-on-surface-variant">Carregando painel geral...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-error-container text-on-error-container rounded-2xl border border-error/20 flex items-start gap-3 shadow-sm">
        <span className="material-symbols-outlined text-error text-2xl">error</span>
        <div>
          <h3 className="font-bold text-sm mb-0.5">Erro ao carregar o dashboard</h3>
          <p className="text-xs">{error}</p>
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

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val || 0)
  }

  const maxGraphVal = Math.max(
    ...historicoGrafico.map(m => Math.max(m.entradas, m.saidas)),
    1000
  )

  const totalCestas = basketProgress.total || ativosCestas || 0
  const entreguesCestas = basketProgress.delivered
  const pendentesCestas = Math.max(0, totalCestas - entreguesCestas)
  const pctEntregues = totalCestas > 0 ? Math.round((entreguesCestas / totalCestas) * 100) : 0
  const pctPendentes = 100 - pctEntregues

  const userName = user?.profile?.nome?.split(' ')[0] || user?.email?.split('@')[0] || 'Irmão(ã)'

  return (
    <div className="flex flex-col gap-6 pb-12">
      
      {/* Hero Welcome Banner with Quick Shortcuts */}
      <div className="rounded-3xl bg-gradient-to-r from-primary/15 via-primary/5 to-surface-container-lowest border border-primary/20 p-6 md:p-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 bg-primary text-on-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider shadow-2xs">
              Visão Geral
            </span>
            <span className="text-xs font-semibold text-on-surface-variant">
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display-lg font-bold text-primary tracking-tight">
            Paz e Bem, {userName}! 🙏
          </h1>
          <p className="text-xs md:text-sm text-on-surface-variant max-w-xl">
            Acompanhe o atendimento às famílias, entregas de cestas, empréstimos de equipamentos e movimentação financeira da pastoral.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to="/beneficiarios"
            className="px-4 py-2.5 bg-surface border border-outline-variant/80 hover:border-primary/50 text-on-surface hover:text-primary rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">person_add</span>
            Novo Beneficiário
          </Link>
          <Link
            to="/cestas"
            className="px-4 py-2.5 bg-surface border border-outline-variant/80 hover:border-primary/50 text-on-surface hover:text-primary rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">shopping_bag</span>
            Entregar Cesta
          </Link>
          <Link
            to="/aluguel/novo"
            className="px-4 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Novo Empréstimo
          </Link>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        
        {/* Card 1: Saldo do Mês (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[140px]">account_balance_wallet</span>
          </div>
          <div className="flex items-center gap-2.5 mb-4 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-primary/80">Saldo Líquido no Mês</span>
          </div>
          <div className="relative z-10 space-y-1">
            <p className="font-display-lg text-2xl md:text-3xl font-extrabold">{formatCurrency(saldoMes)}</p>
            <p className="text-[11px] text-on-primary/75 font-medium">Balanço entre entradas e saídas do mês</p>
          </div>
        </div>

        {/* Card 2: Cestas Vinculadas (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-outline-variant/70 p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-0.5">Cestas Vinculadas</span>
            <p className="text-xl font-extrabold text-on-surface">{totalCestas}</p>
            <p className="text-[10px] text-outline font-medium mt-0.5">Famílias no programa</p>
          </div>
        </div>

        {/* Card 3: Aluguéis Ativos (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-outline-variant/70 p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]">medical_services</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-0.5">Empréstimos Ativos</span>
            <p className="text-xl font-extrabold text-on-surface">{ativosAlugueis}</p>
            <p className="text-[10px] text-outline font-medium mt-0.5">Equipamentos em uso</p>
          </div>
        </div>

        {/* Card 4: Entradas do Mês (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-outline-variant/70 p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]">trending_up</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-0.5">Entradas</span>
            <p className="text-base font-extrabold text-emerald-700">{formatCurrency(totalEntradasMes)}</p>
            <p className="text-[10px] text-outline font-medium mt-0.5">Doações & Dízimos</p>
          </div>
        </div>

        {/* Card 5: Saídas do Mês (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-outline-variant/70 p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]">trending_down</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-0.5">Saídas</span>
            <p className="text-base font-extrabold text-rose-700">{formatCurrency(totalSaidasMes)}</p>
            <p className="text-[10px] text-outline font-medium mt-0.5">Despesas & Compras</p>
          </div>
        </div>

      </div>

      {/* Row 2: Charts & Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Financial Flow Bar Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-surface rounded-2xl shadow-xs border border-outline-variant/80 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">bar_chart</span>
              <h3 className="font-bold text-primary text-base">Movimentação Financeira</h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-primary">
                <span className="w-3 h-3 rounded-md bg-primary"></span> Entradas
              </div>
              <div className="flex items-center gap-1.5 text-secondary">
                <span className="w-3 h-3 rounded-md bg-secondary"></span> Saídas
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[220px] flex items-end gap-2 text-xs text-outline relative pt-6 pl-12 pb-2">
            {/* Scale lines */}
            <div className="absolute left-0 top-0 bottom-6 w-full flex flex-col justify-between border-l border-b border-surface-variant/80 pb-2">
              <div className="w-full border-t border-dashed border-outline-variant/40 relative">
                <span className="absolute -top-2.5 -left-12 text-[10px] font-mono font-semibold">{formatCurrency(maxGraphVal)}</span>
              </div>
              <div className="w-full border-t border-dashed border-outline-variant/40 relative">
                <span className="absolute -top-2.5 -left-12 text-[10px] font-mono font-semibold">{formatCurrency(maxGraphVal * 0.5)}</span>
              </div>
              <div className="w-full relative">
                <span className="absolute -top-2.5 -left-12 text-[10px] font-mono font-semibold">R$ 0</span>
              </div>
            </div>
            
            {/* Bars */}
            <div className="flex-1 flex justify-around items-end h-[180px] z-10 pb-2">
              {historicoGrafico.map((m, idx) => {
                const entradaPct = (m.entradas / maxGraphVal) * 100
                const saidaPct = (m.saidas / maxGraphVal) * 100
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 group w-full max-w-[64px]">
                    <div className="flex gap-1.5 items-end h-[140px] w-full justify-center">
                      <div 
                        style={{ height: `${Math.max(entradaPct, 4)}%` }} 
                        className="w-3.5 bg-primary/70 rounded-t-md group-hover:bg-primary transition-all duration-200 shadow-2xs"
                        title={`Entradas: ${formatCurrency(m.entradas)}`}
                      ></div>
                      <div 
                        style={{ height: `${Math.max(saidaPct, 4)}%` }} 
                        className="w-3.5 bg-secondary/60 rounded-t-md group-hover:bg-secondary transition-all duration-200 shadow-2xs"
                        title={`Saídas: ${formatCurrency(m.saidas)}`}
                      ></div>
                    </div>
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase">{m.mes}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Benefits breakdown donut (4 Cols) */}
        <div className="lg:col-span-4 bg-surface rounded-2xl shadow-xs border border-outline-variant/80 p-6 flex flex-col items-center justify-between">
          <div className="w-full flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">donut_large</span>
              <h3 className="font-bold text-primary text-base">Entregas de Cesta</h3>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              {new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="relative w-36 h-36 my-auto flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#e8e2d7" strokeDasharray="100 0" strokeWidth="5.5"></circle>
              <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#3e5219" strokeDasharray={`${pctEntregues} ${100 - pctEntregues}`} strokeDashoffset="0" strokeWidth="5.5" strokeLinecap="round"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-extrabold text-2xl text-primary">{pctEntregues}%</span>
              <span className="text-[9px] text-on-surface-variant uppercase tracking-wider font-bold">Entregues</span>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-surface-variant/80 text-xs">
            <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-center">
              <span className="block text-[10px] font-bold text-primary uppercase">Entregues</span>
              <span className="text-base font-extrabold text-primary">{entreguesCestas}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
              <span className="block text-[10px] font-bold text-amber-800 uppercase">Pendentes</span>
              <span className="text-base font-extrabold text-amber-700">{pendentesCestas}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Row 3: Productivity Widgets (Aluguéis a vencer & Pendências de Cestas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Side: Aluguéis a Vencer */}
        <div className="bg-surface border border-amber-300/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-amber-200 bg-amber-500/10 flex justify-between items-center">
              <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[20px]">notifications_active</span>
                Vencimentos Próximos (7 Dias)
              </h3>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                {rentalsExpiring.length} pendentes
              </span>
            </div>
            
            <div className="p-4">
              {rentalsExpiring.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">check</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-800">Tudo em dia!</p>
                  <p className="text-[11px] text-outline">Nenhum vencimento de empréstimo nos próximos 7 dias.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-variant/70 max-h-64 overflow-y-auto pr-1">
                  {rentalsExpiring.map((r) => {
                    const hasWhatsApp = r.locatario_whatsapp || r.locatario_telefone
                    return (
                      <div key={r.id} className="py-3 flex justify-between items-center hover:bg-amber-50/40 rounded-xl px-2 transition-colors">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-xs text-on-surface truncate">{r.locatario_nome}</p>
                          <p className="text-[10px] text-outline truncate">{r.imovel_endereco || 'Equipamento'}</p>
                          <span className="inline-block text-[10px] font-bold text-amber-700 mt-0.5">
                            {r.diasFaltando === 0 ? '⚠️ Vence hoje' : `Vence em ${r.diasFaltando} dias (${r.dataVencimento})`}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-extrabold text-on-surface">
                            {formatCurrency(r.valor_aluguel)}
                          </span>
                          {hasWhatsApp ? (
                            <button
                              type="button"
                              onClick={() => handleDashboardWhatsAppClick('Cobrança', r, 'locatario')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                              title="Avisar via WhatsApp"
                            >
                              <span className="material-symbols-outlined text-[14px]">chat</span>
                              Avisar
                            </button>
                          ) : (
                            <span className="text-[10px] text-outline">Sem tel.</span>
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

        {/* Right Side: Entregas de Cesta do Mês */}
        <div className="bg-surface border border-outline-variant/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-surface-variant/80 flex justify-between items-center">
              <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                Cestas Pendentes de Retirada
              </h3>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                  {basketProgress.pendingList.length} pendentes
                </span>
                <Link to="/cestas" className="text-[11px] font-bold text-primary hover:underline">
                  Gerenciar Todas
                </Link>
              </div>
            </div>

            <div className="p-4">
              {basketProgress.pendingList.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">done_all</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-800">100% das cestas entregues!</p>
                  <p className="text-[11px] text-outline">Todas as {totalCestas} famílias vinculadas já receberam neste mês.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-variant/70 max-h-64 overflow-y-auto pr-1">
                  {basketProgress.pendingList.map(c => {
                    const hasWhatsApp = c.whatsapp || c.telefone
                    return (
                      <div key={c.id} className="py-2.5 flex justify-between items-center hover:bg-surface-container rounded-xl px-2 transition-colors">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-xs text-on-surface truncate">{c.nome}</p>
                            {c.bairro && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-surface-container-high rounded text-on-surface-variant">
                                {c.bairro}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-outline mt-0.5">{c.telefone || 'Sem telefone'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Quick Deliver Button */}
                          <button
                            type="button"
                            onClick={() => handleQuickDeliverCesta(c)}
                            className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                            title="Confirmar entrega de cesta deste mês"
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            Entregar
                          </button>

                          {/* WhatsApp Reminder Button */}
                          {hasWhatsApp && (
                            <button
                              type="button"
                              onClick={() => handleDashboardWhatsAppClick('Confirmação', c, 'beneficiario')}
                              className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold transition-colors"
                              title="Enviar lembrete via WhatsApp"
                            >
                              <span className="material-symbols-outlined text-[16px]">chat</span>
                            </button>
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

      {/* Row 4: Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Side: Recent Beneficiaries */}
        <div className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-surface-variant/80 flex justify-between items-center">
              <h3 className="font-bold text-primary text-sm">Beneficiários Cadastrados Recentemente</h3>
              <Link className="text-[11px] font-bold text-primary hover:underline" to="/beneficiarios">Ver todos</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-surface-variant">
                  <tr>
                    <th className="px-5 py-2.5">Nome</th>
                    <th className="px-5 py-2.5">Data</th>
                    <th className="px-5 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                  {beneficiariosRecentes.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-5 py-8 text-center text-outline">Nenhum beneficiário cadastrado.</td>
                    </tr>
                  ) : (
                    beneficiariosRecentes.slice(0, 5).map((b) => (
                      <tr key={b.id} className="hover:bg-secondary-container/10 transition-colors">
                        <td className="px-5 py-3 font-bold">
                          <Link to={`/beneficiarios/${b.id}`} className="hover:text-primary transition-colors">{b.nome}</Link>
                        </td>
                        <td className="px-5 py-3 text-outline">
                          {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            b.status === 'ativo' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                              : 'bg-surface-container text-on-surface-variant border-outline-variant'
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

        {/* Right Side: Recent Financial Entries */}
        <div className="bg-surface rounded-2xl shadow-xs border border-outline-variant/80 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-surface-variant/80 flex justify-between items-center">
              <h3 className="font-bold text-primary text-sm">Últimos Lançamentos de Caixa</h3>
              <Link className="text-[11px] font-bold text-primary hover:underline" to="/financeiro">Ver todos</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-surface-variant">
                  <tr>
                    <th className="px-5 py-2.5">Descrição</th>
                    <th className="px-5 py-2.5">Data</th>
                    <th className="px-5 py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/70 text-xs font-medium text-on-surface">
                  {financeiroRecente.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-5 py-8 text-center text-outline">Nenhum lançamento financeiro.</td>
                    </tr>
                  ) : (
                    financeiroRecente.slice(0, 5).map((item) => (
                      <tr key={item.id} className="hover:bg-secondary-container/10 transition-colors">
                        <td className="px-5 py-3 font-bold flex items-center gap-1.5">
                          <span className={`material-symbols-outlined text-[16px] ${
                            item.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {item.tipo === 'entrada' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                          <span className="truncate max-w-[180px]">{item.descricao}</span>
                        </td>
                        <td className="px-5 py-3 text-outline">
                          {new Date(item.data).toLocaleDateString('pt-BR')}
                        </td>
                        <td className={`px-5 py-3 text-right font-extrabold ${
                          item.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
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
          
          <div className="bg-surface-container-low px-5 py-3 border-t border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant">
            <span>Total de Registros no Sistema</span>
            <span className="bg-primary text-on-primary px-3 py-0.5 rounded-full text-xs font-extrabold">{totalCadastrosGerais}</span>
          </div>
        </div>

      </div>

    </div>
  )
}
