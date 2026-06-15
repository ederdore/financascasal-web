// Eventos.js — rastreamento de eventos de produto
// Registra cada marco uma única vez por usuário (unique constraint no banco)

import { supabase } from '../supabase.js'

export const EVENTOS = {
  CONTA_CRIADA:          'conta_criada',
  PARCEIRO_CONVIDADO:    'parceiro_convidado',
  PRIMEIRA_RECEITA:      'primeira_receita',
  PRIMEIRA_DESPESA:      'primeira_despesa',
  PRIMEIRO_CARTAO:       'primeiro_cartao',
  PRIMEIRA_META:         'primeira_meta',
  PRIMEIRA_RESERVA:      'primeira_reserva',
  PRIMEIRA_IA:           'primeira_ia',
  PRIMEIRO_TELEGRAM:     'primeiro_telegram',
  SETE_DIAS_ATIVO:       '7_dias_ativo',
  TRINTA_DIAS_ATIVO:     '30_dias_ativo',
}

// Registra evento — silencioso, não bloqueia o fluxo principal
export async function registrarEvento(userId, casalCode, evento, dados = {}) {
  if (!userId || !evento) return
  try {
    await supabase.from('eventos_usuario').insert({
      user_id: userId,
      casal_code: casalCode,
      evento,
      dados,
    })
  } catch { /* unique constraint — evento já registrado, ignora */ }
}

// Verifica atividade e registra marcos de 7 e 30 dias
export async function verificarAtividade(userId, casalCode) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.created_at) return

    const diasDesde = Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Verifica se tem lançamentos recentes (ativo = lançou algo)
    const { data: recente } = await supabase
      .from('despesas')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1)

    if (!recente?.length) return

    if (diasDesde >= 7)  registrarEvento(userId, casalCode, EVENTOS.SETE_DIAS_ATIVO)
    if (diasDesde >= 30) registrarEvento(userId, casalCode, EVENTOS.TRINTA_DIAS_ATIVO)
  } catch(e) { console.warn('verificarAtividade:', e.message) }
}
