import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchBeneficiarioById, insertAtendimento } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useFeedback } from '../contexts/FeedbackContext'
import { mapSupabaseError } from '../lib/errorMapper'

export const FichaBeneficiario = () => {
  const { id } = useParams()
  const { showToast } = useFeedback()
  const [beneficiario, setBeneficiario] = useState(null)
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('dados-pessoais') // dados-pessoais, contato, familia, socio, beneficios, docs, hist
  
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

      // Fetch attendances for this beneficiary
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
      // Get current logged-in user profile ID as responsavel
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-error-container text-on-error-container rounded-xl border border-error/20 flex flex-col gap-2">
        <h3 className="font-semibold">Erro ao carregar Ficha do Beneficiário</h3>
        <p className="text-body-sm">{error}</p>
        <Link to="/beneficiarios" className="mt-2 text-primary font-semibold hover:underline">&larr; Voltar para listagem</Link>
      </div>
    )
  }

  const formatCurrency = (val) => {
    if (!val) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <nav className="flex items-center text-on-surface-variant font-label-sm text-label-sm mb-2 space-x-2">
            <Link className="hover:text-primary transition-colors" to="/beneficiarios">Beneficiários</Link>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-on-surface font-semibold">Ficha Detalhada</span>
          </nav>
          <div className="flex items-center gap-4">
            {beneficiario.foto_url ? (
              <img src={beneficiario.foto_url} alt="Profile" className="w-[72px] h-[72px] rounded-full object-cover border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] shrink-0" />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-headline-md border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] shrink-0">
                {beneficiario.nome ? beneficiario.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'B'}
              </div>
            )}
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary font-bold">{beneficiario.nome}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-md text-[11px] font-semibold ${
                beneficiario.status === 'ativo' ? 'bg-primary-container text-on-primary-container' : 'bg-outline-variant/40 text-on-surface-variant'
              }`}>
                {beneficiario.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>
        <Link to="/beneficiarios" className="px-6 py-2.5 border border-outline text-on-surface hover:bg-surface-container rounded-lg font-semibold text-body-sm transition-all active:scale-95">
          Voltar à Listagem
        </Link>
      </div>

      {/* Main Container */}
      <div className="bg-surface rounded-xl shadow-sm border border-surface-variant overflow-hidden">
        {/* Tabs Navigation */}
        <div className="border-b border-surface-variant flex overflow-x-auto bg-surface-bright shrink-0">
          {[
            { id: 'dados-pessoais', name: 'Dados Pessoais' },
            { id: 'contato', name: 'Contato e Endereço' },
            { id: 'familia', name: 'Composição Familiar' },
            { id: 'socio', name: 'Situação Socioeconômica' },
            { id: 'beneficios', name: 'Benefícios Recebidos' },
            { id: 'docs', name: 'Documentos' },
            { id: 'hist', name: 'Histórico' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-4 font-semibold text-body-sm whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id 
                  ? 'border-primary text-primary bg-primary/5 font-bold' 
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Tabs Content */}
        <div className="p-8">
          {/* DADOS PESSOAIS */}
          {activeTab === 'dados-pessoais' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Nome Completo</span>
                <span className="text-body-md text-on-surface font-semibold">{beneficiario.nome}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">CPF</span>
                <span className="text-body-md text-on-surface font-semibold">{beneficiario.cpf || 'Não Informado'}</span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Data de Nascimento</span>
                <span className="text-body-md text-on-surface font-semibold">
                  {beneficiario.data_nascimento ? new Date(beneficiario.data_nascimento).toLocaleDateString('pt-BR') : 'Não Informado'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Sexo</span>
                <span className="text-body-md text-on-surface font-semibold">{beneficiario.sexo || 'Não Informado'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Estado Civil</span>
                <span className="text-body-md text-on-surface font-semibold">{beneficiario.estado_civil || 'Não Informado'}</span>
              </div>
              <div className="md:col-span-2">
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Escolaridade</span>
                <span className="text-body-md text-on-surface font-semibold">{beneficiario.escolaridade || 'Não Informado'}</span>
              </div>
            </div>
          )}

          {/* CONTATO E ENDEREÇO */}
          {activeTab === 'contato' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Telefone</span>
                  <span className="text-body-md text-on-surface font-semibold">{beneficiario.telefone || 'Não Informado'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">WhatsApp</span>
                  <span className="text-body-md text-on-surface font-semibold">{beneficiario.whatsapp || 'Não Informado'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">E-mail</span>
                  <span className="text-body-md text-on-surface font-semibold truncate block">{beneficiario.email || 'Não Informado'}</span>
                </div>
              </div>

              <div className="border-t border-surface-variant/40 pt-6">
                <h4 className="font-semibold text-primary mb-4">Localização do Domicílio</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Rua / Logradouro</span>
                    <span className="text-body-md text-on-surface font-semibold">{beneficiario.rua || '---'} {beneficiario.numero ? `, Nº ${beneficiario.numero}` : ''}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Bairro</span>
                    <span className="text-body-md text-on-surface font-semibold">{beneficiario.bairro || '---'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">CEP</span>
                    <span className="text-body-md text-on-surface font-semibold">{beneficiario.cep || '---'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Cidade / Estado</span>
                    <span className="text-body-md text-on-surface font-semibold">{beneficiario.cidade || '---'} - {beneficiario.estado || '---'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Complemento</span>
                    <span className="text-body-md text-on-surface font-semibold">{beneficiario.complemento || 'Nenhum'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COMPOSIÇÃO FAMILIAR */}
          {activeTab === 'familia' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-primary mb-3">Membros Residentes</h4>
              <div className="overflow-hidden border border-outline-variant rounded-lg bg-surface">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Parentesco</th>
                      <th className="px-4 py-3">Idade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant text-body-sm">
                    {!beneficiario.membros_familia || beneficiario.membros_familia.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-4 text-center text-on-surface-variant">Não há membros familiares registrados.</td>
                      </tr>
                    ) : (
                      beneficiario.membros_familia.map((m) => (
                        <tr key={m.id}>
                          <td className="px-4 py-3 font-semibold text-on-surface">{m.nome}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{m.parentesco}</td>
                          <td className="px-4 py-3">{m.idade} anos</td>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Renda Familiar Mensal</span>
                <span className="text-headline-md font-semibold text-primary">{formatCurrency(beneficiario.renda_familiar)}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Tipo de Habitação</span>
                <span className="text-body-md text-on-surface font-semibold">{beneficiario.tipo_moradia}</span>
              </div>
              <div className="md:col-span-2 border-t border-surface-variant/40 pt-4">
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Outros Benefícios Governamentais</span>
                <span className="text-body-md text-on-surface font-semibold">
                  {beneficiario.outros_beneficios ? `Sim - ${beneficiario.quais_beneficios}` : 'Não recebe'}
                </span>
              </div>
              <div className="md:col-span-2 border-t border-surface-variant/40 pt-4">
                <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Observações Gerais</span>
                <p className="text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{beneficiario.observacoes || 'Nenhuma observação registrada.'}</p>
              </div>
            </div>
          )}

          {/* BENEFÍCIOS RECEBIDOS */}
          {activeTab === 'beneficios' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Histórico de Apoios Ativos</h4>
              <div className="flex flex-wrap gap-3">
                {!beneficiario.beneficios_recebidos || beneficiario.beneficios_recebidos.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">Nenhum auxílio específico registrado no perfil.</p>
                ) : (
                  beneficiario.beneficios_recebidos.map((b) => (
                    <span key={b.id} className="px-4 py-2 bg-primary-container text-on-primary-container border border-primary/20 rounded-full font-semibold text-body-sm">
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
              <h4 className="font-semibold text-primary">Comprovantes e Documentos Anexados</h4>
              <div className="overflow-hidden border border-outline-variant rounded-lg bg-surface">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant border-b border-surface-variant">
                    <tr>
                      <th className="px-4 py-3">Documento</th>
                      <th className="px-4 py-3">Anexado em</th>
                      <th className="px-4 py-3 text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant text-body-sm">
                    {!beneficiario.documentos || beneficiario.documentos.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-4 text-center text-on-surface-variant">Não há documentos carregados.</td>
                      </tr>
                    ) : (
                      beneficiario.documentos.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-3 font-semibold text-on-surface">{d.nome}</td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary font-bold hover:underline">
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
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
              <div className="lg:col-span-7 space-y-6">
                <h4 className="font-semibold text-primary">Acompanhamento e Atendimentos</h4>
                
                {attendances.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant bg-surface-container-low p-6 rounded-xl border border-outline-variant/30 text-center">Nenhum atendimento registrado anteriormente.</p>
                ) : (
                  <div className="relative border-l-2 border-primary/20 pl-4 space-y-6 ml-2">
                    {attendances.map((att) => (
                      <div key={att.id} className="relative">
                        <span className="absolute -left-[23px] top-1 bg-primary text-on-primary w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-surface">
                          <span className="w-1.5 h-1.5 bg-on-primary rounded-full"></span>
                        </span>
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/40 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-primary text-body-sm">{att.tipo}</span>
                            <span className="text-xs text-outline font-medium">{new Date(att.data).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-body-sm text-on-surface leading-relaxed mb-3">{att.observacoes}</p>
                          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                            <span className="material-symbols-outlined text-[16px]">account_circle</span>
                            <span>Responsável: <strong>{att.responsavel?.nome || 'Instituição'}</strong></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log new attendance form */}
              <div className="lg:col-span-5">
                <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/60 shadow-sm sticky top-24">
                  <h4 className="font-semibold text-primary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">post_add</span>
                    Registrar Atendimento
                  </h4>
                  <form onSubmit={handleAddAtendimento} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Data do Atendimento</label>
                      <input 
                        type="date" 
                        value={newAtendimento.data} 
                        onChange={(e) => setNewAtendimento(prev => ({ ...prev, data: e.target.value }))}
                        className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none" 
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Tipo de Auxílio / Serviço</label>
                      <select 
                        value={newAtendimento.tipo} 
                        onChange={(e) => setNewAtendimento(prev => ({ ...prev, tipo: e.target.value }))}
                        className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none"
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
                      <label className="block text-xs font-semibold mb-1 text-on-surface-variant">Observações / Relatório</label>
                      <textarea 
                        value={newAtendimento.observacoes} 
                        onChange={(e) => setNewAtendimento(prev => ({ ...prev, observacoes: e.target.value }))}
                        placeholder="Relatório detalhado do atendimento..."
                        className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-body-sm focus:border-primary focus:ring-0 outline-none h-28" 
                        required 
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={savingAtendimento}
                      className="w-full bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container py-3 rounded-lg font-semibold text-body-sm shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
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
