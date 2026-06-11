import { useEffect } from 'react'
import { supabase } from '../supabase.js'

// Hook que roda em background ao carregar o app
// Verifica recorrências com dia_cobranca <= hoje e lança automaticamente
export function useAutoLancarRecorrencias(session, profile) {
  useEffect(() => {
    if (!session?.user?.id || !profile) return
    // Pequeno delay para não atrasar o carregamento inicial
    const timer = setTimeout(() => autoLancar(session, profile), 2000)
    return () => clearTimeout(timer)
  }, [session?.user?.id, profile?.casal_code])
}

async function autoLancar(session, profile) {
  const uid  = session.user.id
  const cc   = profile.casal_code || uid
  const now  = new Date()
  const mes  = now.getMonth()
  const ano  = now.getFullYear()
  const hoje = now.getDate()

  try {
    // 1. Busca recorrências ativas com auto_lancar = true vinculadas a um cartão
    const { data: recorrencias } = await supabase
      .from('recorrencias_cartao')
      .select('*')
      .eq('casal_code', cc)
      .eq('ativa', true)
      .eq('auto_lancar', true)
      .not('cartao_id', 'is', null)
      .lte('dia_cobranca', hoje) // dia de cobrança já passou

    if (!recorrencias?.length) return

    // 2. Busca quais já foram lançadas este mês
    const ids = recorrencias.map(r => r.id)
    const { data: jaLancados } = await supabase
      .from('lancamentos_recorrentes')
      .select('recorrencia_id')
      .in('recorrencia_id', ids)
      .eq('mes', mes)
      .eq('ano', ano)

    const lancadosSet = new Set((jaLancados || []).map(l => l.recorrencia_id))

    // 3. Filtra as que ainda não foram lançadas
    const pendentes = recorrencias.filter(r => !lancadosSet.has(r.id))
    if (!pendentes.length) return

    // 4. Busca os cartões de uma vez
    const cartaoIds = [...new Set(pendentes.map(r => r.cartao_id))]
    const { data: cartoes } = await supabase
      .from('cartoes')
      .select('*')
      .in('id', cartaoIds)

    const cartaoMap = {}
    ;(cartoes || []).forEach(c => { cartaoMap[c.id] = c })

    // 5. Lança cada recorrência pendente
    for (const rec of pendentes) {
      const cartao = cartaoMap[rec.cartao_id]
      if (!cartao) continue

      try {
        // Lança a despesa
        const { error: e1 } = await supabase.from('despesas').insert({
          user_id:       uid,
          casal_code:    cc,
          nome:          rec.nome,
          valor:         rec.valor,
          categoria:     rec.categoria || 'Assinaturas',
          quem:          rec.quem || profile.papel,
          tipo:          'recorrente',
          pagamento_tipo:'cartao',
          cartao_id:     rec.cartao_id,
          cartao_nome:   rec.cartao_nome,
          mes,
          ano,
        })
        if (e1) throw e1

        // Atualiza fatura do cartão
        await supabase.from('cartoes')
          .update({ fatura: (cartao.fatura || 0) + rec.valor })
          .eq('id', rec.cartao_id)

        // Marca como lançado neste mês
        await supabase.from('lancamentos_recorrentes').insert({
          recorrencia_id: rec.id,
          casal_code:     cc,
          mes,
          ano,
        })

        console.log(`✅ Auto-lançado: ${rec.nome} (${rec.valor}) na fatura ${rec.cartao_nome}`)

      } catch (err) {
        // Falha silenciosa por item — não interrompe os demais
        console.warn(`⚠️ Falha ao auto-lançar ${rec.nome}:`, err.message)
      }
    }

    console.log(`🔄 Auto-lançamento concluído: ${pendentes.length} recorrência(s)`)

  } catch (err) {
    // Falha silenciosa geral
    console.warn('Auto-lançamento falhou:', err.message)
  }
}
