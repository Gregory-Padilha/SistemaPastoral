/**
 * Maps raw Supabase/PostgreSQL errors to friendly titles and descriptions
 * for user feedback.
 */
export const mapSupabaseError = (error) => {
  if (!error) return { title: 'Erro', message: 'Ocorreu um erro desconhecido.' }

  const code = String(error.code || '')
  const message = String(error.message || '')

  // Unique constraint violation (e.g. CPF duplication)
  if (code === '23505' || message.includes('duplicate key value') || message.includes('already exists')) {
    if (message.toLowerCase().includes('cpf')) {
      return {
        title: 'Erro de Cadastro',
        message: 'O CPF informado já está registrado para outro beneficiário no sistema.'
      }
    }
    return {
      title: 'Registro Duplicado',
      message: 'Este registro já está cadastrado no sistema.'
    }
  }

  // Network/Connection failure
  if (
    code === 'PGRST100' || 
    message.includes('FetchError') || 
    message.includes('failed to fetch') || 
    message.includes('NetworkError') || 
    message.includes('timeout')
  ) {
    return {
      title: 'Falha de Conexão',
      message: 'Não foi possível salvar os dados. Verifique sua internet e tente novamente.'
    }
  }

  // Foreign key constraint violation
  if (code === '23503' || message.includes('violates foreign key constraint')) {
    return {
      title: 'Erro de Relacionamento',
      message: 'Esta operação faz referência a um registro que não existe ou foi excluído.'
    }
  }

  // Permission / RLS denial
  if (code === '42501' || message.includes('permission denied') || message.includes('violates row-level security')) {
    return {
      title: 'Acesso Negado',
      message: 'Você não tem permissão para realizar esta operação no sistema.'
    }
  }

  // Default fallback
  return {
    title: 'Erro na Operação',
    message: message || 'Não foi possível concluir a ação no banco de dados.'
  }
}
