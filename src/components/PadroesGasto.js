// PadroesGasto.js — motor de análise comportamental
// Identifica padrões de gasto por dia da semana e categoria
import { supabase } from '../supabase.js'

const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']
const DIAS_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// Analisa histórico e atualiza padrões — roda em background
export async function analisarPadroes(session, profile) {
  if (!profile?.casal_code) return
  const cc  = profile.casal_code
  const uid = session.user.id

  try {
    // Busca despesas dos últimos 3 meses
    const tresMesesAtras = new Date()
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)

    const { data: despesas } = await supabase
      .from('despesas')
      .select('valor, categoria, created_at, nome')
      .eq('casal_code', cc)
      .gte('created_at', tresMesesAtras.toISOString())
      .order('created_at', { ascending: false })

    if (!despesas?.length) return

    // Agrupa por dia da semana + categoria
    const grupos = {}
    despesas.forEach(d => {
      const diaSemana = new Date(d.created_at).getDay()
      const key = `${diaSemana}_${d.categoria}`
      if (!grupos[key]) grupos[key] = { diaSemana, categoria: d.categoria, valores: [], nomes: [], datas: [] }
      grupos[key].valores.push(d.valor)
      grupos[key].nomes.push(d.nome)
      grupos[key].datas.push(d.created_at)
    })

    // Filtra padrões com pelo menos 2 ocorrências
    const padroes = Object.values(grupos).filter(g => g.valores.length >= 2)

    // Upsert dos padrões no banco
    for (const p of padroes) {
      const valorMedio = p.valores.reduce((s, v) => s + v, 0) / p.valores.length
      const ultimoGasto = p.datas.sort().reverse()[0]

      await supabase.from('padroes_gasto').upsert({
        casal_code:  cc,
        user_id:     uid,
        dia_semana:  p.diaSemana,
        categoria:   p.categoria,
        valor_medio: Math.round(valorMedio * 100) / 100,
        ocorrencias: p.valores.length,
        ultimo_gasto: ultimoGasto,
        ativo: true,
      }, { onConflict: 'casal_code,dia_semana,categoria' })
    }

    console.log(`📊 Padrões atualizados: ${padroes.length}`)
  } catch(e) { console.warn('analisarPadroes:', e.message) }
}

// Busca padrões relevantes para hoje
export async function buscarPadroesHoje(casalCode) {
  const hoje = new Date().getDay()
  const { data } = await supabase
    .from('padroes_gasto')
    .select('*')
    .eq('casal_code', casalCode)
    .eq('dia_semana', hoje)
    .eq('ativo', true)
    .gte('ocorrencias', 2)
    .order('valor_medio', { ascending: false })
  return data || []
}

// Verifica se já investiu suficiente este mês para cobrir o padrão
export async function verificarContrapartida(session, profile, valorPadrao) {
  const uid = session.user.id
  const cc  = profile.casal_code
  const now = new Date()

  const [aportes, reserva] = await Promise.all([
    supabase.from('aportes_metas').select('valor')
      .eq('casal_code', cc)
      .eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
    supabase.from('reserva').select('atual').eq('user_id', uid).maybeSingle(),
  ])

  const totalAportes = (aportes.data||[]).reduce((s,a) => s+a.valor, 0)
  const temReserva   = (reserva.data?.atual || 0) > 0

  return {
    jaInvestiu: totalAportes >= valorPadrao,
    totalAportes,
    temReserva,
    suficiente: totalAportes >= valorPadrao || temReserva,
  }
}

// Registra resposta do usuário à reflexão
export async function registrarResposta(session, profile, padraoId, resposta) {
  const now = new Date()
  await supabase.from('reflexoes_respondidas').insert({
    casal_code: profile.casal_code,
    user_id:    session.user.id,
    padrao_id:  padraoId,
    resposta,
    mes: now.getMonth(),
    ano: now.getFullYear(),
  })
}

// Formata a mensagem de reflexão
export function formatarReflexao({ padrao, contrapartida, profile }) {
  const dia     = DIAS[padrao.dia_semana]
  const valor   = `R$ ${padrao.valor_medio.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const cat     = padrao.categoria
  const icons   = { Alimentação:'🍕', Lazer:'🎉', Transporte:'🚗', Saúde:'💊', Outros:'💸', Assinaturas:'📺' }
  const icon    = icons[cat] || '💸'

  let msg = `${icon} *Reflexão do Éden*\n\n`
  msg += `Na ${dia} passada vocês gastaram *${valor}* em ${cat}.\n\n`

  if (!contrapartida.suficiente) {
    msg += `Antes de repetir este padrão, vocês já guardaram pelo menos esse valor na reserva este mês?\n\n`
    msg += `💡 _Se repetirem 12x, são ${valor.replace('R$', 'R$').replace(' ', '')} × 12 = R$ ${Math.round(padrao.valor_medio * 12).toLocaleString('pt-BR')} por ano._`
  } else {
    msg += `✅ Vocês já investiram *R$ ${contrapartida.totalAportes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}* este mês. `
    msg += `O ${cat} de hoje está coberto! Aproveitem com consciência. 🌿`
  }

  return msg
}

export { DIAS, DIAS_CURTO }
