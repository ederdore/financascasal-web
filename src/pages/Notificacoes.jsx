import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

export default function Notificacoes({ session, profile }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const { data } = await cf(supabase.from('notificacoes').select('*')).order('created_at', { ascending: false }).limit(50)
    if (data) setNotifs(data)
    setLoading(false)
  }

  async function marcarLidas() {
    await supabase.from('notificacoes').update({ lida: true }).eq('user_id', session.user.id)
    loadData()
  }

  async function excluir(id) {
    await supabase.from('notificacoes').delete().eq('id', id)
    loadData()
  }

  const naoLidas = notifs.filter(n => !n.lida).length
  const corTipo = tipo => {
    if (tipo === 'fatura' || tipo === 'saldo') return 'var(--red)'
    if (tipo === 'reserva' || tipo === 'parcela') return 'var(--yellow)'
    return 'var(--blue)'
  }

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{naoLidas} não lida(s)</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>{notifs.length} notificação(ões) no total</div>
        </div>
        {naoLidas > 0 && <button className="btn btn-outline" onClick={marcarLidas}>✅ Marcar todas como lidas</button>}
      </div>

      {notifs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 500 }}>Nenhuma notificação</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifs.map(n => (
          <div key={n.id} className="card" style={{ borderLeft: `3px solid ${corTipo(n.tipo)}`, opacity: n.lida ? 0.6 : 1 }}>
            <div className="row-between">
              <div className="row" style={{ gap: 10, flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{n.titulo}</div>
                  {n.mensagem && <div style={{ fontSize: 13, color: 'var(--secondary)', marginTop: 4 }}>{n.mensagem}</div>}
                  <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 6 }}>{new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {!n.lida && <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--red)' }} />}
                <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(n.id)}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
