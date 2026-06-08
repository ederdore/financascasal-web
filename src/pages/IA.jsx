import { useState } from 'react'
import { supabase, fmt, API_URL } from '../supabase.js'

export default function IA({ session, profile }) {
  const [analise, setAnalise] = useState('')
  const [dicas, setDicas] = useState('')
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [loadingDicas, setLoadingDicas] = useState(false)

  async function gerarAnalise() {
    setLoadingAnalise(true)
    const uid = session.user.id
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', uid)
    const now = new Date()
    try {
      const [desp, rec, cartoes, bancos, reserva, investimentos] = await Promise.all([
        cf(supabase.from('despesas').select('*')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
        cf(supabase.from('receitas').select('*')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
        cf(supabase.from('cartoes').select('*')),
        cf(supabase.from('contas_banco').select('*')),
        supabase.from('reserva').select('*').eq('user_id', uid).maybeSingle(),
        cf(supabase.from('investimentos').select('*')),
      ])
      const totalRec = (rec.data || []).reduce((s, r) => s + r.valor, 0)
      const totalDesp = (desp.data || []).reduce((s, d) => s + d.valor, 0)
      const cats = {}; (desp.data || []).forEach(d => { cats[d.categoria] = (cats[d.categoria] || 0) + d.valor })
      const catStr = Object.entries(cats).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ')
      const res = reserva.data || { atual: 0, meta: 30000 }
      const faturas = (cartoes.data || []).reduce((s, c) => s + (c.fatura || 0), 0)
      const saldoBancos = (bancos.data || []).reduce((s, b) => s + b.saldo, 0)
      const totalInv = (investimentos.data || []).reduce((s, i) => s + i.valor, 0)

      const prompt = `Consultor financeiro para casais brasileiros. Analise em português:
DADOS: Receitas: ${fmt(totalRec)} | Despesas: ${fmt(totalDesp)} | Saldo: ${fmt(totalRec - totalDesp)}
Gastos: ${catStr || 'sem dados'} | Renda Fixa: ${fmt(totalInv)} | Bancos: ${fmt(saldoBancos)}
Reserva: ${fmt(res.atual)} de ${fmt(res.meta)} | Faturas cartão: ${fmt(faturas)}
Objetivo: ${profile.objetivo || 'controle'}
4 blocos: 📊 Diagnóstico | ⚠️ Atenção | 💡 Sugestão | 🚀 Projeção. Máx 250 palavras.`

      const response = await fetch(`${API_URL}/api/analise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const data = await response.json()
      setAnalise(data.resultado || 'Sem resposta do servidor.')
    } catch (e) { setAnalise('Erro ao conectar com a IA.') }
    finally { setLoadingAnalise(false) }
  }

  async function gerarDicas() {
    setLoadingDicas(true)
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    try {
      const [inv, res] = await Promise.all([
        cf(supabase.from('investimentos').select('*')),
        supabase.from('reserva').select('*').eq('user_id', session.user.id).maybeSingle(),
      ])
      const totalInv = (inv.data || []).reduce((s, i) => s + i.valor, 0)
      const reserva = res.data || { atual: 0, meta: 30000 }
      const prompt = `Especialista em renda fixa brasileira. 3 dicas personalizadas em português:
Carteira: ${fmt(totalInv)} | Reserva: ${fmt(reserva.atual)} de ${fmt(reserva.meta)}
CDI: ${reserva.rende_cdi ? `${reserva.pct_cdi}% CDI` : 'não configurado'}
Objetivo: ${profile.objetivo || 'controle'}
3 dicas numeradas com emojis, práticas. Máx 150 palavras.`

      const response = await fetch(`${API_URL}/api/analise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const data = await response.json()
      setDicas(data.resultado || 'Sem resposta.')
    } catch (e) { setDicas('Erro ao conectar com a IA.') }
    finally { setLoadingDicas(false) }
  }

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Análise */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>📊 Análise do mês</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14 }}>Diagnóstico com gastos, receitas, reserva e projeção do objetivo.</div>
            <button className="btn btn-primary" onClick={gerarAnalise} disabled={loadingAnalise} style={{ width: '100%', justifyContent: 'center' }}>
              {loadingAnalise ? '⏳ Gerando...' : '✨ Gerar análise'}
            </button>
          </div>
          {analise && (
            <div className="card" style={{ background: '#F9F8F6' }}>
              <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{analise}</div>
            </div>
          )}
        </div>

        {/* Dicas */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>🏦 Dicas de Renda Fixa</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14 }}>Sugestões personalizadas para sua carteira de renda fixa.</div>
            <button className="btn btn-green" onClick={gerarDicas} disabled={loadingDicas} style={{ width: '100%', justifyContent: 'center' }}>
              {loadingDicas ? '⏳ Gerando...' : '💡 Gerar dicas'}
            </button>
          </div>
          {dicas && (
            <div className="card" style={{ background: '#F9F8F6' }}>
              <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{dicas}</div>
            </div>
          )}
        </div>
      </div>

      {!analise && !dicas && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Análise com IA Groq</div>
          <div style={{ color: 'var(--secondary)', fontSize: 13 }}>Clique em um dos botões acima para gerar sua análise personalizada com base nos seus dados reais.</div>
        </div>
      )}
    </div>
  )
}
