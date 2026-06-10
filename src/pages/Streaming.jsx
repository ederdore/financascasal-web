import { useState, useEffect } from 'react'
import { supabase, fmt, MESES_CURTO } from '../supabase.js'

export default function Streaming({ session, profile }) {
  const [recorrencias, setRecorrencias] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [historico, setHistorico] = useState([]) // lançamentos já feitos este mês
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [cartaoNome, setCartaoNome] = useState('')
  const [dia, setDia] = useState('1')
  const [cat, setCat] = useState('Assinaturas')
  const [quem, setQuem] = useState(profile.papel)
  const [ativa, setAtiva] = useState(true)
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [r, c, d] = await Promise.all([
      cf(supabase.from('recorrencias_cartao').select('*')).order('nome'),
      cf(supabase.from('cartoes').select('*')),
      // Despesas deste mês para saber quais já foram lançadas
      cf(supabase.from('despesas').select('nome,cartao_id,valor'))
        .eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
    ])
    if (r.data) setRecorrencias(r.data)
    if (c.data) {
      setCartoes(c.data)
      if (c.data.length > 0 && !cartaoId) {
        setCartaoId(c.data[0].id)
        setCartaoNome(c.data[0].nome)
      }
    }
    if (d.data) setHistorico(d.data)
    setLoading(false)
  }

  // Verifica se uma recorrência já foi lançada este mês
  function jaLancada(rec) {
    return historico.some(d =>
      d.cartao_id === rec.cartao_id &&
      d.nome === rec.nome &&
      Math.abs(d.valor - rec.valor) < 0.01
    )
  }

  // Verifica se hoje é o dia de lançar (dentro de 3 dias de tolerância)
  function deveSerLancadaHoje(rec) {
    const hoje = now.getDate()
    const diaRec = rec.dia_cobranca
    return hoje >= diaRec && hoje <= diaRec + 3
  }

  function openModal(r = null) {
    setEdit(r); setNome(r?.nome || ''); setValor(r ? String(r.valor) : '')
    setCartaoId(r?.cartao_id || cartoes[0]?.id || '')
    setCartaoNome(r?.cartao_nome || cartoes[0]?.nome || '')
    setDia(r ? String(r.dia_cobranca) : '1')
    setCat(r?.categoria || 'Assinaturas')
    setQuem(r?.quem || profile.papel); setAtiva(r?.ativa !== false); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      user_id: session.user.id, casal_code: profile.casal_code || session.user.id,
      nome, valor: parseFloat(valor), cartao_id: cartaoId || null,
      cartao_nome: cartaoNome, dia_cobranca: parseInt(dia) || 1,
      categoria: cat, quem, ativa,
    }
    try {
      let result
      if (edit) result = await supabase.from('recorrencias_cartao').update(payload).eq('id', edit.id)
      else result = await supabase.from('recorrencias_cartao').insert(payload)
      if (result.error) throw result.error
      setModal(false); loadData()
    } catch (e) { alert('Erro: ' + e.message) } finally { setSaving(false) }
  }

  async function lancar(rec) {
    const cartao = cartoes.find(c => c.id === rec.cartao_id)
    if (!confirm(`Lançar ${rec.nome} (${fmt(rec.valor)}) na fatura do ${rec.cartao_nome}?`)) return
    setSaving(true)
    try {
      const cc = profile.casal_code || session.user.id
      // Lança a despesa
      const { error: e1 } = await supabase.from('despesas').insert({
        user_id: session.user.id, casal_code: cc,
        nome: rec.nome, valor: rec.valor, categoria: rec.categoria,
        quem: rec.quem, tipo: 'recorrente',
        pagamento_tipo: 'cartao', cartao_id: rec.cartao_id, cartao_nome: rec.cartao_nome,
        mes: now.getMonth(), ano: now.getFullYear(),
      })
      if (e1) throw e1
      // Atualiza fatura do cartão
      if (cartao) {
        const { error: e2 } = await supabase.from('cartoes')
          .update({ fatura: (cartao.fatura || 0) + rec.valor }).eq('id', rec.cartao_id)
        if (e2) throw e2
      }
      loadData()
    } catch (e) { alert('Erro: ' + e.message) } finally { setSaving(false) }
  }

  async function lancarTodas() {
    const pendentes = recorrencias.filter(r => r.ativa && !jaLancada(r))
    if (pendentes.length === 0) { alert('Todas as assinaturas já foram lançadas este mês!'); return }
    if (!confirm(`Lançar ${pendentes.length} assinatura(s) pendente(s) nas faturas?`)) return
    setSaving(true)
    try {
      const cc = profile.casal_code || session.user.id
      for (const rec of pendentes) {
        const cartao = cartoes.find(c => c.id === rec.cartao_id)
        await supabase.from('despesas').insert({
          user_id: session.user.id, casal_code: cc,
          nome: rec.nome, valor: rec.valor, categoria: rec.categoria,
          quem: rec.quem, tipo: 'recorrente',
          pagamento_tipo: 'cartao', cartao_id: rec.cartao_id, cartao_nome: rec.cartao_nome,
          mes: now.getMonth(), ano: now.getFullYear(),
        })
        if (cartao) {
          await supabase.from('cartoes')
            .update({ fatura: (cartao.fatura || 0) + rec.valor }).eq('id', rec.cartao_id)
        }
      }
      loadData()
      alert(`✅ ${pendentes.length} assinatura(s) lançada(s) com sucesso!`)
    } catch (e) { alert('Erro: ' + e.message) } finally { setSaving(false) }
  }

  const ativas = recorrencias.filter(r => r.ativa)
  const totalMes = ativas.reduce((s, r) => s + r.valor, 0)
  const pendentes = ativas.filter(r => !jaLancada(r))
  const lancadasMes = ativas.filter(r => jaLancada(r))
  const paraLancarHoje = pendentes.filter(r => deveSerLancadaHoje(r))

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      {/* Header */}
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--blue)' }}>{fmt(totalMes)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
            Total/mês · Anual: {fmt(totalMes * 12)} · {ativas.length} ativa(s)
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {pendentes.length > 0 && (
            <button className="btn btn-green" onClick={lancarTodas} disabled={saving}>
              ▶ Lançar todas ({pendentes.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openModal()}>+ Nova assinatura</button>
        </div>
      </div>

      {/* Alerta — para lançar hoje */}
      {paraLancarHoje.length > 0 && (
        <div style={{ background: '#EEF6FF', border: '0.5px solid var(--blue)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--blue)', marginBottom: 8 }}>
            📅 {paraLancarHoje.length} assinatura(s) vencem hoje ou nos próximos dias
          </div>
          {paraLancarHoje.map(r => (
            <div key={r.id} className="row-between" style={{ padding: '6px 0', borderTop: '0.5px solid #BDD7F5' }}>
              <div>
                <span style={{ fontWeight: 500 }}>📺 {r.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--secondary)', marginLeft: 8 }}>dia {r.dia_cobranca} · {r.cartao_nome}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmt(r.valor)}</span>
                <button className="btn btn-green btn-sm" onClick={() => lancar(r)} disabled={saving}>▶ Lançar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mini cards */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="mini-card">
          <div className="lbl">Lançadas este mês</div>
          <div className="val" style={{ color: 'var(--green)' }}>{lancadasMes.length}</div>
          <div className="sub">{fmt(lancadasMes.reduce((s, r) => s + r.valor, 0))}</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Pendentes</div>
          <div className="val" style={{ color: pendentes.length > 0 ? 'var(--yellow)' : 'var(--green)' }}>{pendentes.length}</div>
          <div className="sub">{fmt(pendentes.reduce((s, r) => s + r.valor, 0))}</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Total anual</div>
          <div className="val">{fmt(totalMes * 12)}</div>
          <div className="sub">{ativas.length} serviço(s)</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Serviço</th><th>Cartão</th><th>Dia</th><th>Quem</th><th>Valor</th><th>Este mês</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {recorrencias.map(r => {
                const lancada = jaLancada(r)
                return (
                  <tr key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 500 }}>📺 {r.nome}</td>
                    <td style={{ fontSize: 12 }}>{r.cartao_nome || '—'}</td>
                    <td style={{ fontSize: 12 }}>Dia {r.dia_cobranca}</td>
                    <td>
                      <span className={`badge ${r.quem === 'eu' ? 'badge-blue' : r.quem === 'ela' ? 'badge-red' : 'badge-yellow'}`}>
                        {r.quem === 'casal' ? 'Casal' : r.quem === 'eu' ? 'EU' : 'ELA'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--blue)', fontWeight: 500 }}>{fmt(r.valor)}/mês</td>
                    <td>
                      {r.ativa && (
                        lancada
                          ? <span className="badge badge-green">✅ Lançada</span>
                          : <span className="badge badge-yellow">⏳ Pendente</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${r.ativa ? 'badge-green' : 'badge-yellow'}`}>
                        {r.ativa ? 'Ativa' : 'Pausada'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {r.ativa && !lancada && (
                          <button className="btn btn-green btn-sm" onClick={() => lancar(r)} disabled={saving}>▶</button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => openModal(r)}>✏️</button>
                        <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                          onClick={async () => { if (confirm('Excluir?')) { await supabase.from('recorrencias_cartao').delete().eq('id', r.id); loadData() } }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {recorrencias.length === 0 && <div className="empty">Nenhuma assinatura cadastrada</div>}
        </div>
      </div>

      {/* Resumo por cartão */}
      {recorrencias.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Resumo por cartão</div>
          {cartoes.filter(c => recorrencias.some(r => r.cartao_id === c.id && r.ativa)).map(c => {
            const recs = recorrencias.filter(r => r.cartao_id === c.id && r.ativa)
            const total = recs.reduce((s, r) => s + r.valor, 0)
            return (
              <div key={c.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '0.5px solid var(--border)' }}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>💳 {c.nome}</span>
                  <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmt(total)}/mês</span>
                </div>
                {recs.map(r => (
                  <div key={r.id} className="row-between" style={{ fontSize: 12, color: 'var(--secondary)', paddingLeft: 8 }}>
                    <span>{r.nome}</span>
                    <span>{fmt(r.valor)}</span>
                  </div>
                ))}
              </div>
            )
          })}
          <div className="row-between" style={{ fontWeight: 600 }}>
            <span>Total mensal</span>
            <span style={{ color: 'var(--blue)', fontSize: 16 }}>{fmt(totalMes)}</span>
          </div>
          <div className="row-between" style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>
            <span>Total anual</span>
            <span>{fmt(totalMes * 12)}</span>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar assinatura' : '📺 Nova assinatura'}</h3>
            <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--blue)' }}>
              💡 A assinatura será lançada automaticamente na fatura do cartão no dia configurado
            </div>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Nome do serviço</label>
                <input className="form-input" placeholder="Ex: Netflix, Spotify, Disney+..." value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Valor mensal (R$)</label>
                <input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Cartão de cobrança</label>
                <select className="form-select" value={cartaoId} onChange={e => { setCartaoId(e.target.value); setCartaoNome(cartoes.find(c => c.id === e.target.value)?.nome || '') }}>
                  {cartoes.length === 0 && <option value="">Nenhum cartão cadastrado</option>}
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome} (livre: {fmt(Math.max(0, c.limite - (c.fatura||0) - (c.limite_bloqueado||0)))})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Dia da cobrança</label>
                  <input className="form-input" type="number" min="1" max="31" value={dia} onChange={e => setDia(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pago por quem?</label>
                  <select className="form-select" value={quem} onChange={e => setQuem(e.target.value)}>
                    <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={ativa ? 'sim' : 'nao'} onChange={e => setAtiva(e.target.value === 'sim')}>
                  <option value="sim">✅ Ativa</option>
                  <option value="nao">⏸ Pausada</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
