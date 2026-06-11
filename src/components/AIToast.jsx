import { useState, useEffect, useCallback } from 'react'
import { buildPromptToast, chamarIA } from './IAEngine.js'

export function useAIToast(profile) {
  const [toast, setToast] = useState(null)

  const dispensar = useCallback(() => setToast(null), [])

  const sugerirIA = useCallback(async ({ tipo, nome, valor, categoria, quem, contexto = {} }) => {
    setToast({ loading: true, msg: '' })
    try {
      const objetivo = profile?.objetivo || 'controle'
      const prompt = buildPromptToast({
        objetivo, tipo, nome, valor, categoria, quem,
        totalMes: contexto.totalMes,
        pctReserva: profile?.pct_reserva || 5,
      })
      const plano = profile?.plano || 'free'
      const msg = await chamarIA(prompt, plano)
      if (msg?.trim()) setToast({ loading: false, msg: msg.trim() })
      else setToast(null)
    } catch(e) {
      console.warn('AIToast:', e.message)
      setToast(null)
    }
  }, [profile?.objetivo, profile?.pct_reserva])

  useEffect(() => {
    if (!toast || toast.loading) return
    const t = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(t)
  }, [toast])

  return { toast, sugerirIA, dispensar }
}

export function AIToast({ toast, onDispensar }) {
  if (!toast) return null
  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      maxWidth:340, width:'calc(100% - 48px)',
      background:'var(--primary)', color:'#fff',
      borderRadius:16, padding:'14px 16px',
      boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
      animation:'slideUp 0.3s ease',
      display:'flex', alignItems:'flex-start', gap:12,
    }}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
        {toast.loading ? <span style={{ animation:'pulse 1.2s ease infinite', fontSize:18 }}>🤖</span> : '💡'}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:0.8, opacity:0.5, marginBottom:4, textTransform:'uppercase' }}>Sugestão da IA</div>
        {toast.loading
          ? <div style={{ fontSize:13, opacity:0.6 }}>Analisando seu lançamento...</div>
          : <div style={{ fontSize:13, lineHeight:1.5 }}>{toast.msg}</div>}
      </div>
      {!toast.loading && (
        <button onClick={onDispensar} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:20, padding:0, lineHeight:1, flexShrink:0 }}>×</button>
      )}
    </div>
  )
}
