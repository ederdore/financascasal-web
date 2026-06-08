import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL } from '../supabase.js'

export default function Reserva({ session, profile }) {
  const [reserva, setReserva] = useState({ meta: 30000, atual: 0, atual_usd: 0, meta_usd: 0, rende_cdi: false, pct_cdi: 100, taxa_cdi_mensal: 0.92 })
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalMeta, setModalMeta] = useState(false)
  const [modalCfg, setModalCfg] = useState(false)
  const [modalRetirada, setModalRetirada] = useState(false)
  const [novaMeta, setNovaMeta] = useState('')
  const [resCdiAtivo, setResCdiAtivo] = useState(false)
  const [resPctCdi, setResPctCdi] = useState('100')
  const [resTaxaCdi, setResTaxaCdi] = useState('0.92')
  const [resMetaUsd, setResMetaUsd] = useState('0')
  const [resAtualUsd, setResAtualUsd] = useState('0')
  const [retValor, setRetValor] = useState('')
  const [retBancoId, setRetBancoId] = useState('')
  const [saving, setSaving] = useState(false)
  const [contasFixas, setContasFixas] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const uid = session.user.id
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', uid)
    const [r, b, fx] = await Promise.all([
      supabase.from('reserva').select('*').eq('user_id', uid).maybeSingle(),
      cf(supabase.from('contas_banco').select('*')),
      cf(supabase.from('contas_fixas').select('valor')),
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
    if (fx.data) setContasFixas(fx.data)
    setLoading(false)
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
    const payload = { rende_cdi: resCdiAtivo, pct_cdi: parseFloat(resPctCdi) || 100, taxa_cdi_mensal: parseFloat(resTaxaCdi) || 0.92, meta_usd: parseFloat(resMetaUsd) || 0, atual_usd: parseFloat(resAtualUsd) || 0 }
    try {
      if (reserva.id) await supabase.from('reserva').update(payload).eq('id', reserva.id)
      else await supabase.from('reserva').insert({ user_id: session.user.id, meta: 30000, atual: 0, ...payload })
      setModalCfg(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function salvarRetirada(e) {
    e.preventDefault()
    const val = parseFloat(retValor) || 0
    if (val <= 0) { alert('Informe o valor'); return }
    if (val > (reserva.atual || 0)) { alert('Valor maior que a reserva atual'); return }
    setSaving(true)
    try {
      const novoAtual = (reserva.atual || 0) - val
      if (reserva.id) await supabase.from('reserva').update({ atual: novoAtual, updated_at: new Date() }).eq('id', reserva.id)
      if (retBancoId) {
        const banco = bancos.find(b => b.id === retBancoId)
        if (banco) {
          const ns = (banco.saldo || 0) + val
          await supabase.from('contas_banco').update({ saldo: ns }).eq('id', retBancoId)
          await supabase.from('extrato_banco').insert({ user_id: session.user.id, casal_code: profile.casal_code, banco_id: retBancoId, banco_nome: banco.banco, tipo: 'entrada', descricao: 'Retirada da reserva de emergência', valor: val, saldo_apos: ns, mes: new Date().getMonth(), ano: new Date().getFullYear() })
        }
      }
      setModalRetirada(false); loadData(); alert(`✅ ${fmt(val)} retirados da reserva.`)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const pctBRL = reserva.meta > 0 ? Math.min(100, (reserva.atual / reserva.meta) * 100) : 0
  const pctUSD = reserva.meta_usd > 0 ? Math.min(100, ((reserva.atual_usd || 0) / reserva.meta_usd) * 100) : 0
  const totalBRL = (reserva.atual || 0) + toBRL(reserva.atual_usd || 0)
  const rendimento = reserva.rende_cdi ? (reserva.atual || 0) * ((reserva.taxa_cdi_mensal || 0.92) / 100) * (reserva.pct_cdi || 100) / 100 : 0
  const totalFixas = contasFixas.reduce((s, f) => s + f.valor, 0)

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* BRL */}
        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--green)' }}>{fmt(reserva.atual)}</div>
              <div style={{ fontSize: 13, color: 'var(--secondary)', marginTop: 2 }}>Meta: {fmt(reserva.meta)}</div>
              {reserva.rende_cdi && <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 4 }}>🏦 {reserva.pct_cdi || 100}% CDI · +{fmt(rendimento)}/mês</div>}
            </div>
            <span style={{ fontSize: 40 }}>🛡️</span>
          </div>
          <div className="prog-wrap" style={{ marginBottom: 8 }}>
            <div className="prog-fill" style={{ width: pctBRL + '%', background: pctBRL >= 100 ? 'var(--green)' : pctBRL >= 50 ? 'var(--blue)' : 'var(--yellow)' }} />
          </div>
          <div className="row-between" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--green)', fontWeight: 500 }}>{pctBRL.toFixed(0)}% atingido</span>
            <span style={{ color: 'var(--secondary)' }}>Faltam {fmt(Math.max(0, reserva.meta - reserva.atual))}</span>
          </div>
        </div>

        {/* USD */}
        {((reserva.meta_usd || 0) > 0 || (reserva.atual_usd || 0) > 0) && (
          <div className="card" style={{ background: '#F0FAF0' }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--usd)' }}>{fmt(reserva.atual_usd || 0, 'USD')}</div>
                <div style={{ fontSize: 13, color: 'var(--secondary)', marginTop: 2 }}>Meta: {fmt(reserva.meta_usd || 0, 'USD')}</div>
                <div style={{ fontSize: 12, color: 'var(--secondary)' }}>≈ {fmt(toBRL(reserva.atual_usd || 0))} hoje</div>
              </div>
              <span style={{ fontSize: 36 }}>🇺🇸</span>
            </div>
            <div className="prog-wrap" style={{ marginBottom: 8 }}>
              <div className="prog-fill" style={{ width: pctUSD + '%', background: 'var(--usd)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--usd)', fontWeight: 500 }}>{pctUSD.toFixed(0)}% atingido</div>
          </div>
        )}
      </div>

      {/* Total consolidado */}
      <div className="card" style={{ marginBottom: 16 }}>
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
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--blue)' }}>{fmt(totalBRL)}</span>
        </div>
      </div>

      {/* Referência */}
      <div className="card" style={{ marginBottom: 20, background: '#EEF6FF' }}>
        <div style={{ fontWeight: 500, marginBottom: 6, color: 'var(--blue)' }}>📊 Referência de meta ideal</div>
        <div style={{ fontSize: 13, color: 'var(--secondary)' }}>
          Meta ideal = 6 meses de despesas fixas = <strong>{fmt(totalFixas * 6)}</strong><br />
          Você aporta <strong>{profile.pct_reserva || 5}%</strong> de cada receita automaticamente.
        </div>
      </div>

      {/* Botões */}
      <div className="row" style={{ gap: 10 }}>
        <button className="btn btn-outline" onClick={() => { setNovaMeta(String(reserva.meta || 30000)); setModalMeta(true) }}>🎯 Editar meta BRL</button>
        <button className="btn btn-outline" onClick={() => setModalCfg(true)}>⚙️ CDI / USD</button>
        <button className="btn btn-red" onClick={() => { setRetValor(''); setModalRetirada(true) }}>💸 Retirar da reserva</button>
      </div>

      {/* Modal Meta */}
      {modalMeta && (
        <div className="modal-overlay" onClick={() => setModalMeta(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🎯 Editar meta da reserva</h3>
            <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--blue)' }}>
              Sugestão: 6 meses de fixas = {fmt(totalFixas * 6)}
            </div>
            <form onSubmit={salvarMeta}>
              <div className="form-group"><label className="form-label">Nova meta (R$)</label><input className="form-input" type="number" step="0.01" value={novaMeta} onChange={e => setNovaMeta(e.target.value)} required /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalMeta(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar meta'}</button>
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
                <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>Configure se sua reserva rende % do CDI</div>
              </div>
              <div className="form-group"><label className="form-label">Sua reserva rende CDI?</label><select className="form-select" value={resCdiAtivo ? 'sim' : 'nao'} onChange={e => setResCdiAtivo(e.target.value === 'sim')}><option value="sim">✅ Sim</option><option value="nao">❌ Não</option></select></div>
              {resCdiAtivo && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group"><label className="form-label">% do CDI</label><input className="form-input" type="number" step="0.1" value={resPctCdi} onChange={e => setResPctCdi(e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Taxa CDI mensal (%)</label><input className="form-input" type="number" step="0.01" placeholder="Ex: 0.92" value={resTaxaCdi} onChange={e => setResTaxaCdi(e.target.value)} /></div>
                  </div>
                  <div style={{ background: '#E1F5EE', borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: 'var(--green)' }}>
                    📈 Rendimento estimado: {fmt((reserva.atual || 0) * ((parseFloat(resTaxaCdi) || 0.92) / 100) * (parseFloat(resPctCdi) || 100) / 100)}/mês
                  </div>
                </>
              )}
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ background: '#F0FAF0', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ fontWeight: 500, color: 'var(--usd)' }}>🇺🇸 Reserva em Dólar</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label className="form-label">Valor atual (US$)</label><input className="form-input" type="number" step="0.01" value={resAtualUsd} onChange={e => setResAtualUsd(e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Meta (US$)</label><input className="form-input" type="number" step="0.01" value={resMetaUsd} onChange={e => setResMetaUsd(e.target.value)} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalCfg(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
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
              <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>Use apenas para emergências reais</div>
            </div>
            <form onSubmit={salvarRetirada}>
              <div className="form-group"><label className="form-label">Valor (R$)</label><input className="form-input" type="number" step="0.01" value={retValor} onChange={e => setRetValor(e.target.value)} required /></div>
              <div className="form-group">
                <label className="form-label">Depositar em qual banco? (opcional)</label>
                <select className="form-select" value={retBancoId} onChange={e => setRetBancoId(e.target.value)}>
                  <option value="">Não depositar</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalRetirada(false)}>Cancelar</button>
                <button type="submit" className="btn btn-red" disabled={saving}>{saving ? 'Processando...' : 'Confirmar retirada'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
