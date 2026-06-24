import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL } from '../supabase.js'

export default function Reserva({ session, profile }) {
  const [reserva, setReserva] = useState({ meta: 30000, atual: 0, atual_usd: 0, meta_usd: 0, rende_cdi: false, pct_cdi: 100, taxa_cdi_mensal: 0.92 })
  const [bancos, setBancos] = useState([])
  const [fixas, setFixas] = useState([])
  const [recorrencias, setRecorrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesesReserva, setMesesReserva] = useState(6)
  const [modalMeta, setModalMeta] = useState(false)
  const [modalCfg, setModalCfg] = useState(false)
  const [modalRetirada, setModalRetirada] = useState(false)
  const [modalDeposito, setModalDeposito] = useState(false)
  const [depValor, setDepValor] = useState('')
  const [depBancoId, setDepBancoId] = useState('')
  const [depMoeda, setDepMoeda] = useState('BRL')
  const [novaMeta, setNovaMeta] = useState('')
  const [resCdiAtivo, setResCdiAtivo] = useState(false)
  const [resPctCdi, setResPctCdi] = useState('100')
  const [resTaxaCdi, setResTaxaCdi] = useState('0.92')
  const [resMetaUsd, setResMetaUsd] = useState('0')
  const [resAtualUsd, setResAtualUsd] = useState('0')
  const [retValor, setRetValor] = useState('')
  const [retBancoId, setRetBancoId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const uid = session.user.id
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', uid)
    const [r, b, fx, rec] = await Promise.all([
      supabase.from('reserva').select('*').eq('user_id', uid).maybeSingle(),
      cf(supabase.from('contas_banco').select('*')),
      cf(supabase.from('contas_fixas').select('*')),
      cf(supabase.from('recorrencias_cartao').select('*')).eq('ativa', true),
    ])
    if (r.data) {
      setReserva(r.data)
      setResCdiAtivo(r.data.rende_cdi || false)
      setResPctCdi(String(r.data.pct_cdi || 100))
      setResTaxaCdi(String(r.data.taxa_cdi_mensal || 0.92))
      setResMetaUsd(String(r.data.meta_usd || 0))
      setResAtualUsd(String(r.data.atual_usd || 0))
    }
    if (b.data) { setBancos(b.data); if (b.data.length > 0) setRetBancoId(b.data[0].id) }
    if (fx.data) setFixas(fx.data)
    if (rec.data) setRecorrencias(rec.data)
    setLoading(false)
  }

  const totalFixas = fixas.reduce((s, f) => s + f.valor, 0)
  const totalRecorrencias = recorrencias.reduce((s, r) => s + r.valor, 0)
  const baseReserva = totalFixas + totalRecorrencias
  const metaIdeal = baseReserva * mesesReserva

  async function aplicarMeta() {
    if (metaIdeal <= 0) { alert('Cadastre contas fixas primeiro para calcular a meta'); return }
    setSaving(true)
    try {
      if (reserva.id) await supabase.from('reserva').update({ meta: metaIdeal }).eq('id', reserva.id)
      else await supabase.from('reserva').insert({ user_id: session.user.id, meta: metaIdeal, atual: 0 })
      loadData()
      alert(`✅ Meta atualizada para ${fmt(metaIdeal)} (${mesesReserva} meses)`)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function salvarMeta(e) {
    e.preventDefault()
    const meta = parseFloat(novaMeta) || 0
    setSaving(true)
    try {
      if (reserva.id) await supabase.from('reserva').update({ meta }).eq('id', reserva.id)
      else await supabase.from('reserva').insert({ user_id: session.user.id, meta, atual: 0 })
      setModalMeta(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function salvarCfg(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      rende_cdi: resCdiAtivo,
      pct_cdi: parseFloat(resPctCdi) || 100,
      taxa_cdi_mensal: parseFloat(resTaxaCdi) || 0.92,
      meta_usd: parseFloat(resMetaUsd) || 0,
      atual_usd: parseFloat(resAtualUsd) || 0,
    }
    try {
      if (reserva.id) await supabase.from('reserva').update(payload).eq('id', reserva.id)
      else await supabase.from('reserva').insert({ user_id: session.user.id, meta: 30000, atual: 0, ...payload })
      setModalCfg(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function salvarDeposito(e) {
    e.preventDefault()
    const val = parseFloat(depValor) || 0
    if (val <= 0) { alert('Informe o valor'); return }
    setSaving(true)
    try {
      const novoAtual = depMoeda === 'USD'
        ? (reserva.atual_usd || 0) + val
        : (reserva.atual || 0) + val

      if (depMoeda === 'USD') {
        await supabase.from('reserva').update({ atual_usd: novoAtual }).eq('id', reserva.id)
      } else {
        if (reserva.id) await supabase.from('reserva').update({ atual: novoAtual }).eq('id', reserva.id)
        else await supabase.from('reserva').insert({ user_id: session.user.id, meta: reserva.meta || 30000, atual: novoAtual })
      }

      // Debita do banco se selecionado
      if (depBancoId && depMoeda === 'BRL') {
        const banco = bancos.find(b => b.id === depBancoId)
        if (banco) {
          const ns = (banco.saldo || 0) - val
          await supabase.from('contas_banco').update({ saldo: ns }).eq('id', depBancoId)
          await supabase.from('extrato_banco').insert({
            user_id: session.user.id, casal_code: profile.casal_code,
            banco_id: depBancoId, banco_nome: banco.banco,
            tipo: 'saida', descricao: 'Depósito na reserva de emergência',
            valor: val, saldo_apos: ns,
            mes: new Date().getMonth(), ano: new Date().getFullYear(),
          })
        }
      }

      // Lança como despesa categoria Investimento
      if (depMoeda === 'BRL') {
        await supabase.from('despesas').insert({
          user_id: session.user.id, casal_code: profile.casal_code || session.user.id,
          nome: 'Aporte reserva de emergência', valor: val,
          categoria: 'Investimento', quem: profile.papel,
          tipo: 'fixa', pagamento_tipo: 'debito',
          banco_id: depBancoId || null,
          banco_nome: bancos.find(b => b.id === depBancoId)?.banco || '',
          mes: new Date().getMonth(), ano: new Date().getFullYear(),
        })
      }

      setModalDeposito(false); setDepValor(''); loadData()
      alert('✅ ' + (depMoeda === 'USD' ? 'US$' : 'R$') + val.toFixed(2) + ' adicionados à reserva!')
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function salvarRetirada(e) {
    e.preventDefault()
    const val = parseFloat(retValor) || 0
    if (val <= 0) { alert('Informe o valor'); return }
    if (val > (reserva.atual || 0)) { alert('Valor maior que a reserva atual'); return }
    setSaving(true)
    try {
      const novoAtual = (reserva.atual || 0) - val
      if (reserva.id) await supabase.from('reserva').update({ atual: novoAtual }).eq('id', reserva.id)
      if (retBancoId) {
        const banco = bancos.find(b => b.id === retBancoId)
        if (banco) {
          const ns = (banco.saldo || 0) + val
          await supabase.from('contas_banco').update({ saldo: ns }).eq('id', retBancoId)
          await supabase.from('extrato_banco').insert({
            user_id: session.user.id, casal_code: profile.casal_code,
            banco_id: retBancoId, banco_nome: banco.banco,
            tipo: 'entrada', descricao: 'Retirada da reserva de emergência',
            valor: val, saldo_apos: ns,
            mes: new Date().getMonth(), ano: new Date().getFullYear(),
          })
        }
      }
      setModalRetirada(false); loadData()
      alert(`✅ ${fmt(val)} retirados da reserva.`)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const pctBRL = reserva.meta > 0 ? Math.min(100, (reserva.atual / reserva.meta) * 100) : 0
  const pctUSD = reserva.meta_usd > 0 ? Math.min(100, ((reserva.atual_usd || 0) / reserva.meta_usd) * 100) : 0
  const totalBRL = (reserva.atual || 0) + toBRL(reserva.atual_usd || 0)
  const rendimento = reserva.rende_cdi
    ? (reserva.atual || 0) * ((reserva.taxa_cdi_mensal || 0.92) / 100) * (reserva.pct_cdi || 100) / 100
    : 0

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* BRL */}
        <div className="card">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 500, color: 'var(--green)' }}>{fmt(reserva.atual)}</div>
              <div style={{ fontSize: 13, color: 'var(--secondary)', marginTop: 2 }}>Meta: {fmt(reserva.meta)}</div>
              {reserva.rende_cdi && (
                <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 4 }}>
                  🏦 {reserva.pct_cdi || 100}% CDI · +{fmt(rendimento)}/mês
                </div>
              )}
            </div>
            <span style={{ fontSize: 48 }}>🛡️</span>
          </div>
          <div className="prog-wrap" style={{ marginBottom: 8 }}>
            <div className="prog-fill" style={{
              width: pctBRL + '%',
              background: pctBRL >= 100 ? 'var(--green)' : pctBRL >= 50 ? 'var(--blue)' : 'var(--yellow)'
            }} />
          </div>
          <div className="row-between" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--green)', fontWeight: 500 }}>{pctBRL.toFixed(0)}% atingido</span>
            <span style={{ color: 'var(--secondary)' }}>Faltam {fmt(Math.max(0, reserva.meta - reserva.atual))}</span>
          </div>
        </div>

        {/* USD */}
        {((reserva.meta_usd || 0) > 0 || (reserva.atual_usd || 0) > 0) ? (
          <div className="card" style={{ background: '#F0FAF0' }}>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--usd)' }}>
                  {fmt(reserva.atual_usd || 0, 'USD')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--secondary)', marginTop: 2 }}>
                  Meta: {fmt(reserva.meta_usd || 0, 'USD')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                  ≈ {fmt(toBRL(reserva.atual_usd || 0))} hoje
                </div>
              </div>
              <span style={{ fontSize: 40 }}>🇺🇸</span>
            </div>
            <div className="prog-wrap" style={{ marginBottom: 8 }}>
              <div className="prog-fill" style={{ width: pctUSD + '%', background: 'var(--usd)' }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--usd)', fontWeight: 500 }}>{pctUSD.toFixed(0)}% atingido</span>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9F8F6' }}>
            <div style={{ textAlign: 'center', color: 'var(--secondary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🇺🇸</div>
              <div style={{ fontSize: 13 }}>Configure reserva em dólar</div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setModalCfg(true)}>
                ⚙️ Configurar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Total consolidado */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Total consolidado</div>
        <div className="row-between" style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ color: 'var(--secondary)' }}>Reserva BRL</span>
          <span style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(reserva.atual || 0)}</span>
        </div>
        {(reserva.atual_usd || 0) > 0 && (
          <div className="row-between" style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
            <span style={{ color: 'var(--secondary)' }}>Reserva USD (convertido)</span>
            <span style={{ fontWeight: 500, color: 'var(--usd)' }}>{fmt(toBRL(reserva.atual_usd || 0))}</span>
          </div>
        )}
        <div className="row-between" style={{ padding: '8px 0' }}>
          <span style={{ fontWeight: 600 }}>Total em BRL</span>
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--blue)' }}>{fmt(totalBRL)}</span>
        </div>
      </div>

      {/* Calculadora 6/12 meses */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>🧮 Calculadora de meta ideal</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[6, 12].map(m => (
            <button key={m} onClick={() => setMesesReserva(m)}
              className={`btn ${mesesReserva === m ? 'btn-primary' : 'btn-outline'}`}
              style={{ justifyContent: 'center', flexDirection: 'column', padding: '14px', height: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{m} meses</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {m === 6 ? 'Recomendado' : 'Conservador'}
              </div>
            </button>
          ))}
        </div>

        <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--secondary)' }}>Fixas/mês:</span>
              <span style={{ fontWeight: 500, marginLeft: 6 }}>{fmt(totalFixas)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--secondary)' }}>Recorrências/mês:</span>
              <span style={{ fontWeight: 500, marginLeft: 6 }}>{fmt(totalRecorrencias)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--secondary)' }}>Base mensal:</span>
              <span style={{ fontWeight: 500, marginLeft: 6 }}>{fmt(baseReserva)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--blue)', fontWeight: 600 }}>Meta ideal ({mesesReserva}m):</span>
              <span style={{ fontWeight: 700, color: 'var(--blue)', marginLeft: 6 }}>{fmt(metaIdeal)}</span>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={aplicarMeta} disabled={saving}>
          {saving ? 'Aplicando...' : `✅ Aplicar meta de ${mesesReserva} meses (${fmt(metaIdeal)})`}
        </button>
      </div>

      {/* Botões de ação */}
      <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
        <button className="btn" style={{ background:'#1D9E75', color:'#fff' }}
          onClick={() => { setDepValor(''); setDepMoeda('BRL'); setDepBancoId(bancos[0]?.id||''); setModalDeposito(true) }}>
          💰 Depositar
        </button>
        <button className="btn btn-outline" onClick={() => { setNovaMeta(String(reserva.meta || 30000)); setModalMeta(true) }}>
          🎯 Meta manual
        </button>
        <button className="btn btn-outline" onClick={() => setModalCfg(true)}>⚙️ CDI / USD</button>
        <button className="btn btn-red" onClick={() => { setRetValor(''); setModalRetirada(true) }}>💸 Retirar</button>
      </div>

      {/* Modal Meta */}
      {modalMeta && (
        <div className="modal-overlay" onClick={() => setModalMeta(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🎯 Definir meta manualmente</h3>
            <form onSubmit={salvarMeta}>
              <div className="form-group">
                <label className="form-label">Meta (R$)</label>
                <input className="form-input" type="number" step="0.01" value={novaMeta}
                  onChange={e => setNovaMeta(e.target.value)} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalMeta(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CDI/USD */}
      {modalCfg && (
        <div className="modal-overlay" onClick={() => setModalCfg(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>⚙️ Configurar reserva</h3>
            <form onSubmit={salvarCfg}>
              <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 500, color: 'var(--blue)' }}>🏦 Rendimento CDI</div>
              </div>
              <div className="form-group">
                <label className="form-label">Sua reserva rende CDI?</label>
                <select className="form-select" value={resCdiAtivo ? 'sim' : 'nao'}
                  onChange={e => setResCdiAtivo(e.target.value === 'sim')}>
                  <option value="sim">✅ Sim</option>
                  <option value="nao">❌ Não</option>
                </select>
              </div>
              {resCdiAtivo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">% do CDI</label>
                    <input className="form-input" type="number" step="0.1" value={resPctCdi}
                      onChange={e => setResPctCdi(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taxa CDI mensal (%)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="Ex: 0.92"
                      value={resTaxaCdi} onChange={e => setResTaxaCdi(e.target.value)} />
                  </div>
                </div>
              )}
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ background: '#F0FAF0', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ fontWeight: 500, color: 'var(--usd)' }}>🇺🇸 Reserva em Dólar</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Valor atual (US$)</label>
                    <input className="form-input" type="number" step="0.01" value={resAtualUsd}
                      onChange={e => setResAtualUsd(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Meta (US$)</label>
                    <input className="form-input" type="number" step="0.01" value={resMetaUsd}
                      onChange={e => setResMetaUsd(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalCfg(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Depositar */}
      {modalDeposito && (
        <div className="modal-overlay" onClick={() => setModalDeposito(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💰 Depositar na reserva</h3>
            <div style={{ background:'#E1F5EE', borderRadius:10, padding:12, marginBottom:16 }}>
              <div style={{ fontWeight:500, color:'var(--green)' }}>Saldo atual: {fmt(reserva.atual)}</div>
              {(reserva.atual_usd||0) > 0 && <div style={{ fontSize:12, color:'var(--secondary)', marginTop:4 }}>USD: {fmt(reserva.atual_usd||0,'USD')}</div>}
            </div>
            <form onSubmit={salvarDeposito}>
              <div className="form-group">
                <label className="form-label">Moeda</label>
                <select className="form-select" value={depMoeda} onChange={e => setDepMoeda(e.target.value)}>
                  <option value="BRL">🇧🇷 Real (BRL)</option>
                  <option value="USD">🇺🇸 Dólar (USD)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor ({depMoeda})</label>
                <input className="form-input" type="number" step="0.01" placeholder="Ex: 500"
                  value={depValor} onChange={e => setDepValor(e.target.value)} required />
                {depValor && (
                  <div style={{ fontSize:12, marginTop:6, color:'var(--green)' }}>
                    Após depósito: {depMoeda==='USD' ? fmt((reserva.atual_usd||0)+parseFloat(depValor||0),'USD') : fmt((reserva.atual||0)+parseFloat(depValor||0))}
                  </div>
                )}
              </div>
              {depMoeda === 'BRL' && (
                <div className="form-group">
                  <label className="form-label">🏦 Debitar de qual banco?</label>
                  <select className="form-select" value={depBancoId} onChange={e => setDepBancoId(e.target.value)}>
                    <option value="">Não movimentar banco</option>
                    {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                  </select>
                  {depBancoId && depValor && (() => {
                    const banco = bancos.find(b => b.id === depBancoId)
                    const ns = (banco?.saldo||0) - (parseFloat(depValor)||0)
                    return <div style={{ fontSize:12, marginTop:6, color: ns>=0?'var(--green)':'var(--red)' }}>Saldo após: {fmt(ns)} {ns<0?'⚠️':'✓'}</div>
                  })()}
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalDeposito(false)}>Cancelar</button>
                <button type="submit" className="btn" style={{ background:'#1D9E75', color:'#fff' }} disabled={saving}>
                  {saving ? 'Salvando...' : 'Confirmar depósito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Retirada */}
      {modalRetirada && (
        <div className="modal-overlay" onClick={() => setModalRetirada(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💸 Retirar da reserva</h3>
            <div style={{ background: '#FFF3CD', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, color: 'var(--yellow)' }}>Saldo atual: {fmt(reserva.atual)}</div>
              <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>
                Use apenas para emergências reais
              </div>
            </div>
            <form onSubmit={salvarRetirada}>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={retValor}
                  onChange={e => setRetValor(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Depositar em qual banco? (opcional)</label>
                <select className="form-select" value={retBancoId} onChange={e => setRetBancoId(e.target.value)}>
                  <option value="">Não depositar</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalRetirada(false)}>Cancelar</button>
                <button type="submit" className="btn btn-red" disabled={saving}>
                  {saving ? 'Processando...' : 'Confirmar retirada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
