import { useState, useEffect } from 'react'
import { supabase, fmt, MESES_CURTO } from '../supabase.js'

const ADMIN_EMAILS = ['dore09@gmail.com'] // substitua pelo seu e-mail

export default function Admin({ session, profile }) {
  const [aba, setAba] = useState('visao')
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState(null)
  const [convites, setConvites] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [emailConvite, setEmailConvite] = useState('')
  const [casalConvite, setCasalConvite] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ texto: '', tipo: '' })

  const isAdmin = ADMIN_EMAILS.includes(session.user.email)

  useEffect(() => { if (isAdmin) loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [
        profiles, despesas, receitas, cartoes,
        bancos, metas, investimentos, convitesData
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('despesas').select('id, valor, created_at, casal_code'),
        supabase.from('receitas').select('id, valor, created_at, casal_code'),
        supabase.from('cartoes').select('id, casal_code'),
        supabase.from('contas_banco').select('id, saldo, casal_code'),
        supabase.from('metas').select('id, valor_alvo, valor_atual, casal_code'),
        supabase.from('investimentos').select('id, valor, casal_code'),
        supabase.from('convites').select('*').order('criado_em', { ascending: false }),
      ])

      setUsuarios(profiles.data || [])
      setConvites(convitesData.data || [])

      // Casais únicos
      const casalCodes = [...new Set((profiles.data || []).map(p => p.casal_code).filter(Boolean))]
      const totalDespesas = (despesas.data || []).reduce((s, d) => s + d.valor, 0)
      const totalReceitas = (receitas.data || []).reduce((s, r) => s + r.valor, 0)
      const totalInvestido = (investimentos.data || []).reduce((s, i) => s + i.valor, 0)
      const totalReservas = (bancos.data || []).reduce((s, b) => s + b.saldo, 0)

      // Crescimento por mês (últimos 6)
      const now = new Date()
      const crescimento = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const m = d.getMonth(); const a = d.getFullYear()
        const novosUsuarios = (profiles.data || []).filter(p => {
          const cd = new Date(p.created_at)
          return cd.getMonth() === m && cd.getFullYear() === a
        }).length
        crescimento.push({ mes: MESES_CURTO[m], usuarios: novosUsuarios })
      }

      // Atividade por casal
      const atividadeCasais = casalCodes.map(cc => {
        const membros = (profiles.data || []).filter(p => p.casal_code === cc)
        const despCasal = (despesas.data || []).filter(d => d.casal_code === cc)
        const recCasal = (receitas.data || []).filter(r => r.casal_code === cc)
        const ultimaAtiv = [...despCasal, ...recCasal].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        return {
          casal_code: cc,
          membros: membros.length,
          nomes: membros.map(m => m.nome).join(' & '),
          despesas: despCasal.length,
          receitas: recCasal.length,
          total_lancamentos: despCasal.length + recCasal.length,
          ultima_atividade: ultimaAtiv?.created_at || null,
          criado_em: membros[0]?.created_at,
        }
      }).sort((a, b) => b.total_lancamentos - a.total_lancamentos)

      setDados({
        totalUsuarios: (profiles.data || []).length,
        totalCasais: casalCodes.length,
        totalDespesas, totalReceitas, totalInvestido, totalReservas,
        crescimento, atividadeCasais,
        totalLancamentos: (despesas.data || []).length + (receitas.data || []).length,
        totalCartoes: (cartoes.data || []).length,
        totalMetas: (metas.data || []).length,
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function showMsg(texto, tipo = 'sucesso') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 4000)
  }

  async function enviarConvite(e) {
    e.preventDefault()
    if (!emailConvite) { showMsg('Informe o e-mail', 'erro'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('convites').insert({
        email: emailConvite.toLowerCase().trim(),
        casal_code: casalConvite.toLowerCase().trim() || null,
        convidado_por: session.user.id,
        status: 'pendente',
      })
      if (error) throw error
      showMsg(`✅ Convite registrado para ${emailConvite}!`)
      setEmailConvite(''); setCasalConvite('')
      loadData()
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setSaving(false) }
  }

  async function cancelarConvite(id) {
    await supabase.from('convites').update({ status: 'cancelado' }).eq('id', id)
    loadData()
  }

  async function excluirUsuario(id, nome) {
    if (!confirm(`Excluir o usuário "${nome}"? Esta ação é irreversível.`)) return
    await supabase.from('profiles').delete().eq('id', id)
    showMsg(`Usuário ${nome} removido.`)
    loadData()
  }

  if (!isAdmin) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>Acesso restrito</div>
      <div style={{ color: 'var(--secondary)', fontSize: 13 }}>
        Esta área é exclusiva para administradores do FinançasCasal.
      </div>
    </div>
  )

  if (loading) return <div className="empty">Carregando dados...</div>

  const ABAS = [
    ['visao', '📊 Visão geral'],
    ['casais', '💑 Casais'],
    ['usuarios', '👤 Usuários'],
    ['convites', '✉️ Convites'],
  ]

  return (
    <div>
      {/* Header admin */}
      <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>⚙️ Gestão FinançasCasal</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Admin: {session.user.email}</div>
        </div>
        <button className="btn btn-outline btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={loadData}>
          🔄 Atualizar
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', marginBottom: 20 }}>
        {ABAS.map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: aba === id ? 600 : 400, color: aba === id ? 'var(--primary)' : 'var(--secondary)',
              borderBottom: aba === id ? '2px solid var(--primary)' : '2px solid transparent',
              fontSize: 13, fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Mensagem */}
      {msg.texto && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: msg.tipo === 'sucesso' ? '#E1F5EE' : '#FCEBEB',
          color: msg.tipo === 'sucesso' ? 'var(--green)' : 'var(--red)' }}>
          {msg.texto}
        </div>
      )}

      {/* ── VISÃO GERAL ── */}
      {aba === 'visao' && dados && (
        <div>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <div className="mini-card">
              <div className="lbl">Usuários cadastrados</div>
              <div className="val">{dados.totalUsuarios}</div>
              <div className="sub">{dados.totalCasais} casal(is)</div>
            </div>
            <div className="mini-card">
              <div className="lbl">Total lançamentos</div>
              <div className="val" style={{ color: 'var(--blue)' }}>{dados.totalLancamentos}</div>
              <div className="sub">{dados.totalCartoes} cartão(ões)</div>
            </div>
            <div className="mini-card">
              <div className="lbl">Volume despesas</div>
              <div className="val" style={{ color: 'var(--red)' }}>{fmt(dados.totalDespesas)}</div>
              <div className="sub">acumulado total</div>
            </div>
            <div className="mini-card">
              <div className="lbl">Volume investido</div>
              <div className="val" style={{ color: 'var(--green)' }}>{fmt(dados.totalInvestido)}</div>
              <div className="sub">{dados.totalMetas} meta(s)</div>
            </div>
          </div>

          {/* Crescimento */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Novos usuários por mês</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
              {dados.crescimento.map(m => {
                const max = Math.max(...dados.crescimento.map(x => x.usuarios), 1)
                const h = Math.max(4, (m.usuarios / max) * 64)
                return (
                  <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--primary)' }}>{m.usuarios}</div>
                    <div style={{ width: '100%', height: h, background: 'var(--primary)', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                    <div style={{ fontSize: 10, color: 'var(--secondary)' }}>{m.mes}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top casais por atividade */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Casais mais ativos</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Casal</th><th>Membros</th><th>Lançamentos</th><th>Despesas</th><th>Receitas</th><th>Última atividade</th></tr></thead>
                <tbody>
                  {dados.atividadeCasais.slice(0, 10).map(c => (
                    <tr key={c.casal_code}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.nomes || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--secondary)' }}>{c.casal_code}</div>
                      </td>
                      <td><span className="badge badge-blue">{c.membros}</span></td>
                      <td style={{ fontWeight: 500 }}>{c.total_lancamentos}</td>
                      <td style={{ color: 'var(--red)' }}>{c.despesas}</td>
                      <td style={{ color: 'var(--green)' }}>{c.receitas}</td>
                      <td style={{ fontSize: 12, color: 'var(--secondary)' }}>
                        {c.ultima_atividade ? new Date(c.ultima_atividade).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dados.atividadeCasais.length === 0 && <div className="empty">Nenhum casal ainda</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── CASAIS ── */}
      {aba === 'casais' && dados && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Todos os casais ({dados.atividadeCasais.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Membros</th><th>Lançamentos</th><th>Cadastro</th></tr></thead>
              <tbody>
                {dados.atividadeCasais.map(c => (
                  <tr key={c.casal_code}>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--blue)' }}>{c.casal_code}</div>
                      <div style={{ fontSize: 12, color: 'var(--secondary)' }}>{c.nomes || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge ${c.membros >= 2 ? 'badge-green' : 'badge-yellow'}`}>
                        {c.membros >= 2 ? '💑 Vinculados' : '👤 Solo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.total_lancamentos}</div>
                      <div style={{ fontSize: 11, color: 'var(--secondary)' }}>{c.despesas} desp · {c.receitas} rec</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--secondary)' }}>
                      {c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dados.atividadeCasais.length === 0 && <div className="empty">Nenhum casal ainda</div>}
          </div>
        </div>
      )}

      {/* ── USUÁRIOS ── */}
      {aba === 'usuarios' && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Todos os usuários ({usuarios.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Código casal</th><th>Papel</th><th>Renda</th><th>Telegram</th><th>Cadastro</th><th>Ações</th></tr></thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{u.nome || '—'}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>{u.casal_code || '—'}</td>
                    <td><span className={`badge ${u.papel === 'eu' ? 'badge-blue' : 'badge-red'}`}>{u.papel === 'eu' ? 'EU' : 'ELA'}</span></td>
                    <td style={{ fontSize: 13 }}>{u.renda ? fmt(u.renda) : '—'}</td>
                    <td>
                      {u.telegram_id
                        ? <span className="badge badge-green">✅ Vinculado</span>
                        : <span style={{ fontSize: 12, color: 'var(--secondary)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--secondary)' }}>
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      {u.id !== session.user.id && (
                        <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                          onClick={() => excluirUsuario(u.id, u.nome)}>🗑️</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONVITES ── */}
      {aba === 'convites' && (
        <div>
          {/* Form novo convite */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>✉️ Enviar convite</div>
            <form onSubmit={enviarConvite}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">E-mail do convidado</label>
                  <input className="form-input" type="email" placeholder="email@exemplo.com"
                    value={emailConvite} onChange={e => setEmailConvite(e.target.value)} required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Código do casal (opcional)</label>
                  <input className="form-input" placeholder="Ex: joaoemaria2024"
                    value={casalConvite} onChange={e => setCasalConvite(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 42 }}>
                  {saving ? 'Enviando...' : '+ Convidar'}
                </button>
              </div>
            </form>
            <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
              💡 O convite registra o e-mail no sistema. Envie manualmente um e-mail para a pessoa com o link do app e o código do casal.
            </div>
          </div>

          {/* Lista convites */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Convites enviados ({convites.length})</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>E-mail</th><th>Código casal</th><th>Status</th><th>Criado em</th><th>Expira em</th><th>Ações</th></tr></thead>
                <tbody>
                  {convites.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.email}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>{c.casal_code || '—'}</td>
                      <td>
                        <span className={`badge ${c.status === 'aceito' ? 'badge-green' : c.status === 'pendente' ? 'badge-yellow' : 'badge-red'}`}>
                          {c.status === 'aceito' ? '✅ Aceito' : c.status === 'pendente' ? '⏳ Pendente' : '❌ Cancelado'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--secondary)' }}>
                        {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      </td>
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
              {convites.length === 0 && <div className="empty">Nenhum convite enviado ainda</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
