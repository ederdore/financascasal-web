import { useState, useEffect } from 'react'
import { supabase, fmt, MESES } from '../supabase.js'

export default function Cartoes({ session, profile }) {
  const [cartoes, setCartoes] = useState([])
  const [historico, setHistorico] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalPag, setModalPag] = useState(false)
  const [edit, setEdit] = useState(null)
  const [pagCartao, setPagCartao] = useState(null)
  const [pagBancoId, setPagBancoId] = useState('')
  const [pagValor, setPagValor] = useState('')
  const [pagLancarConta, setPagLancarConta] = useState(true)
  // Form cartão
  const [nome, setNome] = useState('')
  const [limite, setLimite] = useState('')
  const [fatura, setFatura] = useState('')
  const [titular, setTitular] = useState(profile.papel)
  const [diaVenc, setDiaVenc] = useState('10')
  const [diaFech, setDiaFech] = useState('3')
  const [bancoPagId, setBancoPagId] = useState('')
  const [bancoPagNome, setBancoPagNome] = useState('')
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [c, h, p, b] = await Promise.all([
      cf(supabase.from('cartoes').select('*')),
      cf(supabase.from('historico_faturas').select('*')).order('created_at', { ascending: false }).limit(30),
      cf(supabase.from('parcelas').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('contas_banco').select('*')),
    ])
    if (c.data) setCartoes(c.data)
    if (h.data) setHistorico(h.data)
    if (p.data) setParcelas(p.data)
    if (b.data) {
      setBancos(b.data)
      const principal = b.data.find(x => x.id === profile.banco_principal_id) || b.data[0]
      if (principal) setPagBancoId(principal.id)
    }
    setLoading(false)
  }

  function openModal(c = null) {
    setEdit(c); setNome(c?.nome || ''); setLimite(c ? String(c.limite) : '')
    setFatura(c ? String(c.fatura) : ''); setTitular(c?.titular || profile.papel)
    setDiaVenc(c?.dia_vencimento ? String(c.dia_vencimento) : '10')
    setDiaFech(c?.dia_fechamento ? String(c.dia_fechamento) : '3')
    setBancoPagId(c?.banco_id_pagamento || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
    setBancoPagNome(c?.banco_nome_pagamento || bancos.find(b => b.id === profile.banco_principal_id)?.banco || bancos[0]?.banco || '')
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      user_id: session.user.id, casal_code: profile.casal_code || session.user.id,
      nome, titular, limite: parseFloat(limite), fatura: parseFloat(fatura) || 0,
      limite_bloqueado: edit?.limite_bloqueado || 0,
      dia_vencimento: parseInt(diaVenc) || 10, dia_fechamento: parseInt(diaFech) || 3,
      banco_id_pagamento: bancoPagId || null,
      banco_nome_pagamento: bancoPagNome || '',
    }
    try {
      if (edit) await supabase.from('cartoes').update(payload).eq('id', edit.id)
      else await supabase.from('cartoes').insert(payload)
      setModal(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function pagarFatura(e) {
    e.preventDefault(); if (!pagCartao) return
    const v = parseFloat(pagValor) || 0
    if (v <= 0) { alert('Informe o valor'); return }
    setSaving(true)
    try {
      const cc = profile.casal_code || session.user.id
      const banco = bancos.find(b => b.id === pagBancoId)

      // 1. Debita do banco
      if (banco) {
        const ns = (banco.saldo || 0) - v
        await supabase.from('contas_banco').update({ saldo: ns }).eq('id', pagBancoId)
        await supabase.from('extrato_banco').insert({
          user_id: session.user.id, casal_code: cc,
          banco_id: pagBancoId, banco_nome: banco.banco,
          tipo: 'saida', descricao: `Pagamento fatura ${pagCartao.nome}`,
          categoria: 'Moradia', valor: v, saldo_apos: ns,
          mes: now.getMonth(), ano: now.getFullYear(),
        })
      }

      // 2. Registra no histórico de faturas
      const hf = historico.find(h => h.cartao_id === pagCartao.id && h.mes === now.getMonth() && h.ano === now.getFullYear())
      if (hf) {
        await supabase.from('historico_faturas').update({
          paga: true, paga_em: new Date().toISOString(),
          banco_pagamento_nome: banco?.banco || '',
        }).eq('id', hf.id)
      }

      // 3. Zera a fatura do cartão
      await supabase.from('cartoes').update({ fatura: 0, limite_bloqueado: 0 }).eq('id', pagCartao.id)

      // 4. Lança como despesa E como conta ativa (se marcado)
      if (pagLancarConta) {
        // Lança despesa
        await supabase.from('despesas').insert({
          user_id: session.user.id, casal_code: cc,
          nome: `Fatura ${pagCartao.nome}`, valor: v,
          categoria: 'Moradia', quem: profile.papel, tipo: 'fixa',
          mes: now.getMonth(), ano: now.getFullYear(),
          pagamento_tipo: 'debito',
          banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
        })

        // Verifica se já existe conta fixa para esse cartão
        const { data: contaExistente } = await supabase.from('contas_fixas')
          .select('*').eq('casal_code', cc)
          .ilike('nome', `%${pagCartao.nome}%`).maybeSingle()

        if (contaExistente) {
          // Atualiza valor da conta fixa existente com o valor atual da fatura
          await supabase.from('contas_fixas').update({
            valor: v, banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
          }).eq('id', contaExistente.id)
        } else {
          // Cria nova conta fixa para este cartão
          await supabase.from('contas_fixas').insert({
            user_id: session.user.id, casal_code: cc,
            nome: `Fatura ${pagCartao.nome}`, valor: v,
            categoria: 'Moradia', quem: profile.papel,
            dia_vencimento: pagCartao.dia_vencimento || 10,
            banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
          })
        }
      } else {
        // Só lança a despesa
        await supabase.from('despesas').insert({
          user_id: session.user.id, casal_code: cc,
          nome: `Fatura ${pagCartao.nome}`, valor: v,
          categoria: 'Moradia', quem: profile.papel, tipo: 'fixa',
          mes: now.getMonth(), ano: now.getFullYear(),
          pagamento_tipo: 'debito',
          banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
        })
      }

      setModalPag(false); loadData()
      alert(`✅ Fatura paga! ${fmt(v)} debitados do ${banco?.banco || 'banco'}.${pagLancarConta ? '\n\nConta fixa atualizada automaticamente.' : ''}`)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="empty">Carregando...</div>

  const faturaTotal = cartoes.reduce((s, c) => s + (c.fatura || 0), 0)

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--red)' }}>{fmt(faturaTotal)}</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Total em faturas abertas</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Novo cartão</button>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {cartoes.map(c => {
          const bloqueado = c.limite_bloqueado || 0
          const pct = c.limite > 0 ? Math.min(100, (((c.fatura || 0) + bloqueado) / c.limite) * 100) : 0
          const cor = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)'
          const fatMes = historico.find(h => h.cartao_id === c.id && h.mes === now.getMonth() && h.ano === now.getFullYear())
          const parcsCartao = parcelas.filter(p => p.cartao_id === c.id)
          const bancoPag = bancos.find(b => b.id === c.banco_id_pagamento)
          return (
            <div key={c.id} className="card">
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>💳 {c.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                    {c.titular === 'eu' ? 'EU' : c.titular === 'ela' ? 'ELA' : 'Casal'} · Limite {fmt(c.limite)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                    Fecha dia {c.dia_fechamento || 3} · Vence dia {c.dia_vencimento || 10}
                  </div>
                  {bancoPag && (
                    <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 2 }}>
                      🏦 Pagamento via {bancoPag.banco}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: cor }}>{pct.toFixed(0)}%</div>
                  {fatMes && (
                    <span className={`badge ${fatMes.paga ? 'badge-green' : 'badge-red'}`}>
                      {fatMes.paga ? '✓ Paga' : 'Pendente'}
                    </span>
                  )}
                </div>
              </div>

              <div className="prog-wrap" style={{ margin: '12px 0 8px' }}>
                <div className="prog-fill" style={{ width: (c.limite > 0 ? ((c.fatura || 0) / c.limite) * 100 : 0) + '%', background: 'var(--red)' }} />
                {bloqueado > 0 && <div className="prog-fill" style={{ width: (c.limite > 0 ? (bloqueado / c.limite) * 100 : 0) + '%', background: 'var(--yellow)' }} />}
              </div>

              <div className="row-between" style={{ fontSize: 12, marginBottom: 10 }}>
                <span style={{ color: 'var(--red)' }}>Fatura: {fmt(c.fatura || 0)}</span>
                {bloqueado > 0 && <span style={{ color: 'var(--yellow)' }}>Bloq.: {fmt(bloqueado)}</span>}
                <span style={{ color: 'var(--green)' }}>Livre: {fmt(Math.max(0, c.limite - (c.fatura || 0) - bloqueado))}</span>
              </div>

              {parcsCartao.length > 0 && (
                <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 4 }}>
                    📦 {parcsCartao.length} parcela(s) ativa(s)
                  </div>
                  {parcsCartao.map(p => (
                    <div key={p.id} style={{ fontSize: 12 }}>
                      {p.descricao} ({p.parcela_atual}/{p.total_parcelas}) — {fmt(p.valor_parcela)}/mês
                    </div>
                  ))}
                </div>
              )}

              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => openModal(c)}>✏️ Editar</button>
                {(c.fatura || 0) > 0 && (!fatMes || !fatMes.paga) && (
                  <button className="btn btn-green btn-sm" onClick={() => {
                    setPagCartao(c)
                    setPagValor(String(c.fatura || 0))
                    setPagBancoId(c.banco_id_pagamento || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
                    setPagLancarConta(true)
                    setModalPag(true)
                  }}>💳 Pagar fatura</button>
                )}
                <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }}
                  onClick={async () => { if (confirm('Excluir cartão?')) { await supabase.from('cartoes').delete().eq('id', c.id); loadData() } }}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      {cartoes.length === 0 && <div className="empty">Nenhum cartão cadastrado</div>}

      {historico.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Histórico de faturas</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cartão</th><th>Mês</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.id}>
                    <td>{h.cartao_nome}</td>
                    <td>{MESES[h.mes]} {h.ano}</td>
                    <td style={{ fontWeight: 500 }}>{fmt(h.valor)}</td>
                    <td><span className={`badge ${h.paga ? 'badge-green' : 'badge-red'}`}>{h.paga ? '✓ Paga' : 'Pendente'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal cartão */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar cartão' : '💳 Novo cartão'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome</label>
                <input className="form-input" placeholder="Ex: Nubank, Itaú..." value={nome} onChange={e => setNome(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Titular</label>
                <select className="form-select" value={titular} onChange={e => setTitular(e.target.value)}>
                  <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option>
                </select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Limite (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={limite} onChange={e => setLimite(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Fatura atual (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={fatura} onChange={e => setFatura(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Dia fechamento</label>
                  <input className="form-input" type="number" min="1" max="31" value={diaFech} onChange={e => setDiaFech(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Dia vencimento</label>
                  <input className="form-input" type="number" min="1" max="31" value={diaVenc} onChange={e => setDiaVenc(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">🏦 Banco de pagamento padrão</label>
                <select className="form-select" value={bancoPagId} onChange={e => { setBancoPagId(e.target.value); setBancoPagNome(bancos.find(b => b.id === e.target.value)?.banco || '') }}>
                  <option value="">Não vincular banco</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 4 }}>
                  Banco usado automaticamente ao pagar a fatura
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal pagar fatura */}
      {modalPag && (
        <div className="modal-overlay" onClick={() => setModalPag(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💳 Pagar fatura — {pagCartao?.nome}</h3>
            <div style={{ background: '#E1F5EE', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, color: 'var(--green)' }}>Fatura atual: {fmt(pagCartao?.fatura || 0)}</div>
              <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>Após pagar, fatura será zerada</div>
            </div>
            <form onSubmit={pagarFatura}>
              <div className="form-group"><label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={pagValor} onChange={e => setPagValor(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Pagar com qual banco?</label>
                <select className="form-select" value={pagBancoId} onChange={e => setPagBancoId(e.target.value)}>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select></div>
              <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={pagLancarConta} onChange={e => setPagLancarConta(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 500 }}>Lançar como conta fixa ativa</div>
                    <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 2 }}>
                      Cria ou atualiza a conta fixa "Fatura {pagCartao?.nome}" com o valor pago
                    </div>
                  </div>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalPag(false)}>Cancelar</button>
                <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Processando...' : 'Confirmar pagamento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
