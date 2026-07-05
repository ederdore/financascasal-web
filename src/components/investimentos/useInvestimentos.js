import { useState, useEffect, useCallback } from 'react';
// AJUSTE ESTE IMPORT para o caminho real do seu client Supabase
// (ex: '../../supabaseClient' ou '../../lib/supabase')
import { supabase } from '../../supabaseClient';

import {
  calcularPosicao,
  calcularValorAtual,
  calcularAgregadosDividendos,
  calcularScore,
  revisaoMaisRecente,
} from './calculosInvestimentos';

/**
 * Busca e monta todos os dados do Jardim de Investimentos para um casal.
 *
 * Uso:
 *   const { dados, ativos, loading, erro, registrarNota, recarregar } = useInvestimentos(casalCode);
 *
 * - `dados`  → formato esperado por <Dashboard dados={dados} />
 * - `ativos` → array de objetos no formato esperado por <FichaAtivo ativo={...} />
 */
export function useInvestimentos(casalCode) {
  const [estado, setEstado] = useState({ loading: true, erro: null, dados: null, ativos: [] });

  const carregar = useCallback(async () => {
    if (!casalCode) return;
    setEstado((s) => ({ ...s, loading: true, erro: null }));

    try {
      const [assetsRes, transRes, divRes, reviewsRes, notesRes, snapRes] = await Promise.all([
        supabase.from('invest_assets').select('*').eq('casal_code', casalCode),
        supabase.from('invest_transactions').select('*').eq('casal_code', casalCode),
        supabase.from('invest_dividends').select('*').eq('casal_code', casalCode),
        supabase.from('invest_thesis_reviews').select('*').eq('casal_code', casalCode),
        supabase.from('invest_notes').select('*').eq('casal_code', casalCode).order('note_date', { ascending: false }),
        supabase.from('invest_portfolio_snapshots').select('*').eq('casal_code', casalCode).order('snapshot_date', { ascending: true }),
      ]);

      const erroEncontrado = [assetsRes, transRes, divRes, reviewsRes, notesRes, snapRes].find((r) => r.error)?.error;
      if (erroEncontrado) throw erroEncontrado;

      const assets = assetsRes.data || [];
      const transacoes = transRes.data || [];
      const dividendos = divRes.data || [];
      const revisoes = reviewsRes.data || [];
      const notas = notesRes.data || [];
      const snapshots = snapRes.data || [];

      // Cotação atual: tenta buscar em cotacoes_cache pelos tickers.
      // Ajuste os nomes de coluna abaixo ('ticker', 'preco') se forem
      // diferentes na sua tabela.
      const tickers = assets.map((a) => a.ticker);
      let cotacoesPorTicker = {};
      if (tickers.length) {
        const { data: cotacoesData } = await supabase
          .from('cotacoes_cache')
          .select('ticker, preco')
          .in('ticker', tickers);
        cotacoesPorTicker = Object.fromEntries((cotacoesData || []).map((c) => [c.ticker, Number(c.preco)]));
      }

      const ativosMontados = assets.map((asset) => {
        const transacoesDoAtivo = transacoes.filter((t) => t.asset_id === asset.id);
        const dividendosDoAtivo = dividendos.filter((d) => d.asset_id === asset.id);
        const revisoesDoAtivo = revisoes.filter((r) => r.asset_id === asset.id);
        const notasDoAtivo = notas.filter((n) => n.asset_id === asset.id);

        const posicao = calcularPosicao(transacoesDoAtivo);
        const cotacaoAtual = cotacoesPorTicker[asset.ticker] ?? posicao.precoMedio;
        const { valorAtual, rentabilidadeTotal } = calcularValorAtual(posicao, cotacaoAtual);
        const agregadosDiv = calcularAgregadosDividendos(dividendosDoAtivo, posicao.valorInvestido);
        const revisao = revisaoMaisRecente(revisoesDoAtivo);
        const score = calcularScore(revisao);

        return {
          ticker: asset.ticker,
          name: asset.name,
          assetType: asset.asset_type,
          status: asset.status,
          thesis: asset.thesis,
          targetWeight: Number(asset.target_weight || 0),
          quantidade: posicao.quantidade,
          precoMedio: posicao.precoMedio,
          valorInvestido: posicao.valorInvestido,
          valorAtual,
          dividendosAcumulados: agregadosDiv.acumulado,
          rentabilidadeTotal,
          score,
          historicoCompras: transacoesDoAtivo
            .filter((t) => t.transaction_type === 'compra')
            .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
            .map((t) => ({ data: t.transaction_date, quantidade: t.quantity, precoUnitario: t.unit_price, valorTotal: t.total_value })),
          historicoDividendos: dividendosDoAtivo
            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
            .map((d) => ({ data: d.payment_date, tipo: d.dividend_type, valorTotal: d.total_value })),
          notas: notasDoAtivo.map((n) => ({ id: n.id, data: n.note_date, tipo: n.note_type, descricao: n.description, decisao: n.decision })),
        };
      });

      // Agregados de carteira para o dashboard (seção 8)
      const patrimonioTotal = ativosMontados.reduce((s, a) => s + a.valorAtual, 0);
      const valorInvestidoTotal = ativosMontados.reduce((s, a) => s + a.valorInvestido, 0);
      const dividendosMesTotal = dividendos
        .filter((d) => {
          const dt = new Date(d.payment_date);
          const hoje = new Date();
          return dt.getMonth() === hoje.getMonth() && dt.getFullYear() === hoje.getFullYear();
        })
        .reduce((s, d) => s + Number(d.total_value), 0);
      const anoAtual = new Date().getFullYear();
      const dividendosAnoTotal = dividendos
        .filter((d) => new Date(d.payment_date).getFullYear() === anoAtual)
        .reduce((s, d) => s + Number(d.total_value), 0);

      const ultimoSnapshot = snapshots[snapshots.length - 1];

      const distribuicaoPorTipo = Object.entries(
        ativosMontados.reduce((acc, a) => {
          acc[a.assetType] = (acc[a.assetType] || 0) + a.valorAtual;
          return acc;
        }, {})
      ).map(([tipo, valor]) => ({ tipo, valor }));

      const topAtivos = ativosMontados
        .map((a) => ({ ticker: a.ticker, peso: patrimonioTotal > 0 ? (a.valorAtual / patrimonioTotal) * 100 : 0, valorAtual: a.valorAtual }))
        .sort((a, b) => b.peso - a.peso)
        .slice(0, 10);

      const ativosForaDoPeso = ativosMontados
        .map((a) => ({
          ticker: a.ticker,
          pesoAtual: patrimonioTotal > 0 ? (a.valorAtual / patrimonioTotal) * 100 : 0,
          pesoAlvo: a.targetWeight,
        }))
        .filter((a) => Math.abs(a.pesoAtual - a.pesoAlvo) > 1); // tolerância de 1pp

      const dados = {
        patrimonioTotal,
        valorInvestido: valorInvestidoTotal,
        lucroPrejuizo: patrimonioTotal - valorInvestidoTotal,
        dividendosMes: dividendosMesTotal,
        dividendosAno: dividendosAnoTotal,
        rendaMensalMedia: ativosMontados.reduce((s, a) => s + (a.dividendosAcumulados > 0 ? a.dividendosAcumulados / 12 : 0), 0),
        rendaAnualProjetada: dividendosAnoTotal,
        metaRendaPassiva: ultimoSnapshot?.passive_income_goal || 0,
        evolucaoPatrimonial: snapshots.map((s) => ({ mes: s.snapshot_date, valor: s.total_market_value })),
        evolucaoDividendos: snapshots.map((s) => ({ mes: s.snapshot_date, valor: s.total_dividends_month })),
        distribuicaoPorTipo,
        distribuicaoPorSetor: [], // pendente: assets não tem valor de mercado individual armazenado, calcular quando cotação estiver integrada
        topAtivos,
        ativosForaDoPeso,
      };

      setEstado({ loading: false, erro: null, dados, ativos: ativosMontados });
    } catch (erro) {
      console.error('Erro ao carregar Jardim de Investimentos:', erro);
      setEstado({ loading: false, erro, dados: null, ativos: [] });
    }
  }, [casalCode]);

  useEffect(() => { carregar(); }, [carregar]);

  const registrarNota = useCallback(async (ticker, nota) => {
    const asset = estado.ativos.find((a) => a.ticker === ticker);
    if (!asset) return;
    const assetRow = (await supabase.from('invest_assets').select('id').eq('casal_code', casalCode).eq('ticker', ticker).single()).data;
    if (!assetRow) return;

    const { error } = await supabase.from('invest_notes').insert({
      casal_code: casalCode,
      asset_id: assetRow.id,
      note_type: nota.noteType,
      description: nota.description,
      decision: nota.decision,
    });
    if (error) { console.error('Erro ao registrar nota:', error); return; }
    await carregar();
  }, [casalCode, estado.ativos, carregar]);

  return { ...estado, registrarNota, recarregar: carregar };
}
