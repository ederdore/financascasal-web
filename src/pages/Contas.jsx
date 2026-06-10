import { useState, useEffect } from 'react'
import { supabase, fmt, CATS_FIXA, CATS_VAR, CAT_ICONS } from '../supabase.js'

export default function Contas({ session, profile }) {
  const [fixas, setFixas] = useState([])
  const [vars, setVars] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalFixa, setModalFixa] = useState(false)
  const [modalVar, setModalVar] = useState(false)
  const [modalPagar, setModalPagar] = useState(false)
  const [editFixa, setEditFixa] = useState(null)
  const [editVar, setEditVar] = useState(null)
  const [contaPagar, setContaPagar] = useState(null)
  // Form fixa
  const [fxNome, setFxNome] = useState('')
  const [fxValor, setFxValor] = useState('')
  const [fxCat, setFxCat] = useState('Moradia')
  const [fxQuem, setFxQuem] = useState(profile.papel)
  const [fxDia, setFxDia] = useState('5')
  const [fxBancoId, setFxBancoId] = useState('')
  const [fxBancoNome, setFxBancoNome] = useState('')
  // Form variável
  const [vrNome, setVrNome] = useState('')
  const [vrValor, setVrValor] = useState('')
  const [vrCat, setVrCat] = useState('Alimentação')
  const [vrQuem, setVrQuem] = useState(profile.papel)
  // Pagar
  const [pagBancoId, setPagBancoId] = useState('')
  const [pagValor, setPagValor] = useState('')
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [fx, vr, pag, ban] = await Promise.all([
      cf(supabase.from('contas_fixas').select('*')).order('dia_vencimento', { ascending: true }),
      cf(supabase.from('contas_variaveis').select('*')),
      cf(supabase.from('pagamentos_contas').select('*')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
      cf(supabase.from('contas_banco').select('*')),
    ])
    if (fx.data) setFixas(fx.data)
    if (vr.data) setVars(vr.data)
    if (pag.data) setPagamentos(pag.data)
    if (ban.data) {
      setBancos(ban.data)
      const principal = ban.data.find(b => b.id === profile.banco_principal_id) || ban.data[0]
      if (principal) setPagBancoId(principal.id)
    }
    setLoading(false)
  }

  function getStatus(contaId) {
    const pag = pagamentos.find(p => p.conta_fixa_id === contaId)
    const conta = fixas.find(f => f.id === contaId)
    if (pag?.pago) return 'paga'
    if (conta && now.getDate() > conta.dia_vencimento) return 'atrasada'
    return 'pendente'
  }

  function openPagar(f) {
    setContaPagar(f)
    setPagValor(String(f.valor))
    // Se conta tem banco vinculado, usa ele; senão usa o principal
    const bancoVinculado = bancos.find(b => b.id === f.banco_id)
    setPagBancoId(bancoVinculado?.id || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
    setModalPagar(true)
  }

  async function confirmarPagamento(e) {
    e.preventDefault(); setSaving(true)
    const v = parseFloat(pagValor) || 0
    const cc = profile.casal_code || session.user.id
    try {
      // 1. Marca como paga
      const existente = pagamentos.find(p => p.conta_fixa_id === contaPagar.id)
      if (existente) {
        await supabase.from('pagamentos_contas').update({ pago: true, data_pagamento: new Date().toISOString().split('T')[0] }).eq('id', existente.id)
      } else {
        await supabase.from('pagamentos_contas').insert({
          user_id: session.user.id, casal_code: cc,
          conta_fixa_id: contaPagar.id,
          mes: now.getMonth(), ano: now.getFullYear(),
          pago: true, data_pagamento: new Date().toISOString().split('T')[0],
        })
      }

      // 2. Debita do banco automaticamente
      if (pagBancoId && v > 0) {
        const banco = bancos.find(b => b.id === pagBancoId)
        if (banco) {
          const ns = (banco.saldo || 0) - v
          await supabase.from('contas_banco').update({ saldo: ns }).eq('id', pagBancoId)
          await supabase.from('extrato_banco').insert({
            user_id: session.user.id, casal_code: cc,
            banco_id: pagBancoId, banco_nome: banco.banco,
            tipo: 'saida', descricao: contaPagar.nome,
            categoria: contaPagar.categoria, valor: v, saldo_apos: ns,
            mes: now.getMonth(), ano: now.getFullYear(),
          })
        }
      }

      // 3. Lança despesa
      await supabase.from('despesas').insert({
        user_id: session.user.id, casal_code: cc,
        nome: contaPagar.nome, valor: v,
        categoria: contaPagar.categoria, quem: contaPagar.quem,
        tipo: 'fixa', mes: now.getMonth(), ano: now.getFullYear(),
        pagamento_tipo: 'debito',
        banco_id: pagBancoId || null,
        banco_nome: bancos.find(b => b.id === pagBancoId)?.banco || '',
      })

      setModalPagar(false); loadData()
      alert(`✅ Conta "${contaPagar.nome}" paga! ${fmt(v)} debitados.`)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function marcarPaga(contaId, pagar = true) {
    const existente = pagamentos.find(p => p.conta_fixa_id === contaId)
    if (existente) {
      await supabase.from('pagamentos_contas').update({ pago: pagar, data_pagamento: pagar ? new Date().toISOString().split('T')[0] : null }).eq('id', existente.id)
    } else {
      await supabase.from('pagamentos_contas').insert({
        user_id: session.user.id, casal_code: profile.casal_code || session.user.id,
        conta_fixa_id: contaId, mes: now.getMonth(), ano: now.getFullYear(),
        pago: pagar, data_pagamento: pagar ? new Date().toISOString().split('T')[0] : null,
      })
    }
    loadData()
  }

  async function salvarFixa(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      user_id: session.user.id, casal_code: profile.casal_code || session.user.id,
      nome: fxNome, valor: parseFloat(fxValor), categoria: fxCat,
      quem: fxQuem, dia_vencimento: parseInt(fxDia) || 1,
      banco_id: fxBancoId || null, banco_nome: fxBancoNome || '',
    }
    try {
      if (editFixa) await supabase.from('contas_fixas').update(payload).eq('id', editFixa.id)
      else await supabase.from('contas_fixas').insert(payload)
      setModalFixa(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function salvarVar(e) {
    e.preventDefault(); setSaving(true)
    const payload = { user_id: session.user.id, casal_code: profile.casal_code || session.user.id, nome: vrNome, valor_medio: parseFloat(vrValor), categoria: vrCat, quem: vrQuem }
    try {
      if (editVar) await supabase.from('contas_variaveis').update(payload).eq('id', editVar.id)
      else await supabase.from('contas_variaveis').insert(payload)
      setModalVar(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  function openFixa(f = null) {
    setEditFixa(f); setFxNome(f?.nome || ''); setFxValor(f ? String(f.valor) : '')
    setFxCat(f?.categoria || 'Moradia'); setFxQuem(f?.quem || profile.papel); setFxDia(f ? String(f.dia_vencimento) : '5')
    setFxBancoId(f?.banco_id || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
    setFxBancoNome(f?.banco_nome || bancos.find(b => b.id === profile.banco_principal_id)?.banco || bancos[0]?.banco || '')
    setModalFixa(true)
  }

  function openVar(v = null) {
    setEditVar(v); setVrNome(v?.nome || ''); setVrValor(v ? String(v.valor_medio) : '')
    setVrCat(v?.categoria || 'Alimentação'); setVrQuem(v?.quem || profile.papel); setModalVar(true)
  }

  const totalFixas = fixas.reduce((s, f) => s + f.valor, 0)
  const totalVars = vars.reduce((s, v) => s + v.valor_medio, 0)
  const pagas = fixas.filter(f => getStatus(f.id) === 'paga').length
  const atrasadas = fixas.filter(f => getStatus(f.id) === 'atrasada')

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      {/* Alerta de atrasadas */}
      {atrasadas.length > 0 && (
        <div style={{ background: '#FCEBEB', border: '0.5px solid var(--red)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>⚠️ {atrasadas.length} conta(s) em atraso!</div>
          {atrasadas.map(f => (
            <div key={f.id} className="row-between" style={{ padding: '6px 0', borderTop: '0.5px solid #FCCACA' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{f.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--secondary)', marginLeft: 8 }}>Venceu dia {f.dia_vencimento}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(f.valor)}</span>
                <button className="btn btn-green btn-sm" onClick={() => openPagar(f)}>✅ Pagar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resumo */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="mini-card">
          <div className="lbl">Fixas/mês</div>
          <div className="val" style={{ color: 'var(--red)' }}>{fmt(totalFixas)}</div>
          <div className="sub">{pagas}/{fixas.length} pagas · {atrasadas.length} atrasada(s)</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Variáveis/mês</div>
          <div className="val" style={{ color: 'var(--yellow)' }}>~{fmt(totalVars)}</div>
          <div className="sub">{vars.length} item(s)</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Total estimado</div>
          <div className="val">{fmt(totalFixas + totalVars)}</div>
          <div className="sub">fixas + variáveis</div>
        </div>
      </div>

      {/* Contas fixas */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>📋 Contas fixas — {fmt(totalFixas)}/mês</div>
          <button className="btn btn-primary btn-sm" onClick={() => openFixa()}>+ Adicionar</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Responsável</th><th>Banco vinculado</th><th>Vence</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {fixas.map(f => {
                const status = getStatus(f.id)
                const bancof = bancos.find(b => b.id === f.banco_id)
                return (
                  <tr key={f.id} style={{ background: status === 'atrasada' ? '#FFF5F5' : status === 'paga' ? '#F0FFF4' : 'transparent' }}>
                    <td style={{ fontWeight: 500 }}>{CAT_ICONS[f.categoria] || '📋'} {f.nome}</td>
                    <td>{f.categoria}</td>
                    <td><span className={`badge ${f.quem === 'eu' ? 'badge-blue' : f.quem === 'ela' ? 'badge-red' : 'badge-yellow'}`}>{f.quem === 'casal' ? 'Casal' : f.quem === 'eu' ? 'EU' : 'ELA'}</span></td>
                    <td style={{ fontSize: 12 }}>{bancof ? `🏦 ${bancof.banco}` : <span style={{ color: 'var(--secondary)' }}>—</span>}</td>
                    <td>Dia {f.dia_vencimento}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 500 }}>{fmt(f.valor)}</td>
                    <td><span className={`badge ${status === 'paga' ? 'badge-green' : status === 'atrasada' ? 'badge-red' : 'badge-yellow'}`}>{status === 'paga' ? '✅ Paga' : status === 'atrasada' ? '⚠️ Atrasada' : '⏳ Pendente'}</span></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {status !== 'paga' ? (
                          <button className="btn btn-sm" style={{ background: '#E1F5EE', color: 'var(--green)' }} onClick={() => openPagar(f)}>✅ Pagar</button>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => marcarPaga(f.id, false)}>↩️</button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => openFixa(f)}>✏️</button>
                        <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                          onClick={async () => { if (confirm('Excluir?')) { await supabase.from('contas_fixas').delete().eq('id', f.id); loadData() } }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {fixas.length === 0 && <div className="empty">Nenhuma conta fixa cadastrada</div>}
        </div>
      </div>

      {/* Contas variáveis */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>📦 Variáveis — ~{fmt(totalVars)}/mês</div>
          <button className="btn btn-primary btn-sm" onClick={() => openVar()}>+ Adicionar</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Responsável</th><th>Média/mês</th><th>Ações</th></tr></thead>
            <tbody>
              {vars.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 500 }}>{CAT_ICONS[v.categoria] || '💸'} {v.nome}</td>
                  <td>{v.categoria}</td>
                  <td><span className={`badge ${v.quem === 'eu' ? 'badge-blue' : v.quem === 'ela' ? 'badge-red' : 'badge-yellow'}`}>{v.quem === 'casal' ? 'Casal' : v.quem === 'eu' ? 'EU' : 'ELA'}</span></td>
                  <td style={{ color: 'var(--yellow)', fontWeight: 500 }}>~{fmt(v.valor_medio)}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openVar(v)}>✏️</button>
                      <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                        onClick={async () => { if (confirm('Excluir?')) { await supabase.from('contas_variaveis').delete().eq('id', v.id); loadData() } }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vars.length === 0 && <div className="empty">Nenhuma conta variável cadastrada</div>}
        </div>
      </div>

      {/* Modal confirmar pagamento */}
      {modalPagar && contaPagar && (
        <div className="modal-overlay" onClick={() => setModalPagar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>✅ Pagar — {contaPagar.nome}</h3>
            <div style={{ background: '#E1F5EE', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, color: 'var(--green)' }}>Valor da conta: {fmt(contaPagar.valor)}</div>
              <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>O pagamento será debitado do banco e lançado como despesa automaticamente</div>
            </div>
            <form onSubmit={confirmarPagamento}>
              <div className="form-group"><label className="form-label">Valor pago (R$)</label>
                <input className="form-input" type="number" step="0.01" value={pagValor} onChange={e => setPagValor(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Debitar de qual banco?</label>
                <select className="form-select" value={pagBancoId} onChange={e => setPagBancoId(e.target.value)}>
                  <option value="">Não movimentar banco</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select></div>
              {pagBancoId && pagValor && (()=>{
                const banco = bancos.find(b => b.id === pagBancoId)
                const ns = (banco?.saldo || 0) - (parseFloat(pagValor) || 0)
                return <div style={{ background: ns >= 0 ? '#E1F5EE' : '#FCEBEB', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13, color: ns >= 0 ? 'var(--green)' : 'var(--red)' }}>Saldo após: {fmt(ns)} {ns < 0 ? '⚠️ Insuficiente' : '✓'}</div>
              })()}
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalPagar(false)}>Cancelar</button>
                <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Processando...' : 'Confirmar pagamento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal conta fixa */}
      {modalFixa && (
        <div className="modal-overlay" onClick={() => setModalFixa(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editFixa ? '✏️ Editar conta fixa' : '📋 Nova conta fixa'}</h3>
            <form onSubmit={salvarFixa}>
              <div className="form-group"><label className="form-label">Nome</label>
                <input className="form-input" placeholder="Ex: Aluguel, Internet..." value={fxNome} onChange={e => setFxNome(e.target.value)} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Categoria</label>
                  <select className="form-select" value={fxCat} onChange={e => setFxCat(e.target.value)}>
                    {CATS_FIXA.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Responsável</label>
                  <select className="form-select" value={fxQuem} onChange={e => setFxQuem(e.target.value)}>
                    <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Valor (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={fxValor} onChange={e => setFxValor(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Dia vencimento</label>
                  <input className="form-input" type="number" min="1" max="31" value={fxDia} onChange={e => setFxDia(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">🏦 Banco de pagamento</label>
                <select className="form-select" value={fxBancoId} onChange={e => { setFxBancoId(e.target.value); setFxBancoNome(bancos.find(b => b.id === e.target.value)?.banco || '') }}>
                  <option value="">Não vincular banco</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 4 }}>Banco debitado automaticamente ao pagar</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalFixa(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : editFixa ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal variável */}
      {modalVar && (
        <div className="modal-overlay" onClick={() => setModalVar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editVar ? '✏️ Editar variável' : '📦 Nova conta variável'}</h3>
            <form onSubmit={salvarVar}>
              <div className="form-group"><label className="form-label">Nome</label>
                <input className="form-input" placeholder="Ex: Supermercado..." value={vrNome} onChange={e => setVrNome(e.target.value)} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Categoria</label>
                  <select className="form-select" value={vrCat} onChange={e => setVrCat(e.target.value)}>
                    {CATS_VAR.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Responsável</label>
                  <select className="form-select" value={vrQuem} onChange={e => setVrQuem(e.target.value)}>
                    <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option>
                  </select></div>
              </div>
              <div className="form-group"><label className="form-label">Média mensal (R$)</label>
                <input className="form-input" type="number" step="0.01" value={vrValor} onChange={e => setVrValor(e.target.value)} required /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalVar(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : editVar ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
