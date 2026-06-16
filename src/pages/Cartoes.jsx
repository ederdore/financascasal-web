import FaturaDetalhe from './FaturaDetalhe.jsx'
import { useState, useEffect } from 'react'
import { supabase, fmt, MESES } from '../supabase.js'
import { registrarEvento, EVENTOS } from '../components/Eventos.js'
import { getBancoInfo, BancoLogo } from '../components/BancoInfo.jsx'

const CAT_CORES = {
  'Alimentação':'#E67E22','Lazer':'#9B59B6','Saúde':'#27AE60',
  'Transporte':'#2980B9','Educação':'#F39C12','Moradia':'#C17F5A',
  'Assinaturas':'#8E44AD','Vestuário':'#E74C3C','Viagem':'#16A085',
  'Outros':'#95A5A6',
}

function GraficoCategorias({ cartaoId, casalCode }) {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const now = new Date()
      const { data } = await supabase
        .from('despesas')
        .select('valor,categoria')
        .eq('casal_code', casalCode)
        .eq('cartao_id', cartaoId)
        .eq('mes', now.getMonth())
        .eq('ano', now.getFullYear())
      
      if (!data?.length) { setLoading(false); return }
      
      const agrupado = {}
      data.forEach(d => { agrupado[d.categoria||'Outros'] = (agrupado[d.categoria||'Outros']||0) + d.valor })
      const total = Object.values(agrupado).reduce((s,v) => s+v, 0)
      const lista = Object.entries(agrupado)
        .sort((a,b) => b[1]-a[1])
        .map(([cat, val]) => ({ cat, val, pct: Math.round((val/total)*100) }))
      setCats(lista)
      setLoading(false)
    }
    carregar()
  }, [cartaoId])

  if (loading || !cats.length) return null

  return (
    <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:12, marginTop:8 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--secondary)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
        Gasto por categoria
      </div>
      {/* Barra empilhada */}
      <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', marginBottom:10 }}>
        {cats.map(({ cat, pct }) => (
          <div key={cat} style={{ width:`${pct}%`, background:CAT_CORES[cat]||'#95A5A6', transition:'width .4s' }}
            title={`${cat}: ${pct}%`}/>
        ))}
      </div>
      {/* Legenda */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 12px' }}>
        {cats.map(({ cat, val, pct }) => (
          <div key={cat} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:CAT_CORES[cat]||'#95A5A6', flexShrink:0 }}/>
            <span style={{ color:'var(--secondary)' }}>{cat}</span>
            <span style={{ fontWeight:600 }}>{fmt(val)}</span>
            <span style={{ color:'var(--tertiary)' }}>{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

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
  const [nome, setNome] = useState('')
  const [limite, setLimite] = useState('')
  const [fatura, setFatura] = useState('')
  const [titular, setTitular] = useState(profile.papel)
  const [diaVenc, setDiaVenc] = useState('10')
  const [diaFech, setDiaFech] = useState('3')
  const [bancoPagId, setBancoPagId] = useState('')
  const [bancoPagNome, setBancoPagNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [cartaoDetalhe, setCartaoDetalhe] = useState(null)
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
      banco_id_pagamento: bancoPagId || null, banco_nome_pagamento: bancoPagNome || '',
    }
    try {
      if (edit) await supabase.from('cartoes').update(payload).eq('id', edit.id)
      else await supabase.from('cartoes').insert(payload)
      await registrarEvento(session.user.id, profile.casal_code, EVENTOS.PRIMEIRO_CARTAO)
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
      const hf = historico.find(h => h.cartao_id === pagCartao.id && h.mes === now.getMonth() && h.ano === now.getFullYear())
      if (hf) {
        await supabase.from('historico_faturas').update({
          paga: true, paga_em: new Date().toISOString(),
          banco_pagamento_nome: banco?.banco || '',
        }).eq('id', hf.id)
      }
      await supabase.from('cartoes').update({ fatura: 0, limite_bloqueado: 0 }).eq('id', pagCartao.id)
      if (pagLancarConta) {
        await supabase.from('despesas').insert({
          user_id: session.user.id, casal_code: cc,
          nome: `Fatura ${pagCartao.nome}`, valor: v,
          categoria: 'Moradia', quem: profile.papel, tipo: 'fixa',
          mes: now.getMonth(), ano: now.getFullYear(),
          pagamento_tipo: 'debito', banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
        })
        const { data: contaExistente } = await supabase.from('contas_fixas')
          .select('*').eq('casal_code', cc).ilike('nome', `%${pagCartao.nome}%`).maybeSingle()
        if (contaExistente) {
          await supabase.from('contas_fixas').update({ valor: v, banco_id: pagBancoId || null, banco_nome: banco?.banco || '' }).eq('id', contaExistente.id)
        } else {
          await supabase.from('contas_fixas').insert({
            user_id: session.user.id, casal_code: cc,
            nome: `Fatura ${pagCartao.nome}`, valor: v,
            categoria: 'Moradia', quem: profile.papel,
            dia_vencimento: pagCartao.dia_vencimento || 10,
            banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
          })
        }
      } else {
        await supabase.from('despesas').insert({
          user_id: session.user.id, casal_code: cc,
          nome: `Fatura ${pagCartao.nome}`, valor: v,
          categoria: 'Moradia', quem: profile.papel, tipo: 'fixa',
          mes: now.getMonth(), ano: now.getFullYear(),
          pagamento_tipo: 'debito', banco_id: pagBancoId || null, banco_nome: banco?.banco || '',
        })
      }
      setModalPag(false); loadData()
      alert(`✅ Fatura paga! ${fmt(v)} debitados do ${banco?.banco || 'banco'}.`)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="empty">Carregando...</div>

  if (cartaoDetalhe) return (
    <FaturaDetalhe session={session} profile={profile} cartao={cartaoDetalhe}
      onVoltar={() => { setCartaoDetalhe(null); loadData() }} />
  )

  const faturaTotal = cartoes.reduce((s, c) => s + (c.fatura || 0), 0)

  return (
    <div>
      <div className="row-between" style={{ marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, color:'var(--red)' }}>{fmt(faturaTotal)}</div>
          <div style={{ fontSize:12, color:'var(--secondary)' }}>Total em faturas abertas · {cartoes.length} cartão(ões)</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Novo cartão</button>
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        {cartoes.map(c => {
          const bloqueado = c.limite_bloqueado || 0
          const pct = c.limite > 0 ? Math.min(100, (((c.fatura||0) + bloqueado) / c.limite) * 100) : 0
          const cor = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)'
          const fatMes = historico.find(h => h.cartao_id === c.id && h.mes === now.getMonth() && h.ano === now.getFullYear())
          const parcsCartao = parcelas.filter(p => p.cartao_id === c.id)
          const bancoPag = bancos.find(b => b.id === c.banco_id_pagamento)
          const bancoInfo = getBancoInfo(c.nome)

          return (
            <div key={c.id} className="card" style={{ padding:0, overflow:'hidden' }}>
              {/* Header com cor do banco */}
              <div style={{
                background: bancoInfo ? `linear-gradient(135deg, ${bancoInfo.cor}18 0%, ${bancoInfo.cor}08 100%)` : 'var(--bg)',
                borderBottom:'0.5px solid var(--border)',
                padding:'14px 16px',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <BancoLogo nome={c.nome} size={36} />
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--primary)' }}>💳 {c.nome}</div>
                      <div style={{ fontSize:11, color:'var(--secondary)', marginTop:2 }}>
                        {c.titular==='eu'?'EU':c.titular==='ela'?'ELA':'Casal'} · Limite {fmt(c.limite)}
                      </div>
                      <div style={{ fontSize:11, color:'var(--secondary)' }}>
                        Fecha dia {c.dia_fechamento||3} · Vence dia {c.dia_vencimento||10}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:cor }}>{pct.toFixed(0)}%</div>
                    {fatMes && (
                      <span className={`badge ${fatMes.paga?'badge-green':'badge-red'}`} style={{ fontSize:10 }}>
                        {fatMes.paga?'✓ Paga':'Pendente'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de uso */}
                <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden', margin:'10px 0 6px' }}>
                  <div style={{ height:'100%', width:`${c.limite>0?((c.fatura||0)/c.limite)*100:0}%`, background:'var(--red)', borderRadius:3, transition:'width .4s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                  <span style={{ color:'var(--red)', fontWeight:600 }}>Fatura: {fmt(c.fatura||0)}</span>
                  {bloqueado > 0 && <span style={{ color:'var(--yellow)' }}>Bloq.: {fmt(bloqueado)}</span>}
                  <span style={{ color:'var(--green)' }}>Livre: {fmt(Math.max(0, c.limite-(c.fatura||0)-bloqueado))}</span>
                </div>
              </div>

              {/* Gráfico de categorias */}
              <div style={{ padding:'0 16px' }}>
                <GraficoCategorias cartaoId={c.id} casalCode={profile.casal_code} />
              </div>

              {/* Parcelas */}
              {parcsCartao.length > 0 && (
                <div style={{ padding:'8px 16px', borderTop:'0.5px solid var(--border)', fontSize:12, color:'var(--secondary)' }}>
                  📦 {parcsCartao.length} parcela(s) ativa(s)
                  {parcsCartao.map(p => (
                    <div key={p.id} style={{ fontSize:11, marginTop:2 }}>
                      {p.descricao} ({p.parcela_atual}/{p.total_parcelas}) — {fmt(p.valor_parcela)}/mês
                    </div>
                  ))}
                </div>
              )}

              {/* Banco de pagamento */}
              {bancoPag && (
                <div style={{ padding:'6px 16px', fontSize:11, color:'var(--blue)', borderTop:'0.5px solid var(--border)' }}>
                  🏦 Pagamento via {bancoPag.banco}
                </div>
              )}

              {/* Ações */}
              <div style={{ padding:'10px 16px', display:'flex', gap:6, borderTop:'0.5px solid var(--border)' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setCartaoDetalhe(c)}>📊 Fatura</button>
                <button className="btn btn-outline btn-sm" onClick={() => openModal(c)}>✏️</button>
                {(c.fatura||0) > 0 && (!fatMes || !fatMes.paga) && (
                  <button className="btn btn-green btn-sm" onClick={() => {
                    setPagCartao(c); setPagValor(String(c.fatura||0))
                    setPagBancoId(c.banco_id_pagamento || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
                    setPagLancarConta(true); setModalPag(true)
                  }}>💳 Pagar</button>
                )}
                <button className="btn btn-sm" style={{ background:'#FCEBEB', color:'var(--red)' }}
                  onClick={async () => { if (confirm('Excluir cartão?')) { await supabase.from('cartoes').delete().eq('id', c.id); loadData() } }}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      {cartoes.length === 0 && <div className="empty">Nenhum cartão cadastrado</div>}

      {historico.length > 0 && (
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:14 }}>Histórico de faturas</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cartão</th><th>Mês</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <BancoLogo nome={h.cartao_nome} size={22} />
                        {h.cartao_nome}
                      </div>
                    </td>
                    <td>{MESES[h.mes]} {h.ano}</td>
                    <td style={{ fontWeight:500 }}>{fmt(h.valor)}</td>
                    <td><span className={`badge ${h.paga?'badge-green':'badge-red'}`}>{h.paga?'✓ Paga':'Pendente'}</span></td>
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Salvando...':edit?'Salvar':'Adicionar'}</button>
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
            <div style={{ background:'#E1F5EE', borderRadius:10, padding:12, marginBottom:16 }}>
              <div style={{ fontWeight:500, color:'var(--green)' }}>Fatura atual: {fmt(pagCartao?.fatura||0)}</div>
              <div style={{ fontSize:12, color:'var(--secondary)', marginTop:4 }}>Após pagar, fatura será zerada</div>
            </div>
            <form onSubmit={pagarFatura}>
              <div className="form-group"><label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={pagValor} onChange={e => setPagValor(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Pagar com qual banco?</label>
                <select className="form-select" value={pagBancoId} onChange={e => setPagBancoId(e.target.value)}>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo, b.moeda)}</option>)}
                </select></div>
              <div style={{ background:'#EEF6FF', borderRadius:10, padding:12, marginBottom:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={pagLancarConta} onChange={e => setPagLancarConta(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight:500 }}>Lançar como conta fixa ativa</div>
                    <div style={{ fontSize:11, color:'var(--secondary)', marginTop:2 }}>
                      Cria ou atualiza a conta fixa "Fatura {pagCartao?.nome}" com o valor pago
                    </div>
                  </div>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalPag(false)}>Cancelar</button>
                <button type="submit" className="btn btn-green" disabled={saving}>{saving?'Processando...':'Confirmar pagamento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
