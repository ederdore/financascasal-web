import { useState, useEffect } from 'react'
import { supabase, fmt } from '../supabase.js'

export default function Streaming({ session, profile }) {
  const [recorrencias, setRecorrencias] = useState([])
  const [cartoes, setCartoes] = useState([])
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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [r, c] = await Promise.all([
      cf(supabase.from('recorrencias_cartao').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('cartoes').select('*')),
    ])
    if (r.data) setRecorrencias(r.data)
    if (c.data) { setCartoes(c.data); if (c.data.length > 0) setCartaoId(c.data[0].id) }
    setLoading(false)
  }

  function openModal(r = null) {
    setEdit(r); setNome(r?.nome || ''); setValor(r ? String(r.valor) : '')
    setCartaoId(r?.cartao_id || cartoes[0]?.id || '')
    setCartaoNome(r?.cartao_nome || cartoes[0]?.nome || '')
    setDia(r ? String(r.dia_cobranca) : '1'); setCat(r?.categoria || 'Assinaturas')
    setQuem(r?.quem || profile.papel); setAtiva(r?.ativa !== false); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const payload = { user_id: session.user.id, casal_code: profile.casal_code || session.user.id, nome, valor: parseFloat(valor), cartao_id: cartaoId || null, cartao_nome: cartaoNome, dia_cobranca: parseInt(dia) || 1, categoria: cat, quem, ativa }
    try {
      if (edit) await supabase.from('recorrencias_cartao').update(payload).eq('id', edit.id)
      else await supabase.from('recorrencias_cartao').insert(payload)
      setModal(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta assinatura?')) return
    await supabase.from('recorrencias_cartao').delete().eq('id', id); loadData()
  }

  async function lancar(r) {
    if (!confirm(`Lançar ${fmt(r.valor)} de ${r.nome} na fatura do ${r.cartao_nome}?`)) return
    const now = new Date()
    const cartao = cartoes.find(c => c.id === r.cartao_id)
    await supabase.from('despesas').insert({ user_id: session.user.id, casal_code: profile.casal_code, nome: r.nome, valor: r.valor, categoria: r.categoria, quem: r.quem, tipo: 'fixa', pagamento_tipo: 'cartao', cartao_id: r.cartao_id, cartao_nome: r.cartao_nome, mes: now.getMonth(), ano: now.getFullYear() })
    if (cartao) await supabase.from('cartoes').update({ fatura: (cartao.fatura || 0) + r.valor }).eq('id', r.cartao_id)
    alert(`✅ ${fmt(r.valor)} lançado na fatura do ${r.cartao_nome}`)
    loadData()
  }

  const totalMes = recorrencias.filter(r => r.ativa).reduce((s, r) => s + r.valor, 0)

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--blue)' }}>{fmt(totalMes)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total em assinaturas/mês · Anual: {fmt(totalMes * 12)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Nova assinatura</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serviço</th><th>Cartão</th><th>Dia cobrança</th><th>Quem</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {recorrencias.map(r => (
                <tr key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 500 }}>📺 {r.nome}</td>
                  <td>{r.cartao_nome}</td>
                  <td>Dia {r.dia_cobranca}</td>
                  <td><span className={`badge ${r.quem === 'eu' ? 'badge-blue' : r.quem === 'ela' ? 'badge-red' : 'badge-yellow'}`}>{r.quem === 'casal' ? 'Casal' : r.quem === 'eu' ? 'EU' : 'ELA'}</span></td>
                  <td style={{ color: 'var(--blue)', fontWeight: 500 }}>{fmt(r.valor)}/mês</td>
                  <td><span className={`badge ${r.ativa ? 'badge-green' : 'badge-yellow'}`}>{r.ativa ? '✅ Ativa' : '⏸ Pausada'}</span></td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-green btn-sm" onClick={() => lancar(r)}>▶ Lançar</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(r)}>✏️</button>
                      <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(r.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recorrencias.length === 0 && <div className="empty">Nenhuma assinatura cadastrada</div>}
        </div>
      </div>

      {recorrencias.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Resumo por serviço</div>
          <div className="grid-3">
            {recorrencias.filter(r => r.ativa).map(r => (
              <div key={r.id} style={{ padding: 12, border: '0.5px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontWeight: 500 }}>📺 {r.nome}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--blue)', margin: '6px 0' }}>{fmt(r.valor)}</div>
                <div style={{ fontSize: 11, color: 'var(--secondary)' }}>{r.cartao_nome} · dia {r.dia_cobranca}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar assinatura' : '📺 Nova assinatura'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome do serviço</label><input className="form-input" placeholder="Ex: Netflix, Spotify..." value={nome} onChange={e => setNome(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Valor mensal (R$)</label><input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required /></div>
              <div className="form-group">
                <label className="form-label">Cartão de cobrança</label>
                <select className="form-select" value={cartaoId} onChange={e => { setCartaoId(e.target.value); setCartaoNome(cartoes.find(c => c.id === e.target.value)?.nome || '') }}>
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Dia da cobrança</label><input className="form-input" type="number" min="1" max="31" value={dia} onChange={e => setDia(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Pago por quem?</label><select className="form-select" value={quem} onChange={e => setQuem(e.target.value)}><option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option></select></div>
              </div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={ativa ? 'sim' : 'nao'} onChange={e => setAtiva(e.target.value === 'sim')}><option value="sim">✅ Ativa</option><option value="nao">⏸ Pausada</option></select></div>
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
