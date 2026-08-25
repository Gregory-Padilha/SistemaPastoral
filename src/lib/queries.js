import { supabase } from './supabase'

// ==========================================
// BENEFICIÁRIOS QUERIES
// ==========================================

export const fetchBeneficiarios = async (search = '', status = 'todos') => {
  try {
    let query = supabase.from('beneficiarios').select('*, anotacoes_retirada(count)').is('deletado_em', null)
    
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
  const currentMonthNum = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  let ativosCestas = 0
  try {
    const { count, error } = await supabase
      .from('beneficiarios_cestas')
      .select('*', { count: 'exact', head: true })
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

  const totalCadastrosGerais = (countStandard || 0)

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
    const { count, error } = await supabase
      .from('historico_entregas_cestas')
      .select('*', { count: 'exact', head: true })
      .eq('mes_referencia', currentMonthNum)
      .eq('ano_referencia', currentYear)
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
    // 1. Fetch the record to check if it's related to an aluguel contract
    const { data: record } = await supabase
      .from('financeiro')
      .select('id, contrato_id, mes_referencia, data, descricao')
      .eq('id', id)
      .single()

    // 2. Perform the soft delete on the financeiro entry
    const { error } = await supabase
      .from('financeiro')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    // 3. If it is linked to an aluguel contract, revert ONLY that month's payment status to 'Não Pago' (red)
    // and DO NOT delete the rental contract itself!
    if (record && record.contrato_id) {
      try {
        let mesNum = null
        let anoNum = null

        if (record.mes_referencia && record.mes_referencia.includes('/')) {
          const parts = record.mes_referencia.split('/')
          mesNum = parseInt(parts[0])
          anoNum = parseInt(parts[1])
        } else if (record.data) {
          const d = new Date(record.data)
          mesNum = d.getMonth() + 1
          anoNum = d.getFullYear()
        }

        if (mesNum && anoNum) {
          await supabase
            .from('historico_pagamentos_aluguel')
            .delete()
            .eq('contrato_id', record.contrato_id)
            .eq('mes_referencia', mesNum)
            .eq('ano_referencia', anoNum)
        }
      } catch (cErr) {
        console.error('Error removing payment reference from historico_pagamentos_aluguel:', cErr)
      }
    }
  } catch (err) {
    console.error('Error deleting financeiro:', err)
    throw new Error('Erro ao excluir lançamento: ' + err.message)
  }
}

// ==========================================
// ALUGUEIS QUERIES
// ==========================================

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
    console.error('Error fetching estoque_equipamentos:', err)
    throw new Error('Erro ao buscar equipamentos em estoque: ' + err.message)
  }
}

export const insertEquipamento = async (equipamentoData) => {
  try {
    const payload = {
      ...equipamentoData,
      quantidade_disponivel: equipamentoData.quantidade_total,
      status: equipamentoData.quantidade_total > 0 ? 'Disponível' : 'Esgotado'
    }
    const { data, error } = await supabase
      .from('estoque_equipamentos')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting item in estoque:', err)
    throw new Error('Erro ao cadastrar equipamento em estoque: ' + err.message)
  }
}

export const fetchAlugueis = async (search = '', status = 'todos') => {
  try {
    let query = supabase.from('alugueis').select('*, financeiro(*), estoque_equipamentos(*)').is('deletado_em', null)
    if (search) {
      query = query.or(`locatario_nome.ilike.%${search}%,imovel_endereco.ilike.%${search}%`)
    }
    const { data, error } = await query.order('locatario_nome')
    if (error) throw error
    
    // Parse itens for each contract returned in list
    const parsedList = (data || []).map(aluguel => {
      let parsedItens = []
      if (Array.isArray(aluguel.itens) && aluguel.itens.length > 0) {
        parsedItens = aluguel.itens
      } else if (typeof aluguel.itens === 'string') {
        try { parsedItens = JSON.parse(aluguel.itens) } catch (_) {}
      } else if (aluguel.observacoes && aluguel.observacoes.includes('<!--ITENS_JSON:')) {
        try {
          const match = aluguel.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
          if (match && match[1]) {
            parsedItens = JSON.parse(match[1])
          }
        } catch (_) {}
      }

      if (parsedItens.length === 0) {
        parsedItens = [{
          id: 'legacy-item-1',
          equipamento_id: aluguel.equipamento_id || '',
          nome_equipamento: aluguel.imovel_endereco || aluguel.estoque_equipamentos?.nome_equipamento || 'Equipamento',
          imovel_tipo: aluguel.imovel_tipo || 'Cadeira de Rodas',
          numero_serie: aluguel.estoque_equipamentos?.numero_serie || '',
          descricao: aluguel.imovel_descricao || '',
          quantidade: 1,
          valor_unitario: aluguel.valor_aluguel || 0
        }]
      }

      return {
        ...aluguel,
        itens: parsedItens
      }
    })

    return parsedList
  } catch (err) {
    console.error('Error fetching alugueis:', err)
    throw new Error('Erro ao buscar contratos: ' + err.message)
  }
}

export const fetchAluguelById = async (id) => {
  try {
    const { data: aluguel, error: aError } = await supabase
      .from('alugueis')
      .select('*, financeiro(*), estoque_equipamentos(*)')
      .eq('id', id)
      .is('deletado_em', null)
      .single()
    if (aError) throw aError

    // Parse itens if stored as string or in metadata
    if (aluguel) {
      let parsedItens = []
      if (Array.isArray(aluguel.itens) && aluguel.itens.length > 0) {
        parsedItens = aluguel.itens
      } else if (typeof aluguel.itens === 'string') {
        try { parsedItens = JSON.parse(aluguel.itens) } catch (_) {}
      } else if (aluguel.observacoes && aluguel.observacoes.includes('<!--ITENS_JSON:')) {
        try {
          const match = aluguel.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
          if (match && match[1]) {
            parsedItens = JSON.parse(match[1])
          }
        } catch (_) {}
      }

      // If no multi-items found, fallback to legacy single item
      if (parsedItens.length === 0) {
        parsedItens = [{
          id: 'legacy-item-1',
          equipamento_id: aluguel.equipamento_id || '',
          nome_equipamento: aluguel.imovel_endereco || 'Equipamento',
          imovel_tipo: aluguel.imovel_tipo || 'Cadeira de Rodas',
          numero_serie: aluguel.estoque_equipamentos?.numero_serie || '',
          descricao: aluguel.imovel_descricao || '',
          quantidade: 1,
          valor_unitario: aluguel.valor_aluguel || 0
        }]
      }
      aluguel.itens = parsedItens
    }

    return aluguel
  } catch (err) {
    console.error('Error fetching aluguel by id:', err)
    throw new Error('Erro ao carregar contrato: ' + err.message)
  }
}

export const insertAluguel = async (aluguelData) => {
  try {
    const itens = aluguelData.itens || []
    
    // Prepare clean payload
    const payload = { ...aluguelData }
    
    // Check if itens column is supported or embed in observacoes
    let data = null
    let insertError = null

    try {
      const res = await supabase
        .from('alugueis')
        .insert([payload])
        .select()
        .single()
      data = res.data
      insertError = res.error
    } catch (e) {
      insertError = e
    }

    // Fallback if column 'itens' does not exist in database yet
    if (insertError && (insertError.code === '42703' || insertError.message?.includes('itens'))) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.itens
      
      const embeddedMetadata = `\n<!--ITENS_JSON:${JSON.stringify(itens)}-->`
      fallbackPayload.observacoes = (fallbackPayload.observacoes || '') + embeddedMetadata

      const retryRes = await supabase
        .from('alugueis')
        .insert([fallbackPayload])
        .select()
        .single()
      
      if (retryRes.error) throw retryRes.error
      data = retryRes.data
    } else if (insertError) {
      throw insertError
    }

    // Note: Creating a rental does NOT insert into financeiro automatically.
    // Financial entries are only generated when monthly payments are marked as 'Pago'.

    // Decrement stock for all items in the rental if status is 'Ativo'
    if (data.status === 'Ativo' && itens.length > 0) {
      for (const item of itens) {
        if (item.equipamento_id) {
          const qty = parseInt(item.quantidade) || 1
          const { data: eq } = await supabase
            .from('estoque_equipamentos')
            .select('quantidade_disponivel')
            .eq('id', item.equipamento_id)
            .single()
          
          if (eq) {
            const nextQty = Math.max(0, eq.quantidade_disponivel - qty)
            await supabase
              .from('estoque_equipamentos')
              .update({
                quantidade_disponivel: nextQty,
                status: nextQty > 0 ? 'Disponível' : 'Esgotado'
              })
              .eq('id', item.equipamento_id)
          }
        }
      }
    }
    return data
  } catch (err) {
    console.error('Error inserting aluguel:', err)
    throw new Error('Erro ao criar contrato: ' + err.message)
  }
}

export const updateAluguel = async (id, aluguelData) => {
  try {
    const itens = aluguelData.itens || []

    // Fetch current record to compare status
    const { data: current, error: fetchErr } = await supabase
      .from('alugueis')
      .select('status, equipamento_id, observacoes, itens')
      .eq('id', id)
      .single()

    const payload = { ...aluguelData }
    let data = null
    let updateError = null

    try {
      const res = await supabase
        .from('alugueis')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      data = res.data
      updateError = res.error
    } catch (e) {
      updateError = e
    }

    // Fallback if column 'itens' does not exist in database yet
    if (updateError && (updateError.code === '42703' || updateError.message?.includes('itens'))) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.itens
      
      // Clean previous embedded metadata and append updated one
      let cleanObs = (fallbackPayload.observacoes || '').replace(/<!--ITENS_JSON:.*?-->/g, '').trim()
      const embeddedMetadata = `\n<!--ITENS_JSON:${JSON.stringify(itens)}-->`
      fallbackPayload.observacoes = cleanObs + embeddedMetadata

      const retryRes = await supabase
        .from('alugueis')
        .update(fallbackPayload)
        .eq('id', id)
        .select()
        .single()
      
      if (retryRes.error) throw retryRes.error
      data = retryRes.data
    } else if (updateError) {
      throw updateError
    }

    // Handle stock updates based on status transitions
    if (!fetchErr && current) {
      const oldStatus = current.status
      const newStatus = aluguelData.status

      if (oldStatus === 'Ativo' && newStatus === 'Devolvido') {
        // Return items to stock
        for (const item of itens) {
          if (item.equipamento_id) {
            const qty = parseInt(item.quantidade) || 1
            const { data: eq } = await supabase
              .from('estoque_equipamentos')
              .select('quantidade_disponivel')
              .eq('id', item.equipamento_id)
              .single()
            if (eq) {
              const nextQty = eq.quantidade_disponivel + qty
              await supabase
                .from('estoque_equipamentos')
                .update({
                  quantidade_disponivel: nextQty,
                  status: nextQty > 0 ? 'Disponível' : 'Esgotado'
                })
                .eq('id', item.equipamento_id)
            }
          }
        }
      } else if (oldStatus === 'Devolvido' && newStatus === 'Ativo') {
        // Re-borrow items from stock
        for (const item of itens) {
          if (item.equipamento_id) {
            const qty = parseInt(item.quantidade) || 1
            const { data: eq } = await supabase
              .from('estoque_equipamentos')
              .select('quantidade_disponivel')
              .eq('id', item.equipamento_id)
              .single()
            if (eq) {
              const nextQty = Math.max(0, eq.quantidade_disponivel - qty)
              await supabase
                .from('estoque_equipamentos')
                .update({
                  quantidade_disponivel: nextQty,
                  status: nextQty > 0 ? 'Disponível' : 'Esgotado'
                })
                .eq('id', item.equipamento_id)
            }
          }
        }
      }
    }
    return data
  } catch (err) {
    console.error('Error updating aluguel:', err)
    throw new Error('Erro ao editar contrato: ' + err.message)
  }
}

export const deleteAluguel = async (id) => {
  try {
    // 1. Fetch current rental details to restore stock if active
    const { data: current } = await supabase
      .from('alugueis')
      .select('status, equipamento_id, observacoes, itens')
      .eq('id', id)
      .single()

    if (current && current.status === 'Ativo') {
      let itensToRestore = []
      if (Array.isArray(current.itens) && current.itens.length > 0) {
        itensToRestore = current.itens
      } else if (current.observacoes && current.observacoes.includes('<!--ITENS_JSON:')) {
        try {
          const match = current.observacoes.match(/<!--ITENS_JSON:(.*?)-->/)
          if (match && match[1]) itensToRestore = JSON.parse(match[1])
        } catch (_) {}
      } else if (current.equipamento_id) {
        itensToRestore = [{ equipamento_id: current.equipamento_id, quantidade: 1 }]
      }

      for (const item of itensToRestore) {
        if (item.equipamento_id) {
          const qty = parseInt(item.quantidade) || 1
          const { data: eq } = await supabase
            .from('estoque_equipamentos')
            .select('quantidade_disponivel')
            .eq('id', item.equipamento_id)
            .single()
          if (eq) {
            await supabase
              .from('estoque_equipamentos')
              .update({
                quantidade_disponivel: eq.quantidade_disponivel + qty,
                status: 'Disponível'
              })
              .eq('id', item.equipamento_id)
          }
        }
      }
    }

    // 2. Soft delete the aluguel record
    const { error } = await supabase
      .from('alugueis')
      .update({ deletado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    // 3. Automatically remove/soft-delete all related entries in the financeiro ledger (Caderno de Fechamento)
    try {
      await supabase
        .from('financeiro')
        .update({ deletado_em: new Date().toISOString() })
        .eq('contrato_id', id)
    } catch (fErr) {
      console.warn('Error soft-deleting financeiro entries for aluguel:', fErr.message)
    }

    // 4. Clean up payment history for this contract
    try {
      await supabase
        .from('historico_pagamentos_aluguel')
        .delete()
        .eq('contrato_id', id)
    } catch (hErr) {
      console.warn('Error deleting payment history for aluguel:', hErr.message)
    }
  } catch (err) {
    console.error('Error deleting aluguel:', err)
    throw new Error('Erro ao excluir contrato: ' + err.message)
  }
}

export const insertPagamentoAluguel = async (pagamentoData) => {
  try {
    const { data: aluguel, error: aError } = await supabase
      .from('alugueis')
      .select('locatario_nome, imovel_endereco, forma_pagamento')
      .eq('id', pagamentoData.aluguel_id)
      .single()
    if (aError) throw aError

    const locatario = aluguel?.locatario_nome || 'Beneficiário'
    const equipamento = aluguel?.imovel_endereco || 'Equipamento'
    const forma = aluguel?.forma_pagamento || 'PIX'

    const financeiroRecord = {
      tipo: 'entrada',
      data: pagamentoData.data_pagamento || new Date().toISOString().split('T')[0],
      descricao: `Mensalidade Aluguel - ${equipamento} - ${locatario}`,
      categoria: 'Aluguel',
      valor: pagamentoData.valor_pago,
      forma_pagamento: pagamentoData.forma_pagamento || forma,
      contrato_id: pagamentoData.aluguel_id,
      mes_referencia: pagamentoData.mes_referencia,
      observacoes: `Relacionado ao aluguel de ${equipamento} para ${locatario} (${pagamentoData.mes_referencia})`
    }

    const { data, error } = await supabase
      .from('financeiro')
      .insert([financeiroRecord])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting payment in financeiro:', err)
    throw new Error('Erro ao registrar pagamento no financeiro: ' + err.message)
  }
}

// ==========================================
// CESTAS BÁSICAS QUERIES
// ==========================================

export const fetchCestas = async (search = '', status = 'todos', pathology = 'todos') => {
  try {
    let query = supabase.from('beneficiarios').select('*').not('responsavel_nome', 'is', null).is('deletado_em', null)
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
      .from('beneficiarios')
      .select('*, documentos(*), cestas_entregas(*)')
      .eq('id', id)
      .is('deletado_em', null)
      .single()
    if (error) throw error
    if (data) {
      data.cestas_documentos = data.documentos || []
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
      .from('beneficiarios')
      .insert([cestaData])
      .select()
      .single()
    if (cError) throw cError

    if (documentos.length > 0) {
      const docs = documentos.map(d => ({ nome: d.nome, url: d.url, beneficiario_id: cesta.id }))
      const { error: dError } = await supabase
        .from('documentos')
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
      .from('beneficiarios')
      .update(cestaData)
      .eq('id', id)
      .select()
      .single()
    if (cError) throw cError

    if (documentos.length > 0) {
      const docs = documentos.map(d => ({ nome: d.nome, url: d.url, beneficiario_id: id }))
      const { error: dError } = await supabase
        .from('documentos')
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
      .from('beneficiarios')
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
    const { data, error } = await supabase
      .from('cestas_entregas')
      .insert([entregaData])
      .select()
      .single()
    if (error) throw error

    return data
  } catch (err) {
    console.error('Error inserting delivery:', err)
    throw new Error('Erro ao registrar entrega: ' + err.message)
  }
}

export const deleteCestaDocumento = async (docId) => {
  try {
    const { error } = await supabase
      .from('documentos')
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
    const [beneficiariosRes, alugueisRes, modelosRes] = await Promise.all([
      supabase.from('beneficiarios').select('id, nome, responsavel_nome').ilike('nome', termILike).is('deletado_em', null).limit(8),
      supabase.from('alugueis').select('id, locatario_nome').ilike('locatario_nome', termILike).is('deletado_em', null).limit(5),
      supabase.from('modelos_mensagem').select('id, titulo').ilike('titulo', termILike).eq('ativo', true).is('deletado_em', null).limit(5)
    ])

    const results = []

    if (beneficiariosRes.data) {
      beneficiariosRes.data.forEach(item => {
        if (item.responsavel_nome) {
          results.push({
            id: item.id,
            nome: item.nome,
            tipo: 'Cesta Básica',
            link: `/cestas/${item.id}`,
            icon: 'shopping_bag'
          })
        } else {
          results.push({
            id: item.id,
            nome: item.nome,
            tipo: 'Beneficiário',
            link: `/beneficiarios/${item.id}`,
            icon: 'group'
          })
        }
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
      .from('cestas_entregas')
      .select('data_entrega')
      .eq('cesta_beneficiario_id', cestaBeneficiarioId)
      .eq('status', 'Entregue')
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
      .order('nome')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching items:', err)
    throw new Error('Erro ao buscar itens de retirada: ' + err.message)
  }
}

export const insertItemRetirada = async (itemData) => {
  try {
    const { data, error } = await supabase
      .from('itens_retirada')
      .insert([itemData])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error inserting item:', err)
    throw new Error('Erro ao cadastrar item de retirada: ' + err.message)
  }
}

export const fetchAnotacoesRetirada = async () => {
  try {
    const { data, error } = await supabase
      .from('anotacoes_retirada')
      .select(`
        *,
        beneficiario:beneficiarios(nome),
        anotacoes_itens(
          id,
          quantidade,
          item:itens_retirada(nome, unidade_medida)
        )
      `)
      .order('data_retirada', { ascending: false })
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching annotations:', err)
    throw new Error('Erro ao buscar anotações de retirada: ' + err.message)
  }
}

export const insertAnotacaoRetirada = async (anotacaoData, itens) => {
  try {
    // 1. Insert header
    const { data: header, error: hError } = await supabase
      .from('anotacoes_retirada')
      .insert([anotacaoData])
      .select()
      .single()
    if (hError) throw hError

    // 2. Insert items if any
    if (itens && itens.length > 0) {
      const itemsPayload = itens.map(it => ({
        anotacao_id: header.id,
        item_id: it.item_id,
        quantidade: it.quantidade
      }))
      const { error: iError } = await supabase
        .from('anotacoes_itens')
        .insert(itemsPayload)
      if (iError) throw iError
    }
    return header
  } catch (err) {
    console.error('Error saving withdrawal annotation:', err)
    throw new Error('Erro ao salvar anotação de retirada: ' + err.message)
  }
}

export const fetchAnotacoesByBeneficiarioId = async (beneficiarioId) => {
  try {
    const { data, error } = await supabase
      .from('anotacoes_retirada')
      .select(`
        *,
        anotacoes_itens(
          id,
          quantidade,
          item:itens_retirada(nome, unidade_medida)
        )
      `)
      .eq('beneficiario_id', beneficiarioId)
      .order('data_retirada', { ascending: false })
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching annotations by beneficiary:', err)
    throw new Error('Erro ao buscar histórico de retiradas: ' + err.message)
  }
}

export const updateItemRetirada = async (id, itemData) => {
  try {
    const { data, error } = await supabase
      .from('itens_retirada')
      .update(itemData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error updating item:', err)
    throw new Error('Erro ao editar item de retirada: ' + err.message)
  }
}

export const deleteItemRetirada = async (id) => {
  try {
    const { error } = await supabase
      .from('itens_retirada')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting item:', err)
    throw new Error('Erro ao excluir item de retirada. Certifique-se de que ele não esteja vinculado a nenhuma retirada existente: ' + err.message)
  }
}

export const deleteAnotacaoRetirada = async (id) => {
  try {
    const { error } = await supabase
      .from('anotacoes_retirada')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting annotation:', err)
    throw new Error('Erro ao excluir anotação de retirada: ' + err.message)
  }
}

export const updateAnotacaoRetirada = async (id, anotacaoData, itens) => {
  try {
    // 1. Update header
    const { data: header, error: hError } = await supabase
      .from('anotacoes_retirada')
      .update(anotacaoData)
      .eq('id', id)
      .select()
      .single()
    if (hError) throw hError

    // 2. Delete existing items
    const { error: dError } = await supabase
      .from('anotacoes_itens')
      .delete()
      .eq('anotacao_id', id)
    if (dError) throw dError

    // 3. Insert new items if any
    if (itens && itens.length > 0) {
      const itemsPayload = itens.map(it => ({
        anotacao_id: id,
        item_id: it.item_id,
        quantidade: it.quantidade
      }))
      const { error: iError } = await supabase
        .from('anotacoes_itens')
        .insert(itemsPayload)
      if (iError) throw iError
    }
    return header
  } catch (err) {
    console.error('Error updating withdrawal annotation:', err)
    throw new Error('Erro ao atualizar anotação de retirada: ' + err.message)
  }
}

export const deleteBeneficiarioPermanently = async (id) => {
  try {
    const { error } = await supabase
      .from('beneficiarios')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error permanently deleting beneficiario:', err)
    throw new Error('Erro ao excluir permanentemente o beneficiário: ' + err.message)
  }
}

export const fetchBeneficiariosCestas = async (search = '', status = 'todos') => {
  try {
    let query = supabase
      .from('beneficiarios_cestas')
      .select(`
        id,
        criado_em,
        beneficiario:beneficiarios (
          id,
          nome,
          cpf,
          status,
          deletado_em
        )
      `)
    
    const { data, error } = await query
    if (error) throw error
    
    let filtered = data || []
    
    filtered = filtered.filter(item => item.beneficiario && !item.beneficiario.deletado_em)
    
    if (status && status !== 'todos') {
      filtered = filtered.filter(item => item.beneficiario.status === status)
    }
    if (search) {
      const term = search.toLowerCase()
      filtered = filtered.filter(item => 
        item.beneficiario.nome.toLowerCase().includes(term) ||
        (item.beneficiario.cpf && item.beneficiario.cpf.includes(term))
      )
    }
    
    filtered.sort((a, b) => a.beneficiario.nome.localeCompare(b.beneficiario.nome))
    return filtered
  } catch (err) {
    console.error('Error fetching recurrent basket beneficiaries:', err)
    throw new Error('Erro ao buscar atendidos por cestas básicas: ' + err.message)
  }
}

export const insertBeneficiarioCesta = async (beneficiarioId) => {
  try {
    const { data, error } = await supabase
      .from('beneficiarios_cestas')
      .insert([{ beneficiario_id: beneficiarioId }])
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error enrolling beneficiary in baskets:', err)
    throw new Error('Erro ao vincular beneficiário ao grupo de cestas: ' + err.message)
  }
}

export const deleteBeneficiarioCesta = async (id) => {
  try {
    const { error } = await supabase
      .from('beneficiarios_cestas')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Error removing beneficiary from baskets:', err)
    throw new Error('Erro ao desvincular beneficiário do grupo de cestas: ' + err.message)
  }
}

export const fetchHistoricoEntregasCestas = async (ano) => {
  try {
    const { data, error } = await supabase
      .from('historico_entregas_cestas')
      .select('*')
      .eq('ano_referencia', ano)
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching basket deliveries history:', err)
    throw new Error('Erro ao buscar histórico de entregas: ' + err.message)
  }
}

export const insertHistoricoEntregaCesta = async (beneficiarioId, mes, ano, observacoes = '') => {
  try {
    const { data, error } = await supabase
      .from('historico_entregas_cestas')
      .insert([{
        beneficiario_id: beneficiarioId,
        mes_referencia: mes,
        ano_referencia: ano,
        observacoes: observacoes || null
      }])
      .select()
      .single()
    if (error) throw error
    
    return data
  } catch (err) {
    console.error('Error inserting basket delivery history:', err)
    throw new Error('Erro ao registrar entrega de cesta: ' + err.message)
  }
}

export const deleteHistoricoEntregaCesta = async (beneficiarioId, mes, ano) => {
  try {
    const { error } = await supabase
      .from('historico_entregas_cestas')
      .delete()
      .eq('beneficiario_id', beneficiarioId)
      .eq('mes_referencia', mes)
      .eq('ano_referencia', ano)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting basket delivery history:', err)
    throw new Error('Erro ao desmarcar entrega: ' + err.message)
  }
}

export const fetchHistoricoPagamentosAluguel = async (ano) => {
  try {
    // 1. Fetch all raw payment history records for the year
    const { data: histData, error } = await supabase
      .from('historico_pagamentos_aluguel')
      .select('*')
      .eq('ano_referencia', ano)
    if (error) throw error

    // 2. Fetch active (not soft-deleted) financeiro records related to alugueis for this year
    const { data: finData, error: finError } = await supabase
      .from('financeiro')
      .select('contrato_id, mes_referencia')
      .eq('categoria', 'Aluguel')
      .eq('tipo', 'entrada')
      .is('deletado_em', null)
      .like('mes_referencia', `%/${ano}`)
    if (finError) throw finError

    const activeRefs = new Set((finData || []).map(f => `${f.contrato_id}_${f.mes_referencia}`))

    // 3. Fetch contracts to identify zero-rent ones
    const { data: contracts } = await supabase
      .from('alugueis')
      .select('id, valor_aluguel')
      .is('deletado_em', null)
      
    const zeroRentContractIds = new Set(
      (contracts || [])
        .filter(c => parseFloat(c.valor_aluguel || '0') === 0)
        .map(c => c.id)
    )

    // 4. Only retain payment history if the contract value is zero OR if it has a matching active financeiro entry
    const filtered = (histData || []).filter(h => {
      const refKey = `${h.contrato_id}_${h.mes_referencia}/${h.ano_referencia}`
      return zeroRentContractIds.has(h.contrato_id) || activeRefs.has(refKey)
    })

    return filtered
  } catch (err) {
    console.error('Error fetching aluguel payments history:', err)
    throw new Error('Erro ao buscar histórico de pagamentos: ' + err.message)
  }
}

export const insertHistoricoPagamentoAluguel = async (contratoId, mes, ano, observacoes = '') => {
  try {
    const { data, error } = await supabase
      .from('historico_pagamentos_aluguel')
      .upsert([{
        contrato_id: contratoId,
        mes_referencia: mes,
        ano_referencia: ano,
        observacoes: observacoes || null
      }], { onConflict: 'contrato_id,mes_referencia,ano_referencia' })
      .select()
      .single()
    if (error) throw error

    // Fetch contract details to check valor_aluguel
    const { data: contract, error: cError } = await supabase
      .from('alugueis')
      .select('*, estoque_equipamentos(*)')
      .eq('id', contratoId)
      .single()
      
    if (!cError && contract) {
      const valor = parseFloat(contract.valor_aluguel || '0')
      if (valor > 0) {
        // Check if an active financeiro entry already exists for this contract and month reference
        const { data: existingFin } = await supabase
          .from('financeiro')
          .select('id')
          .eq('contrato_id', contratoId)
          .eq('mes_referencia', `${mes}/${ano}`)
          .is('deletado_em', null)

        if (!existingFin || existingFin.length === 0) {
          // Insert into financeiro (Caderno de Fechamento)
          const mesesAbreviados = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
          const eqNome = contract.estoque_equipamentos?.nome_equipamento || contract.imovel_endereco || 'Equipamento'
          const desc = `Mensalidade de Aluguel - ${eqNome} - Mês: ${mesesAbreviados[mes - 1]}/${ano}`
          
          const { data: { user } } = await supabase.auth.getUser()
          
          await supabase
            .from('financeiro')
            .insert([{
              tipo: 'entrada',
              descricao: desc,
              valor: valor,
              forma_pagamento: contract.forma_pagamento || 'PIX',
              categoria: 'Aluguel',
              data: new Date().toISOString().split('T')[0],
              responsavel_id: user?.id || null,
              contrato_id: contratoId,
              mes_referencia: `${mes}/${ano}`,
              observacoes: `Pagamento mensalidade de aluguel referente a ${mes}/${ano}`
            }])
        }
      }
    }

    return data
  } catch (err) {
    console.error('Error inserting aluguel payment history:', err)
    throw new Error('Erro ao registrar pagamento: ' + err.message)
  }
}

export const deleteHistoricoPagamentoAluguel = async (contratoId, mes, ano) => {
  try {
    // 1. Delete from financeiro ledger
    try {
      await supabase
        .from('financeiro')
        .delete()
        .eq('contrato_id', contratoId)
        .eq('mes_referencia', `${mes}/${ano}`)
    } catch (e) {
      console.warn('Error deleting payment from financeiro:', e.message)
    }

    // 2. Delete from payment history
    const { error } = await supabase
      .from('historico_pagamentos_aluguel')
      .delete()
      .eq('contrato_id', contratoId)
      .eq('mes_referencia', mes)
      .eq('ano_referencia', ano)
    if (error) throw error
  } catch (err) {
    console.error('Error deleting aluguel payment history:', err)
    throw new Error('Erro ao desmarcar pagamento: ' + err.message)
  }
}
