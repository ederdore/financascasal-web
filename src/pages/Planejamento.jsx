import { useState } from 'react'
import Despesas from './Despesas.jsx'
import Receitas from './Receitas.jsx'

export default function Planejamento({ session, profile }) {
  const [aba, setAba] = useState('despesas')
  const abas = [['despesas','💸 Despesas'],['receitas','💰 Receitas']]
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
      {aba === 'despesas' && <Despesas session={session} profile={profile} />}
      {aba === 'receitas' && <Receitas session={session} profile={profile} />}
    </div>
  )
}
