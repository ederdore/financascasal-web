import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL, iconeBanco, CAT_ICONS } from '../supabase.js'
import { getBancoInfo, getMoedaInfo, BancoLogo } from '../components/BancoInfo.jsx'

const TIPOS = [['corrente','Corrente'],['poupanca','Poupança'],['investimento','Investimento']]
const MOEDAS = [['BRL','🇧🇷 Real (BRL)'],['USD','🇺🇸 Dólar (USD)'],['EUR','🇪🇺 Euro (EUR)']]

// Sugestões de bancos por moeda
const BANCOS_SUGERIDOS = {
  BRL: ['Nubank','Inter','Itaú','XP','C6','Bradesco','Santander','BTG'],
  USD: ['Nomad','Wise','Remessa Online','Avenue'],
  EUR: ['Wise','Revolut','N26'],
}

export default function Bancos({ session, profile }) {
  const [contas, setContas] = useState([])
  const [extrato, setExtrato] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [banco, setBanco] = useState('')
  const [tipo, setTipo] = useState('corrente')
  const [titular, setTitular] = useState(profile.papel)
  const [saldo, setSaldo] = useState('')
  const [moeda, setMoeda] = useState('BRL')
  const [extratoFiltro, setExtratoFiltro] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [cb, ext] = await Promise.all([
      cf(supabase.from('contas_banco').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('extrato_banco').select('*')).order('created_at', { ascending: false }).limit(150),
    ])
    if (cb.data) setContas(cb.data)
    if (ext.data) setExtrato(ext.data)
    setLoading(false)
  }

  function openModal(c = null) {
    setEdit(c); setBanco(c?.banco || ''); setTipo(c?.tipo || 'corrente')
    setTitular(c?.titular || profile.papel); setSaldo(c ? String(c.saldo) : ''); setMoeda(c?.moeda || 'BRL')
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!banco.trim()) { alert('Informe o nome do banco'); return }
    setSaving(true)
    const payload = { user_id: session.user.id, casal_code: profile.casal_code || session.user.id, banco: banco.trim(), tipo, titular, saldo: parseFloat(saldo) || 0, moeda }
    try {
      if (edit) await supabase.from('contas_banco').update(payload).eq('id', edit.id)
      else await supabase.from('contas_banco').insert(payload)
      setModal(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta conta?')) return
    await supabase.from('contas_banco').delete().eq('id', id); loadData()
  }

  async function setPrincipal(id) {
    await supabase.from('profiles').update({ banco_principal_id: id }).eq('id', session.user.id)
    loadData()
  }

  const cats = [...new Set(extrato.map(e => e.categoria).filter(Boolean))]
  let extratoVer = extrato
  if (extratoFiltro) extratoVer = extratoVer.filter(e => e.banco_id === extratoFiltro)
  if (catFiltro)     extratoVer = extratoVer.filter(e => e.categoria === catFiltro)
  if (tipoFiltro)    extratoVer = extratoVer.filter(e => e.tipo === tipoFiltro)

  const totalBRL = contas.filter(b => b.moeda === 'BRL').reduce((s, b) => s + b.saldo, 0)
  const totalUSD = contas.filter(b => b.moeda === 'USD').reduce((s, b) => s + b.saldo, 0)
  const totalEUR = contas.filter(b => b.moeda === 'EUR').reduce((s, b) => s + b.saldo, 0)
  const totalConsolidado = totalBRL + toBRL(totalUSD, 'USD') + toBRL(totalEUR, 'EUR')

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      {/* Header */}
      <div className="row-between" style={{ marginBottom:20 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:600 }}>{fmt(totalConsolidado)}</div>
          <div style={{ fontSize:12, color:'var(--secondary)', marginTop:2 }}>Total consolidado · {contas.length} conta(s)</div>
          <div style={{ display:'flex', gap:14, marginTop:8 }}>
            {totalBRL !== 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13 }}>
                <span>🇧🇷</span>
                <span style={{ fontWeight:500 }}>{fmt(totalBRL)}</span>
              </div>
            )}
            {totalUSD !== 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13 }}>
                <span>🇺🇸</span>
                <span style={{ fontWeight:500 }}>{fmt(totalUSD,'USD')}</span>
              </div>
            )}
            {totalEUR !== 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13 }}>
                <span>🇪🇺</span>
                <span style={{ fontWeight:500 }}>{fmt(totalEUR,'EUR')}</span>
              </div>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Nova conta</button>
      </div>

      {/* Cards dos bancos */}
      <div className="grid-2" style={{ marginBottom:20 }}>
        {contas.map(b => {
          const isPrincipal = b.id === profile.banco_principal_id
          const bancoInfo = getBancoInfo(b.banco)
          const moedaInfo = getMoedaInfo(b.moeda)
          return (
            <div key={b.id} className="card" style={{ borderLeft: isPrincipal ? '3px solid var(--green)' : undefined, padding:0, overflow:'hidden' }}>
              {/* Header colorido */}
              <div style={{
                background: bancoInfo ? `linear-gradient(135deg, ${bancoInfo.cor}15 0%, ${bancoInfo.cor}08 100%)` : 'var(--bg)',
                borderBottom: '0.5px solid var(--border)',
                padding:'14px 16px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <BancoLogo nome={b.banco} size={38} />
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, fontSize:15, color:'var(--primary)' }}>{b.banco}</span>
                      {isPrincipal && <span className="badge badge-green" style={{ fontSize:10 }}>⭐ Principal</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                      <span style={{ fontSize:14 }}>{moedaInfo.bandeira}</span>
                      <span style={{ fontSize:11, color:'var(--secondary)' }}>
                        {TIPOS.find(t => t[0] === b.tipo)?.[1]} ·{' '}
                        {b.titular === 'eu' ? 'EU' : b.titular === 'ela' ? 'ELA' : 'Casal'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{
                    fontSize:18, fontWeight:700,
                    color: b.saldo >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {fmt(b.saldo, b.moeda)}
                  </div>
                  {b.moeda !== 'BRL' && (
                    <div style={{ fontSize:11, color:'var(--secondary)', marginTop:2 }}>
                      ≈ {fmt(toBRL(b.saldo, b.moeda))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div style={{ padding:'10px 16px', display:'flex', gap:6 }}>
                {!isPrincipal && <button className="btn btn-outline btn-sm" onClick={() => setPrincipal(b.id)}>⭐ Principal</button>}
                <button className="btn btn-outline btn-sm" onClick={() => setExtratoFiltro(b.id === extratoFiltro ? '' : b.id)}>📄 Extrato</button>
                <button className="btn btn-outline btn-sm" onClick={() => openModal(b)}>✏️</button>
                <button className="btn btn-sm" style={{ background:'#FCEBEB', color:'var(--red)' }} onClick={() => excluir(b.id)}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>
      {contas.length === 0 && <div className="empty">Nenhuma conta bancária cadastrada</div>}

      {/* Extrato */}
      <div className="card">
        <div style={{ fontWeight:600, marginBottom:14 }}>📄 Extrato</div>
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <select className="form-select" style={{ width:'auto' }} value={extratoFiltro} onChange={e => setExtratoFiltro(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map(b => {
              const bi = getBancoInfo(b.banco)
              const mi = getMoedaInfo(b.moeda)
              return <option key={b.id} value={b.id}>{mi.bandeira} {b.banco}</option>
            })}
          </select>
          <select className="form-select" style={{ width:'auto' }} value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
            <option value="">Entradas e saídas</option>
            <option value="entrada">⬆️ Entradas</option>
            <option value="saida">⬇️ Saídas</option>
          </select>
          <select className="form-select" style={{ width:'auto' }} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
            <option value="">Todas as categorias</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          {(extratoFiltro || tipoFiltro || catFiltro) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setExtratoFiltro(''); setTipoFiltro(''); setCatFiltro('') }}>✕ Limpar</button>
          )}
        </div>
        {extratoVer.length > 0 && (
          <div style={{ display:'flex', gap:16, marginBottom:14, fontSize:13 }}>
            <span style={{ color:'var(--green)' }}>⬆️ Entradas: {fmt(extratoVer.filter(e => e.tipo==='entrada').reduce((s,e)=>s+e.valor,0))}</span>
            <span style={{ color:'var(--red)' }}>⬇️ Saídas: {fmt(extratoVer.filter(e => e.tipo==='saida').reduce((s,e)=>s+e.valor,0))}</span>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th>Tipo</th><th>Valor</th><th>Saldo após</th></tr>
            </thead>
            <tbody>
              {extratoVer.slice(0,50).map(e => {
                const conta = contas.find(b => b.id === e.banco_id)
                const mi = getMoedaInfo(conta?.moeda || 'BRL')
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace:'nowrap' }}>{new Date(e.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>{e.descricao}</td>
                    <td>
                      {e.categoria ? (
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span>{CAT_ICONS[e.categoria]||'💸'}</span>
                          <span style={{ fontSize:12, color:'var(--secondary)' }}>{e.categoria}</span>
                        </span>
                      ) : <span style={{ color:'var(--secondary)', fontSize:12 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <BancoLogo nome={e.banco_nome} size={20} />
                        <span style={{ fontSize:12 }}>{mi.bandeira} {e.banco_nome}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${e.tipo==='entrada'?'badge-green':'badge-red'}`}>{e.tipo==='entrada'?'⬆️ Entrada':'⬇️ Saída'}</span></td>
                    <td style={{ color:e.tipo==='entrada'?'var(--green)':'var(--red)', fontWeight:500 }}>
                      {e.tipo==='entrada'?'+':'-'}{fmt(e.valor)}
                    </td>
                    <td>{e.saldo_apos != null ? fmt(e.saldo_apos) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {extratoVer.length === 0 && <div className="empty">Nenhuma movimentação encontrada</div>}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar conta' : '🏦 Nova conta bancária'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Moeda</label>
                <select className="form-select" value={moeda} onChange={e => { setMoeda(e.target.value); setBanco('') }}>
                  {MOEDAS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Banco</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {(BANCOS_SUGERIDOS[moeda]||[]).map(b => {
                    const bi = getBancoInfo(b)
                    return (
                      <button key={b} type="button"
                        onClick={() => setBanco(b)}
                        style={{
                          display:'flex', alignItems:'center', gap:6,
                          padding:'5px 10px', borderRadius:8, border:'0.5px solid var(--border)',
                          background: banco===b ? (bi?.cor||'var(--primary)') : 'var(--bg)',
                          color: banco===b ? '#fff' : 'var(--primary)',
                          cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:500,
                        }}>
                        {bi ? (
                          <div style={{ width:16, height:16 }} dangerouslySetInnerHTML={{ __html: bi.logo }}/>
                        ) : '🏦'}
                        {b}
                      </button>
                    )
                  })}
                </div>
                <input className="form-input" placeholder="Ou digite outro banco..." value={banco} onChange={e => setBanco(e.target.value)} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de conta</label>
                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                  {TIPOS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Titular</label>
                <select className="form-select" value={titular} onChange={e => setTitular(e.target.value)}>
                  <option value="eu">👤 EU</option>
                  <option value="ela">👤 ELA</option>
                  <option value="casal">👫 Casal</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Saldo atual ({moeda})</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00" value={saldo} onChange={e => setSaldo(e.target.value)} required/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Salvando...':edit?'Salvar':'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
