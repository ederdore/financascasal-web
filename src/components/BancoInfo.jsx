// BancoInfo.js — logos e bandeiras dos bancos
// Usado em Bancos.jsx, Jardim.jsx e qualquer componente que exiba bancos

export const BANCO_INFO = {
  // ── Bancos ────────────────────────────────────────
  'Nubank': {
    cor: '#820AD1',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#820AD1"/>
      <path d="M10 26V14l14 12V14" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    emoji: '💜',
  },
  'Inter': {
    cor: '#FF7A00',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#FF7A00"/>
      <circle cx="20" cy="20" r="8" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="20" r="2" fill="white"/>
    </svg>`,
    emoji: '🟠',
  },
  'Cartão Inter': {
    cor: '#FF7A00',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#FF7A00"/>
      <circle cx="20" cy="20" r="8" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="20" r="2" fill="white"/>
    </svg>`,
    emoji: '🟠',
  },
  'XP': {
    cor: '#000000',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#111"/>
      <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">XP</text>
    </svg>`,
    emoji: '⬛',
  },
  'Nomad': {
    cor: '#00B4D8',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#00B4D8"/>
      <path d="M10 28 Q20 12 30 28" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="20" cy="16" r="4" fill="white"/>
    </svg>`,
    emoji: '🔵',
  },
  'Wise': {
    cor: '#00B9A0',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#00B9A0"/>
      <path d="M8 14l6 12 4-8 4 8 6-12" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    emoji: '🟢',
  },
  'Itaú': {
    cor: '#EC7000',
    corTexto: '#fff',
    logo: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill="#EC7000"/>
      <text x="20" y="26" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">itaú</text>
    </svg>`,
    emoji: '🟡',
  },
}

export const MOEDA_INFO = {
  'BRL': {
    bandeira: '🇧🇷',
    nome: 'Real Brasileiro',
    simbolo: 'R$',
    cor: '#009C3B',
  },
  'USD': {
    bandeira: '🇺🇸',
    nome: 'Dólar Americano',
    simbolo: 'US$',
    cor: '#3C3B6E',
  },
  'EUR': {
    bandeira: '🇪🇺',
    nome: 'Euro',
    simbolo: '€',
    cor: '#003399',
  },
}

// Retorna info do banco com fallback
export function getBancoInfo(nomeBanco) {
  if (!nomeBanco) return null
  const key = Object.keys(BANCO_INFO).find(k =>
    nomeBanco.toLowerCase().includes(k.toLowerCase())
  )
  return key ? BANCO_INFO[key] : null
}

// Retorna info da moeda com fallback BRL
export function getMoedaInfo(moeda) {
  return MOEDA_INFO[moeda] || MOEDA_INFO['BRL']
}

// Componente logo do banco (retorna JSX string para uso inline)
export function BancoLogo({ nome, size = 36 }) {
  const info = getBancoInfo(nome)
  if (!info) {
    return (
      <div style={{
        width: size, height: size, borderRadius: size * 0.3,
        background: '#E8DCC8', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.4, flexShrink: 0,
      }}>
        🏦
      </div>
    )
  }
  return (
    <div
      style={{ width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: info.logo }}
    />
  )
}
