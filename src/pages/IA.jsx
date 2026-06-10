import { useState } from 'react'
import { supabase, fmt, API_URL } from '../supabase.js'

export default function IA({ session, profile }) {
  const [analise, setAnalise] = useState('')
  const [dicas, setDicas] = useState('')
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [loadingDicas, setLoadingDicas] = useState(false)
  const [erroAnalise, setErroAnalise] = useState('')
  const [erroDicas, setErroDicas] = useState('')

  async function chamarIA(prompt) {
    const url = `${API_URL}/api/analise`
    console.log('Chamando IA em:', url)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!response.ok) {
      const txt = await response.text()
      throw new Error(`HTTP ${response.status}: ${txt}`)
    }
    const data = await response.json()
    return data.resultado || data.resposta || data.content || JSON.stringify(data)
  }

  async function gerarAnalise() {
    setLoadingAnalise(true); setErroAnalise(''); setAnalise('')
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
      const totalRec  = (rec.data  || []).reduce((s, r) => s + r.valor, 0)
      const totalDesp = (desp.data || []).reduce((s, d) => s + d.valor, 0)
      const cats = {}; (desp.data || []).forEach(d => { cats[d.categoria] = (cats[d.categoria] || 0) + d.valor })
      const catStr = Object.entries(cats).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ')
      const res = reserva.data || { atual: 0, meta: 30000 }
      const faturas = (cartoes.data || []).reduce((s, c) => s + (c.fatura || 0), 0)
      const saldoBancos = (bancos.data || []).reduce((s, b) => s + b.saldo, 0)
      const totalInv = (investimentos.data || []).reduce((s, i) => s + i.valor, 0)

      const prompt = `Você é um consultor financeiro para casais brasileiros. Analise os dados abaixo e responda em português:

DADOS DO MÊS:
- Receitas: ${fmt(totalRec)}
- Despesas: ${fmt(totalDesp)}
- Saldo: ${fmt(totalRec - totalDesp)}
- Gastos por categoria: ${catStr || 'sem dados'}
- Renda Fixa: ${fmt(totalInv)}
- Saldo bancos: ${fmt(saldoBancos)}
- Faturas cartão: ${fmt(faturas)}
- Reserva: ${fmt(res.atual)} de ${fmt(res.meta)}
- Objetivo do casal: ${profile.objetivo || 'controle financeiro'}

Responda com 4 blocos curtos:
📊 Diagnóstico (situação atual)
⚠️ Atenção (pontos de alerta)
💡 Sugestão (ação prática)
🚀 Projeção (próximo mês)

Máximo 250 palavras. Seja direto e prático.`

      const resultado = await chamarIA(prompt)
      setAnalise(resultado)
    } catch (e) {
      console.error('Erro IA analise:', e)
      setErroAnalise(`Erro: ${e.message}. Verifique se o backend está rodando em ${API_URL}`)
    } finally { setLoadingAnalise(false) }
  }

  async function gerarDicas() {
    setLoadingDicas(true); setErroDicas(''); setDicas('')
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    try {
      const [inv, res] = await Promise.all([
        cf(supabase.from('investimentos').select('*')),
        supabase.from('reserva').select('*').eq('user_id', session.user.id).maybeSingle(),
      ])
      const totalInv = (inv.data || []).reduce((s, i) => s + i.valor, 0)
      const reserva = res.data || { atual: 0, meta: 30000 }

      const prompt = `Você é um especialista em renda fixa brasileira. Dê 3 dicas personalizadas em português:

CARTEIRA ATUAL:
- Total investido: ${fmt(totalInv)}
- Reserva de emergência: ${fmt(reserva.atual)} de ${fmt(reserva.meta)}
- CDI configurado: ${reserva.rende_cdi ? `${reserva.pct_cdi}% CDI` : 'não configurado'}
- Objetivo: ${profile.objetivo || 'controle financeiro'}

Formato: 3 dicas numeradas com emoji, práticas e específicas para o Brasil. Máximo 150 palavras.`

      const resultado = await chamarIA(prompt)
      setDicas(resultado)
    } catch (e) {
      console.error('Erro IA dicas:', e)
      setErroDicas(`Erro: ${e.message}`)
    } finally { setLoadingDicas(false) }
  }

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Análise mensal */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>📊 Análise do mês</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Diagnóstico completo com gastos, receitas, reserva e projeção baseado nos seus dados reais.
            </div>
            <button className="btn btn-primary" onClick={gerarAnalise}
              disabled={loadingAnalise} style={{ width: '100%', justifyContent: 'center' }}>
              {loadingAnalise ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                  Analisando...
                </span>
              ) : '✨ Gerar análise'}
            </button>
          </div>

          {erroAnalise && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid var(--red)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: 'var(--red)' }}>
              {erroAnalise}
            </div>
          )}

          {analise && (
            <div className="card" style={{ background: '#F9F8F6' }}>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--primary)' }}>
                {analise}
              </div>
            </div>
          )}
        </div>

        {/* Dicas renda fixa */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>🏦 Dicas de Renda Fixa</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Sugestões personalizadas para sua carteira de investimentos baseadas no perfil do casal.
            </div>
            <button className="btn btn-green" onClick={gerarDicas}
              disabled={loadingDicas} style={{ width: '100%', justifyContent: 'center' }}>
              {loadingDicas ? '⏳ Gerando...' : '💡 Gerar dicas'}
            </button>
          </div>

          {erroDicas && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid var(--red)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: 'var(--red)' }}>
              {erroDicas}
            </div>
          )}

          {dicas && (
            <div className="card" style={{ background: '#F9F8F6' }}>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--primary)' }}>
                {dicas}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info sobre a IA */}
      {!analise && !dicas && !erroAnalise && !erroDicas && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 16 }}>Análise com IA</div>
          <div style={{ color: 'var(--secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            Powered by <strong>Groq (llama-3.3-70b)</strong> — análises personalizadas baseadas nos seus dados financeiros reais.
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--secondary)' }}>
            Backend: <code style={{ background: '#F5F3EF', padding: '2px 6px', borderRadius: 4 }}>{API_URL}</code>
          </div>
        </div>
      )}
    </div>
  )
}
