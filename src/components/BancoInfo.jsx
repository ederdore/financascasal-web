// BancoInfo.jsx — identidade visual dos bancos com cores oficiais
// Usa iniciais estilizadas com cores reais das marcas

export const BANCO_INFO = {
  'Nubank': {
    cor: '#820AD1', corTexto: '#fff', inicial: 'N',
    fonte: 'bold', radius: 12,
    descricao: 'Banco digital roxo',
  },
  'Inter': {
    cor: '#FF7A00', corTexto: '#fff', inicial: 'i',
    fonte: '500', radius: 12,
    descricao: 'Banco Inter laranja',
  },
  'Cartão Inter': {
    cor: '#FF7A00', corTexto: '#fff', inicial: 'i',
    fonte: '500', radius: 12,
  },
  'XP': {
    cor: '#000000', corTexto: '#fff', inicial: 'XP',
    fonte: 'bold', radius: 8,
    descricao: 'XP Investimentos preto',
  },
  'Nomad': {
    cor: '#1A1A2E', corTexto: '#00D4AA', inicial: 'N',
    fonte: 'bold', radius: 12,
    descricao: 'Nomad escuro com verde água',
  },
  'Wise': {
    cor: '#00B9A0', corTexto: '#fff', inicial: 'W',
    fonte: 'bold', radius: 12,
    descricao: 'Wise verde água',
  },
  'Itaú': {
    cor: '#EC7000', corTexto: '#fff', inicial: 'itaú',
    fonte: '600', radius: 12,
    descricao: 'Itaú laranja',
  },
  'C6': {
    cor: '#242424', corTexto: '#F5C518', inicial: 'C6',
    fonte: 'bold', radius: 12,
    descricao: 'C6 Bank preto e amarelo',
  },
  'Bradesco': {
    cor: '#CC092F', corTexto: '#fff', inicial: 'B',
    fonte: 'bold', radius: 12,
    descricao: 'Bradesco vermelho',
  },
  'Santander': {
    cor: '#EC0000', corTexto: '#fff', inicial: 'S',
    fonte: 'bold', radius: 12,
    descricao: 'Santander vermelho',
  },
  'BTG': {
    cor: '#002060', corTexto: '#fff', inicial: 'BTG',
    fonte: 'bold', radius: 8,
    descricao: 'BTG Pactual azul escuro',
  },
  'Revolut': {
    cor: '#0666EB', corTexto: '#fff', inicial: 'R',
    fonte: 'bold', radius: 12,
    descricao: 'Revolut azul',
  },
}

export const MOEDA_INFO = {
  'BRL': { bandeira: '🇧🇷', nome: 'Real Brasileiro',   simbolo: 'R$',  cor: '#009C3B' },
  'USD': { bandeira: '🇺🇸', nome: 'Dólar Americano',   simbolo: 'US$', cor: '#3C3B6E' },
  'EUR': { bandeira: '🇪🇺', nome: 'Euro',               simbolo: '€',   cor: '#003399' },
}

export function getBancoInfo(nomeBanco) {
  if (!nomeBanco) return null
  const key = Object.keys(BANCO_INFO).find(k =>
    nomeBanco.toLowerCase().includes(k.toLowerCase())
  )
  return key ? BANCO_INFO[key] : null
}

export function getMoedaInfo(moeda) {
  return MOEDA_INFO[moeda] || MOEDA_INFO['BRL']
}

export function BancoLogo({ nome, size = 36 }) {
  const info = getBancoInfo(nome)
  const radius = size * 0.3

  if (!info) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: '#E8DCC8', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.38, flexShrink: 0,
        fontWeight: 'bold', color: '#7A7060',
      }}>
        {nome?.charAt(0)?.toUpperCase() || '🏦'}
      </div>
    )
  }

  const fontSize = info.inicial.length > 2
    ? size * 0.25
    : info.inicial.length === 2
    ? size * 0.3
    : size * 0.4

  return (
    <div style={{
      width: size, height: size,
      borderRadius: info.radius || radius,
      background: info.cor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: `0 2px 8px ${info.cor}40`,
    }}>
      <span style={{
        color: info.corTexto,
        fontSize: fontSize,
        fontWeight: info.fonte || 'bold',
        fontFamily: nome === 'Itaú' ? 'Georgia, serif' : "'Inter', sans-serif",
        letterSpacing: info.inicial.length > 1 ? '-0.5px' : '0',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {info.inicial}
      </span>
    </div>
  )
}
