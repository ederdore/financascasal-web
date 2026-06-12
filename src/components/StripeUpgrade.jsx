import { useState } from 'react'
import { API_URL } from '../supabase.js'

export function BotaoUpgrade({ session, profile, style }) {
  const [loading, setLoading] = useState(false)

  async function iniciarCheckout() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/stripe?action=checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:    session.user.id,
          casalCode: profile.casal_code,
          email:     session.user.email,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Erro: ' + (data.erro || 'Tente novamente'))
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setLoading(false) }
  }

  async function abrirPortal() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/stripe?action=portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Erro: ' + (data.erro || 'Tente novamente'))
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setLoading(false) }
  }

  const isPremium = profile.plano === 'premium'
  const isTrial   = profile.plano === 'trial'

  if (isPremium) return (
    <button onClick={abrirPortal} disabled={loading}
      style={{ fontSize: 12, color: 'var(--eden-gold)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', ...style }}>
      {loading ? '...' : '💳 Gerenciar assinatura'}
    </button>
  )

  return (
    <button onClick={iniciarCheckout} disabled={loading}
      style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--eden-gold)', color: 'var(--eden-bark)', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', ...style }}>
      {loading ? '...' : isTrial ? '⭐ Assinar Premium — R$24/mês' : '⭐ Upgrade para Premium'}
    </button>
  )
}

// Banner de trial expirando
export function TrialBanner({ profile, session }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || profile.plano === 'premium') return null

  const isTrial = profile.plano === 'trial'
  const diasRestantes = isTrial && profile.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim) - new Date()) / (1000 * 60 * 60 * 24)))
    : null

  if (!isTrial && profile.plano !== 'free') return null

  return (
    <div style={{ background: diasRestantes <= 3 ? 'var(--red-bg)' : 'var(--yellow-bg)', borderBottom: `0.5px solid ${diasRestantes <= 3 ? 'var(--red)' : 'var(--yellow)'}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <div style={{ color: diasRestantes <= 3 ? 'var(--red)' : 'var(--yellow)', fontWeight: 500 }}>
        {isTrial
          ? diasRestantes > 0
            ? `⏳ Trial Premium: ${diasRestantes} dia(s) restante(s)`
            : '⚠️ Trial expirado — faça upgrade para continuar com IA e recursos premium'
          : '✨ Experimente o Premium com IA e aprendizado contínuo'}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <BotaoUpgrade session={session} profile={profile} />
        <button onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)', fontSize: 16 }}>×</button>
      </div>
    </div>
  )
}
