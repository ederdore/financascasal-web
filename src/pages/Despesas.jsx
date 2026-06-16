import { useState, useEffect } from 'react'
import { supabase, fmt, CATS_DESP_PADRAO, CAT_ICONS, MESES, MESES_CURTO, carregarCategorias } from '../supabase.js'
import { useAIToast, AIToast } from '../components/AIToast.jsx'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { registrarEvento, EVENTOS } from '../components/Eventos.js'

const COLORS = ['#1D9E75','#178DD1','#EF9F27','#E24B4A','#7F77DD','#2E7D32','#993556','#FF6B35','#4ECDC4']

// ── Sugestão de tags por categoria ────────────────────
const TAGS_SUGERIDAS = {
  'Alimentação':  ['Mercado','Restaurante','Delivery','Padaria','Lanche','Feira'],
  'PET':          ['Consulta','Ração','Exame','Vacina','Banho','Petshop','Remédio'],
  'Saúde':        ['Consulta','Exame','Farmácia','Plano de saúde','Dentista','Cirurgia'],
  'Transporte':   ['Gasolina','Uber','Estacionamento','Manutenção','IPVA','Seguro'],
  'Lazer':        ['Cinema','Restaurante','Viagem','Show','Bar','Academia','Jogo'],
  'Moradia':      ['Aluguel','Condomínio','Energia','Água','Internet','Reforma'],
  'Educação':     ['Curso','Livro','Material','Mensalidade','Faculdade'],
  'Vestuário':    ['Roupa','Calçado','Acessório','Online','Loja'],
  'Assinaturas':  ['Streaming','Academia','Software','Revista','Clube'],
  'Investimento': ['CDB','Ações','Fundo','Crypto','Poupança'],
}

export default function Despesas({ session, profile }) {
  const [despesas, setDespesas] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [bancos, setBancos] = useState([])
  const [categorias, setCategorias] = useState(CATS_DESP_PADRAO)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('lista')
  const [modal, setModal] = useState(false)
  const [modalCats, setModalCats] = useState(false)
  const [edit, setEdit] = useState(null)
  // Form
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [cat, setCat] = useState('Alimentação')
  const [tag, setTag] = useState('')
  const [quem, setQuem] = useState(profile.papel)
  const [tipo, setTipo] = useState('variavel')
  const [pagTipo, setPagTipo] = useState('debito')
  const [bancoId, setBancoId] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [cartaoNome, setCartaoNome] = useState('')
  const [parcelado, setParcelado] = useState(false)
  const [nParcelas, setNParcelas] = useState('1')
  const [recorrente, setRecorrente] = useState(false)
  // Filtros
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth())
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroTag, setFiltroTag] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroQuem, setFiltroQuem] = useState('')
  // Categorias gerenciar
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatIcone, setNovaCatIcone] = useState('📦')
  const [catsCustom, setCatsCustom] = useState([])
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const { toast, sugerirIA, dispensar } = useAIToast()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [d, c, b, catsCustomData] = await Promise.all([
      cf(supabase.from('despesas').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('cartoes').select('*')),
      cf(supabase.from('contas_banco').select('*')),
      supabase.from('categorias').select('*')
        .or(`casal_code.eq.${cc},user_id.eq.${session.user.id}`)
        .eq('tipo', 'despesa').order('nome'),
    ])
    if (d.data) setDespesas(d.data)
    if (c.data) setCartoes(c.data)
    if (b.data) {
      setBancos(b.data)
      const p = b.data.find(x => x.id === profile.banco_principal_id) || b.data[0]
      if (p) { setBancoId(p.id); setBancoNome(p.banco) }
    }
    if (catsCustomData.data) {
      setCatsCustom(catsCustomData.data)
      const todas = [...new Set([...CATS_DESP_PADRAO, ...catsCustomData.data.map(c => c.nome)])].sort()
      setCategorias(todas)
    }
    setLoading(false)
  }

  function openModal(d = null) {
    setEdit(d); setNome(d?.nome || ''); setValor(d ? String(d.valor) : '')
    setCat(d?.categoria || 'Alimentação'); setTag(d?.tag || '')
    setQuem(d?.quem || profile.papel)
    setTipo(d?.tipo || 'variavel'); setPagTipo(d?.pagamento_tipo || 'debito')
    const bid = d?.banco_id || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || ''
    setBancoId(bid); setBancoNome(d?.banco_nome || bancos.find(b => b.id === bid)?.banco || '')
    setCartaoId(d?.cartao_id || ''); setCartaoNome(d?.cartao_nome || '')
    setParcelado(false); setNParcelas('1'); setRecorrente(false); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const v = parseFloat(valor)
    const cp = ex => ({ user_id: session.user.id, casal_code: profile.casal_code || session.user.id, ...ex })
    try {
      if (pagTipo === 'cartao' && cartaoId && parcelado && parseInt(nParcelas) > 1) {
        const cartao = cartoes.find(c => c.id === cartaoId)
        const np = parseInt(nParcelas)
        if (cartao) await supabase.from('cartoes').update({ fatura: (cartao.fatura||0)+(v/np), limite_bloqueado: (cartao.limite_bloqueado||0)+(v-v/np) }).eq('id', cartaoId)
        await supabase.from('parcelas').insert(cp({ cartao_id: cartaoId, cartao_nome: cartaoNome, descricao: nome, valor_total: v, valor_parcela: v/np, total_parcelas: np, parcela_atual: 1, mes_inicio: now.getMonth(), ano_inicio: now.getFullYear(), quem, categoria: cat }))
        await supabase.from('despesas').insert(cp({ nome: `${nome} (1/${np})`, valor: v/np, categoria: cat, tag: tag||null, quem, tipo, mes: now.getMonth(), ano: now.getFullYear(), pagamento_tipo: 'cartao', cartao_id: cartaoId, cartao_nome: cartaoNome }))
      } else {
        if (pagTipo === 'debito' && bancoId && !edit) {
          const banco = bancos.find(b => b.id === bancoId)
          if (banco) {
            const ns = (banco.saldo||0) - v
            await supabase.from('contas_banco').update({ saldo: ns }).eq('id', bancoId)
            await supabase.from('extrato_banco').insert(cp({ banco_id: bancoId, banco_nome: banco.banco, tipo: 'saida', descricao: nome, categoria: cat, valor: v, saldo_apos: ns, mes: now.getMonth(), ano: now.getFullYear() }))
          }
        }
        if (pagTipo === 'cartao' && cartaoId && !edit) {
          const cartao = cartoes.find(c => c.id === cartaoId)
          if (cartao) await supabase.from('cartoes').update({ fatura: (cartao.fatura||0)+v }).eq('id', cartaoId)
        }
        const tipoFinal = recorrente ? 'recorrente' : tipo
        const payload = cp({ nome, valor: v, categoria: cat, tag: tag||null, quem, tipo: tipoFinal, mes: now.getMonth(), ano: now.getFullYear(), pagamento_tipo: pagTipo, cartao_id: pagTipo==='cartao'&&cartaoId?cartaoId:null, cartao_nome: pagTipo==='cartao'?cartaoNome:'', banco_id: pagTipo==='debito'&&bancoId?bancoId:null, banco_nome: pagTipo==='debito'?bancoNome:'' })
        if (edit) await supabase.from('despesas').update(payload).eq('id', edit.id)
        else await supabase.from('despesas').insert(payload)
      }
      await registrarEvento(session.user.id, profile.casal_code, EVENTOS.PRIMEIRA_DESPESA)
      setModal(false); loadData()
      const totalMes = despesas.filter(d => d.mes===now.getMonth()&&d.ano===now.getFullYear()).reduce((s,d)=>s+d.valor,0)
      sugerirIA({ tipo:'despesa', nome, valor:v, categoria:cat, quem, contexto:{ totalMes:totalMes+v } })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function adicionarCat(e) {
    e.preventDefault(); if (!novaCatNome.trim()) return; setSaving(true)
    try {
      await supabase.from('categorias').insert({ user_id:session.user.id, casal_code:profile.casal_code||session.user.id, nome:novaCatNome.trim(), icone:novaCatIcone, tipo:'despesa' })
      setNovaCatNome(''); setNovaCatIcone('📦'); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function excluirCat(id) {
    if (!confirm('Excluir categoria?')) return
    await supabase.from('categorias').delete().eq('id', id); loadData()
  }

  // Tags existentes para autocomplete
  const tagsExistentes = [...new Set(despesas.filter(d => d.tag).map(d => d.tag))].sort()
  const tagsSugeridas = TAGS_SUGERIDAS[cat] || []
  const todasTags = [...new Set([...tagsSugeridas, ...tagsExistentes.filter(t => !tagsSugeridas.includes(t))])]

  // Filtros
  let despFiltradas = despesas
  if (filtroMes !== '') despFiltradas = despFiltradas.filter(d => d.mes===filtroMes && d.ano===filtroAno)
  if (filtroCat)  despFiltradas = despFiltradas.filter(d => d.categoria===filtroCat)
  if (filtroTag)  despFiltradas = despFiltradas.filter(d => d.tag===filtroTag)
  if (filtroTipo) despFiltradas = despFiltradas.filter(d => d.tipo===filtroTipo)
  if (filtroQuem) despFiltradas = despFiltradas.filter(d => d.quem===filtroQuem)

  const totalFiltrado = despFiltradas.reduce((s,d) => s+d.valor, 0)

  // Gráficos
  const catMap = {}
  despFiltradas.forEach(d => { catMap[d.categoria]=(catMap[d.categoria]||0)+d.valor })
  const pieData = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}))

  // Gráfico por tag
  const tagMap = {}
  despFiltradas.filter(d=>d.tag).forEach(d => { tagMap[d.tag]=(tagMap[d.tag]||0)+d.valor })
  const tagData = Object.entries(tagMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value}))

  const barData = []
  for (let i=5;i>=0;i--) {
    const d=new Date(now.getFullYear(),now.getMonth()-i,1)
    const m=d.getMonth(); const a=d.getFullYear()
    const desp=despesas.filter(x=>x.mes===m&&x.ano===a)
    barData.push({ mes:MESES_CURTO[m], Variável:desp.filter(x=>x.tipo==='variavel').reduce((s,x)=>s+x.valor,0), Fixa:desp.filter(x=>x.tipo==='fixa').reduce((s,x)=>s+x.valor,0), Recorrente:desp.filter(x=>x.tipo==='recorrente').reduce((s,x)=>s+x.valor,0) })
  }

  const tipoMap={variavel:0,fixa:0,recorrente:0}
  despFiltradas.forEach(d=>{if(tipoMap[d.tipo]!==undefined)tipoMap[d.tipo]+=d.valor})
  const tipoData=[{name:'Variável',value:tipoMap.variavel},{name:'Fixa',value:tipoMap.fixa},{name:'Recorrente',value:tipoMap.recorrente}].filter(x=>x.value>0)

  // Tags únicas para filtro
  const tagsNoFiltro = [...new Set(despesas.filter(d=>d.tag&&(filtroCat?d.categoria===filtroCat:true)).map(d=>d.tag))].sort()

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom:16 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:500, color:'var(--red)' }}>{fmt(totalFiltrado)}</div>
          <div style={{ fontSize:12, color:'var(--secondary)' }}>{despFiltradas.length} lançamento(s) no período</div>
        </div>
        <div className="row" style={{ gap:8 }}>
          <button className="btn btn-outline" onClick={() => setModalCats(true)}>🏷️ Categorias</button>
          <button className="btn btn-red" onClick={() => openModal()}>+ Nova despesa</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:'auto' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value===''?'':parseInt(e.target.value))}>
          <option value="">Todos os meses</option>
          {MESES.map((m,i) => <option key={i} value={i}>{m} {filtroAno}</option>)}
        </select>
        <select className="form-select" style={{ width:'auto' }} value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setFiltroTag('') }}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c}>{c}</option>)}
        </select>
        {tagsNoFiltro.length > 0 && (
          <select className="form-select" style={{ width:'auto' }} value={filtroTag} onChange={e => setFiltroTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {tagsNoFiltro.map(t => <option key={t}>{t}</option>)}
          </select>
        )}
        <select className="form-select" style={{ width:'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="variavel">📦 Variável</option>
          <option value="fixa">📌 Fixa</option>
          <option value="recorrente">🔄 Recorrente</option>
        </select>
        <select className="form-select" style={{ width:'auto' }} value={filtroQuem} onChange={e => setFiltroQuem(e.target.value)}>
          <option value="">EU + ELA</option>
          <option value="eu">EU</option>
          <option value="ela">ELA</option>
          <option value="casal">Casal</option>
        </select>
        {(filtroCat||filtroTag||filtroTipo||filtroQuem) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFiltroCat(''); setFiltroTag(''); setFiltroTipo(''); setFiltroQuem('') }}>✕ Limpar</button>
        )}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:0, borderBottom:'0.5px solid var(--border)', marginBottom:16 }}>
        {[['lista','📋 Lista'],['graficos','📊 Gráficos'],['tags','🏷️ Tags']].map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding:'8px 16px', border:'none', background:'none', fontWeight:aba===id?600:400, color:aba===id?'var(--primary)':'var(--secondary)', cursor:'pointer', borderBottom:aba===id?'2px solid var(--primary)':'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {aba === 'lista' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Descrição</th><th>Categoria</th><th>Tag</th><th>Quem</th><th>Pagamento</th><th>Tipo</th><th>Mês</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                {despFiltradas.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight:500 }}>{d.nome}</td>
                    <td>{CAT_ICONS[d.categoria]||'💸'} {d.categoria}</td>
                    <td>
                      {d.tag ? (
                        <span style={{ fontSize:11, background:'rgba(61,90,62,0.1)', color:'var(--eden-green)', padding:'2px 8px', borderRadius:20, fontWeight:500, cursor:'pointer' }}
                          onClick={() => setFiltroTag(d.tag)}>
                          🏷️ {d.tag}
                        </span>
                      ) : <span style={{ color:'var(--tertiary)', fontSize:12 }}>—</span>}
                    </td>
                    <td><span className={`badge ${d.quem==='eu'?'badge-blue':d.quem==='ela'?'badge-red':'badge-yellow'}`}>{d.quem==='casal'?'Casal':d.quem==='eu'?'EU':'ELA'}</span></td>
                    <td style={{ fontSize:12 }}>{d.pagamento_tipo==='cartao'?'💳 '+d.cartao_nome:'🏦 '+(d.banco_nome||'Débito')}</td>
                    <td><span className={`badge ${d.tipo==='fixa'?'badge-blue':d.tipo==='recorrente'?'badge-green':'badge-yellow'}`}>{d.tipo==='fixa'?'📌 Fixa':d.tipo==='recorrente'?'🔄 Rec.':'📦 Var.'}</span></td>
                    <td style={{ fontSize:12 }}>{MESES[d.mes]} {d.ano}</td>
                    <td style={{ color:'var(--red)', fontWeight:500 }}>-{fmt(d.valor)}</td>
                    <td>
                      <div className="row" style={{ gap:6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openModal(d)}>✏️</button>
                        <button className="btn btn-sm" style={{ background:'#FCEBEB', color:'var(--red)' }}
                          onClick={async () => { if (confirm('Excluir?')) { await supabase.from('despesas').delete().eq('id',d.id); loadData() } }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {despFiltradas.length===0 && <div className="empty">Nenhuma despesa no período</div>}
          </div>
        </div>
      )}

      {aba === 'graficos' && (
        <div>
          <div className="grid-2" style={{ marginBottom:16 }}>
            <div className="card">
              <div style={{ fontWeight:600, marginBottom:14 }}>Por categoria</div>
              {pieData.length===0 ? <div className="empty" style={{ padding:20 }}>Sem dados</div> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                      label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div style={{ marginTop:8 }}>
                {pieData.slice(0,6).map((item,i) => (
                  <div key={item.name} className="row-between" style={{ padding:'4px 0', fontSize:12 }}>
                    <div className="row" style={{ gap:6 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:COLORS[i%COLORS.length] }}/>
                      <span>{CAT_ICONS[item.name]||'💸'} {item.name}</span>
                    </div>
                    <span style={{ fontWeight:500 }}>{fmt(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div style={{ fontWeight:600, marginBottom:14 }}>Por tipo</div>
              {tipoData.length===0 ? <div className="empty" style={{ padding:20 }}>Sem dados</div> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={tipoData} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                      label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {tipoData.map((_,i) => <Cell key={i} fill={['#178DD1','#E24B4A','#1D9E75'][i]}/>)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div style={{ marginTop:8 }}>
                {tipoData.map((item,i) => (
                  <div key={item.name} className="row-between" style={{ padding:'4px 0', fontSize:12 }}>
                    <div className="row" style={{ gap:6 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:['#178DD1','#E24B4A','#1D9E75'][i] }}/>
                      <span>{item.name}</span>
                    </div>
                    <span style={{ fontWeight:500 }}>{fmt(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight:600, marginBottom:14 }}>Evolução mensal (últimos 6 meses)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8"/>
                <XAxis dataKey="mes" tick={{ fontSize:12 }}/>
                <YAxis tick={{ fontSize:11 }} tickFormatter={v => 'R$'+(v/1000).toFixed(0)+'k'}/>
                <Tooltip formatter={v => fmt(v)}/>
                <Legend/>
                <Bar dataKey="Variável"   fill="#EF9F27" radius={[4,4,0,0]}/>
                <Bar dataKey="Fixa"       fill="#178DD1" radius={[4,4,0,0]}/>
                <Bar dataKey="Recorrente" fill="#1D9E75" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── ABA TAGS ── */}
      {aba === 'tags' && (
        <div>
          {tagData.length === 0 ? (
            <div className="card">
              <div className="empty" style={{ padding:32 }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🏷️</div>
                <div style={{ fontWeight:500, marginBottom:6 }}>Nenhuma tag registrada ainda</div>
                <div style={{ fontSize:13, color:'var(--secondary)' }}>Adicione tags nos lançamentos para ver análises detalhadas aqui</div>
              </div>
            </div>
          ) : (
            <>
              {/* Ranking de tags */}
              <div className="card" style={{ marginBottom:16 }}>
                <div style={{ fontWeight:600, marginBottom:14 }}>🏷️ Gastos por tag</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {tagData.map(({name,value},i) => {
                    const pct = totalFiltrado > 0 ? Math.round((value/totalFiltrado)*100) : 0
                    return (
                      <div key={name}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:'var(--secondary)', width:18 }}>#{i+1}</span>
                            <span style={{ fontWeight:500, cursor:'pointer' }} onClick={() => { setFiltroTag(name); setAba('lista') }}>
                              🏷️ {name}
                            </span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:11, color:'var(--secondary)' }}>{pct}%</span>
                            <span style={{ fontWeight:700 }}>{fmt(value)}</span>
                          </div>
                        </div>
                        <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:COLORS[i%COLORS.length], borderRadius:2 }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tags por categoria */}
              <div className="card">
                <div style={{ fontWeight:600, marginBottom:14 }}>Tags por categoria</div>
                {Object.entries(
                  despFiltradas.filter(d=>d.tag).reduce((acc,d) => {
                    if (!acc[d.categoria]) acc[d.categoria] = {}
                    acc[d.categoria][d.tag] = (acc[d.categoria][d.tag]||0) + d.valor
                    return acc
                  }, {})
                ).map(([catNome, tags]) => (
                  <div key={catNome} style={{ marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--secondary)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
                      {CAT_ICONS[catNome]||'💸'} {catNome}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {Object.entries(tags).sort((a,b)=>b[1]-a[1]).map(([tagNome,val]) => (
                        <div key={tagNome}
                          style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:20, padding:'4px 12px', fontSize:12, cursor:'pointer' }}
                          onClick={() => { setFiltroCat(catNome); setFiltroTag(tagNome); setAba('lista') }}>
                          <span style={{ fontWeight:500 }}>🏷️ {tagNome}</span>
                          <span style={{ color:'var(--red)', fontWeight:600 }}>{fmt(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal despesa */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar despesa' : '💸 Nova despesa'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input className="form-input" placeholder="Ex: Supermercado..." value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <div className="row-between" style={{ marginBottom:6 }}>
                    <label className="form-label" style={{ margin:0 }}>Categoria</label>
                    <button type="button" style={{ fontSize:11, color:'var(--blue)', background:'none', border:'none', cursor:'pointer' }} onClick={() => setModalCats(true)}>+ Nova cat.</button>
                  </div>
                  <select className="form-select" value={cat} onChange={e => { setCat(e.target.value); setTag('') }}>
                    {categorias.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quem pagou?</label>
                  <select className="form-select" value={quem} onChange={e => setQuem(e.target.value)}>
                    <option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal (50/50)</option>
                  </select>
                </div>
              </div>

              {/* ── Campo de tag ── */}
              <div className="form-group">
                <label className="form-label">
                  🏷️ Tag <span style={{ fontWeight:400, color:'var(--secondary)', fontSize:11 }}>(opcional — detalhe o gasto)</span>
                </label>
                <input
                  className="form-input"
                  placeholder={`Ex: ${(TAGS_SUGERIDAS[cat]||['Consulta','Ração','Exame']).slice(0,3).join(', ')}...`}
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  list={`tags-${cat}`}
                />
                <datalist id={`tags-${cat}`}>
                  {todasTags.map(t => <option key={t} value={t}/>)}
                </datalist>
                {/* Chips de sugestão */}
                {todasTags.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                    {todasTags.slice(0,8).map(t => (
                      <button key={t} type="button"
                        onClick={() => setTag(t)}
                        style={{
                          fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer',
                          background: tag===t ? 'var(--eden-green)' : 'var(--bg)',
                          color: tag===t ? '#fff' : 'var(--secondary)',
                          border: `0.5px solid ${tag===t?'var(--eden-green)':'var(--border)'}`,
                          fontFamily:'inherit',
                        }}>
                        {t}
                      </button>
                    ))}
                    {tag && (
                      <button type="button" onClick={() => setTag('')}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:20, cursor:'pointer', background:'#FCEBEB', color:'var(--red)', border:'none', fontFamily:'inherit' }}>
                        ✕ limpar
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                    <option value="variavel">📦 Variável</option>
                    <option value="fixa">📌 Fixa</option>
                    <option value="recorrente">🔄 Recorrente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Pagamento</label>
                  <select className="form-select" value={pagTipo} onChange={e => { setPagTipo(e.target.value); if (e.target.value==='debito'){setCartaoId('');setCartaoNome('')} }}>
                    <option value="debito">💵 Débito/Pix</option>
                    <option value="cartao">💳 Cartão</option>
                  </select>
                </div>
              </div>

              {pagTipo==='debito' && (
                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <select className="form-select" value={bancoId} onChange={e => { setBancoId(e.target.value); setBancoNome(bancos.find(b=>b.id===e.target.value)?.banco||'') }}>
                    {bancos.map(b => <option key={b.id} value={b.id}>{b.banco} — {fmt(b.saldo,b.moeda)}</option>)}
                  </select>
                </div>
              )}

              {pagTipo==='cartao' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Cartão</label>
                    <select className="form-select" value={cartaoId} onChange={e => { setCartaoId(e.target.value); setCartaoNome(cartoes.find(c=>c.id===e.target.value)?.nome||'') }}>
                      <option value="">Selecione...</option>
                      {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group">
                      <label className="form-label">Parcelado?</label>
                      <select className="form-select" value={parcelado?'sim':'nao'} onChange={e => setParcelado(e.target.value==='sim')}>
                        <option value="nao">À vista</option>
                        <option value="sim">Parcelado</option>
                      </select>
                    </div>
                    {parcelado && (
                      <div className="form-group">
                        <label className="form-label">Parcelas</label>
                        <select className="form-select" value={nParcelas} onChange={e => setNParcelas(e.target.value)}>
                          {Array.from({length:12},(_,i)=>i+1).map(n => <option key={n} value={n}>{n}x{valor?` de ${fmt((parseFloat(valor)||0)/n)}`:''}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-red" disabled={saving}>{saving?'Salvando...':edit?'Salvar':'Lançar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal categorias */}
      {modalCats && (
        <div className="modal-overlay" onClick={() => setModalCats(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🏷️ Gerenciar categorias</h3>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--secondary)', marginBottom:10 }}>Categorias padrão</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                {CATS_DESP_PADRAO.map(c => (
                  <span key={c} style={{ padding:'4px 10px', borderRadius:20, background:'#F5F3EF', fontSize:12 }}>
                    {CAT_ICONS[c]||'💸'} {c}
                  </span>
                ))}
              </div>
              {catsCustom.length > 0 && (
                <>
                  <div style={{ fontSize:12, color:'var(--secondary)', marginBottom:10 }}>Categorias personalizadas</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                    {catsCustom.map(c => (
                      <span key={c.id} style={{ padding:'4px 10px', borderRadius:20, background:'#EEF6FF', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                        {c.icone} {c.nome}
                        <button onClick={() => excluirCat(c.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', padding:0, marginLeft:2 }}>✕</button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:16 }}>
              <div style={{ fontWeight:500, marginBottom:12 }}>+ Adicionar categoria</div>
              <form onSubmit={adicionarCat}>
                <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:10 }}>
                  <div className="form-group">
                    <label className="form-label">Ícone</label>
                    <input className="form-input" value={novaCatIcone} onChange={e => setNovaCatIcone(e.target.value)} placeholder="📦" style={{ textAlign:'center', fontSize:20 }}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nome da categoria</label>
                    <input className="form-input" placeholder="Ex: Animais, Farmácia..." value={novaCatNome} onChange={e => setNovaCatNome(e.target.value)}/>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} disabled={saving}>
                  {saving?'Salvando...':'+ Adicionar'}
                </button>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setModalCats(false); loadData() }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <AIToast toast={toast} onDispensar={dispensar} />
    </div>
  )
}
