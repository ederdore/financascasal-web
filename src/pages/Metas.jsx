import { useState, useEffect } from 'react'
import { supabase, fmt, CATS_META } from '../supabase.js'

export default function Metas({ session, profile }) {
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalAporte, setModalAporte] = useState(false)
  const [edit, setEdit] = useState(null)
  const [metaAporte, setMetaAporte] = useState(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorAlvo, setValorAlvo] = useState('')
  const [valorAtual, setValorAtual] = useState('0')
  const [dono, setDono] = useState(profile.papel)
  const [categoria, setCategoria] = useState('viagem')
  const [dataAlvo, setDataAlvo] = useState('')
  const [aporteValor, setAporteValor] = useState('')
  const [aporteQuem, setAporteQuem] = useState(profile.papel)
  const [aporteObs, setAporteObs] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const { data } = await cf(supabase.from('metas').select('*')).order('created_at', { ascending: false })
    if (data) {
      // Normaliza: usa valor_atual se existir, senão usa atual
      const normalized = data.map(m => ({
        ...m,
        valor_atual: m.valor_atual ?? m.atual ?? 0,
        valor_alvo: m.valor_alvo ?? 0,
      }))
      setMetas(normalized)
    }
    setLoading(false)
  }

  function openModal(m = null) {
    setEdit(m); setNome(m?.nome || ''); setDescricao(m?.descricao || '')
    setValorAlvo(m ? String(m.valor_alvo) : ''); setValorAtual(m ? String(m.valor_atual) : '0')
    setDono(m?.dono || profile.papel); setCategoria(m?.categoria || 'viagem')
    setDataAlvo(m?.data_alvo || ''); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      user_id: session.user.id,
      casal_code: profile.casal_code || session.user.id,
      nome,
      descricao: descricao || null,
      valor_alvo: parseFloat(valorAlvo) || 0,
      valor_atual: parseFloat(valorAtual) || 0,
      atual: parseFloat(valorAtual) || 0,
      dono,
      categoria,
      data_alvo: dataAlvo || null,
      ativa: true,
    }
    try {
      let result
      if (edit) {
        result = await supabase.from('metas').update(payload).eq('id', edit.id)
      } else {
        result = await supabase.from('metas').insert(payload)
      }
      if (result.error) throw result.error
      setModal(false); loadData()
    } catch (e) {
      console.error('Erro metas:', e)
      alert('Erro ao salvar meta: ' + (e.message || JSON.stringify(e)))
    } finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta meta?')) return
    await supabase.from('metas').delete().eq('id', id); loadData()
  }

  async function salvarAporte(e) {
    e.preventDefault()
    const val = parseFloat(aporteValor) || 0
    if (val <= 0 || !metaAporte) { alert('Informe o valor'); return }
    setSaving(true)
    const now = new Date()
    try {
      const novoAtual = (metaAporte.valor_atual || 0) + val
      const r1 = await supabase.from('metas').update({ valor_atual: novoAtual, atual: novoAtual, updated_at: new Date() }).eq('id', metaAporte.id)
      if (r1.error) throw r1.error
      const r2 = await supabase.from('aportes_metas').insert({ user_id: session.user.id, casal_code: profile.casal_code || session.user.id, meta_id: metaAporte.id, valor: val, quem: aporteQuem, observacao: aporteObs || null, mes: now.getMonth(), ano: now.getFullYear() })
      if (r2.error) throw r2.error
      setModalAporte(false); loadData()
      if (novoAtual >= metaAporte.valor_alvo) alert(`🎉 Meta "${metaAporte.nome}" concluída! Parabéns!`)
    } catch (e) {
      console.error('Erro aporte:', e)
      alert('Erro ao salvar aporte: ' + (e.message || JSON.stringify(e)))
    } finally { setSaving(false) }
  }

  if (loading) return <div className="empty">Carregando...</div>

  const metasAtivas = metas.filter(m => m.ativa && m.valor_atual < m.valor_alvo)
  const metasConcluidas = metas.filter(m => m.valor_atual >= m.valor_alvo)

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{metas.length} meta(s) · {metasConcluidas.length} concluída(s)</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total acumulado: {fmt(metas.reduce((s, m) => s + m.valor_atual, 0))}</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Nova meta</button>
      </div>

      {/* Metas ativas */}
      {metasAtivas.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Em andamento</div>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {metasAtivas.map(m => {
              const pct = m.valor_alvo > 0 ? Math.min(100, (m.valor_atual / m.valor_alvo) * 100) : 0
              const cor = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : 'var(--yellow)'
              const catItem = CATS_META.find(c => c[0] === m.categoria)
              return (
                <div key={m.id} className="card">
                  <div className="row-between" style={{ marginBottom: 12 }}>
                    <div className="row">
                      <span style={{ fontSize: 28 }}>{catItem ? catItem[1].split(' ')[0] : '🎯'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{m.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                          {m.dono === 'eu' ? 'EU' : m.dono === 'ela' ? 'ELA' : 'Casal'}
                          {m.data_alvo ? ` · até ${new Date(m.data_alvo).toLocaleDateString('pt-BR')}` : ''}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: cor }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="row-between" style={{ fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: cor, fontWeight: 500 }}>{fmt(m.valor_atual)}</span>
                    <span style={{ color: 'var(--secondary)' }}>de {fmt(m.valor_alvo)}</span>
                  </div>
                  <div className="prog-wrap" style={{ marginBottom: 8 }}>
                    <div className="prog-fill" style={{ width: pct + '%', background: cor }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 12 }}>
                    Faltam {fmt(Math.max(0, m.valor_alvo - m.valor_atual))}
                    {m.descricao && ` · ${m.descricao}`}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-green btn-sm" onClick={() => { setMetaAporte(m); setAporteValor(''); setAporteQuem(profile.papel); setAporteObs(''); setModalAporte(true) }}>💰 Aportar</button>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal(m)}>✏️</button>
                    <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(m.id)}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Metas concluídas */}
      {metasConcluidas.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>✅ Concluídas</div>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {metasConcluidas.map(m => {
              const catItem = CATS_META.find(c => c[0] === m.categoria)
              return (
                <div key={m.id} className="card" style={{ borderColor: 'var(--green)', borderWidth: 1.5, opacity: 0.85 }}>
                  <div className="row-between">
                    <div className="row">
                      <span style={{ fontSize: 26 }}>{catItem ? catItem[1].split(' ')[0] : '🎯'}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--secondary)' }}>{fmt(m.valor_atual)} atingido</div>
                      </div>
                    </div>
                    <span className="badge badge-green">✓ Concluída</span>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal(m)}>✏️</button>
                    <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(m.id)}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {metas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Nenhuma meta ainda</div>
          <div style={{ color: 'var(--secondary)', fontSize: 13 }}>Crie sua primeira meta financeira!</div>
        </div>
      )}

      {/* Resumo por dono */}
      {metas.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Resumo do casal</div>
          {['eu', 'ela', 'casal'].map(d => {
            const metasDono = metas.filter(m => m.dono === d)
            if (metasDono.length === 0) return null
            const totalAlvo = metasDono.reduce((s, m) => s + m.valor_alvo, 0)
            const totalAtual = metasDono.reduce((s, m) => s + m.valor_atual, 0)
            const pct = totalAlvo > 0 ? (totalAtual / totalAlvo) * 100 : 0
            const cor = d === 'eu' ? 'var(--eu-text)' : d === 'ela' ? 'var(--ela-text)' : 'var(--green)'
            return (
              <div key={d} style={{ marginBottom: 14 }}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>{d === 'eu' ? 'EU' : d === 'ela' ? 'ELA' : 'Casal'} — {metasDono.length} meta(s)</span>
                  <span style={{ fontSize: 13, color: 'var(--secondary)' }}>{fmt(totalAtual)} / {fmt(totalAlvo)}</span>
                </div>
                <div className="prog-wrap">
                  <div className="prog-fill" style={{ width: pct + '%', background: cor }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal meta */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar meta' : '🎯 Nova meta'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome</label><input className="form-input" placeholder="Ex: Viagem para Europa..." value={nome} onChange={e => setNome(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Categoria</label><select className="form-select" value={categoria} onChange={e => setCategoria(e.target.value)}>{CATS_META.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="form-group"><label className="form-label">De quem?</label><select className="form-select" value={dono} onChange={e => setDono(e.target.value)}><option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal 👫</option></select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Valor alvo (R$)</label><input className="form-input" type="number" step="0.01" value={valorAlvo} onChange={e => setValorAlvo(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Já guardado (R$)</label><input className="form-input" type="number" step="0.01" value={valorAtual} onChange={e => setValorAtual(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Descrição (opcional)</label><input className="form-input" placeholder="Ex: Lua de mel..." value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Data alvo (opcional)</label><input className="form-input" type="date" value={dataAlvo} onChange={e => setDataAlvo(e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Criar meta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal aporte */}
      {modalAporte && metaAporte && (
        <div className="modal-overlay" onClick={() => setModalAporte(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💰 Aportar — {metaAporte.nome}</h3>
            <div style={{ background: '#E1F5EE', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(metaAporte.valor_atual)} de {fmt(metaAporte.valor_alvo)}</div>
              <div className="prog-wrap" style={{ margin: '8px 0' }}>
                <div className="prog-fill" style={{ width: Math.min(100, (metaAporte.valor_atual / metaAporte.valor_alvo) * 100) + '%', background: 'var(--green)' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Faltam {fmt(Math.max(0, metaAporte.valor_alvo - metaAporte.valor_atual))}</div>
            </div>
            <form onSubmit={salvarAporte}>
              <div className="form-group"><label className="form-label">Valor do aporte (R$)</label><input className="form-input" type="number" step="0.01" placeholder="Ex: 500" value={aporteValor} onChange={e => setAporteValor(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Quem está aportando?</label><select className="form-select" value={aporteQuem} onChange={e => setAporteQuem(e.target.value)}><option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option></select></div>
              <div className="form-group"><label className="form-label">Observação (opcional)</label><input className="form-input" placeholder="Ex: Guardei do 13º..." value={aporteObs} onChange={e => setAporteObs(e.target.value)} /></div>
              {aporteValor && (
                <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: 'var(--blue)' }}>
                  Após aporte: {fmt((metaAporte.valor_atual || 0) + (parseFloat(aporteValor) || 0))} ({Math.min(100, (((metaAporte.valor_atual || 0) + (parseFloat(aporteValor) || 0)) / metaAporte.valor_alvo) * 100).toFixed(0)}%)
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalAporte(false)}>Cancelar</button>
                <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar aporte'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
