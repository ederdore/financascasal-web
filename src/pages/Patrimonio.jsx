import { useState } from 'react'
import Bancos from './Bancos.jsx'
import RendaFixa from './RendaFixa.jsx'
import Reserva from './Reserva.jsx'

export default function Patrimonio({ session, profile, onProfileUpdate }) {
  const [aba, setAba] = useState('bancos')
  const abas = [['bancos','🏦 Bancos'],['reserva','🛡 Reserva'],['rendafixa','📈 Renda Fixa']]
  return (
    <div>
      <div style={{ display:'flex', borderBottom:'0.5px solid var(--border)', marginBottom:20 }}>
        {abas.map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding:'9px 16px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13,
              fontWeight: aba===id?600:400, color: aba===id?'var(--primary)':'var(--secondary)',
              borderBottom: aba===id?'2px solid var(--eden-green)':'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>
      {aba === 'bancos'    && <Bancos    session={session} profile={profile} onProfileUpdate={onProfileUpdate} />}
      {aba === 'reserva'   && <Reserva   session={session} profile={profile} />}
      {aba === 'rendafixa' && <RendaFixa session={session} profile={profile} />}
    </div>
  )
}
