import { useState } from 'react'
import CartoesPag from './Cartoes.jsx'
import ContasFixas from './ContasFixas.jsx'

export default function Contas({ session, profile }) {
  const [aba, setAba] = useState('cartoes')
  return (
    <div>
      <div style={{ display:'flex', borderBottom:'0.5px solid var(--border)', marginBottom:20 }}>
        {[['cartoes','💳 Cartões'],['contas','📋 Contas Fixas']].map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding:'9px 16px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13,
              fontWeight: aba===id?600:400, color: aba===id?'var(--primary)':'var(--secondary)',
              borderBottom: aba===id?'2px solid var(--eden-green)':'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>
      {aba === 'cartoes' && <CartoesPag session={session} profile={profile} />}
      {aba === 'contas'  && <ContasFixas session={session} profile={profile} />}
    </div>
  )
}
