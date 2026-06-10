import { useState, useEffect } from 'react'
import { supabase, fmt, TIPOS_REC, MESES } from '../supabase.js'

export default function Receitas({ session, profile }) {
  const [receitas, setReceitas] = useState([])
  const [recorrentes, setRecorrentes] = useState([])
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('lancamentos') // 'lancamentos' | 'recorrentes'
  const [modal, setModal] = useState(false)
  const [modalRec, setModalRec] = useState(false)
  const [edit, setEdit] = useState(null)
  const [editRec, setEditRec] = useState(null)
  // Lançamento
  const [tipo, setTipo] = useState('salario')
  const [valor, setValor] = useState('')
  const [quem, setQuem] = useState(profile.papel)
  const [bancoId, setBancoId] = useState('')
  // Recorrente
  const [rNome, setRNome] = useState('')
  const [rValor, setRValor] = useState('')
  const [rTipo, setRTipo] = useState('salario')
  const [rQuem, setRQuem] = useState(profile.papel)
  const [rBancoId, setRBancoId] = useState('')
  const [rBancoNome, setRBancoNome] = useState('')
  const [rDia, setRDia] = useState('5')
  const [rAtiva, setRAtiva] = useState(true)
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [rec, recorr, ban] = await Promise.all([
      cf(supabase.from('receitas').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('receitas_recorrentes').select('*')).order('nome'),
      cf(supabase.from('contas_banco').select('*')),
    ])
    if (rec.data) setReceitas(rec.data)
    if (recorr.data) setRecorrentes(recorr.data)
    if (ban.data) {
      setBancos(ban.data)
      const principal = ban.data.find(b => b.id === profile.banco_principal_id) || ban.data[0]
      if (principal) { setBancoId(principal.id); setRBancoId(principal.id); setRBancoNome(principal.banco) }
    }
    setLoading(false)
  }

  // Lançamento pontual
  function openModal(r = null) {
    setEdit(r); setTipo(r?.tipo || 'salario'); setValor(r ? String(r.valor) : ''); setQuem(r?.quem || profile.papel)
    setBancoId(bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const cp = ex => ({ user_id: session.user.id, casal_code: profile.casal_code || session.user.id, ...ex })
    try {
      if (edit) {
        await supabase.from('receitas').update({ tipo, valor: parseFloat(valor), quem }).eq('id', edit.id)
      } else {
        await supabase.from('receitas').insert(cp({ tipo, valor: parseFloat(valor), quem, mes: now.getMonth(), ano: now.getFullYear() }))
        // Entrada no banco
        if (bancoId) {
          const banco = bancos.find(b => b.id === bancoId)
          if (banco) {
            const ns = (banco.saldo || 0) + parseFloat(valor)
            await supabase.from('contas_banco').update({ saldo: ns }).eq('id', bancoId)
            await supabase.from('extrato_banco').insert(cp({
              banco_id: bancoId, banco_nome: banco.banco, tipo: 'entrada',
              descricao: TIPOS_REC.find(t => t[0] === tipo)?.[1]?.replace(/.*\s/, '') || tipo,
              categoria: tipo, valor: parseFloat(valor), saldo_apos: ns,
              mes: now.getMonth(), ano: now.getFullYear(),
            }))
          }
        }
      }
      setModal(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  // Recorrente
  function openModalRec(r = null) {
    setEditRec(r); setRNome(r?.nome || ''); setRValor(r ? String(r.valor) : '')
    setRTipo(r?.tipo || 'salario'); setRQuem(r?.quem || profile.papel)
    setRBancoId(r?.banco_id || bancos[0]?.id || ''); setRBancoNome(r?.banco_nome || bancos[0]?.banco || '')
    setRDia(r ? String(r.dia_recebimento) : '5'); setRAtiva(r?.ativa !== false); setModalRec(true)
  }

  async function salvarRec(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      user_id: session.user.id, casal_code: profile.casal_code || session.user.id,
      nome: rNome, valor: parseFloat(rValor), tipo: rTipo, quem: rQuem,
      banco_id: rBancoId || null, banco_nome: rBancoNome, dia_recebimento: parseInt(rDia) || 5, ativa: rAtiva,
    }
    try {
      if (editRec) await supabase.from('receitas_recorrentes').update(payload).eq('id', editRec.id)
      else await supabase.from('receitas_recorrentes').insert(payload)
      setModalRec(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function lancarRecorrente(r) {
    if (!confirm(`Lançar ${fmt(r.valor)} de "${r.nome}" este mês?`)) return
    const cp = ex => ({ user_id: session.user.id, casal_code: profile.casal_code || session.user.id, ...ex })
    await supabase.from('receitas').insert(cp({ tipo: r.tipo, valor: r.valor, quem: r.quem, mes: now.getMonth(), ano: now.getFullYear() }))
    if (r.banco_id) {
      const banco = bancos.find(b => b.id === r.banco_id)
      if (banco) {
        const ns = (banco.saldo || 0) + r.valor
        await supabase.from('contas_banco').update({ saldo: ns }).eq('id', r.banco_id)
        await supabase.from('extrato_banco').insert(cp({
          banco_id: r.banco_id, banco_nome: banco.banco, tipo: 'entrada',
          descricao: r.nome, categoria: r.tipo, valor: r.valor, saldo_apos: ns,
          mes: now.getMonth(), ano: now.getFullYear(),
        }))
      }
    }
    alert(`✅ ${fmt(r.valor)} lançado!`); loadData()
  }

  const recMes = receitas.filter(r => r.mes === now.getMonth() && r.ano === now.getFullYear())
  const totalMes = recMes.reduce((s, r) => s + r.valor, 0)

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--green)' }}>{fmt(totalMes)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total de receitas este mês</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-outline" onClick={() => openModalRec()}>+ Recorrente</button>
          <button className="btn btn-green" onClick={() => openModal()}>+ Lançar receita</button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', marginBottom: 16 }}>
        {[['lancamentos','💰 Lançamentos'], ['recorrentes','🔄 Recorrentes']].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '8px 16px', border: 'none', background: 'none', fontWeight: aba === id ? 600 : 400,
              color: aba === id ? 'var(--primary)' : 'var(--secondary)', cursor: 'pointer',
              borderBottom: aba === id ? '2px solid var(--primary)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {aba === 'lancamentos' && (
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
                        <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                          onClick={async () => { if (confirm('Excluir?')) { await supabase.from('receitas').delete().eq('id', r.id); loadData() } }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {receitas.length === 0 && <div className="empty">Nenhuma receita lançada</div>}
          </div>
        </div>
      )}

      {aba === 'recorrentes' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Tipo</th><th>Quem</th><th>Banco</th><th>Dia</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {recorrentes.map(r => (
                  <tr key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 500 }}>{r.nome}</td>
                    <td>{TIPOS_REC.find(t => t[0] === r.tipo)?.[1] || r.tipo}</td>
                    <td><span className={`badge ${r.quem === 'eu' ? 'badge-blue' : 'badge-red'}`}>{r.quem === 'eu' ? 'EU' : 'ELA'}</span></td>
                    <td>{r.banco_nome || '—'}</td>
                    <td>Dia {r.dia_recebimento}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt(r.valor)}</td>
                    <td><span className={`badge ${r.ativa ? 'badge-green' : 'badge-yellow'}`}>{r.ativa ? '✅ Ativa' : '⏸ Pausada'}</span></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-green btn-sm" onClick={() => lancarRecorrente(r)}>▶ Lançar</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openModalRec(r)}>✏️</button>
                        <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                          onClick={async () => { if (confirm('Excluir?')) { await supabase.from('receitas_recorrentes').delete().eq('id', r.id); loadData() } }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recorrentes.length === 0 && <div className="empty">Nenhuma receita recorrente cadastrada</div>}
          </div>
        </div>
      )}

      {/* Modal lançamento */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar receita' : '💰 Lançar receita'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Tipo</label>
                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                  {TIPOS_REC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">De quem?</label>
                <select className="form-select" value={quem} onChange={e => setQuem(e.target.value)}>
                  <option value="eu">EU</option><option value="ela">ELA</option>
                </select></div>
              <div className="form-group"><label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required /></div>
              {!edit && bancos.length > 0 && (
                <div className="form-group"><label className="form-label">Entrar em qual banco?</label>
                  <select className="form-select" value={bancoId} onChange={e => setBancoId(e.target.value)}>
                    <option value="">Não movimentar banco</option>
                    {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                  </select></div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Lançar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal recorrente */}
      {modalRec && (
        <div className="modal-overlay" onClick={() => setModalRec(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editRec ? '✏️ Editar recorrente' : '🔄 Nova receita recorrente'}</h3>
            <form onSubmit={salvarRec}>
              <div className="form-group"><label className="form-label">Nome</label>
                <input className="form-input" placeholder="Ex: Salário empresa, Freela cliente A..." value={rNome} onChange={e => setRNome(e.target.value)} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Tipo</label>
                  <select className="form-select" value={rTipo} onChange={e => setRTipo(e.target.value)}>
                    {TIPOS_REC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">De quem?</label>
                  <select className="form-select" value={rQuem} onChange={e => setRQuem(e.target.value)}>
                    <option value="eu">EU</option><option value="ela">ELA</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Valor (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={rValor} onChange={e => setRValor(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Dia de recebimento</label>
                  <input className="form-input" type="number" min="1" max="31" value={rDia} onChange={e => setRDia(e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Banco de destino</label>
                <select className="form-select" value={rBancoId} onChange={e => { setRBancoId(e.target.value); setRBancoNome(bancos.find(b => b.id === e.target.value)?.banco || '') }}>
                  <option value="">Não vincular banco</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={rAtiva ? 'sim' : 'nao'} onChange={e => setRAtiva(e.target.value === 'sim')}>
                  <option value="sim">✅ Ativa</option><option value="nao">⏸ Pausada</option>
                </select></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalRec(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : editRec ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
