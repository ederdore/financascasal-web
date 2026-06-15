import { useState } from 'react'
import { ConquistasRecentes } from '../components/Conquistas.jsx'
import Notificacoes from './Notificacoes.jsx'

export default function ConquistasPage({ session, profile }) {
  const [aba, setAba] = useState('conquistas')
  return (
    <div>
      <div style={{ display:'flex', borderBottom:'0.5px solid var(--border)', marginBottom:20 }}>
        {[['conquistas','🍎 Conquistas'],['notificacoes','🔔 Notificações']].map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding:'9px 16px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13,
              fontWeight: aba===id?600:400, color: aba===id?'var(--primary)':'var(--secondary)',
              borderBottom: aba===id?'2px solid var(--eden-green)':'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>
      {aba === 'conquistas'   && <ConquistasRecentes session={session} profile={profile} />}
      {aba === 'notificacoes' && <Notificacoes session={session} profile={profile} />}
    </div>
  )
}
