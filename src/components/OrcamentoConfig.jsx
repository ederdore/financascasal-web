import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

const OBJETIVO_DEFAULTS = {
  controle:    { pct_necessidades:60, pct_desejos:30, pct_poupanca:10, label:'🌱 Controle financeiro' },
  reserva:     { pct_necessidades:55, pct_desejos:25, pct_poupanca:20, label:'🛡 Construir reserva' },
  patrimonio:  { pct_necessidades:50, pct_desejos:20, pct_poupanca:30, label:'🌳 Crescer patrimônio' },
  liberdade:   { pct_necessidades:45, pct_desejos:15, pct_poupanca:40, label:'🌟 Liberdade financeira' },
  casamento:   { pct_necessidades:45, pct_desejos:15, pct_poupanca:40, label:'💒 Casamento/Noivado' },
}

const CATS_PADRAO = {
  necessidades: ['Moradia','Alimentação','Saúde','Transporte','Educação','PET'],
  desejos:      ['Lazer','Assinaturas','Vestuário','Viagem','Outros'],
  poupanca:     ['Investimento'],
}

const TODAS_CATS = [
  'Moradia','Alimentação','Saúde','Transporte','Educação','PET',
  'Lazer','Assinaturas','Vestuário','Viagem','Investimento','Outros',
]

const GRUPO_CORES = {
  necessidades: { bg:'#EEF6FF', cor:'#178DD1', label:'🏠 Necessidades', desc:'O essencial para viver' },
  desejos:      { bg:'#FFF8EE', cor:'#EF9F27', label:'🎉 Desejos',      desc:'Qualidade de vida' },
  poupanca:     { bg:'#E1F5EE', cor:'#1D9E75', label:'📈 Poupança',     desc:'Reserva e investimentos' },
}

export default function OrcamentoConfig({ session, profile, onSave }) {
  const [config, setConfig] = useState(null)
  const [pctN, setPctN] = useState(55)
  const [pctD, setPctD] = useState(25)
  const [pctP, setPctP] = useState(20)
  const [catsN, setCatsN] = useState(CATS_PADRAO.necessidades)
  const [catsD, setCatsD] = useState(CATS_PADRAO.desejos)
  const [catsP, setCatsP] = useState(CATS_PADRAO.poupanca)
  const [dragCat, setDragCat] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const { data } = await supabase.from('orcamento_config')
      .select('*').eq('casal_code', profile.casal_code).maybeSingle()
    if (data) {
      setConfig(data)
      setPctN(data.pct_necessidades)
      setPctD(data.pct_desejos)
      setPctP(data.pct_poupanca)
      setCatsN(data.cats_necessidades || CATS_PADRAO.necessidades)
      setCatsD(data.cats_desejos || CATS_PADRAO.desejos)
      setCatsP(data.cats_poupanca || CATS_PADRAO.poupanca)
    } else {
      // Default pelo objetivo
      const def = OBJETIVO_DEFAULTS[profile.objetivo] || OBJETIVO_DEFAULTS.controle
      setPctN(def.pct_necessidades)
      setPctD(def.pct_desejos)
      setPctP(def.pct_poupanca)
    }
  }

  function aplicarObjetivo(obj) {
    const def = OBJETIVO_DEFAULTS[obj]
    if (!def) return
    setPctN(def.pct_necessidades)
    setPctD(def.pct_desejos)
    setPctP(def.pct_poupanca)
  }

  // Sliders travados em 100%
  function handleSlider(grupo, valor) {
    const v = parseInt(valor)
    if (grupo === 'N') {
      const resto = 100 - v
      const ratioD = pctD / (pctD + pctP) || 0.5
      setPctN(v)
      setPctD(Math.round(resto * ratioD))
      setPctP(100 - v - Math.round(resto * ratioD))
    } else if (grupo === 'D') {
      const resto = 100 - v
      const ratioN = pctN / (pctN + pctP) || 0.5
      setPctD(v)
      setPctN(Math.round(resto * ratioN))
      setPctP(100 - v - Math.round(resto * ratioN))
    } else {
      const resto = 100 - v
      const ratioN = pctN / (pctN + pctD) || 0.5
      setPctP(v)
      setPctN(Math.round(resto * ratioN))
      setPctD(100 - v - Math.round(resto * ratioN))
    }
  }

  // Move categoria entre grupos
  function moverCategoria(cat, grupoDestino) {
    setCatsN(prev => prev.filter(c => c !== cat))
    setCatsD(prev => prev.filter(c => c !== cat))
    setCatsP(prev => prev.filter(c => c !== cat))
    if (grupoDestino === 'necessidades') setCatsN(prev => [...prev, cat])
    else if (grupoDestino === 'desejos') setCatsD(prev => [...prev, cat])
    else setCatsP(prev => [...prev, cat])
  }

  function getGrupoDeCat(cat) {
    if (catsN.includes(cat)) return 'necessidades'
    if (catsD.includes(cat)) return 'desejos'
    if (catsP.includes(cat)) return 'poupanca'
    return null
  }

  async function salvar() {
    setSaving(true)
    try {
      const payload = {
        casal_code: profile.casal_code,
        pct_necessidades: pctN,
        pct_desejos: pctD,
        pct_poupanca: pctP,
        cats_necessidades: catsN,
        cats_desejos: catsD,
        cats_poupanca: catsP,
        updated_at: new Date().toISOString(),
      }
      if (config?.id) {
        await supabase.from('orcamento_config').update(payload).eq('id', config.id)
      } else {
        await supabase.from('orcamento_config').insert(payload)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      loadConfig()
      if (onSave) onSave()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  const soma = pctN + pctD + pctP
  const objAtual = OBJETIVO_DEFAULTS[profile.objetivo]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Distribuição do orçamento</div>
        <div style={{ fontSize:13, color:'var(--secondary)' }}>
          Defina como sua renda deve ser dividida. A soma deve ser sempre 100%.
        </div>
      </div>

      {/* Atalhos por objetivo */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--secondary)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
          Distribuição recomendada por objetivo
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {Object.entries(OBJETIVO_DEFAULTS).map(([key, def]) => (
            <button key={key} type="button"
              onClick={() => aplicarObjetivo(key)}
              style={{
                fontSize:12, padding:'6px 12px', borderRadius:20, cursor:'pointer',
                fontFamily:'inherit', fontWeight:500,
                background: profile.objetivo===key ? 'var(--eden-green)' : 'var(--bg)',
                color: profile.objetivo===key ? '#fff' : 'var(--secondary)',
                border: `0.5px solid ${profile.objetivo===key ? 'var(--eden-green)' : 'var(--border)'}`,
              }}>
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {/* Barra visual */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', height:12, borderRadius:6, overflow:'hidden', marginBottom:8 }}>
          <div style={{ width:pctN+'%', background:'#178DD1', transition:'width .3s' }}/>
          <div style={{ width:pctD+'%', background:'#EF9F27', transition:'width .3s' }}/>
          <div style={{ width:pctP+'%', background:'#1D9E75', transition:'width .3s' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--secondary)' }}>
          <span style={{ color:'#178DD1' }}>🏠 {pctN}% Necessidades</span>
          <span style={{ color:'#EF9F27' }}>🎉 {pctD}% Desejos</span>
          <span style={{ color:'#1D9E75' }}>📈 {pctP}% Poupança</span>
        </div>
        {soma !== 100 && (
          <div style={{ fontSize:12, color:'var(--red)', marginTop:6 }}>⚠️ Soma: {soma}% — ajuste para totalizar 100%</div>
        )}
      </div>

      {/* Sliders */}
      <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:24 }}>
        {[
          ['N', pctN, '#178DD1', '🏠 Necessidades'],
          ['D', pctD, '#EF9F27', '🎉 Desejos'],
          ['P', pctP, '#1D9E75', '📈 Poupança'],
        ].map(([key, val, cor, label]) => (
          <div key={key}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
              <span style={{ fontWeight:500 }}>{label}</span>
              <span style={{ fontWeight:700, color:cor }}>{val}%</span>
            </div>
            <input type="range" min="5" max="90" value={val}
              onChange={e => handleSlider(key, e.target.value)}
              style={{ width:'100%', accentColor:cor }}
            />
          </div>
        ))}
      </div>

      {/* Classificação de categorias */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--secondary)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>
          Classificação das categorias
        </div>
        <div style={{ fontSize:12, color:'var(--secondary)', marginBottom:12 }}>
          Clique em uma categoria para mover entre os grupos
        </div>

        {Object.entries(GRUPO_CORES).map(([grupo, info]) => {
          const cats = grupo==='necessidades'?catsN:grupo==='desejos'?catsD:catsP
          return (
            <div key={grupo} style={{
              background: info.bg,
              borderRadius:12, padding:14, marginBottom:10,
              border: dragOver===grupo ? `1.5px solid ${info.cor}` : '1px solid transparent',
            }}
              onDragOver={e => { e.preventDefault(); setDragOver(grupo) }}
              onDrop={e => { e.preventDefault(); if (dragCat) { moverCategoria(dragCat, grupo); setDragCat(null); setDragOver(null) } }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontWeight:600, fontSize:13, color:info.cor }}>{info.label}</span>
                <span style={{ fontSize:11, color:'var(--secondary)' }}>{info.desc}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {cats.map(cat => (
                  <div key={cat} draggable
                    onDragStart={() => setDragCat(cat)}
                    onDragEnd={() => { setDragCat(null); setDragOver(null) }}
                    style={{
                      fontSize:12, padding:'4px 10px', borderRadius:20, cursor:'grab',
                      background: '#fff', border:`1px solid ${info.cor}40`,
                      color: info.cor, fontWeight:500,
                    }}>
                    {cat} ⠿
                  </div>
                ))}
                {cats.length === 0 && (
                  <div style={{ fontSize:12, color:'var(--secondary)', fontStyle:'italic' }}>
                    Arraste categorias para cá
                  </div>
                )}
              </div>
              {/* Botões de mover rápido */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
                {TODAS_CATS.filter(c => getGrupoDeCat(c) !== grupo).map(cat => (
                  <button key={cat} type="button"
                    onClick={() => moverCategoria(cat, grupo)}
                    style={{
                      fontSize:11, padding:'2px 8px', borderRadius:20,
                      background:'transparent', border:`1px dashed ${info.cor}40`,
                      color:'var(--secondary)', cursor:'pointer', fontFamily:'inherit',
                    }}>
                    + {cat}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Salvar */}
      <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
        onClick={salvar} disabled={saving || soma !== 100}>
        {saving ? 'Salvando...' : saved ? '✅ Salvo!' : 'Salvar configuração de orçamento'}
      </button>

      {soma !== 100 && (
        <div style={{ textAlign:'center', fontSize:12, color:'var(--red)', marginTop:8 }}>
          Ajuste os sliders para totalizar 100% antes de salvar
        </div>
      )}
    </div>
  )
}
