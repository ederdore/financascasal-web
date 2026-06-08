import { useState, useEffect } from 'react'
import { supabase, fmt, CATS_DESP, CAT_ICONS, MESES } from '../supabase.js'

export default function Despesas({ session, profile }) {
  const [despesas, setDespesas] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [cat, setCat] = useState('Alimentação')
  const [quem, setQuem] = useState(profile.papel)
  const [tipo, setTipo] = useState('variavel')
  const [pagTipo, setPagTipo] = useState('debito')
  const [bancoId, setBancoId] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [cartaoNome, setCartaoNome] = useState('')
  const [parcelado, setParcelado] = useState(false)
  const [nParcelas, setNParcelas] = useState('1')
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [d, c, b] = await Promise.all([
      cf(supabase.from('despesas').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('cartoes').select('*')),
      cf(supabase.from('contas_banco').select('*')),
    ])
    if (d.data) setDespesas(d.data)
    if (c.data) setCartoes(c.data)
    if (b.data) { setBancos(b.data); if (!bancoId && b.data.length > 0) setBancoId(b.data[0].id) }
    setLoading(false)
  }

  function openModal(d = null) {
    setEdit(d); setNome(d?.nome || ''); setValor(d ? String(d.valor) : '')
    setCat(d?.categoria || 'Alimentação'); setQuem(d?.quem || profile.papel)
    setTipo(d?.tipo || 'variavel'); setPagTipo(d?.pagamento_tipo || 'debito')
    setBancoId(d?.banco_id || bancos[0]?.id || ''); setBancoNome(d?.banco_nome || '')
    setCartaoId(d?.cartao_id || ''); setCartaoNome(d?.cartao_nome || '')
    setParcelado(false); setNParcelas('1'); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setSaving(true)
    const v = parseFloat(valor)
    const cp = extra => ({ user_id: session.user.id, casal_code: profile.casal_code || session.user.id, ...extra })
    try {
      if (pagTipo === 'cartao' && cartaoId && parcelado && parseInt(nParcelas) > 1) {
        const cartao = cartoes.find(c => c.id === cartaoId)
        const np = parseInt(nParcelas)
        if (cartao) await supabase.from('cartoes').update({ fatura: (cartao.fatura || 0) + (v / np), limite_bloqueado: (cartao.limite_bloqueado || 0) + (v - v / np) }).eq('id', cartaoId)
        await supabase.from('parcelas').insert(cp({ cartao_id: cartaoId, cartao_nome: cartaoNome, descricao: nome, valor_total: v, valor_parcela: v / np, total_parcelas: np, parcela_atual: 1, mes_inicio: now.getMonth(), ano_inicio: now.getFullYear(), quem, categoria: cat }))
        await supabase.from('despesas').insert(cp({ nome: `${nome} (1/${np})`, valor: v / np, categoria: cat, quem, tipo, mes: now.getMonth(), ano: now.getFullYear(), pagamento_tipo: 'cartao', cartao_id: cartaoId, cartao_nome: cartaoNome }))
      } else {
        if (pagTipo === 'debito' && bancoId && !edit) {
          const banco = bancos.find(b => b.id === bancoId)
          if (banco) {
            const ns = (banco.saldo || 0) - v
            await supabase.from('contas_banco').update({ saldo: ns }).eq('id', bancoId)
            await supabase.from('extrato_banco').insert(cp({ banco_id: bancoId, banco_nome: banco.banco, tipo: 'saida', descricao: nome, valor: v, saldo_apos: ns, mes: now.getMonth(), ano: now.getFullYear() }))
          }
        }
        if (pagTipo === 'cartao' && cartaoId && !edit) {
          const cartao = cartoes.find(c => c.id === cartaoId)
          if (cartao) await supabase.from('cartoes').update({ fatura: (cartao.fatura || 0) + v }).eq('id', cartaoId)
        }
        const payload = cp({ nome, valor: v, categoria: cat, quem, tipo, mes: now.getMonth(), ano: now.getFullYear(), pagamento_tipo: pagTipo, cartao_id: pagTipo === 'cartao' && cartaoId ? cartaoId : null, cartao_nome: pagTipo === 'cartao' ? cartaoNome : '', banco_id: pagTipo === 'debito' && bancoId ? bancoId : null, banco_nome: pagTipo === 'debito' ? bancoNome : '' })
        if (edit) await supabase.from('despesas').update(payload).eq('id', edit.id)
        else await supabase.from('despesas').insert(payload)
      }
      setModal(false); loadData()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir?')) return
    await supabase.from('despesas').delete().eq('id', id); loadData()
  }

  const despMes = despesas.filter(d => d.mes === now.getMonth() && d.ano === now.getFullYear())
  const totalMes = despMes.reduce((s, d) => s + d.valor, 0)

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--red)' }}>{fmt(totalMes)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total de despesas este mês</div>
        </div>
        <button className="btn btn-red" onClick={() => openModal()}>+ Nova despesa</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Quem</th><th>Pagamento</th><th>Mês</th><th>Valor</th><th>Ações</th></tr></thead>
            <tbody>
              {despesas.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.nome}</td>
                  <td>{CAT_ICONS[d.categoria] || '💸'} {d.categoria}</td>
                  <td><span className={`badge ${d.quem === 'eu' ? 'badge-blue' : d.quem === 'ela' ? 'badge-red' : 'badge-yellow'}`}>{d.quem === 'casal' ? 'Casal' : d.quem === 'eu' ? 'EU' : 'ELA'}</span></td>
                  <td>{d.pagamento_tipo === 'cartao' ? '💳 ' + d.cartao_nome : '🏦 ' + (d.banco_nome || 'Débito')}</td>
                  <td>{MESES[d.mes]} {d.ano}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 500 }}>-{fmt(d.valor)}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(d)}>✏️</button>
                      <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(d.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {despesas.length === 0 && <div className="empty">Nenhuma despesa</div>}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar despesa' : '💸 Nova despesa'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input className="form-input" placeholder="Ex: Supermercado..." value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select className="form-select" value={cat} onChange={e => setCat(e.target.value)}>
                    {CATS_DESP.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quem pagou?</label>
                  <select className="form-select" value={quem} onChange={e => setQuem(e.target.value)}>
                    <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal (50/50)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                    <option value="variavel">📦 Variável</option><option value="fixa">📌 Fixa</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Pagamento</label>
                  <select className="form-select" value={pagTipo} onChange={e => { setPagTipo(e.target.value); if (e.target.value === 'debito') { setCartaoId(''); setCartaoNome('') } }}>
                    <option value="debito">💵 Débito/Pix</option><option value="cartao">💳 Cartão</option>
                  </select>
                </div>
              </div>
              {pagTipo === 'debito' && (
                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <select className="form-select" value={bancoId} onChange={e => { setBancoId(e.target.value); setBancoNome(bancos.find(b => b.id === e.target.value)?.banco || '') }}>
                    {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                  </select>
                </div>
              )}
              {pagTipo === 'cartao' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Cartão</label>
                    <select className="form-select" value={cartaoId} onChange={e => { setCartaoId(e.target.value); setCartaoNome(cartoes.find(c => c.id === e.target.value)?.nome || '') }}>
                      <option value="">Selecione...</option>
                      {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome} (livre: {fmt(Math.max(0, c.limite - (c.fatura || 0) - (c.limite_bloqueado || 0)))})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parcelado?</label>
                    <select className="form-select" value={parcelado ? 'sim' : 'nao'} onChange={e => setParcelado(e.target.value === 'sim')}>
                      <option value="nao">À vista</option><option value="sim">Parcelado</option>
                    </select>
                  </div>
                  {parcelado && (
                    <div className="form-group">
                      <label className="form-label">Parcelas</label>
                      <select className="form-select" value={nParcelas} onChange={e => setNParcelas(e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x{valor ? ` de ${fmt((parseFloat(valor) || 0) / n)}` : ''}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-red" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Lançar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
