// IAMemoria.js — sistema de aprendizado contínuo para plano premium
import { supabase } from '../supabase.js'
import { chamarIA } from './IAEngine.js'

// Carrega a memória atual do casal
export async function carregarMemoria(casalCode) {
  const { data } = await supabase
    .from('ia_memoria')
    .select('*')
    .eq('casal_code', casalCode)
    .maybeSingle()
  return data
}

// Atualiza a memória após uma análise — só premium
export async function atualizarMemoria({ casalCode, analise, dados, perguntas, plano }) {
  if (plano !== 'premium') return null

  const memoriaAtual = await carregarMemoria(casalCode)
  const now = new Date()

  // Extrai insights da análise atual
  const promptInsight = `Com base nesta análise financeira de um casal:

"${analise}"

E estes dados do mês:
- Receitas: R$${dados.totalRec?.toFixed(0)} | Despesas: R$${dados.totalDesp?.toFixed(0)}
- Taxa de poupança: ${dados.totalRec > 0 ? (((dados.totalRec-dados.totalDesp)/dados.totalRec)*100).toFixed(0) : 0}%
- Reserva: ${dados.reserva?.pct?.toFixed(0)||0}%
${perguntas?.length ? `\nReflexões do casal: ${perguntas.map(p => `"${p.resposta}"`).join(', ')}` : ''}

Gere um resumo de aprendizado em 2-3 frases sobre o perfil financeiro deste casal.
O que é característico deles? Quais padrões se repetem? O que mais importa para eles?
Seja específico e pessoal. Responda apenas o resumo, sem títulos.`

  try {
    const novoInsight = await chamarIA(promptInsight, 'premium')

    const insights = memoriaAtual?.insights || []
    insights.unshift({
      data: now.toISOString(),
      mes: now.getMonth(),
      ano: now.getFullYear(),
      poupanca: dados.totalRec > 0 ? ((dados.totalRec-dados.totalDesp)/dados.totalRec)*100 : 0,
      resumo: novoInsight,
    })
    // Guarda até 12 meses de insights
    const insightsLimitados = insights.slice(0, 12)

    // Constrói resumo consolidado
    const promptConsolidado = `Você é a memória financeira de um casal. Estes são os aprendizados dos últimos meses:

${insightsLimitados.map((i, idx) => `Mês ${idx+1}: ${i.resumo}`).join('\n')}

Consolide em 1 parágrafo curto (máx 60 palavras) o perfil financeiro deste casal.
O que define o jeito deles de lidar com dinheiro? Quais são seus pontos fortes e fracos recorrentes?
Seja direto e pessoal. Apenas o parágrafo, sem títulos.`

    const resumoConsolidado = insights.length >= 2
      ? await chamarIA(promptConsolidado, 'premium')
      : novoInsight

    // Salva no banco
    const payload = {
      casal_code: casalCode,
      resumo: resumoConsolidado,
      ultima_analise: now.toISOString(),
      total_analises: (memoriaAtual?.total_analises || 0) + 1,
      insights: insightsLimitados,
      updated_at: now.toISOString(),
    }

    if (memoriaAtual) {
      await supabase.from('ia_memoria').update(payload).eq('casal_code', casalCode)
    } else {
      await supabase.from('ia_memoria').insert(payload)
    }

    return resumoConsolidado
  } catch(e) {
    console.warn('IAMemoria update:', e.message)
    return null
  }
}

// Formata a memória para incluir no prompt
export function formatarMemoriaIA(memoria) {
  if (!memoria?.resumo) return ''
  const meses = memoria.total_analises || 0
  return `\n\nMEMÓRIA DO CASAL (${meses} análise${meses !== 1 ? 's' : ''} anteriores):
${memoria.resumo}
${memoria.insights?.length >= 2 ? `\nTendência recente: poupança de ${memoria.insights[0]?.poupanca?.toFixed(0)||0}% → ${memoria.insights[1]?.poupanca?.toFixed(0)||0}% no mês anterior` : ''}`
}

// Gera alerta proativo baseado na memória — só premium
export async function gerarAlertaProativo({ casalCode, dados, memoria, objetivo }) {
  if (!memoria?.resumo) return null

  const { totalRec, totalDesp, reserva, faturas } = dados
  const poupanca = totalRec > 0 ? ((totalRec-totalDesp)/totalRec)*100 : 0

  const prompt = `Você é um assistente financeiro proativo para casais.

PERFIL DO CASAL (aprendido ao longo do tempo):
${memoria.resumo}

SITUAÇÃO ATUAL:
- Poupança este mês: ${poupanca.toFixed(0)}%
- Reserva: ${reserva?.pct?.toFixed(0)||0}%
- Faturas: R$${faturas?.toFixed(0)||0}
- Objetivo: ${objetivo}

Com base no que você sabe sobre este casal e a situação atual,
gere UMA mensagem proativa e personalizada de no máximo 2 frases.
Deve parecer que você os conhece de verdade.
Seja direto, encorajador e específico. Apenas a mensagem.`

  try {
    return await chamarIA(prompt, 'premium')
  } catch { return null }
}
