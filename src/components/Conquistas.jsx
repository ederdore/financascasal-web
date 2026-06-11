import { useState, useEffect, useCallback } from 'react'
import { supabase, fmt } from '../supabase.js'

// ── Definição de todas as conquistas possíveis ────────
export const TIPOS_CONQUISTA = {
  primeiro_lancamento: { titulo: '🎉 Primeiro lançamento!', descricao: 'Vocês registraram o primeiro gasto juntos.', icone: '🎉', cor: '#3B82F6' },
  mes_positivo:        { titulo: '✅ Mês no azul!', descricao: 'Receitas superaram despesas este mês.', icone: '✅', cor: '#00C781' },
  tres_meses_positivos:{ titulo: '🔥 3 meses consecutivos no azul!', descricao: 'Consistência é o segredo das finanças saudáveis.', icone: '🔥', cor: '#00C781' },
  reserva_25:          { titulo: '🛡 Reserva 25% completa', descricao: 'Ótimo começo! Continuem aportando todo mês.', icone: '🛡', cor: '#8B5CF6' },
  reserva_50:          { titulo: '🛡 Reserva na metade!', descricao: 'Vocês estão no meio do caminho da segurança financeira.', icone: '🛡', cor: '#8B5CF6' },
  reserva_100:         { titulo: '🏆 Reserva completa!', descricao: 'Parabéns! Vocês têm meses de segurança garantidos.', icone: '🏆', cor: '#F59E0B' },
  meta_batida:         { titulo: '🎯 Meta concluída!', descricao: 'Vocês realizaram um sonho juntos.', icone: '🎯', cor: '#E8384F' },
  sem_cartao_devedor:  { titulo: '💳 Fatura zerada!', descricao: 'Mês sem dívida no cartão. Isso é liberdade.', icone: '💳', cor: '#00C781' },
  poupanca_20:         { titulo: '💰 Poupando 20%!', descricao: 'Vocês atingiram a meta de poupança recomendada.', icone: '💰', cor: '#3B82F6' },
}

// ── Hook de detecção automática de conquistas ─────────
export function useConquistas(session, profile) {
  const [novasConquistas, setNovasConquistas] = useState([])

  const verificar = useCallback(async () => {
    if (!session?.user?.id || !profile?.casal_code) return
    const uid = session.user.id
    const cc  = profile.casal_code
    const now = new Date()
    const mes = now.getMonth()
    const ano = now.getFullYear()

    try {
      const [desp, rec, cartoes, reservaData, metasData, conquistasExist] = await Promise.all([
        supabase.from('despesas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('receitas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('cartoes').select('fatura').eq('casal_code', cc),
        supabase.from('reserva').select('atual,meta').eq('user_id', uid).maybeSingle(),
        supabase.from('metas').select('*').eq('casal_code', cc).eq('ativa', true),
        supabase.from('conquistas').select('tipo').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
      ])

      const jaConquistadas = new Set((conquistasExist.data || []).map(c => c.tipo))
      const totalRec  = (rec.data  || []).reduce((s, r) => s + r.valor, 0)
      const totalDesp = (desp.data || []).reduce((s, d) => s + d.valor, 0)
      const reserva   = reservaData.data || { atual: 0, meta: 30000 }
      const pctRes    = reserva.meta > 0 ? (reserva.atual / reserva.meta) * 100 : 0
      const faturas   = (cartoes.data || []).reduce((s, c) => s + (c.fatura || 0), 0)
      const taxaPoup  = totalRec > 0 ? ((totalRec - totalDesp) / totalRec) * 100 : 0

      const novas = []

      async function registrar(tipo, valor = null) {
        if (jaConquistadas.has(tipo)) return
        const def = TIPOS_CONQUISTA[tipo]
        const { error } = await supabase.from('conquistas').insert({
          casal_code: cc, user_id: uid,
          tipo, titulo: def.titulo, descricao: def.descricao,
          valor, mes, ano, celebrado: false,
        })
        if (!error) novas.push({ tipo, ...def, valor })
      }

      // Primeiro lançamento
      if ((desp.data || []).length === 1 && totalDesp > 0) await registrar('primeiro_lancamento')

      // Mês positivo
      if (totalRec > 0 && totalRec > totalDesp) await registrar('mes_positivo', totalRec - totalDesp)

      // Reserva
      if (pctRes >= 25 && pctRes < 50) await registrar('reserva_25', reserva.atual)
      if (pctRes >= 50 && pctRes < 100) await registrar('reserva_50', reserva.atual)
      if (pctRes >= 100) await registrar('reserva_100', reserva.atual)

      // Fatura zerada
      if (faturas === 0 && (cartoes.data || []).length > 0) await registrar('sem_cartao_devedor')

      // Poupança 20%
      if (taxaPoup >= 20) await registrar('poupanca_20', taxaPoup)

      // Metas batidas
      for (const meta of (metasData.data || [])) {
        const atual  = meta.valor_atual ?? meta.atual ?? 0
        const alvo   = meta.valor_alvo ?? 0
        if (alvo > 0 && atual >= alvo) {
          await registrar(`meta_batida_${meta.id}`, alvo)
          novas.push({ tipo: 'meta_batida', ...TIPOS_CONQUISTA.meta_batida, valor: alvo, nomeMeta: meta.nome })
        }
      }

      // 3 meses consecutivos positivos
      const { data: hist } = await supabase.from('conquistas')
        .select('mes,ano').eq('casal_code', cc).eq('tipo', 'mes_positivo')
        .order('ano', { ascending: false }).order('mes', { ascending: false }).limit(3)
      if ((hist || []).length >= 3) await registrar('tres_meses_positivos')

      if (novas.length > 0) setNovasConquistas(novas)

    } catch(e) { console.warn('Conquistas:', e.message) }
  }, [session?.user?.id, profile?.casal_code])

  useEffect(() => {
    if (!session?.user?.id || !profile) return
    const timer = setTimeout(verificar, 3000)
    return () => clearTimeout(timer)
  }, [verificar])

  const dispensar = useCallback(() => setNovasConquistas([]), [])
  return { novasConquistas, dispensar }
}

// ── Modal de celebração ───────────────────────────────
export function CelebracaoModal({ conquistas, onClose }) {
  const [idx, setIdx] = useState(0)
  if (!conquistas?.length) return null
  const atual = conquistas[idx]
  const def   = TIPOS_CONQUISTA[atual.tipo] || TIPOS_CONQUISTA.mes_positivo

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 24, animation: 'fadeIn 0.2s ease',
    }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes confetti {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Confetti */}
      {['#E8384F','#00C781','#3B82F6','#F59E0B','#8B5CF6'].map((cor, i) =>
        Array.from({length: 6}).map((_, j) => (
          <div key={`${i}-${j}`} style={{
            position: 'fixed',
            left: `${10 + (i*16) + (j*3)}%`,
            top: '-10px',
            width: 8 + j,
            height: 8 + j,
            borderRadius: j % 2 === 0 ? '50%' : 2,
            background: cor,
            animation: `confetti ${1.5 + j*0.2}s ease ${i*0.1 + j*0.15}s forwards`,
            pointerEvents: 'none',
            zIndex: 9998,
          }} />
        ))
      )}

      <div style={{
        background: 'var(--card, #fff)',
        borderRadius: 24, padding: '40px 32px',
        maxWidth: 400, width: '100%', textAlign: 'center',
        animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        position: 'relative', zIndex: 9999,
      }}>
        {/* Ícone animado */}
        <div style={{ fontSize: 64, marginBottom: 16, animation: 'float 2s ease infinite', lineHeight: 1 }}>
          {def.icone}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: def.cor, textTransform: 'uppercase', marginBottom: 8 }}>
          Conquista desbloqueada
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary, #1C1C1E)', marginBottom: 10, letterSpacing: -0.3 }}>
          {atual.titulo || def.titulo}
        </div>

        <div style={{ fontSize: 14, color: 'var(--secondary, #8A8A8E)', lineHeight: 1.6, marginBottom: 8 }}>
          {atual.descricao || def.descricao}
        </div>

        {atual.valor && (
          <div style={{ fontSize: 16, fontWeight: 600, color: def.cor, marginBottom: 20 }}>
            {typeof atual.valor === 'number' && atual.valor > 100 ? fmt(atual.valor) : `${atual.valor?.toFixed(0)}%`}
          </div>
        )}

        {atual.nomeMeta && (
          <div style={{ fontSize: 13, color: 'var(--secondary, #8A8A8E)', marginBottom: 16 }}>
            Meta: <strong>{atual.nomeMeta}</strong>
          </div>
        )}

        {/* Progresso se houver mais conquistas */}
        {conquistas.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {conquistas.map((_, i) => (
              <div key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, background: i === idx ? def.cor : 'var(--border, #E8E8E6)', transition: 'width 0.2s' }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {idx < conquistas.length - 1 ? (
            <button onClick={() => setIdx(idx + 1)}
              style={{ flex: 1, padding: '12px', borderRadius: 12, background: def.cor, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Próxima conquista →
            </button>
          ) : (
            <button onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: 12, background: def.cor, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Continuar 🎉
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card de conquistas recentes (para Visão Geral) ────
export function ConquistasRecentes({ session, profile }) {
  const [conquistas, setConquistas] = useState([])

  useEffect(() => {
    if (!profile?.casal_code) return
    supabase.from('conquistas').select('*')
      .eq('casal_code', profile.casal_code)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setConquistas(data) })
  }, [profile?.casal_code])

  if (conquistas.length === 0) return null

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>🏆 Conquistas do casal</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {conquistas.map(c => {
          const def = TIPOS_CONQUISTA[c.tipo] || TIPOS_CONQUISTA.mes_positivo
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg, #F7F7F5)', borderRadius: 10, padding: '8px 12px',
              border: '0.5px solid var(--separator, #E8E8E6)',
            }}>
              <span style={{ fontSize: 18 }}>{def.icone}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: def.cor }}>{c.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--secondary, #8A8A8E)' }}>
                  {new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
