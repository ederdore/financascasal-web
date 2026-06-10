import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../supabase.js'

// Hook global — importar onde precisar
export function useAIToast() {
  const [toast, setToast] = useState(null) // { msg, loading }

  const dispensar = useCallback(() => setToast(null), [])

  const sugerirIA = useCallback(async ({ tipo, nome, valor, categoria, quem, contexto = {} }) => {
    // Mostra imediatamente como loading
    setToast({ loading: true, msg: '' })

    try {
      const quemLabel = quem === 'casal' ? 'do casal (50/50)' : quem === 'eu' ? 'seu' : 'dela'
      const prompt = tipo === 'despesa'
        ? `Consultor financeiro. Um casal acabou de lançar uma despesa: "${nome}" de R$${valor} na categoria "${categoria}", ${quemLabel}. ${contexto.totalMes ? `Total gasto este mês: R$${contexto.totalMes}.` : ''} Dê UMA sugestão prática e direta em 1 frase curta (máx 20 palavras). Sem introdução, sem título, só a dica.`
        : `Consultor financeiro. Um casal acabou de registrar uma receita: "${nome}" de R$${valor}, ${quemLabel}. ${contexto.pctReserva ? `Reserva automática configurada: ${contexto.pctReserva}%.` : ''} Dê UMA sugestão sobre o que fazer com esse dinheiro em 1 frase curta (máx 20 palavras). Sem introdução, sem título, só a dica.`

      const res = await fetch(`${API_URL}/api/analise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const msg = data.resultado || data.resposta || ''

      if (msg) setToast({ loading: false, msg: msg.trim() })
      else setToast(null)

    } catch (e) {
      console.warn('AIToast erro:', e.message)
      setToast(null) // Falha silenciosa — não atrapalha o fluxo
    }
  }, [])

  // Auto-dispensar após 8 segundos
  useEffect(() => {
    if (!toast || toast.loading) return
    const t = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(t)
  }, [toast])

  return { toast, sugerirIA, dispensar }
}

// Componente Toast — renderiza no canto inferior direito
export function AIToast({ toast, onDispensar }) {
  if (!toast) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      maxWidth: 340, width: '100%',
      background: 'var(--primary)', color: '#fff',
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      animation: 'slideUp 0.3s ease',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1 } 50% { opacity: 0.4 }
        }
      `}</style>

      {/* Ícone */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>
        {toast.loading ? (
          <span style={{ animation: 'pulse 1.2s ease infinite', fontSize: 18 }}>🤖</span>
        ) : '💡'}
      </div>

      {/* Texto */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase' }}>
          Sugestão da IA
        </div>
        {toast.loading ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>Analisando seu lançamento...</div>
        ) : (
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{toast.msg}</div>
        )}
      </div>

      {/* Fechar */}
      {!toast.loading && (
        <button onClick={onDispensar} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0,
        }}>×</button>
      )}
    </div>
  )
}
