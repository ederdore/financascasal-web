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

/**
 * Pega a segunda revisão mais recente (para comparar score atual vs anterior).
 */
export function segundaRevisaoMaisRecente(revisoes = []) {
  if (revisoes.length < 2) return null;
  return [...revisoes].sort((a, b) => new Date(b.review_date) - new Date(a.review_date))[1];
}

function diferencaEmMeses(dataAntiga, dataNova) {
  return (dataNova.getFullYear() - dataAntiga.getFullYear()) * 12 + (dataNova.getMonth() - dataAntiga.getMonth());
}

/**
 * Alertas (seção 13). Cobre 8 dos 10 tipos listados no documento —
 * "P/VP muito acima da média" e "novas emissões" não têm campo próprio
 * no schema atual (só entram como texto na tese/diário), então não são
 * calculados automaticamente aqui.
 *
 * Recebe os ativos já montados (com sector, pesoAtual, revisoes brutas
 * e historicoDividendos) e o patrimônio total, e devolve uma lista de
 * alertas prontos para exibir.
 */
const LIMITE_PESO_PP = 1;
const LIMITE_CONCENTRACAO_ATIVO = 20;
const LIMITE_CONCENTRACAO_SETOR = 30;
const MESES_SEM_REVISAO = 6;
const MESES_SEM_DIVIDENDO = 3;
const QUEDA_DIVIDENDO_PCT = 0.30; // queda de 30%+ vs média das 3 anteriores é "relevante"

export function calcularAlertas(ativos = [], patrimonioTotal = 0) {
  const alertas = [];

  const somaPorSetor = {};
  for (const a of ativos) {
    const setor = a.sector || 'Sem setor';
    somaPorSetor[setor] = (somaPorSetor[setor] || 0) + (a.valorAtual || 0);
  }

  for (const a of ativos) {
    // peso fora do alvo
    if (a.targetWeight) {
      const diffPeso = (a.pesoAtual ?? 0) - a.targetWeight;
      if (diffPeso > LIMITE_PESO_PP) {
        alertas.push({ tipo: 'peso_acima', ticker: a.ticker, severidade: 'atencao', mensagem: `${a.ticker} está ${diffPeso.toFixed(1)}pp acima do peso alvo.` });
      } else if (diffPeso < -LIMITE_PESO_PP) {
        alertas.push({ tipo: 'peso_abaixo', ticker: a.ticker, severidade: 'info', mensagem: `${a.ticker} está ${Math.abs(diffPeso).toFixed(1)}pp abaixo do peso alvo.` });
      }
    }

    // concentração excessiva em um ativo
    if ((a.pesoAtual ?? 0) > LIMITE_CONCENTRACAO_ATIVO) {
      alertas.push({ tipo: 'concentracao_ativo', ticker: a.ticker, severidade: 'alerta', mensagem: `${a.ticker} representa ${a.pesoAtual.toFixed(1)}% da carteira — concentração alta em um único ativo.` });
    }

    // status do ativo
    if (a.status === 'em_observacao') {
      alertas.push({ tipo: 'em_observacao', ticker: a.ticker, severidade: 'atencao', mensagem: `${a.ticker} está marcado como "em observação".` });
    }
    if (a.status === 'tese_rompida') {
      alertas.push({ tipo: 'tese_rompida', ticker: a.ticker, severidade: 'alerta', mensagem: `${a.ticker} está com a tese marcada como rompida.` });
    }

    // dividendos zerados / queda relevante
    if (['fii', 'acao'].includes(a.assetType) && a.quantidade > 0) {
      const divs = [...(a.historicoDividendos || [])].sort((x, y) => new Date(y.data) - new Date(x.data));
      const ultimoDiv = divs[0];
      const mesesDesdeUltimo = ultimoDiv ? diferencaEmMeses(new Date(ultimoDiv.data), new Date()) : null;

      if (!ultimoDiv || mesesDesdeUltimo >= MESES_SEM_DIVIDENDO) {
        alertas.push({
          tipo: 'dividendo_zerado',
          ticker: a.ticker,
          severidade: 'alerta',
          mensagem: ultimoDiv
            ? `${a.ticker} está sem receber dividendos há ${mesesDesdeUltimo} meses.`
            : `${a.ticker} ainda não teve nenhum dividendo registrado.`,
        });
      } else if (divs.length >= 4) {
        const media3Anteriores = divs.slice(1, 4).reduce((s, d) => s + Number(d.valorTotal), 0) / 3;
        const quedaPct = media3Anteriores > 0 ? 1 - Number(ultimoDiv.valorTotal) / media3Anteriores : 0;
        if (quedaPct >= QUEDA_DIVIDENDO_PCT) {
          alertas.push({ tipo: 'queda_dividendo', ticker: a.ticker, severidade: 'atencao', mensagem: `${a.ticker} teve queda de ${Math.round(quedaPct * 100)}% no último dividendo vs. média recente.` });
        }
      }
    }

    // tese sem revisão / score em queda
    const revisoesOrdenadas = [...(a.revisoes || [])].sort((x, y) => new Date(y.review_date) - new Date(x.review_date));
    const ultimaRevisao = revisoesOrdenadas[0];
    const mesesSemRevisao = ultimaRevisao ? diferencaEmMeses(new Date(ultimaRevisao.review_date), new Date()) : Infinity;

    if (mesesSemRevisao >= MESES_SEM_REVISAO) {
      alertas.push({
        tipo: 'tese_sem_revisao',
        ticker: a.ticker,
        severidade: 'atencao',
        mensagem: ultimaRevisao ? `${a.ticker} não tem revisão de tese há ${mesesSemRevisao} meses.` : `${a.ticker} nunca teve uma revisão de tese registrada.`,
      });
    }

    if (revisoesOrdenadas.length >= 2) {
      const scoreAtual = calcularScore(revisoesOrdenadas[0]);
      const scoreAnterior = calcularScore(revisoesOrdenadas[1]);
      if (scoreAtual != null && scoreAnterior != null && scoreAtual < scoreAnterior - 5) {
        alertas.push({ tipo: 'score_em_queda', ticker: a.ticker, severidade: 'atencao', mensagem: `${a.ticker} teve o score caindo de ${scoreAnterior.toFixed(0)} para ${scoreAtual.toFixed(0)}.` });
      }
    }
  }

  // concentração excessiva em um setor
  for (const [setor, valor] of Object.entries(somaPorSetor)) {
    const pct = patrimonioTotal > 0 ? (valor / patrimonioTotal) * 100 : 0;
    if (pct > LIMITE_CONCENTRACAO_SETOR) {
      alertas.push({ tipo: 'concentracao_setor', severidade: 'alerta', mensagem: `Setor "${setor}" representa ${pct.toFixed(1)}% da carteira — concentração alta.` });
    }
  }

  return alertas;
}
