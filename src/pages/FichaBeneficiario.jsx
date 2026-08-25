import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchBeneficiarioById, insertAtendimento } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useFeedback } from '../contexts/FeedbackContext'
import { mapSupabaseError } from '../lib/errorMapper'
import { isCadastroIncompleto } from '../utils/masks'

export const FichaBeneficiario = () => {
  const { id } = useParams()
  const { showToast } = useFeedback()
  const [beneficiario, setBeneficiario] = useState(null)
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('dados-pessoais')
  
  // Attendance logger form state
  const [newAtendimento, setNewAtendimento] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'Cesta Básica',
    observacoes: ''
  })
  const [savingAtendimento, setSavingAtendimento] = useState(false)

  const loadBeneficiarioData = async () => {
    try {
      setLoading(true)
      const data = await fetchBeneficiarioById(id)
      setBeneficiario(data)

      const { data: attList, error: attError } = await supabase
        .from('atendimentos')
        .select('*, responsavel:perfis(nome)')
        .eq('beneficiario_id', id)
        .order('data', { ascending: false })

      if (attError) throw attError
      setAttendances(attList || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBeneficiarioData()
  }, [id])

  const handleAddAtendimento = async (e) => {
    e.preventDefault()
    setSavingAtendimento(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      await insertAtendimento({
        beneficiario_id: id,
        data: newAtendimento.data,
        tipo: newAtendimento.tipo,
        responsavel_id: user.id,
        observacoes: newAtendimento.observacoes
      })

      showToast('Sucesso', 'Atendimento registrado com sucesso!', 'success')
      setNewAtendimento({
        data: new Date().toISOString().split('T')[0],
        tipo: 'Cesta Básica',
        observacoes: ''
      })
      loadBeneficiarioData()
    } catch (err) {
      const mapped = mapSupabaseError(err)
      showToast(mapped.title, mapped.message, 'error')
    } finally {
      setSavingAtendimento(false)
    }
  }

  if (loading && !beneficiario) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-outline">Carregando ficha do beneficiário...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-error-container text-on-error-container rounded-2xl border border-error/20 flex flex-col gap-2">
        <h3 className="font-bold text-sm">Erro ao carregar Ficha do Beneficiário</h3>
        <p className="text-xs">{error}</p>
        <Link to="/beneficiarios" className="mt-2 text-primary font-bold hover:underline text-xs">&larr; Voltar para listagem</Link>
      </div>
    )
  }

  const formatCurrency = (val) => {
    if (!val) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const phoneNum = beneficiario.whatsapp || beneficiario.telefone
  const cleanPhone = phoneNum ? phoneNum.replace(/\D/g, '') : ''
  const hasWhatsApp = cleanPhone.length >= 10

  const tabs = [
    { id: 'dados-pessoais', name: 'Dados Pessoais', icon: 'person' },
    { id: 'contato', name: 'Contato e Endereço', icon: 'location_on' },
    { id: 'familia', name: 'Composição Familiar', icon: 'diversity_3' },
    { id: 'socio', name: 'Sócio-Econômico', icon: 'payments' },
    { id: 'beneficios', name: 'Benefícios', icon: 'volunteer_activism' },
    { id: 'docs', name: 'Documentos', icon: 'description' },
    { id: 'hist', name: 'Histórico & Visitas', icon: 'history' }
  ]

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <nav className="flex items-center text-xs font-semibold text-on-surface-variant gap-1.5">
            <Link className="hover:text-primary transition-colors" to="/beneficiarios">Beneficiários</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Ficha Cadastral</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-surface border border-outline-variant/80 hover:border-primary/50 text-on-surface hover:text-primary rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Imprimir Ficha
          </button>
          <Link to="/beneficiarios" className="px-4 py-2 border border-outline-variant/80 text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs transition-all">
            &larr; Voltar
          </Link>
        </div>
      </div>

      {/* Hero Profile Dossier Card */}
      <div className="rounded-3xl bg-surface border border-outline-variant/80 p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {beneficiario.foto_url ? (
            <img src={beneficiario.foto_url} alt="Profile" className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/20 shadow-xs shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-extrabold text-2xl border-2 border-primary/20 shadow-xs shrink-0">
              {beneficiario.nome ? beneficiario.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'B'}
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-on-surface">{beneficiario.nome}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                beneficiario.status === 'ativo' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                  : 'bg-surface-container text-on-surface-variant border-outline-variant'
              }`}>
                {beneficiario.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-xs text-outline font-medium">
              CPF: <strong className="text-on-surface font-mono">{beneficiario.cpf || 'Não informado'}</strong> | Cadastrado em {new Date(beneficiario.criado_em).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-xs text-on-surface-variant font-medium">
              📍 {beneficiario.rua ? `${beneficiario.rua}${beneficiario.numero ? `, Nº ${beneficiario.numero}` : ''} - ${beneficiario.bairro || ''}, ${beneficiario.cidade || ''}` : 'Endereço não cadastrado'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {hasWhatsApp && (
            <a
              href={`https://wa.me/55${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              WhatsApp
            </a>
          )}
          {phoneNum && (
            <a
              href={`tel:${cleanPhone}`}
              className="px-4 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface hover:bg-surface-container text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              Ligar
            </a>
          )}
        </div>
      </div>

      {/* Alert for Incomplete Profile */}
      {isCadastroIncompleto(beneficiario) && (
        <div className="bg-amber-500/10 border border-amber-300 text-amber-900 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
          <span className="material-symbols-outlined text-amber-700 text-[22px]">warning</span>
          <div className="text-xs font-medium">
            <strong className="font-bold">Cadastro Incompleto:</strong> Este beneficiário possui campos essenciais pendentes. Atualize os dados para manter o prontuário em dia.
          </div>
        </div>
      )}

      {/* Main Dossier Container */}
      <div className="bg-surface rounded-3xl shadow-xs border border-outline-variant/80 overflow-hidden">
        
        {/* Tabs Navigation */}
        <div className="border-b border-surface-variant/80 flex overflow-x-auto bg-surface-container-lowest p-2 gap-1.5 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-primary text-on-primary shadow-2xs' 
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* Tabs Content */}
        <div className="p-6 md:p-8">
          
          {/* DADOS PESSOAIS */}
          {activeTab === 'dados-pessoais' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Nome Completo</span>
                <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.nome}</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">CPF</span>
                <span className="text-xs md:text-sm text-on-surface font-mono font-bold">{beneficiario.cpf || 'Não Informado'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Data de Nascimento</span>
                <span className="text-xs md:text-sm text-on-surface font-bold">
                  {beneficiario.data_nascimento ? new Date(beneficiario.data_nascimento).toLocaleDateString('pt-BR') : 'Não Informado'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Sexo</span>
                <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.sexo || 'Não Informado'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Estado Civil</span>
                <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.estado_civil || 'Não Informado'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Escolaridade</span>
                <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.escolaridade || 'Não Informado'}</span>
              </div>
            </div>
          )}

          {/* CONTATO E ENDEREÇO */}
          {activeTab === 'contato' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Telefone Principal</span>
                  <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.telefone || 'Não Informado'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">WhatsApp</span>
                  <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.whatsapp || 'Não Informado'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">E-mail</span>
                  <span className="text-xs md:text-sm text-on-surface font-bold truncate block">{beneficiario.email || 'Não Informado'}</span>
                </div>
              </div>

              <div className="border-t border-surface-variant/70 pt-6">
                <h4 className="font-bold text-primary text-sm mb-4">Endereço de Residência</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Logradouro</span>
                    <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.rua || '---'} {beneficiario.numero ? `, Nº ${beneficiario.numero}` : ''}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Bairro</span>
                    <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.bairro || '---'}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">CEP</span>
                    <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.cep || '---'}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Cidade / UF</span>
                    <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.cidade || '---'} - {beneficiario.estado || '---'}</span>
                  </div>
                  <div className="md:col-span-2 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Complemento / Ponto de Referência</span>
                    <span className="text-xs md:text-sm text-on-surface font-bold">{beneficiario.complemento || 'Nenhum'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COMPOSIÇÃO FAMILIAR */}
          {activeTab === 'familia' && (
            <div className="space-y-4">
              <h4 className="font-bold text-primary text-sm">Membros da Família ({beneficiario.membros_familia?.length || 0})</h4>
              <div className="overflow-hidden border border-outline-variant/80 rounded-2xl bg-surface">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-surface-variant">
                    <tr>
                      <th className="px-5 py-3">Nome</th>
                      <th className="px-5 py-3">Parentesco</th>
                      <th className="px-5 py-3">Idade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant/70 text-xs font-medium">
                    {!beneficiario.membros_familia || beneficiario.membros_familia.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-5 py-8 text-center text-outline">Não há membros familiares registrados.</td>
                      </tr>
                    ) : (
                      beneficiario.membros_familia.map((m) => (
                        <tr key={m.id} className="hover:bg-surface-container/40">
                          <td className="px-5 py-3 font-bold text-on-surface">{m.nome}</td>
                          <td className="px-5 py-3 text-on-surface-variant">{m.parentesco}</td>
                          <td className="px-5 py-3">{m.idade} anos</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SITUAÇÃO SOCIOECONÔMICA */}
          {activeTab === 'socio' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Renda Familiar Declarada</span>
                <span className="text-xl font-extrabold text-primary">{formatCurrency(beneficiario.renda_familiar)}</span>
              </div>
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Tipo de Habitação</span>
                <span className="text-base font-bold text-on-surface">{beneficiario.tipo_moradia || 'Não informado'}</span>
              </div>
              <div className="md:col-span-2 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Benefícios Sociais do Governo</span>
                <span className="text-xs md:text-sm text-on-surface font-semibold">
                  {beneficiario.outros_beneficios ? `Sim - ${beneficiario.quais_beneficios}` : 'Não recebe benefícios governamentais'}
                </span>
              </div>
              <div className="md:col-span-2 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/50">
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Observações & Diagnóstico Social</span>
                <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">{beneficiario.observacoes || 'Nenhuma observação registrada.'}</p>
              </div>
            </div>
          )}

          {/* BENEFÍCIOS RECEBIDOS */}
          {activeTab === 'beneficios' && (
            <div className="space-y-4">
              <h4 className="font-bold text-primary text-sm">Auxílios Vinculados ao Cadastro</h4>
              <div className="flex flex-wrap gap-2.5">
                {!beneficiario.beneficios_recebidos || beneficiario.beneficios_recebidos.length === 0 ? (
                  <p className="text-xs text-outline">Nenhum auxílio específico registrado no perfil.</p>
                ) : (
                  beneficiario.beneficios_recebidos.map((b) => (
                    <span key={b.id} className="px-4 py-2 bg-primary/10 text-primary border border-primary/25 rounded-2xl font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {b.tipo}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* DOCUMENTOS */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <h4 className="font-bold text-primary text-sm">Documentos e Comprovantes Digitalizados</h4>
              <div className="overflow-hidden border border-outline-variant/80 rounded-2xl bg-surface">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-surface-variant">
                    <tr>
                      <th className="px-5 py-3">Documento</th>
                      <th className="px-5 py-3">Anexado em</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant/70 text-xs font-medium">
                    {!beneficiario.documentos || beneficiario.documentos.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-5 py-8 text-center text-outline">Não há documentos carregados.</td>
                      </tr>
                    ) : (
                      beneficiario.documentos.map((d) => (
                        <tr key={d.id} className="hover:bg-surface-container/40">
                          <td className="px-5 py-3 font-bold text-on-surface">{d.nome}</td>
                          <td className="px-5 py-3 text-on-surface-variant">
                            {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary font-bold hover:underline">
                              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                              Visualizar
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HISTÓRICO DE ATENDIMENTOS */}
          {activeTab === 'hist' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Record Logs list */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="font-bold text-primary text-sm">Histórico de Atendimentos e Visitas</h4>
                
                {attendances.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/50 text-center text-outline text-xs">
                    Nenhum atendimento ou visita registrado anteriormente.
                  </div>
                ) : (
                  <div className="relative border-l-2 border-primary/20 pl-4 space-y-4 ml-2">
                    {attendances.map((att) => (
                      <div key={att.id} className="relative">
                        <span className="absolute -left-[23px] top-1 bg-primary text-on-primary w-4 h-4 rounded-full flex items-center justify-center border-2 border-surface shadow-2xs">
                          <span className="w-1 h-1 bg-on-primary rounded-full"></span>
                        </span>
                        <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/60 shadow-2xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-primary text-xs">{att.tipo}</span>
                            <span className="text-[10px] text-outline font-semibold">{new Date(att.data).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-xs text-on-surface leading-relaxed">{att.observacoes}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium pt-1 border-t border-surface-variant/40">
                            <span className="material-symbols-outlined text-[14px]">account_circle</span>
                            <span>Atendido por: <strong>{att.responsavel?.nome || 'Instituição Pastoral'}</strong></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log new attendance form */}
              <div className="lg:col-span-5">
                <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/70 shadow-xs sticky top-24 space-y-4">
                  <h4 className="font-bold text-primary text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">post_add</span>
                    Registrar Novo Atendimento
                  </h4>
                  <form onSubmit={handleAddAtendimento} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Data do Atendimento</label>
                      <input 
                        type="date" 
                        value={newAtendimento.data} 
                        onChange={(e) => setNewAtendimento(prev => ({ ...prev, data: e.target.value }))}
                        className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs font-semibold focus:border-primary focus:ring-0 outline-none" 
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Tipo de Auxílio</label>
                      <select 
                        value={newAtendimento.tipo} 
                        onChange={(e) => setNewAtendimento(prev => ({ ...prev, tipo: e.target.value }))}
                        className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs font-semibold focus:border-primary focus:ring-0 outline-none"
                      >
                        <option value="Cesta Básica">Cesta Básica</option>
                        <option value="Entrega de Medicamentos">Entrega de Medicamentos</option>
                        <option value="Auxílio Gás">Auxílio Gás</option>
                        <option value="Atendimento Psicológico">Atendimento Psicológico</option>
                        <option value="Visita Domiciliar">Visita Domiciliar</option>
                        <option value="Encaminhamento Social">Encaminhamento Social</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Relatório / Observações</label>
                      <textarea 
                        value={newAtendimento.observacoes} 
                        onChange={(e) => setNewAtendimento(prev => ({ ...prev, observacoes: e.target.value }))}
                        placeholder="Descreva o atendimento prestado à família..."
                        className="w-full border border-outline-variant rounded-xl px-3 py-2 bg-surface text-xs font-medium focus:border-primary focus:ring-0 outline-none h-24" 
                        required 
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={savingAtendimento}
                      className="w-full bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {savingAtendimento ? 'Registrando...' : 'Salvar Atendimento'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
