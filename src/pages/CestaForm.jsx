import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { insertBeneficiarioCesta } from '../lib/queries'
import { useFeedback } from '../contexts/FeedbackContext'
import { supabase } from '../lib/supabase'
import { mapSupabaseError } from '../lib/errorMapper'

export const CestaForm = () => {
  const navigate = useNavigate()
  const { showToast } = useFeedback()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Search beneficiaries
  const [beneficiarios, setBeneficiarios] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedBeneficiario, setSelectedBeneficiario] = useState(null)

  const loadBeneficiarios = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('beneficiarios')
        .select('id, nome, cpf, status, foto_url, bairro, cidade')
        .is('deletado_em', null)
        .order('nome')
      if (error) throw error
      setBeneficiarios(data || [])
    } catch (err) {
      showToast('Erro ao carregar beneficiários', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBeneficiarios()
  }, [])

  const filteredBeneficiarios = beneficiarios.filter(b => {
    const term = searchTerm.toLowerCase()
    const nomeMatch = (b.nome || '').toLowerCase().includes(term)
    const cpfMatch = (b.cpf || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''))
    return nomeMatch || cpfMatch
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedBeneficiario) {
      showToast('Aviso', 'Selecione um beneficiário cadastrado no sistema.', 'warning')
      return
    }

    setSaving(true)
    try {
      await insertBeneficiarioCesta(selectedBeneficiario.id)
      showToast('Sucesso', 'Beneficiário vinculado ao grupo recorrente de Cestas Básicas com sucesso!')
      navigate('/cestas')
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/cestas" className="p-2 hover:bg-surface-container rounded-xl text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-xl md:text-2xl font-display-lg font-bold text-primary">
            Vincular Beneficiário à Cesta Básica
          </h2>
          <p className="text-xs text-on-surface-variant">
            Adicione uma família cadastrada ao calendário de atendimento mensal recorrente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface rounded-3xl shadow-xs border border-outline-variant/80 p-6 md:p-8 space-y-6">
        
        {/* Section: Select Beneficiary */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-variant/80 pb-3">
            <span className="material-symbols-outlined text-primary text-[20px]">person_search</span>
            <h3 className="text-primary font-bold text-sm">Seleção do Beneficiário</h3>
          </div>
          
          <div className="relative">
            <label className="block text-[11px] font-bold text-on-surface mb-1">Buscar Beneficiário por Nome ou CPF</label>
            <div className="flex items-center border border-outline-variant/80 rounded-2xl px-3.5 py-2.5 bg-surface-container-low focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all">
              <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
              <input
                type="text"
                placeholder={selectedBeneficiario 
                  ? selectedBeneficiario.nome 
                  : "Digite o nome ou CPF para buscar..."
                }
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                className="bg-transparent border-none outline-none w-full text-xs font-semibold text-on-surface placeholder:text-outline p-0"
              />
              {selectedBeneficiario && (
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedBeneficiario(null)
                    setSearchTerm('')
                  }}
                  className="text-xs text-outline hover:text-error ml-2 font-bold"
                >
                  Limpar
                </button>
              )}
            </div>

            {showDropdown && searchTerm.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-surface border border-outline-variant/80 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto p-1 animate-in fade-in duration-150">
                {filteredBeneficiarios.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-outline text-center">Nenhum beneficiário encontrado</div>
                ) : (
                  filteredBeneficiarios.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBeneficiario(b)
                        setSearchTerm('')
                        setShowDropdown(false)
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-surface-container rounded-xl transition-colors flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {b.nome ? b.nome.substring(0, 2).toUpperCase() : 'B'}
                        </div>
                        <div>
                          <span className="font-bold text-on-surface block text-xs">{b.nome}</span>
                          <span className="text-[10px] text-outline font-mono">CPF: {b.cpf || 'Sem CPF'}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                        b.status === 'ativo' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}>
                        {b.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Beneficiary Confirmation Card */}
          {selectedBeneficiario && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex justify-between items-center animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {selectedBeneficiario.nome ? selectedBeneficiario.nome.substring(0, 2).toUpperCase() : 'B'}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-on-surface">{selectedBeneficiario.nome}</p>
                  <p className="text-[10px] text-outline font-mono">CPF: {selectedBeneficiario.cpf || 'Não Informado'}</p>
                  {selectedBeneficiario.bairro && (
                    <p className="text-[10px] text-on-surface-variant font-medium">📍 {selectedBeneficiario.bairro} - {selectedBeneficiario.cidade || ''}</p>
                  )}
                </div>
              </div>
              <div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${
                  selectedBeneficiario.status === 'ativo' 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                    : 'bg-surface-container text-on-surface-variant border-outline-variant'
                }`}>
                  {selectedBeneficiario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-surface-variant/80 flex justify-end gap-2">
          <Link
            to="/cestas"
            className="px-5 py-2.5 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container text-on-surface transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || !selectedBeneficiario}
            className="px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            {saving ? 'Salvando...' : 'Confirmar Vínculo'}
          </button>
        </div>
      </form>
    </div>
  )
}
