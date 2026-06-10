import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpombcvppitlgynqzhsr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb21iY3ZwcGl0bGd5bnF6aHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzEwMzYsImV4cCI6MjA5MjMwNzAzNn0.qb7WC2lGELaK5C8Ga09Bhs3tHDL04sW2SeY_SFMoZ1A'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const API_URL = 'https://financascasal-backend.vercel.app'
export const USD_BRL = 5.15
export const EUR_BRL = 5.65

export function fmt(n, moeda = 'BRL') {
  if (moeda === 'USD') return 'US$ ' + Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  if (moeda === 'EUR') return '€ '  + Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
}
export function toBRL(v, moeda='USD') { return v * (moeda==='EUR' ? EUR_BRL : USD_BRL) }

export const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// Ícone por moeda
export function iconeBanco(moeda) {
  if (moeda === 'USD') return '🇺🇸'
  if (moeda === 'EUR') return '🇪🇺'
  return '🇧🇷'
}

export const CAT_ICONS = {
  Alimentação:'🛒', Moradia:'🏠', Transporte:'🚗', Saúde:'💊',
  Lazer:'🎉', Educação:'📚', Assinaturas:'📺', Vestuário:'👕',
  Pets:'🐾', Viagem:'✈️', Presente:'🎁', Outros:'💸',
  salario:'💰', adiantamento:'💵', bonus:'🎯', freela:'💻', aluguel_recebido:'🏠',
  corrente:'🏦', poupanca:'🐷', investimento:'📈',
}

export const TIPOS_REC = [
  ['salario','💰 Salário'],['adiantamento','💵 Adiantamento'],
  ['bonus','🎯 Bônus'],['freela','💻 Freela'],
  ['aluguel_recebido','🏠 Aluguel recebido'],['outros','📦 Outros'],
]

export const CATS_DESP_PADRAO = [
  'Alimentação','Moradia','Transporte','Saúde','Lazer',
  'Educação','Assinaturas','Vestuário','Pets','Viagem','Presente','Outros',
]

export const CATS_FIXA = ['Moradia','Saúde','Educação','Transporte','Assinaturas','Outros']
export const CATS_VAR  = ['Alimentação','Transporte','Lazer','Saúde','Outros']

export const SUBTIPOS_RF = [
  ['pos','📈 Pós-fixado'],['pre','📌 Pré-fixado'],['hibrido','⚖️ Híbrido'],
  ['poupanca','🐷 Poupança'],['cdb','🏦 CDB'],['lci_lca','🌿 LCI/LCA'],
  ['tesouro','🇧🇷 Tesouro'],['outro','📦 Outro'],
]

export const CATS_META = [
  ['viagem','✈️ Viagem'],['carro','🚗 Carro'],['casa','🏠 Casa'],
  ['reforma','🔨 Reforma'],['educacao','📚 Educação'],['casamento','💍 Casamento'],
  ['eletronico','📱 Eletrônico'],['reserva_extra','🛡 Reserva extra'],['outro','📦 Outro'],
]

// Carrega categorias personalizadas do Supabase e mescla com as padrão
export async function carregarCategorias(supabaseClient, casalCode, userId) {
  const { data } = await supabaseClient.from('categorias')
    .select('*')
    .or(`casal_code.eq.${casalCode},user_id.eq.${userId}`)
    .eq('tipo', 'despesa')
    .order('nome')
  const customCats = (data || []).map(c => c.nome)
  const todas = [...new Set([...CATS_DESP_PADRAO, ...customCats])]
  return todas.sort()
}
