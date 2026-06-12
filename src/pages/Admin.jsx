import { useState, useEffect } from 'react'
import { supabase, MESES_CURTO } from '../supabase.js'

const ADMIN_EMAILS = ['dore09@gmail.com']

const PLANO_CORES = {
  free:    { bg: '#F1EFE8', color: '#444441', label: 'Free' },
  trial:   { bg: '#EEF6FF', color: '#0C447C', label: 'Trial' },
  premium: { bg: '#E1F5EE', color: '#085041', label: 'Premium' },
}
const STATUS_CORES = {
  ativo:     { bg: '#E1F5EE', color: '#085041' },
  cancelado: { bg: '#FCEBEB', color: '#791F1F' },
  expirado:  { bg: '#FAEEDA', color: '#633806' },
}

export default function Admin({ session }) {
  const [aba, setAba] = useState('visao')
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState(null)
  const [assinaturas, setAssinaturas] = useState([])
  const [convites, setConvites] = useState([])
  const [emailConvite, setEmailConvite] = useState('')
  const [casalConvite, setCasalConvite] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const [filtroPlano, setFiltroPlano] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalPlano, setModalPlano] = useState(null) // { assinatura, novoPlano }

  const isAdmin = ADMIN_EMAILS.includes(session.user.email)

  useEffect(() => { if (isAdmin) loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const now = new Date()

      const [assData, convData, profilesData] = await Promise.all([
        supabase.from('assinaturas').select('*, profiles(nome, created_at, telegram_id, casal_code)').order('created_at', { ascending: false }),
        supabase.from('convites').select('*').order('criado_em', { ascending: false }),
        supabase.from('profiles').select('id, created_at, casal_code'),
      ])

      const ass = assData.data || []
      setAssinaturas(ass)
      setConvites(convData.data || [])

      // Métricas de negócio — sem dados financeiros pessoais
      const total = ass.length
      const porPlano = {
        free:    ass.filter(a => a.plano === 'free').length,
        trial:   ass.filter(a => a.plano === 'trial' && a.status === 'ativo').length,
        premium: ass.filter(a => a.plano === 'premium' && a.status === 'ativo').length,
      }
      const cancelados = ass.filter(a => a.status === 'cancelado').length
      const mrrEstimado = porPlano.premium * 24

      // Churn rate (cancelados / total)
      const churnRate = total > 0 ? ((cancelados / total) * 100).toFixed(1) : 0

      // Trials expirando em 7 dias
      const em7dias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const trialsExpirando = ass.filter(a =>
        a.plano === 'trial' && a.status === 'ativo' &&
        a.trial_fim && new Date(a.trial_fim) <= em7dias
      ).length

      // Casais com 2 membros vinculados
      const casalCodes = (profilesData.data || []).map(p => p.casal_code).filter(Boolean)
      const casaisCount = {}
      casalCodes.forEach(c => { casaisCount[c] = (casaisCount[c] || 0) + 1 })
      const casaisVinculados = Object.values(casaisCount).filter(v => v >= 2).length
      const casaisSolo = Object.values(casaisCount).filter(v => v === 1).length

      // Crescimento de contas por mês (últimos 6)
      const crescimento = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const m = d.getMonth(); const a = d.getFullYear()
        const novos = ass.filter(x => {
          const cd = new Date(x.created_at)
          return cd.getMonth() === m && cd.getFullYear() === a
        }).length
        const premium = ass.filter(x => {
          if (x.plano !== 'premium' || !x.pagamento_inicio) return false
          const pi = new Date(x.pagamento_inicio)
          return pi.getMonth() === m && pi.getFullYear() === a
        }).length
        crescimento.push({ mes: MESES_CURTO[m], novos, premium })
      }

      // Tempo médio free → premium (dias)
      const conversoes = ass.filter(a => a.plano === 'premium' && a.pagamento_inicio && a.created_at)
      const tempoMedioConversao = conversoes.length > 0
        ? Math.round(conversoes.reduce((s, a) => s + (new Date(a.pagamento_inicio) - new Date(a.created_at)) / (1000 * 60 * 60 * 24), 0) / conversoes.length)
        : null

      setMetricas({ total, porPlano, cancelados, mrrEstimado, churnRate, trialsExpirando, casaisVinculados, casaisSolo, crescimento, tempoMedioConversao })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function showMsg(texto, tipo = 'sucesso') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 4000)
  }

  async function enviarConvite(e) {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('convites').insert({
        email: emailConvite.toLowerCase().trim(),
        casal_code: casalConvite.toLowerCase().trim() || null,
        convidado_por: session.user.id, status: 'pendente',
      })
      if (error) throw error
      showMsg(`✅ Convite registrado para ${emailConvite}`)
      setEmailConvite(''); setCasalConvite(''); loadData()
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setSaving(false) }
  }

  async function alterarPlano(ass, novoPlano) {
    setSaving(true)
    try {
      const updates = {
        plano: novoPlano,
        status: 'ativo',
        updated_at: new Date(),
      }
      if (novoPlano === 'trial') {
        updates.trial_inicio = new Date()
        updates.trial_fim = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
      if (novoPlano === 'premium') {
        updates.pagamento_inicio = new Date()
        updates.pagamento_fim = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        updates.valor_pago = 24
      }
      const { error } = await supabase.from('assinaturas').update(updates).eq('id', ass.id)
      if (error) throw error
      showMsg(`✅ Plano alterado para ${novoPlano}`)
      setModalPlano(null); loadData()
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setSaving(false) }
  }

  async function cancelarAssinatura(id) {
    if (!confirm('Cancelar esta assinatura?')) return
    await supabase.from('assinaturas').update({ status: 'cancelado', cancelado_em: new Date() }).eq('id', id)
    showMsg('Assinatura cancelada.')
    loadData()
  }

  async function cancelarConvite(id) {
    await supabase.from('convites').update({ status: 'cancelado' }).eq('id', id)
    loadData()
  }

  async function resetarConta(ass) {
    const nome = ass.profiles?.nome || 'usuário'
    const confirmacao = prompt(`Para resetar a conta de "${nome}", digite RESETAR:`)
    if (confirmacao !== 'RESETAR') { showMsg('Cancelado — texto incorreto.', 'erro'); return }
    setSaving(true)
    try {
      const uid  = ass.user_id
      const cc   = ass.casal_code || ass.profiles?.casal_code

      // Apaga todos os dados financeiros do casal
      const tabelas = [
        'aportes_metas', 'metas',
        'aportes_reserva', 'reserva',
        'parcelas', 'recorrencias_cartao', 'lancamentos_recorrentes',
        'historico_faturas', 'cartoes',
        'extrato_banco', 'contas_banco',
        'pagamentos_contas', 'contas_fixas', 'contas_variaveis',
        'investimentos', 'notificacoes',
        'despesas', 'receitas', 'receitas_recorrentes',
        'conquistas', 'perguntas_mensais', 'ia_memoria',
      ]

      for (const tabela of tabelas) {
        if (cc) {
          await supabase.from(tabela).delete().eq('casal_code', cc)
        } else {
          await supabase.from(tabela).delete().eq('user_id', uid)
        }
      }

      // Reseta assinatura para free
      await supabase.from('assinaturas').update({
        plano: 'free', status: 'ativo',
        trial_inicio: null, trial_fim: null,
        pagamento_inicio: null, pagamento_fim: null,
        valor_pago: 0, updated_at: new Date(),
      }).eq('id', ass.id)

      // Registra no audit log
      await supabase.from('audit_logs').insert({
        user_id: uid, acao: 'reset_conta_admin',
        detalhes: JSON.stringify({ resetado_por: session.user.email, casal_code: cc }),
        origem: 'admin',
      })

      showMsg(`✅ Conta de "${nome}" resetada com sucesso! Todos os dados financeiros foram apagados.`)
      loadData()
    } catch (e) { showMsg('Erro ao resetar: ' + e.message, 'erro') }
    finally { setSaving(false) }
  }

  if (!isAdmin) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>Acesso restrito</div>
      <div style={{ color: 'var(--secondary)', fontSize: 13 }}>Área exclusiva para administradores.</div>
    </div>
  )

  if (loading) return <div className="empty">Carregando métricas...</div>

  const assFiltradas = assinaturas
    .filter(a => !filtroPlano || a.plano === filtroPlano)
    .filter(a => !filtroStatus || a.status === filtroStatus)

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>🛠️ FinançasCasal — Gestão SaaS</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Dados de negócio · sem acesso a dados financeiros dos usuários</div>
        </div>
        <button className="btn btn-outline btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={loadData}>🔄 Atualizar</button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', marginBottom: 20 }}>
        {[['visao','📊 Visão geral'],['assinaturas','💳 Assinaturas'],['convites','✉️ Convites']].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: aba === id ? 600 : 400, color: aba === id ? 'var(--primary)' : 'var(--secondary)',
              borderBottom: aba === id ? '2px solid var(--primary)' : '2px solid transparent', fontSize: 13 }}>
            {label}
          </button>
        ))}
      </div>

      {msg.texto && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: msg.tipo === 'sucesso' ? '#E1F5EE' : '#FCEBEB',
          color: msg.tipo === 'sucesso' ? 'var(--green)' : 'var(--red)' }}>
          {msg.texto}
        </div>
      )}

      {/* ── VISÃO GERAL ── */}
      {aba === 'visao' && metricas && (
        <div>
          {/* KPIs principais */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <div className="mini-card">
              <div className="lbl">MRR estimado</div>
              <div className="val" style={{ color: 'var(--green)' }}>R$ {metricas.mrrEstimado}</div>
              <div className="sub">{metricas.porPlano.premium} premium × R$24</div>
            </div>
            <div className="mini-card">
              <div className="lbl">Contas ativas</div>
              <div className="val">{metricas.total}</div>
              <div className="sub">{metricas.casaisVinculados} casais vinculados · {metricas.casaisSolo} solo</div>
            </div>
            <div className="mini-card">
              <div className="lbl">Churn rate</div>
              <div className="val" style={{ color: parseFloat(metricas.churnRate) > 10 ? 'var(--red)' : 'var(--green)' }}>
                {metricas.churnRate}%
              </div>
              <div className="sub">{metricas.cancelados} cancelamento(s)</div>
            </div>
            <div className="mini-card">
              <div className="lbl">Trials expirando</div>
              <div className="val" style={{ color: metricas.trialsExpirando > 0 ? 'var(--yellow)' : 'var(--green)' }}>
                {metricas.trialsExpirando}
              </div>
              <div className="sub">nos próximos 7 dias</div>
            </div>
          </div>

          {/* Distribuição por plano */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 16 }}>Distribuição por plano</div>
              {Object.entries(metricas.porPlano).map(([plano, qtd]) => {
                const pct = metricas.total > 0 ? (qtd / metricas.total) * 100 : 0
                const c = PLANO_CORES[plano]
                return (
                  <div key={plano} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{c.label}</span>
                        <span style={{ color: 'var(--secondary)' }}>{qtd} conta(s)</span>
                      </div>
                      <span style={{ fontWeight: 500 }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: c.color, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
              {metricas.tempoMedioConversao !== null && (
                <div style={{ marginTop: 16, padding: '10px 12px', background: '#E1F5EE', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
                  ⚡ Tempo médio free → premium: <strong>{metricas.tempoMedioConversao} dias</strong>
                </div>
              )}
            </div>

            {/* Crescimento mensal */}
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 16 }}>Novas contas por mês</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 90, marginBottom: 8 }}>
                {metricas.crescimento.map(m => {
                  const max = Math.max(...metricas.crescimento.map(x => x.novos), 1)
                  const h = Math.max(4, (m.novos / max) * 70)
                  return (
                    <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--primary)' }}>{m.novos}</div>
                      <div style={{ width: '100%', height: h, borderRadius: '3px 3px 0 0', background: m.premium > 0 ? 'var(--green)' : 'var(--border)', position: 'relative' }}>
                        {m.premium > 0 && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(3, (m.premium / m.novos) * h), background: '#085041', borderRadius: '3px 3px 0 0' }} />
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--secondary)' }}>{m.mes}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--border)' }} /> Novas contas</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#085041' }} /> Converteram para premium</span>
              </div>
            </div>
          </div>

          {/* Alertas */}
          {metricas.trialsExpirando > 0 && (
            <div style={{ background: '#FFF3CD', border: '0.5px solid var(--yellow)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: 'var(--yellow)', marginBottom: 4 }}>
                ⚠️ {metricas.trialsExpirando} trial(s) expirando nos próximos 7 dias
              </div>
              <div style={{ fontSize: 13, color: 'var(--secondary)' }}>
                Considere enviar um e-mail de conversão para esses usuários.
              </div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setAba('assinaturas')}>
                Ver trials →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ASSINATURAS ── */}
      {aba === 'assinaturas' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 'auto' }} value={filtroPlano} onChange={e => setFiltroPlano(e.target.value)}>
              <option value="">Todos os planos</option>
              <option value="free">Free</option>
              <option value="trial">Trial</option>
              <option value="premium">Premium</option>
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="cancelado">Cancelado</option>
              <option value="expirado">Expirado</option>
            </select>
            {(filtroPlano || filtroStatus) && (
              <button className="btn btn-outline btn-sm" onClick={() => { setFiltroPlano(''); setFiltroStatus('') }}>✕ Limpar</button>
            )}
            <span style={{ fontSize: 13, color: 'var(--secondary)', display: 'flex', alignItems: 'center' }}>
              {assFiltradas.length} resultado(s)
            </span>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Usuário</th><th>Código casal</th><th>Plano</th><th>Status</th><th>Trial até</th><th>Premium até</th><th>Telegram</th><th>Membro desde</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {assFiltradas.map(a => {
                    const p = a.profiles || {}
                    const pc = PLANO_CORES[a.plano] || PLANO_CORES.free
                    const sc = STATUS_CORES[a.status] || STATUS_CORES.ativo
                    const trialExpirando = a.plano === 'trial' && a.trial_fim && new Date(a.trial_fim) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    return (
                      <tr key={a.id} style={{ background: trialExpirando ? '#FFFDF0' : 'transparent' }}>
                        <td style={{ fontWeight: 500 }}>{p.nome || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>{a.casal_code || p.casal_code || '—'}</td>
                        <td><span style={{ background: pc.bg, color: pc.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{pc.label}</span></td>
                        <td><span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{a.status}</span></td>
                        <td style={{ fontSize: 12, color: trialExpirando ? 'var(--red)' : 'var(--secondary)' }}>
                          {a.trial_fim ? new Date(a.trial_fim).toLocaleDateString('pt-BR') : '—'}
                          {trialExpirando && ' ⚠️'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--secondary)' }}>
                          {a.pagamento_fim ? new Date(a.pagamento_fim).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td>
                          {p.telegram_id
                            ? <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 6px', borderRadius: 4 }}>✅</span>
                            : <span style={{ color: 'var(--secondary)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--secondary)' }}>
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                              value={a.plano}
                              onChange={e => { if (e.target.value !== a.plano) setModalPlano({ ass: a, novoPlano: e.target.value }) }}>
                              <option value="free">Free</option>
                              <option value="trial">Trial</option>
                              <option value="premium">Premium</option>
                            </select>
                            {a.status === 'ativo' && a.plano === 'premium' && (
                              <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                                onClick={() => cancelarAssinatura(a.id)}>✕</button>
                            )}
                            <button className="btn btn-sm" style={{ background: '#FFF3CD', color: '#7A4F00' }}
                              title="Apagar todos os dados financeiros desta conta"
                              onClick={() => resetarConta(a)}>
                              🗑️ Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {assFiltradas.length === 0 && <div className="empty">Nenhuma assinatura encontrada</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── CONVITES ── */}
      {aba === 'convites' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>✉️ Registrar convite</div>
            <form onSubmit={enviarConvite}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">E-mail</label>
                  <input className="form-input" type="email" placeholder="email@exemplo.com" value={emailConvite} onChange={e => setEmailConvite(e.target.value)} required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Código do casal (opcional)</label>
                  <input className="form-input" placeholder="Ex: joaoemaria2024" value={casalConvite} onChange={e => setCasalConvite(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 42 }}>
                  {saving ? '...' : '+ Convidar'}
                </button>
              </div>
            </form>
            <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
              💡 Registra o e-mail no sistema. Envie manualmente o link do app com o código do casal para a pessoa.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Convites ({convites.length})</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>E-mail</th><th>Código casal</th><th>Status</th><th>Criado em</th><th>Expira em</th><th>Ações</th></tr></thead>
                <tbody>
                  {convites.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.email}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>{c.casal_code || '—'}</td>
                      <td>
                        <span style={{
                          background: c.status === 'aceito' ? '#E1F5EE' : c.status === 'pendente' ? '#EEF6FF' : '#FCEBEB',
                          color: c.status === 'aceito' ? '#085041' : c.status === 'pendente' ? '#0C447C' : '#791F1F',
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600
                        }}>
                          {c.status === 'aceito' ? '✅ Aceito' : c.status === 'pendente' ? '⏳ Pendente' : '❌ Cancelado'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--secondary)' }}>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontSize: 12, color: new Date(c.expira_em) < new Date() ? 'var(--red)' : 'var(--secondary)' }}>
                        {c.expira_em ? new Date(c.expira_em).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td>
                        {c.status === 'pendente' && (
                          <button className="btn btn-outline btn-sm" onClick={() => cancelarConvite(c.id)}>Cancelar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {convites.length === 0 && <div className="empty">Nenhum convite ainda</div>}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar alteração de plano */}
      {modalPlano && (
        <div className="modal-overlay" onClick={() => setModalPlano(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Alterar plano</h3>
            <div style={{ fontSize: 14, color: 'var(--secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Alterar <strong>{modalPlano.ass.profiles?.nome || 'usuário'}</strong> de{' '}
              <strong>{modalPlano.ass.plano}</strong> para <strong>{modalPlano.novoPlano}</strong>?
              {modalPlano.novoPlano === 'trial' && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--blue)' }}>⏳ Trial de 14 dias será iniciado agora.</div>}
              {modalPlano.novoPlano === 'premium' && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--green)' }}>✅ Acesso premium por 30 dias será liberado.</div>}
              {modalPlano.novoPlano === 'free' && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--yellow)' }}>⚠️ Acesso será rebaixado para o plano gratuito.</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModalPlano(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => alterarPlano(modalPlano.ass, modalPlano.novoPlano)} disabled={saving}>
                {saving ? 'Alterando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
