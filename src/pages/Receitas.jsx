import { useState, useEffect } from 'react'
import { supabase, fmt, TIPOS_REC, MESES } from '../supabase.js'

export default function Receitas({ session, profile }) {
  const [receitas, setReceitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [tipo, setTipo] = useState('salario')
  const [valor, setValor] = useState('')
  const [quem, setQuem] = useState(profile.papel)
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const { data } = await cf(supabase.from('receitas').select('*')).order('created_at', { ascending: false })
    if (data) setReceitas(data)
    setLoading(false)
  }

  function openModal(r = null) {
    setEdit(r); setTipo(r?.tipo || 'salario'); setValor(r ? String(r.valor) : ''); setQuem(r?.quem || profile.papel); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { user_id: session.user.id, casal_code: profile.casal_code || session.user.id, tipo, valor: parseFloat(valor), quem, mes: now.getMonth(), ano: now.getFullYear() }
    try {
      if (edit) await supabase.from('receitas').update({ tipo, valor: parseFloat(valor), quem }).eq('id', edit.id)
      else await supabase.from('receitas').insert(payload)
      setModal(false); loadData()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta receita?')) return
    await supabase.from('receitas').delete().eq('id', id)
    loadData()
  }

  const recMes = receitas.filter(r => r.mes === now.getMonth() && r.ano === now.getFullYear())
  const totalMes = recMes.reduce((s, r) => s + r.valor, 0)

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--green)' }}>{fmt(totalMes)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total de receitas este mês</div>
        </div>
        <button className="btn btn-green" onClick={() => openModal()}>+ Lançar receita</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Quem</th><th>Mês</th><th>Valor</th><th>Ações</th></tr></thead>
            <tbody>
              {receitas.map(r => (
                <tr key={r.id}>
                  <td>{TIPOS_REC.find(t => t[0] === r.tipo)?.[1] || r.tipo}</td>
                  <td><span className={`badge ${r.quem === 'eu' ? 'badge-blue' : 'badge-red'}`}>{r.quem === 'eu' ? 'EU' : 'ELA'}</span></td>
                  <td>{MESES[r.mes]} {r.ano}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 500 }}>+{fmt(r.valor)}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(r)}>✏️</button>
                      <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(r.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {receitas.length === 0 && <div className="empty">Nenhuma receita lançada</div>}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar receita' : '💰 Lançar receita'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                  {TIPOS_REC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">De quem?</label>
                <select className="form-select" value={quem} onChange={e => setQuem(e.target.value)}>
                  <option value="eu">EU</option><option value="ela">ELA</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Lançar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
