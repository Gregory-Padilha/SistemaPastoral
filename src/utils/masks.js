/**
 * Utility functions for masks and validations in forms
 */

// Format CPF: 000.000.000-00
export const maskCPF = (value) => {
  if (!value) return ''
  const cleanValue = value.replace(/\D/g, '') // Remove letters/symbols
  const truncated = cleanValue.slice(0, 11) // Limit to 11 digits

  // Format step by step
  if (truncated.length <= 3) {
    return truncated
  }
  if (truncated.length <= 6) {
    return `${truncated.slice(0, 3)}.${truncated.slice(3)}`
  }
  if (truncated.length <= 9) {
    return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6)}`
  }
  return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6, 9)}-${truncated.slice(9)}`
}

// Format Phone/WhatsApp: (99) 9 9999-9999 or (99) 9999-9999
export const maskPhone = (value) => {
  if (!value) return ''
  const cleanValue = value.replace(/\D/g, '') // Remove letters/symbols
  const truncated = cleanValue.slice(0, 11) // Limit to 11 digits

  if (truncated.length <= 2) {
    return truncated.length > 0 ? `(${truncated}` : ''
  }
  if (truncated.length <= 6) {
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`
  }
  if (truncated.length <= 10) {
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`
  }
  return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 3)} ${truncated.slice(3, 7)}-${truncated.slice(7)}`
}

// Validate CPF
export const validateCPF = (cpf) => {
  if (!cpf) return false
  const cleanCPF = cpf.replace(/\D/g, '')

  if (cleanCPF.length !== 11) return false

  // Reject known invalid repeating sequences
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false

  // Validate first digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cleanCPF.charAt(9))) return false

  // Validate second digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cleanCPF.charAt(10))) return false

  return true
}

// Check if beneficiary profile is incomplete
export const isCadastroIncompleto = (b) => {
  if (!b) return false
  return !b.cpf || !b.telefone || !b.rua || !b.numero || !b.bairro || !b.cidade || !b.estado
}

// Get list of missing essential fields
export const getCamposPendentes = (b) => {
  const pendentes = []
  if (!b) return pendentes
  
  if (!b.cpf) pendentes.push("CPF")
  if (!b.data_nascimento) pendentes.push("Data de Nascimento")
  if (!b.telefone) pendentes.push("Telefone / Contato")
  
  const temEnderecoCompleto = b.rua && b.numero && b.bairro && b.cidade && b.estado
  if (!temEnderecoCompleto) {
    pendentes.push("Endereço")
  }
  
  return pendentes
}


