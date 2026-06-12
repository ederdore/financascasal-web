// ── IA Engine — FinançasCasal ─────────────────────────
// Centraliza todas as chamadas de IA com contexto de objetivo financeiro
import { API_URL } from '../supabase.js'

// Objetivos e seus contextos
export const OBJETIVOS = {
  controle: {
    label: 'Controle financeiro',
    icon: '📊',
    foco: 'organização, controle de gastos e equilíbrio orçamentário',
    alertas: ['gastos acima da média', 'categorias sem orçamento definido', 'despesas recorrentes esquecidas'],
    meta_reserva_meses: 6,
  },
  reserva: {
    label: 'Completar reserva',
    icon: '🛡',
    foco: 'acumulação acelerada de reserva de emergência',
    alertas: ['reserva abaixo de 3 meses', 'meses sem aporte na reserva', 'gastos desnecessários que poderiam virar reserva'],
    meta_reserva_meses: 12,
  },
  liberdade: {
    label: 'Liberdade financeira',
    icon: '🚀',
    foco: 'redução de despesas, aumento de receitas e crescimento patrimonial',
    alertas: ['taxa de poupança abaixo de 30%', 'sem investimentos ativos', 'despesas de estilo de vida crescendo'],
    meta_reserva_meses: 12,
  },
  casa: {
    label: 'Comprar imóvel',
    icon: '🏠',
    foco: 'acumulação para entrada de imóvel e redução de dívidas',
    alertas: ['meta de imóvel sem progresso', 'fatura de cartão alta', 'sem aporte mensal para a meta'],
    meta_reserva_meses: 6,
  },
  viagem: {
    label: 'Viajar mais',
    icon: '✈️',
    foco: 'acumulação para viagem e controle de gastos supérfluos',
    alertas: ['meta de viagem sem aporte', 'lazer acima do planejado sem destino específico'],
    meta_reserva_meses: 3,
  },
}

// Constrói prompt contextualizado por objetivo
export function buildPromptAnalise({ objetivo, dados, memoria = '' }) {
  const obj = OBJETIVOS[objetivo] || OBJETIVOS.controle
  const { totalRec, totalDesp, saldo, cats, saldoBancos, faturas, reserva, investimentos, metas, pctReserva } = dados

  const taxaPoupanca = totalRec > 0 ? (((totalRec - totalDesp) / totalRec) * 100).toFixed(0) : 0
  const catStr = Object.entries(cats || {}).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([k,v]) => `${k}: R$${v.toFixed(0)}`).join(', ')

  return `Você é um consultor financeiro especializado para casais brasileiros.

OBJETIVO DO CASAL: ${obj.icon} ${obj.label}
FOCO DA ANÁLISE: ${obj.foco}

DADOS DO MÊS:
- Receitas: R$${totalRec.toFixed(0)}
- Despesas: R$${totalDesp.toFixed(0)}
- Saldo: R$${saldo.toFixed(0)}
- Taxa de poupança: ${taxaPoupanca}%
- Top categorias: ${catStr || 'sem dados'}
- Saldo total bancos: R$${saldoBancos.toFixed(0)}
- Faturas cartão: R$${faturas.toFixed(0)}
- Reserva: R$${reserva.atual.toFixed(0)} / R$${reserva.meta.toFixed(0)} (${reserva.pct?.toFixed(0) || 0}%)
- Investimentos: R$${investimentos.toFixed(0)}
- Metas ativas: ${metas}
- % reserva automática: ${pctReserva}%

Responda em português com 4 blocos EXATAMENTE neste formato:

📊 DIAGNÓSTICO
[1-2 frases sobre a situação atual em relação ao objetivo ${obj.label}]

⚠️ ATENÇÃO
[2-3 alertas específicos e diretos, um por linha, baseados nos alertas típicos: ${obj.alertas.join(', ')}]

💡 SUGESTÃO
[1 ação prática e específica para avançar rumo ao objetivo ${obj.label} este mês]

🚀 PRÓXIMO MÊS
[1 meta concreta com número: ex "Guardar R$X a mais" ou "Reduzir X categoria em Y%"]

Máximo 200 palavras. Seja direto, sem introduções.${memoria}`
}

export function buildPromptToast({ objetivo, tipo, nome, valor, categoria, totalMes, pctReserva }) {
  const obj = OBJETIVOS[objetivo] || OBJETIVOS.controle
  if (tipo === 'despesa') {
    return `Consultor financeiro. Casal com objetivo: ${obj.label}. 
Acabou de lançar despesa: "${nome}" R$${valor} categoria ${categoria}. Total despesas mês: R$${totalMes?.toFixed(0) || 0}.
Foco: ${obj.foco}.
Dê UMA dica de 1 frase (máx 15 palavras) conectada ao objetivo ${obj.label}. Só a dica, sem prefixo.`
  }
  return `Consultor financeiro. Casal com objetivo: ${obj.label}.
Acabou de receber R$${valor}. Reserva automática: ${pctReserva}%.
Foco: ${obj.foco}.
Dê UMA sugestão de 1 frase (máx 15 palavras) sobre o que fazer com esse dinheiro para avançar no objetivo. Só a dica.`
}

export function buildPromptNotificacoes({ objetivo, dados }) {
  const obj = OBJETIVOS[objetivo] || OBJETIVOS.controle
  const { totalRec, totalDesp, saldo, reserva, faturas, investimentos, metas } = dados

  return `Você é um assistente financeiro para casais brasileiros.

OBJETIVO: ${obj.label} — ${obj.foco}

SITUAÇÃO ATUAL:
- Receitas: R$${totalRec.toFixed(0)} | Despesas: R$${totalDesp.toFixed(0)} | Saldo: R$${saldo.toFixed(0)}
- Reserva: ${reserva.pct?.toFixed(0) || 0}% da meta
- Faturas: R$${faturas.toFixed(0)}
- Investimentos: R$${investimentos.toFixed(0)}

Gere exatamente 3 notificações/alertas personalizados para este casal baseados no objetivo "${obj.label}".

Responda APENAS JSON válido (sem markdown):
[
  {"tipo": "alerta|dica|conquista", "titulo": "texto curto", "mensagem": "1 frase de orientação", "prioridade": "alta|media|baixa"},
  {"tipo": "alerta|dica|conquista", "titulo": "texto curto", "mensagem": "1 frase de orientação", "prioridade": "alta|media|baixa"},
  {"tipo": "alerta|dica|conquista", "titulo": "texto curto", "mensagem": "1 frase de orientação", "prioridade": "alta|media|baixa"}
]`
}

// Busca histórico de perguntas mensais para contexto da IA
export async function buscarMemoriaPerguntas(supabaseClient, casalCode, limite = 6) {
  try {
    const { data } = await supabaseClient
      .from('perguntas_mensais')
      .select('mes, ano, pergunta, resposta, profiles(papel)')
      .eq('casal_code', casalCode)
      .not('resposta', 'is', null)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(limite)
    return data || []
  } catch { return [] }
}

// Formata memória de perguntas como contexto para a IA
export function formatarMemoria(perguntas) {
  if (!perguntas?.length) return ''
  const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const linhas = perguntas.map(p =>
    `${MESES_CURTO[p.mes]}/${p.ano} — ${p.pergunta}: "${p.resposta}"`
  )
  return '\n\nHISTÓRICO DE REFLEXÕES DO CASAL (últimos meses):\n' + linhas.join('\n')
}

// Chamada à API — passa o plano para o backend escolher o provider
export async function chamarIA(prompt, plano = 'free') {
  const res = await fetch(`${API_URL}/api/analise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, plano }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`HTTP ${res.status}: ${err.erro || res.statusText}`)
  }
  const data = await res.json()
  // Log do provider usado (útil para debug)
  if (data.provider) console.log(`🤖 IA: ${data.provider} (${data.modelo})`)
  return data.resultado || ''
}
