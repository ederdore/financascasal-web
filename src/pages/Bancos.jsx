import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL } from '../supabase.js'

const TIPOS = [['corrente','🏦 Corrente'],['poupanca','🐷 Poupança'],['investimento','📈 Investimento']]
const BANCOS = ['Nubank','Inter','Itaú','Bradesco','Santander','Caixa','BB','C6','BTG','XP','Outro']

export default function Bancos({ session, profile }) {
  const [contas, setContas] = useState([])
  const [extrato, setExtrato] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [banco, setBanco] = useState('Nubank')
  const [tipo, setTipo] = useState('corrente')
  const [titular, setTitular] = useState(profile.papel)
  const [saldo, setSaldo] = useState('')
  const [moeda, setMoeda] = useState('BRL')
  const [extratoFiltro, setExtratoFiltro] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [cb, ext] = await Promise.all([
      cf(supabase.from('contas_banco').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('extrato_banco').select('*')).order('created_at', { ascending: false }).limit(100),
    ])
    if (cb.data) setContas(cb.data)
    if (ext.data) setExtrato(ext.data)
    setLoading(false)
  }

  function openModal(c = null) {
    setEdit(c); setBanco(c?.banco || 'Nubank'); setTipo(c?.tipo || 'corrente')
    setTitular(c?.titular || profile.papel); setSaldo(c ? String(c.saldo) : ''); setMoeda(c?.moeda || 'BRL')
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { user_id: session.user.id, casal_code: profile.casal_code || session.user.id, banco, tipo, titular, saldo: parseFloat(saldo) || 0, moeda }
    try {
      if (edit) await supabase.from('contas_banco').update(payload).eq('id', edit.id)
      else await supabase.from('contas_banco').insert(payload)
      setModal(false); loadData()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta conta?')) return
    await supabase.from('contas_banco').delete().eq('id', id)
    loadData()
  }

  async function setPrincipal(id) {
    await supabase.from('profiles').update({ banco_principal_id: id }).eq('id', session.user.id)
    alert('Banco principal atualizado!')
  }

  const saldoBancosBRL = contas.reduce((s, b) => s + (b.moeda === 'USD' ? toBRL(b.saldo) : b.saldo), 0)
  const extratoVer = extratoFiltro ? extrato.filter(e => e.banco_id === extratoFiltro) : extrato

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500 }}>{fmt(saldoBancosBRL)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total consolidado em BRL</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Nova conta</button>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {contas.map(b => {
          const isPrincipal = b.id === profile.banco_principal_id
          return (
            <div key={b.id} className="card" style={isPrincipal ? { borderColor: 'var(--green)', borderWidth: 1.5 } : {}}>
              <div className="row-between">
                <div className="row">
                  <span style={{ fontSize: 28 }}>{b.tipo === 'corrente' ? '🏦' : b.tipo === 'poupanca' ? '🐷' : '📈'}</span>
                  <div>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>{b.banco}</span>
                      {isPrincipal && <span className="badge badge-green">⭐ Principal</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                      {TIPOS.find(t => t[0] === b.tipo)?.[1]} · {b.titular === 'eu' ? 'EU' : b.titular === 'ela' ? 'ELA' : 'Casal'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: b.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(b.saldo, b.moeda)}</div>
                  {b.moeda === 'USD' && <div style={{ fontSize: 11, color: 'var(--secondary)' }}>≈ {fmt(toBRL(b.saldo))}</div>}
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 12 }}>
                {!isPrincipal && <button className="btn btn-outline btn-sm" onClick={() => setPrincipal(b.id)}>⭐ Principal</button>}
                <button className="btn btn-outline btn-sm" onClick={() => setExtratoFiltro(b.id)}>📄 Extrato</button>
                <button className="btn btn-outline btn-sm" onClick={() => openModal(b)}>✏️</button>
                <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(b.id)}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      {contas.length === 0 && <div className="empty">Nenhuma conta bancária cadastrada</div>}

      {/* Extrato */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600 }}>📄 Extrato</div>
          <select className="form-select" style={{ width: 'auto' }} value={extratoFiltro} onChange={e => setExtratoFiltro(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map(b => <option key={b.id} value={b.id}>{b.banco}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Banco</th><th>Tipo</th><th>Valor</th><th>Saldo após</th></tr>
            </thead>
            <tbody>
              {extratoVer.slice(0, 30).map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{e.descricao}</td>
                  <td>{e.banco_nome}</td>
                  <td><span className={`badge ${e.tipo === 'entrada' ? 'badge-green' : 'badge-red'}`}>{e.tipo === 'entrada' ? '⬆️ Entrada' : '⬇️ Saída'}</span></td>
                  <td style={{ color: e.tipo === 'entrada' ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                    {e.tipo === 'entrada' ? '+' : '-'}{fmt(e.valor)}
                  </td>
                  <td>{e.saldo_apos != null ? fmt(e.saldo_apos) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {extratoVer.length === 0 && <div className="empty">Nenhuma movimentação</div>}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar conta' : '🏦 Nova conta bancária'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Banco</label>
                <select className="form-select" value={banco} onChange={e => setBanco(e.target.value)}>
                  {BANCOS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                  {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Titular</label>
                <select className="form-select" value={titular} onChange={e => setTitular(e.target.value)}>
                  <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Moeda</label>
                <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                  <option value="BRL">🇧🇷 Real (BRL)</option><option value="USD">🇺🇸 Dólar (USD)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Saldo atual ({moeda})</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00" value={saldo} onChange={e => setSaldo(e.target.value)} required />
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
