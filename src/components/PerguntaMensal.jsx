import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

const PERGUNTAS = [
  'Qual foi o maior aprendizado financeiro de vocês este mês?',
  'O que vocês fariam diferente se pudessem recomeçar o mês?',
  'Qual gasto este mês trouxe mais alegria para o casal?',
  'Qual é o próximo passo financeiro que querem dar juntos?',
  'O que vocês mais comemoraram financeiramente este mês?',
  'Que hábito financeiro querem construir no próximo mês?',
  'Qual categoria de gasto ainda pode melhorar na visão de vocês?',
  'O que a situação financeira atual permite que vocês sonhem juntos?',
  'Como vocês avaliam a comunicação sobre dinheiro este mês?',
  'Qual foi a decisão financeira mais inteligente de vocês este mês?',
  'Se vocês tivessem R$1.000 a mais este mês, o que fariam?',
  'O que mais motiva vocês a continuarem organizando as finanças?',
]

function getPerguntaMes(mes, ano) {
  const idx = (mes + ano * 12) % PERGUNTAS.length
  return PERGUNTAS[idx]
}

export function PerguntaMensal({ session, profile }) {
  const [resposta, setResposta] = useState('')
  const [respostaEla, setRespostaEla] = useState(null)
  const [salvei, setSalvei] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aberta, setAberta] = useState(false)

  const now     = new Date()
  const mes     = now.getMonth()
  const ano     = now.getFullYear()
  const pergunta = getPerguntaMes(mes, ano)
  const meuPapel = profile.papel
  const outroPapel = meuPapel === 'eu' ? 'ela' : 'eu'

  useEffect(() => { carregarRespostas() }, [profile.casal_code])

  async function carregarRespostas() {
    if (!profile.casal_code) return
    setLoading(true)
    try {
      const { data } = await supabase.from('perguntas_mensais')
        .select('*, profiles(papel)')
        .eq('casal_code', profile.casal_code)
        .eq('mes', mes).eq('ano', ano)

      const minhaResp = (data || []).find(r => r.user_id === session.user.id)
      const outraResp = (data || []).find(r => r.user_id !== session.user.id)
      if (minhaResp) { setResposta(minhaResp.resposta || ''); setSalvei(true) }
      if (outraResp) setRespostaEla(outraResp.resposta)
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
  }

  async function salvarResposta() {
    if (!resposta.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('perguntas_mensais').upsert({
        user_id: session.user.id, casal_code: profile.casal_code,
        mes, ano, pergunta, resposta: resposta.trim(),
      }, { onConflict: 'casal_code,user_id,mes,ano' })
      if (error) throw error
      setSalvei(true); carregarRespostas()
    } catch(e) { alert('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  if (loading) return null
  if (salvei && !aberta && !respostaEla) return (
    <div className="card" style={{ borderLeft: '3px solid var(--blue, #3B82F6)' }}>
      <div className="row-between">
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue, #3B82F6)' }}>Pergunta do mês respondida</div>
            <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Aguardando resposta do parceiro(a)...</div>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setAberta(true)}>Ver</button>
      </div>
    </div>
  )

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--blue, #3B82F6)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>💬</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue, #3B82F6)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
            Pergunta do mês — {now.toLocaleString('pt-BR', { month: 'long' })}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--primary)', lineHeight: 1.5 }}>
            {pergunta}
          </div>
        </div>
      </div>

      {/* Resposta do parceiro */}
      {respostaEla && (
        <div style={{ background: 'var(--bg, #F7F7F5)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--secondary)', fontWeight: 600, marginBottom: 4 }}>
            {outroPapel === 'ela' ? '👤 ELA respondeu:' : '👤 EU respondeu:'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
            "{respostaEla}"
          </div>
        </div>
      )}

      {/* Minha resposta */}
      {!salvei ? (
        <>
          <textarea
            style={{ width: '100%', padding: '10px 13px', border: '0.5px solid var(--separator)', borderRadius: 10, fontSize: 13, resize: 'none', height: 80, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--primary)', outline: 'none', marginBottom: 10 }}
            placeholder="Escreva sua resposta..."
            value={resposta} onChange={e => setResposta(e.target.value)}
          />
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={salvarResposta} disabled={saving || !resposta.trim()}>
            {saving ? 'Salvando...' : '💬 Enviar resposta'}
          </button>
        </>
      ) : (
        <div>
          <div style={{ background: 'var(--green-bg, #F0FBF6)', borderRadius: 10, padding: '10px 14px', marginBottom: respostaEla ? 0 : 10 }}>
            <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>
              {meuPapel === 'eu' ? '👤 EU respondi:' : '👤 ELA respondeu:'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{resposta}"
            </div>
          </div>
          {!respostaEla && (
            <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 8, textAlign: 'center' }}>
              ⏳ Aguardando resposta do parceiro(a)...
            </div>
          )}
          {respostaEla && (
            <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
              ✅ Os dois responderam! Boa conversa! 💑
            </div>
          )}
        </div>
      )}
    </div>
  )
}
