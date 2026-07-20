import { supabase } from './supabase'

// ==========================================
// BENEFICIÁRIOS QUERIES
// ==========================================

export const fetchBeneficiarios = async (search = '', status = 'todos') => {
  try {
    let query = supabase.from('beneficiarios').select('*').is('deletado_em', null)
    
    if (search) {
      query = query.ilike('nome', `%${search}%`)
    }
    
    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    query = query.order('nome', { ascending: true })

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching beneficiarios:', err)
    throw new Error('Falha ao buscar beneficiários: ' + err.message)
  }
}

export const fetchBeneficiarioById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('beneficiarios')
      .select(`
        *,
        membros_familia (*),
        beneficios_recebidos (*),
        documentos (*)
      `)
      .eq('id', id)
      .is('deletado_em', null)
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching beneficiario details:', err)
    throw new Error('Falha ao buscar detalhes do beneficiário: ' + err.message)
  }
}

export const insertBeneficiario = async (beneficiarioData, membros = [], beneficios = [], documentos = []) => {
  try {
    // 1. Insert base beneficiary
    const { data: beneficiario, error: bError } = await supabase
      .from('beneficiarios')
      .insert([beneficiarioData])
      .select()
      .single()

    if (bError) throw bError
    const bId = beneficiario.id

    // 2. Insert family members
    if (membros.length > 0) {
      const familyToInsert = membros.map(m => ({ ...m, beneficiario_id: bId }))
      const { error: fError } = await supabase
        .from('membros_familia')
        .insert(familyToInsert)
      if (fError) throw fError
    }

    // 3. Insert benefits received
    if (beneficios.length > 0) {
      const benefitsToInsert = beneficios.map(b => ({ tipo: b, beneficiario_id: bId }))
      const { error: benError } = await supabase
        .from('beneficios_recebidos')
        .insert(benefitsToInsert)
      if (benError) throw benError
    }

    // 4. Insert documents
    if (documentos.length > 0) {
      const docsToInsert = documentos.map(d => ({ ...d, beneficiario_id: bId }))
      const { error: dError } = await supabase
        .from('documentos')
        .insert(docsToInsert)
      if (dError) throw dError
    }

    return beneficiario
  } catch (err) {
    console.error('Error inserting beneficiario:', err)
    throw new Error('Erro ao cadastrar beneficiário: ' + err.message)
  }
}

export const updateBeneficiario = async (id, beneficiarioData, membros = [], beneficios = [], documentos = []) => {
  try {
    // Update base beneficiary
    const { data: beneficiario, error: bError } = await supabase
      .from('beneficiarios')
      .update(beneficiarioData)
      .eq('id', id)
      .select()
      .single()

    if (bError) throw bError

    // Sync family members (Delete all existing ones and insert new ones)
    const { error: fDelError } = await supabase
      .from('membros_familia')
      .delete()
      .eq('beneficiario_id', id)
    if (fDelError) throw fDelError

    if (membros.length > 0) {
      const familyToInsert = membros.map(m => ({ nome: m.nome, parentesco: m.parentesco, idade: m.idade, beneficiario_id: id }))
      const { error: fInsError } = await supabase
        .from('membros_familia')
        .insert(familyToInsert)
      if (fInsError) throw fInsError
    }

    // Sync benefits (Delete and insert new)
    const { error: benDelError } = await supabase
      .from('beneficios_recebidos')
      .delete()
      .eq('beneficiario_id', id)
    if (benDelError) throw benDelError

    if (beneficios.length > 0) {
      const benefitsToInsert = beneficios.map(b => ({ tipo: b, beneficiario_id: id }))
      const { error: benInsError } = await supabase
        .from('beneficios_recebidos')
        .insert(benefitsToInsert)
      if (benInsError) throw benInsError
    }

    // Add new documents (only insert, don't delete existing docs to preserve uploaded files)
    if (documentos.length > 0) {
      const docsToInsert = documentos.map(d => ({ nome: d.nome, url: d.url, beneficiario_id: id }))
      const { error: dInsError } = await supabase
        .from('documentos')
        .insert(docsToInsert)
      if (dInsError) throw dInsError
    }

    return beneficiario
  } catch (err) {
    console.error('Error updating beneficiario:', err)
    throw new Error('Erro ao atualizar beneficiário: ' + err.message)
  }
}

// ==========================================
// FINANCEIRO QUERIES
// ==========================================

export const fetchFinanceiro = async (tipo = 'todos', startDate = '', endDate = '', categoria = '') => {
  try {
    let query = supabase.from('financeiro').select('*, responsavel:perfis(nome)').is('deletado_em', null)

    if (tipo && tipo !== 'todos') {
      query = query.eq('tipo', tipo)
    }

    if (startDate) {
      query = query.gte('data', startDate)
    }

    if (endDate) {
      query = query.lte('data', endDate)
    }

    if (categoria && categoria !== 'todas') {
      query = query.eq('categoria', categoria)
    }

    query = query.order('data', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching financeiro:', err)
    throw new Error('Erro ao buscar lançamentos financeiros: ' + err.message)
  }
}

export const insertLancamento = async (lancamentoData) => {
  try {
    const { data, error } = await supabase
      .from('financeiro')
      .insert([lancamentoData])
      .select()
      .single()

    if (error) throw error

    // Adjust estoque_cestas automatically if category is 'Doação em Produto' and description contains 'Cesta'
    const isCestaDonation = 
      lancamentoData.categoria === 'Doação em Produto' && 
      /cesta/i.test(lancamentoData.descricao || '')

    if (isCestaDonation) {
      let qtd = 1
      const numMatch = (lancamentoData.descricao || '').match(/(\d+)/)
      if (numMatch) {
        qtd = parseInt(numMatch[0])
      }
      await ajustarEstoqueCestas(qtd)
    }

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting financeiro:', err)
    throw new Error('Erro ao criar lançamento: ' + err.message)
  }
}

export const updateLancamento = async (id, lancamentoData) => {
  try {
    const { data, error } = await supabase
      .from('financeiro')
      .update(lancamentoData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error updating financeiro:', err)
    throw new Error('Erro ao editar lançamento: ' + err.message)
  }
}

// ==========================================
// ATENDIMENTOS QUERIES
// ==========================================

export const fetchAtendimentos = async () => {
  try {
    const { data, error } = await supabase
      .from('atendimentos')
      .select(`
        *,
        beneficiario:beneficiarios (nome),
        responsavel:perfis (nome)
      `)
      .order('data', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching atendimentos:', err)
    throw new Error('Erro ao buscar atendimentos: ' + err.message)
  }
}

export const insertAtendimento = async (atendimentoData) => {
  try {
    const { data, error } = await supabase
      .from('atendimentos')
      .insert([atendimentoData])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting atendimento:', err)
    throw new Error('Erro ao criar atendimento: ' + err.message)
  }
}

// ==========================================
// DASHBOARD DATA QUERIES
// ==========================================

export const fetchDashboardData = async () => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  let ativosCestas = 0
  try {
    const { count, error } = await supabase
      .from('beneficiarios_cesta')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Ativo')
      .is('deletado_em', null)
    if (error) throw error
    ativosCestas = count || 0
  } catch (err) {
    console.warn('Dashboard query error (ativosCestas):', err.message)
  }

  let ativosAlugueis = 0
  try {
    const { count, error } = await supabase
      .from('alugueis')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Ativo')
      .is('deletado_em', null)
    if (error) throw error
    ativosAlugueis = count || 0
  } catch (err) {
    console.warn('Dashboard query error (ativosAlugueis):', err.message)
  }

  let countStandard = 0
  try {
    const { count, error } = await supabase
      .from('beneficiarios')
      .select('*', { count: 'exact', head: true })
      .is('deletado_em', null)
    if (error) throw error
    countStandard = count || 0
  } catch (err) {
    console.warn('Dashboard query error (countStandard):', err.message)
  }

  let countCestasTotal = 0
  try {
    const { count, error } = await supabase
      .from('beneficiarios_cesta')
      .select('*', { count: 'exact', head: true })
      .is('deletado_em', null)
    if (error) throw error
    countCestasTotal = count || 0
  } catch (err) {
    console.warn('Dashboard query error (countCestasTotal):', err.message)
  }

  let countAlugueisTotal = 0
  try {
    const { count, error } = await supabase
      .from('alugueis')
      .select('*', { count: 'exact', head: true })
      .is('deletado_em', null)
    if (error) throw error
    countAlugueisTotal = count || 0
  } catch (err) {
    console.warn('Dashboard query error (countAlugueisTotal):', err.message)
  }

  const totalCadastrosGerais = (countStandard || 0) + (countCestasTotal || 0) + (countAlugueisTotal || 0)

  let totalEntradasMes = 0
  let totalSaidasMes = 0
  try {
    const { data: monthData, error } = await supabase
      .from('financeiro')
      .select('tipo, valor')
      .gte('data', startOfMonth)
      .lte('data', endOfMonth)
      .is('deletado_em', null)
    if (error) throw error
    if (monthData) {
      monthData.forEach(item => {
        const val = parseFloat(item.valor) || 0
        if (item.tipo === 'entrada') totalEntradasMes += val
        if (item.tipo === 'saida') totalSaidasMes += val
      })
    }
  } catch (err) {
    console.warn('Dashboard query error (monthData):', err.message)
  }

  const monthlySummary = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlySummary[key] = { label, entradas: 0, saidas: 0 }
  }

  try {
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]
    const { data: chartDataRaw, error } = await supabase
      .from('financeiro')
      .select('tipo, valor, data')
      .gte('data', sixMonthsAgo)
      .is('deletado_em', null)
    if (error) throw error
    if (chartDataRaw) {
      chartDataRaw.forEach(item => {
        const monthKey = item.data.substring(0, 7) // YYYY-MM
        if (monthlySummary[monthKey]) {
          const val = parseFloat(item.valor) || 0
          if (item.tipo === 'entrada') monthlySummary[monthKey].entradas += val
          if (item.tipo === 'saida') monthlySummary[monthKey].saidas += val
        }
      })
    }
  } catch (err) {
    console.warn('Dashboard query error (chartDataRaw):', err.message)
  }

  const historicoGrafico = Object.keys(monthlySummary)
    .sort()
    .map(key => ({
      mes: monthlySummary[key].label,
      entradas: monthlySummary[key].entradas,
      saidas: monthlySummary[key].saidas
    }))

  let beneficiariosRecentes = []
  try {
    const { data, error } = await supabase
      .from('beneficiarios')
      .select('*')
      .is('deletado_em', null)
      .order('criado_em', { ascending: false })
      .limit(5)
    if (error) throw error
    beneficiariosRecentes = data || []
  } catch (err) {
    console.warn('Dashboard query error (beneficiariosRecentes):', err.message)
  }

  let financeiroRecente = []
  try {
    const { data, error } = await supabase
      .from('financeiro')
      .select('*, responsavel:perfis(nome)')
      .is('deletado_em', null)
      .order('criado_em', { ascending: false })
      .limit(5)
    if (error) throw error
    financeiroRecente = data || []
  } catch (err) {
    console.warn('Dashboard query error (financeiroRecente):', err.message)
  }

  let entregasCestasMes = 0
  try {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const currentMonthRef = `${months[now.getMonth()]} ${now.getFullYear()}`
    const { count, error } = await supabase
      .from('entregas_cesta')
      .select('*', { count: 'exact', head: true })
      .eq('mes_referencia', currentMonthRef)
    if (error) throw error
    entregasCestasMes = count || 0
  } catch (err) {
    console.warn('Dashboard query error (entregasCestasMes):', err.message)
  }

  return {
    ativosCestas,
    ativosAlugueis,
    totalEntradasMes,
    totalSaidasMes,
    saldoMes: totalEntradasMes - totalSaidasMes,
    totalCadastrosGerais,
    historicoGrafico,
    beneficiariosRecentes,
    financeiroRecente,
    entregasCestasMes
  }
}

// ==========================================
// USUÁRIOS / PERFIS QUERIES
// ==========================================

export const fetchUsuarios = async () => {
  try {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .order('nome', { ascending: true })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching profiles:', err)
    throw new Error('Erro ao buscar usuários: ' + err.message)
  }
}

export const createUsuario = async (email, password, nome, perfil) => {
  try {
    // Calling admin API to create user. This trigger the handle_new_user trigger.
    // Note: To use admin.createUser locally without a service role key we might hit permissions limits,
    // so we handle it gracefully. Standard remote setup allows auth.signUp, then updates the profile.
    // If the account has signUp enabled:
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          perfil
        }
      }
    })
    
    if (error) throw error
    return data.user
  } catch (err) {
    console.error('Error creating user:', err)
    throw new Error('Erro ao criar usuário: ' + err.message)
  }
}

export const toggleUsuarioAtivo = async (id, ativo) => {
  try {
    const { data, error } = await supabase
      .from('perfis')
      .update({ ativo })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error toggling user status:', err)
    throw new Error('Erro ao alterar status do usuário: ' + err.message)
  }
}

// ==========================================
// CONFIGURAÇÕES QUERIES
// ==========================================

export const fetchConfiguracoes = async () => {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .limit(1)

    if (error) throw error
    return data && data.length > 0 ? data[0] : null
  } catch (err) {
    console.error('Error fetching settings:', err)
    throw new Error('Erro ao carregar configurações: ' + err.message)
  }
}

export const upsertConfiguracoes = async (configData) => {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .upsert(configData)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error saving settings:', err)
    throw new Error('Erro ao salvar configurações: ' + err.message)
  }
}

export const fetchCategorias = async (tipo = 'financeiro') => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('tipo', tipo)
      .order('nome')

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching categories:', err)
    throw new Error('Erro ao carregar categorias: ' + err.message)
  }
}

// ==========================================
// FINANCEIRO MENSAL AND DELETIONS
// ==========================================

export const fetchFinanceiroMensal = async (tipo = 'todos', mes = '', ano = '', categoria = '') => {
  try {
    let query = supabase.from('financeiro').select('*, responsavel:perfis(nome)').is('deletado_em', null)

    if (tipo && tipo !== 'todos') {
      query = query.eq('tipo', tipo)
    }

    if (mes && ano) {
      const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
      const lastDay = new Date(ano, mes, 0).getDate()
      const endDate = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('data', startDate).lte('data', endDate)
    }

    if (categoria && categoria !== 'todas') {
      query = query.eq('categoria', categoria)
    }

    query = query.order('data', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching monthly financeiro:', err)
    throw new Error('Erro ao buscar lançamentos financeiros: ' + err.message)
  }
}

export const deleteLancamento = async (id) => {
  try {
    const { error } = await supabase
      .from('financeiro')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting financeiro:', err)
    throw new Error('Erro ao excluir lançamento: ' + err.message)
  }
}

// ==========================================
// ALUGUEIS QUERIES
// ==========================================

export const fetchAlugueis = async (search = '', status = 'todos') => {
  try {
    let query = supabase.from('alugueis').select('*').is('deletado_em', null)
    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }
    if (search) {
      query = query.or(`locatario_nome.ilike.%${search}%,imovel_endereco.ilike.%${search}%`)
    }
    const { data, error } = await query.order('locatario_nome')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching alugueis:', err)
    throw new Error('Erro ao buscar contratos: ' + err.message)
  }
}

export const fetchAluguelById = async (id) => {
  try {
    const { data: aluguel, error: aError } = await supabase
      .from('alugueis')
      .select('*, pagamentos_aluguel(*)')
      .eq('id', id)
      .is('deletado_em', null)
      .single()
    if (aError) throw aError
    return aluguel
  } catch (err) {
    console.error('Error fetching aluguel by id:', err)
    throw new Error('Erro ao carregar contrato: ' + err.message)
  }
}

export const insertAluguel = async (aluguelData) => {
  try {
    const { data, error } = await supabase
      .from('alugueis')
      .insert([aluguelData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting aluguel:', err)
    throw new Error('Erro ao criar contrato: ' + err.message)
  }
}

export const updateAluguel = async (id, aluguelData) => {
  try {
    const { data, error } = await supabase
      .from('alugueis')
      .update(aluguelData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error updating aluguel:', err)
    throw new Error('Erro ao editar contrato: ' + err.message)
  }
}

export const deleteAluguel = async (id) => {
  try {
    const { error } = await supabase
      .from('alugueis')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting aluguel:', err)
    throw new Error('Erro ao excluir contrato: ' + err.message)
  }
}

export const insertPagamentoAluguel = async (pagamentoData) => {
  try {
    const { data, error } = await supabase
      .from('pagamentos_aluguel')
      .insert([pagamentoData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting payment:', err)
    throw new Error('Erro ao registrar pagamento: ' + err.message)
  }
}

// ==========================================
// ESTOQUE / EQUIPAMENTOS QUERIES
// ==========================================

export const fetchEquipamentos = async () => {
  try {
    const { data, error } = await supabase
      .from('estoque_equipamentos')
      .select('*')
      .is('deletado_em', null)
      .gt('quantidade_disponivel', 0)
      .order('nome_equipamento')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching available equipamentos:', err)
    throw new Error('Erro ao buscar equipamentos: ' + err.message)
  }
}

export const fetchEstoqueEquipamentos = async () => {
  try {
    const { data, error } = await supabase
      .from('estoque_equipamentos')
      .select('*')
      .is('deletado_em', null)
      .order('nome_equipamento')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching estoque:', err)
    throw new Error('Erro ao buscar estoque: ' + err.message)
  }
}

export const insertEstoqueEquipamento = async (eqData) => {
  try {
    const { data, error } = await supabase
      .from('estoque_equipamentos')
      .insert([eqData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting estoque:', err)
    throw new Error('Erro ao cadastrar equipamento: ' + err.message)
  }
}

export const decrementEstoqueDisponivel = async (id) => {
  try {
    const { data: eq, error: fetchErr } = await supabase
      .from('estoque_equipamentos')
      .select('quantidade_disponivel')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr

    const newQty = Math.max(0, (eq.quantidade_disponivel || 0) - 1)
    const newStatus = newQty === 0 ? 'Esgotado' : 'Disponível'

    const { error: updateErr } = await supabase
      .from('estoque_equipamentos')
      .update({ quantidade_disponivel: newQty, status: newStatus, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) throw updateErr
  } catch (err) {
    console.error('Error decrementing estoque:', err)
    throw new Error('Erro ao atualizar estoque disponível: ' + err.message)
  }
}

export const incrementEstoqueDisponivel = async (id) => {
  try {
    const { data: eq, error: fetchErr } = await supabase
      .from('estoque_equipamentos')
      .select('quantidade_disponivel')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr

    const newQty = (eq.quantidade_disponivel || 0) + 1
    const newStatus = newQty === 0 ? 'Esgotado' : 'Disponível'

    const { error: updateErr } = await supabase
      .from('estoque_equipamentos')
      .update({ quantidade_disponivel: newQty, status: newStatus, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) throw updateErr
  } catch (err) {
    console.error('Error incrementing estoque:', err)
    throw new Error('Erro ao devolver equipamento para o estoque: ' + err.message)
  }
}

// ==========================================
// CESTAS BÁSICAS QUERIES
// ==========================================

export const fetchCestas = async (search = '', status = 'todos', pathology = 'todos') => {
  try {
    let query = supabase.from('beneficiarios_cesta').select('*').is('deletado_em', null)
    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }
    if (pathology && pathology !== 'todos') {
      query = query.contains('patologias', [pathology])
    }
    if (search) {
      query = query.ilike('nome', `%${search}%`)
    }
    const { data, error } = await query.order('nome')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching baskets:', err)
    throw new Error('Erro ao buscar beneficiários de cesta: ' + err.message)
  }
}

export const fetchCestaById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('beneficiarios_cesta')
      .select('*, documentos_cesta(*), entregas_cesta(*)')
      .eq('id', id)
      .is('deletado_em', null)
      .single()
    if (error) throw error
    if (data) {
      data.cestas_documentos = data.documentos_cesta || []
      data.cestas_entregas = data.entregas_cesta || []
    }
    return data
  } catch (err) {
    console.error('Error fetching basket by id:', err)
    throw new Error('Erro ao buscar ficha da cesta: ' + err.message)
  }
}

export const insertCesta = async (cestaData, documentos = []) => {
  try {
    const { data: cesta, error: cError } = await supabase
      .from('beneficiarios_cesta')
      .insert([cestaData])
      .select()
      .single()
    if (cError) throw cError

    if (documentos.length > 0) {
      const docs = documentos.map(d => ({ nome: d.nome, url: d.url, beneficiario_cesta_id: cesta.id }))
      const { error: dError } = await supabase
        .from('documentos_cesta')
        .insert(docs)
      if (dError) throw dError
    }

    return cesta
  } catch (err) {
    console.error('Error inserting basket beneficiary:', err)
    throw new Error('Erro ao cadastrar beneficiário de cesta: ' + err.message)
  }
}

export const updateCesta = async (id, cestaData, documentos = []) => {
  try {
    const { data: cesta, error: cError } = await supabase
      .from('beneficiarios_cesta')
      .update(cestaData)
      .eq('id', id)
      .select()
      .single()
    if (cError) throw cError

    if (documentos.length > 0) {
      const docs = documentos.map(d => ({ nome: d.nome, url: d.url, beneficiario_cesta_id: id }))
      const { error: dError } = await supabase
        .from('documentos_cesta')
        .insert(docs)
      if (dError) throw dError
    }

    return cesta
  } catch (err) {
    console.error('Error updating basket beneficiary:', err)
    throw new Error('Erro ao atualizar cadastro: ' + err.message)
  }
}

export const deleteCesta = async (id) => {
  try {
    const { error } = await supabase
      .from('beneficiarios_cesta')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting basket beneficiary:', err)
    throw new Error('Erro ao excluir cadastro: ' + err.message)
  }
}

export const insertCestaEntrega = async (entregaData) => {
  try {
    const dbPayload = {
      beneficiario_id: entregaData.cesta_beneficiario_id || entregaData.beneficiario_id,
      mes_referencia: entregaData.mes_referencia,
      data_entrega: entregaData.data_entrega,
      responsavel_entrega: entregaData.entregador || entregaData.responsavel_entrega,
      observacoes: entregaData.observacoes
    }
    const { data, error } = await supabase
      .from('entregas_cesta')
      .insert([dbPayload])
      .select()
      .single()
    if (error) throw error

    await ajustarEstoqueCestas(-1)
    return data
  } catch (err) {
    console.error('Error inserting delivery:', err)
    throw new Error('Erro ao registrar entrega: ' + err.message)
  }
}

export const deleteCestaDocumento = async (docId) => {
  try {
    const { error } = await supabase
      .from('documentos_cesta')
      .delete()
      .eq('id', docId)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting document:', err)
    throw new Error('Erro ao excluir documento: ' + err.message)
  }
}

// ==========================================
// MODELOS DE MENSAGEM QUERIES
// ==========================================

export const fetchModelos = async () => {
  try {
    const { data, error } = await supabase
      .from('modelos_mensagem')
      .select('*')
      .eq('ativo', true)
      .is('deletado_em', null)
      .order('titulo', { ascending: true })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching message templates:', err)
    throw new Error('Erro ao buscar modelos de mensagem: ' + err.message)
  }
}

export const insertModelo = async (modeloData) => {
  try {
    const { data, error } = await supabase
      .from('modelos_mensagem')
      .insert([modeloData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting message template:', err)
    throw new Error('Erro ao criar modelo de mensagem: ' + err.message)
  }
}

export const updateModelo = async (id, modeloData) => {
  try {
    const { data, error } = await supabase
      .from('modelos_mensagem')
      .update(modeloData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error updating message template:', err)
    throw new Error('Erro ao atualizar modelo de mensagem: ' + err.message)
  }
}

export const deleteModelo = async (id) => {
  try {
    const { error } = await supabase
      .from('modelos_mensagem')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting message template:', err)
    throw new Error('Erro ao excluir modelo de mensagem: ' + err.message)
  }
}

// ==========================================
// BUSCA GLOBAL QUERY
// ==========================================

export const searchGlobalEntities = async (term) => {
  try {
    if (!term || term.trim().length < 3) return []
    const termILike = `%${term}%`

    // Parallel search across different entities
    const [beneficiariosRes, alugueisRes, modelosRes, basketRes] = await Promise.all([
      supabase.from('beneficiarios').select('id, nome').ilike('nome', termILike).is('deletado_em', null).limit(8),
      supabase.from('alugueis').select('id, locatario_nome').ilike('locatario_nome', termILike).is('deletado_em', null).limit(5),
      supabase.from('modelos_mensagem').select('id, titulo').ilike('titulo', termILike).eq('ativo', true).is('deletado_em', null).limit(5),
      supabase.from('beneficiarios_cesta').select('id, nome').ilike('nome', termILike).is('deletado_em', null).limit(5)
    ])

    const results = []

    if (beneficiariosRes.data) {
      beneficiariosRes.data.forEach(item => {
        results.push({
          id: item.id,
          nome: item.nome,
          tipo: 'Beneficiário',
          link: `/beneficiarios/${item.id}`,
          icon: 'group'
        })
      })
    }

    if (basketRes.data) {
      basketRes.data.forEach(item => {
        results.push({
          id: item.id,
          nome: item.nome,
          tipo: 'Cesta Básica',
          link: `/cestas/${item.id}`,
          icon: 'shopping_bag'
        })
      })
    }

    if (alugueisRes.data) {
      alugueisRes.data.forEach(item => {
        results.push({
          id: item.id,
          nome: item.locatario_nome,
          tipo: 'Locatário',
          link: `/aluguel/${item.id}`,
          icon: 'home'
        })
      })
    }

    if (modelosRes.data) {
      modelosRes.data.forEach(item => {
        results.push({
          id: item.id,
          nome: item.titulo,
          tipo: 'Modelo de Mensagem',
          link: `/mensagens?useModelo=${item.id}`,
          icon: 'chat'
        })
      })
    }

    return results
  } catch (err) {
    console.error('Error in global search query:', err)
    return []
  }
}

// ==========================================
// LOGS DE CONTATOS E ENTREGAS QUERIES
// ==========================================

export const insertContatoLog = async (logData) => {
  try {
    const { data, error } = await supabase
      .from('historico_contatos')
      .insert([logData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error logging contact:', err)
    throw err
  }
}

export const fetchUltimoContato = async (entidadeId, entidadeTipo) => {
  try {
    const { data, error } = await supabase
      .from('historico_contatos')
      .select(`
        enviado_em,
        perfil:perfis(nome)
      `)
      .eq('entidade_id', entidadeId)
      .eq('entidade_tipo', entidadeTipo)
      .order('enviado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching last contact details:', err)
    return null
  }
}

export const fetchUltimaEntrega = async (cestaBeneficiarioId) => {
  try {
    const { data, error } = await supabase
      .from('entregas_cesta')
      .select('data_entrega')
      .eq('beneficiario_id', cestaBeneficiarioId)
      .order('data_entrega', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? data.data_entrega : null
  } catch (err) {
    console.error('Error fetching last basket delivery:', err)
    return null
  }
}

export const ajustarEstoqueCestas = async (quantidade) => {
  try {
    const { data: config, error: fError } = await supabase
      .from('configuracoes')
      .select('*')
      .limit(1)
      .maybeSingle()
    
    if (fError) throw fError
    if (!config) return null
    
    const novoEstoque = (config.estoque_cestas || 0) + quantidade
    
    const { data: updated, error: uError } = await supabase
      .from('configuracoes')
      .update({ estoque_cestas: Math.max(0, novoEstoque) })
      .eq('id', config.id)
      .select()
      .single()
      
    if (uError) throw uError
    return updated
  } catch (err) {
    console.error('Error adjusting basket stock:', err)
    throw err
  }
}

export const deleteBeneficiario = async (id) => {
  try {
    const { error } = await supabase
      .from('beneficiarios')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting beneficiario:', err)
    throw new Error('Erro ao excluir beneficiário: ' + err.message)
  }
}

export const insertMensagemLog = async (logData) => {
  try {
    const { data, error } = await supabase
      .from('historico_mensagens')
      .insert([logData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting message log:', err)
    throw err
  }
}

export const fetchMensagensHistory = async (destinatarioId, destinatarioTipo) => {
  try {
    const { data, error } = await supabase
      .from('historico_mensagens')
      .select(`
        *,
        perfil:perfis(nome)
      `)
      .eq('destinatario_id', destinatarioId)
      .eq('destinatario_tipo', destinatarioTipo)
      .order('enviado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching messaging history:', err)
    return null
  }
}

// ==========================================
// ANOTAÇÕES DE RETIRADA QUERIES
// ==========================================

export const fetchItensRetirada = async () => {
  try {
    const { data, error } = await supabase
      .from('itens_retirada')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching itens_retirada:', err)
    throw new Error('Falha ao buscar itens de retirada: ' + err.message)
  }
}

export const createItemRetirada = async (nome, unidade_medida = 'Unidade') => {
  try {
    const { data, error } = await supabase
      .from('itens_retirada')
      .insert([{ nome, unidade_medida, ativo: true }])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error creating item_retirada:', err)
    throw new Error('Falha ao cadastrar item: ' + err.message)
  }
}

export const fetchAnotacoesRetirada = async () => {
  try {
    const { data, error } = await supabase
      .from('anotacoes_retirada')
      .select(`
        *,
        beneficiario:beneficiarios(id, nome),
        anotacoes_itens(
          id,
          quantidade,
          item:itens_retirada(id, nome, unidade_medida)
        )
      `)
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching anotacoes_retirada:', err)
    throw new Error('Falha ao buscar anotações de retirada: ' + err.message)
  }
}

export const createAnotacaoRetirada = async (beneficiario_id, data_retirada, observacoes, itens) => {
  try {
    // 1. Insert header
    const { data: anotacao, error: headerError } = await supabase
      .from('anotacoes_retirada')
      .insert([{ beneficiario_id, data_retirada, observacoes }])
      .select()
      .single()
    
    if (headerError) throw headerError

    // 2. Insert items
    if (itens && itens.length > 0) {
      const itemsToInsert = itens.map(item => ({
        anotacao_id: anotacao.id,
        item_id: item.item_id,
        quantidade: item.quantidade
      }))

      const { error: itemsError } = await supabase
        .from('anotacoes_itens')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError
    }

    return anotacao
  } catch (err) {
    console.error('Error creating anotacao_retirada:', err)
    throw new Error('Falha ao registrar anotação: ' + err.message)
  }
}

export const deleteAnotacaoRetirada = async (id) => {
  try {
    const { error } = await supabase
      .from('anotacoes_retirada')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting anotacao_retirada:', err)
    throw new Error('Falha ao excluir anotação: ' + err.message)
  }
}

export const updateAnotacaoRetirada = async (id, beneficiario_id, data_retirada, observacoes, itens) => {
  try {
    // 1. Update header
    const { data: anotacao, error: headerError } = await supabase
      .from('anotacoes_retirada')
      .update({ beneficiario_id, data_retirada, observacoes })
      .eq('id', id)
      .select()
      .single()
    
    if (headerError) throw headerError

    // 2. Delete old items
    const { error: deleteItemsError } = await supabase
      .from('anotacoes_itens')
      .delete()
      .eq('anotacao_id', id)
    
    if (deleteItemsError) throw deleteItemsError

    // 3. Insert new items
    if (itens && itens.length > 0) {
      const itemsToInsert = itens.map(item => ({
        anotacao_id: id,
        item_id: item.item_id,
        quantidade: item.quantidade
      }))

      const { error: itemsError } = await supabase
        .from('anotacoes_itens')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError
    }

    return anotacao
  } catch (err) {
    console.error('Error updating anotacao_retirada:', err)
    throw new Error('Falha ao atualizar anotação: ' + err.message)
  }
}

export const fetchAnotacoesRetiradaByBeneficiarioId = async (beneficiarioId) => {
  try {
    const { data, error } = await supabase
      .from('anotacoes_retirada')
      .select(`
        *,
        anotacoes_itens(
          id,
          quantidade,
          item:itens_retirada(id, nome, unidade_medida)
        )
      `)
      .eq('beneficiario_id', beneficiarioId)
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching anotacoes by beneficiario:', err)
    throw new Error('Falha ao buscar histórico de retiradas: ' + err.message)
  }
}

