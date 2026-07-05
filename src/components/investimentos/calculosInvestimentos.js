// ============================================================
// Éden — Jardim de Investimentos
// Cálculos puros de negócio (seções 5, 7 e 12 do documento).
// Nenhuma função aqui toca rede/Supabase — recebem arrays já
// buscados e devolvem números/objetos prontos para a UI.
// ============================================================

/**
 * Calcula a posição atual de um ativo a partir do histórico de
 * transações (seção 5: quantidade, preço médio, valor investido).
 * Preço médio ponderado: soma(compras) / quantidade, com vendas
 * reduzindo quantidade proporcionalmente (sem alterar o preço médio
 * das unidades remanescentes — método padrão de preço médio).
 */
export function calcularPosicao(transacoes = []) {
  let quantidade = 0;
  let valorInvestido = 0;

  for (const t of [...transacoes].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))) {
    const qtd = Number(t.quantity);
    if (t.transaction_type === 'compra') {
      valorInvestido += Number(t.total_value) + Number(t.fees || 0);
      quantidade += qtd;
    } else if (t.transaction_type === 'venda') {
      const precoMedioAtual = quantidade > 0 ? valorInvestido / quantidade : 0;
      quantidade -= qtd;
      valorInvestido -= precoMedioAtual * qtd;
    }
  }

  const precoMedio = quantidade > 0 ? valorInvestido / quantidade : 0;

  return {
    quantidade,
    precoMedio,
    valorInvestido: Math.max(valorInvestido, 0),
  };
}

/**
 * Valor de mercado atual e rentabilidade (seção 5).
 * `cotacaoAtual` vem de cotacoes_cache ou input manual — este
 * módulo não busca cotação, apenas aplica.
 */
export function calcularValorAtual({ quantidade, valorInvestido }, cotacaoAtual) {
  const valorAtual = quantidade * (cotacaoAtual || 0);
  const lucroPrejuizo = valorAtual - valorInvestido;
  const rentabilidadeTotal = valorInvestido > 0 ? (lucroPrejuizo / valorInvestido) * 100 : 0;
  return { valorAtual, lucroPrejuizo, rentabilidadeTotal };
}

/**
 * Agregados de dividendos (seção 7): total no mês, no ano,
 * acumulado, renda média mensal e yield on cost.
 */
export function calcularAgregadosDividendos(dividendos = [], valorInvestido = 0) {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let noMes = 0;
  let noAno = 0;
  let acumulado = 0;
  const porMes = {};

  for (const d of dividendos) {
    const data = new Date(d.payment_date);
    const valor = Number(d.total_value);
    acumulado += valor;
    if (data.getFullYear() === anoAtual) {
      noAno += valor;
      if (data.getMonth() === mesAtual) noMes += valor;
    }
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    porMes[chave] = (porMes[chave] || 0) + valor;
  }

  // Renda média mensal: últimos 12 meses com dado, evita distorcer
  // com meses sem histórico ainda (ativo comprado recentemente).
  const mesesComDado = Object.keys(porMes).length;
  const rendaMediaMensal = mesesComDado > 0 ? acumulado / Math.min(mesesComDado, 12) : 0;
  const yieldOnCost = valorInvestido > 0 ? (rendaMediaMensal * 12 / valorInvestido) * 100 : 0;

  return { noMes, noAno, acumulado, rendaMediaMensal, yieldOnCost, porMes };
}

/**
 * Investment Score (seção 12) — média ponderada dos 6 critérios
 * da revisão de tese mais recente de um ativo.
 */
const PESOS_SCORE = {
  management_score: 0.20,
  results_score: 0.20,
  dividends_score: 0.20,
  financial_health_score: 0.15,
  valuation_score: 0.15,
  sector_score: 0.10,
};

export function calcularScore(revisaoMaisRecente) {
  if (!revisaoMaisRecente) return null;
  let soma = 0;
  let pesoTotal = 0;
  for (const [campo, peso] of Object.entries(PESOS_SCORE)) {
    const valor = revisaoMaisRecente[campo];
    if (valor != null) {
      soma += Number(valor) * peso;
      pesoTotal += peso;
    }
  }
  if (pesoTotal === 0) return null;
  // normaliza caso algum critério esteja em branco na revisão
  return soma / pesoTotal;
}

/**
 * Classificação do score (seção 12).
 */
export function classificarScore(score) {
  if (score == null) return null;
  if (score >= 90) return 'excelente';
  if (score >= 80) return 'bom';
  if (score >= 70) return 'atencao';
  return 'revisar';
}

/**
 * Pega a revisão de tese mais recente de uma lista (por asset_id).
 */
export function revisaoMaisRecente(revisoes = []) {
  if (!revisoes.length) return null;
  return [...revisoes].sort((a, b) => new Date(b.review_date) - new Date(a.review_date))[0];
}
