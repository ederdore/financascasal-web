import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase.js';

import {
  calcularPosicao,
  calcularValorAtual,
  calcularAgregadosDividendos,
  calcularScore,
  revisaoMaisRecente,
  calcularAlertas,
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

      // Cotação atual: via scraping do StatusInvest (fase sem custo).
      // AJUSTE a URL abaixo se seu backend não estiver em financascasal-backend.vercel.app
      let cotacoesPorTicker = {};
      if (assets.length) {
        try {
          const resp = await fetch(`https://financascasal-backend.vercel.app/api/investimentos?action=cotacoes-scrap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativos: assets.map((a) => ({ ticker: a.ticker, assetType: a.asset_type })) }),
          });
          if (resp.ok) {
            const { precos } = await resp.json();
            cotacoesPorTicker = precos || {};
          }
        } catch (e) {
          console.warn('Não foi possível buscar cotações automáticas, usando preço médio como fallback.', e);
        }
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
          sector: asset.sector,
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
          revisoes: revisoesDoAtivo,
          historicoCompras: transacoesDoAtivo
            .filter((t) => t.transaction_type === 'compra')
            .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
            .map((t) => ({ data: t.transaction_date, quantidade: t.quantity, precoUnitario: t.unit_price, valorTotal: t.total_value })),
          historicoDividendos: dividendosDoAtivo
            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
            .map((d) => ({ data: d.payment_date, tipo: d.dividend_type, valorTotal: d.total_value })),
          historicoRevisoes: revisoesDoAtivo
            .sort((a, b) => new Date(b.review_date) - new Date(a.review_date))
            .map((r) => ({ ...r, scoreCalculado: calcularScore(r) })),
          notas: notasDoAtivo.map((n) => ({ id: n.id, data: n.note_date, tipo: n.note_type, descricao: n.description, decisao: n.decision })),
        };
      });

      // Agregados de carteira para o dashboard (seção 8)
      const patrimonioTotal = ativosMontados.reduce((s, a) => s + a.valorAtual, 0);
      const valorInvestidoTotal = ativosMontados.reduce((s, a) => s + a.valorInvestido, 0);

      // Injeta pesoAtual em cada ativo (precisa do patrimônio total já somado)
      const ativosComPeso = ativosMontados.map((a) => ({
        ...a,
        pesoAtual: patrimonioTotal > 0 ? (a.valorAtual / patrimonioTotal) * 100 : 0,
      }));

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
        ativosComPeso.reduce((acc, a) => {
          acc[a.assetType] = (acc[a.assetType] || 0) + a.valorAtual;
          return acc;
        }, {})
      ).map(([tipo, valor]) => ({ tipo, valor }));

      const distribuicaoPorSetor = Object.entries(
        ativosComPeso.reduce((acc, a) => {
          const setor = a.sector || 'Sem setor';
          acc[setor] = (acc[setor] || 0) + a.valorAtual;
          return acc;
        }, {})
      ).map(([setor, valor]) => ({ setor, valor }));

      const topAtivos = ativosComPeso
        .map((a) => ({ ticker: a.ticker, peso: a.pesoAtual, valorAtual: a.valorAtual }))
        .sort((a, b) => b.peso - a.peso)
        .slice(0, 10);

      const ativosForaDoPeso = ativosComPeso
        .map((a) => ({ ticker: a.ticker, pesoAtual: a.pesoAtual, pesoAlvo: a.targetWeight }))
        .filter((a) => Math.abs(a.pesoAtual - a.pesoAlvo) > 1); // tolerância de 1pp

      const alertas = calcularAlertas(ativosComPeso, patrimonioTotal);

      const dados = {
        patrimonioTotal,
        valorInvestido: valorInvestidoTotal,
        lucroPrejuizo: patrimonioTotal - valorInvestidoTotal,
        dividendosMes: dividendosMesTotal,
        dividendosAno: dividendosAnoTotal,
        rendaMensalMedia: ativosComPeso.reduce((s, a) => s + (a.dividendosAcumulados > 0 ? a.dividendosAcumulados / 12 : 0), 0),
        rendaAnualProjetada: dividendosAnoTotal,
        metaRendaPassiva: ultimoSnapshot?.passive_income_goal || 0,
        evolucaoPatrimonial: snapshots.map((s) => ({ mes: s.snapshot_date, valor: s.total_market_value })),
        evolucaoDividendos: snapshots.map((s) => ({ mes: s.snapshot_date, valor: s.total_dividends_month })),
        distribuicaoPorTipo,
        distribuicaoPorSetor,
        topAtivos,
        ativosForaDoPeso,
        alertas,
      };

      setEstado({ loading: false, erro: null, dados, ativos: ativosComPeso });
    } catch (erro) {
      console.error('Erro ao carregar Jardim de Investimentos:', erro);
      setEstado({ loading: false, erro, dados: null, ativos: [] });
    }
  }, [casalCode]);

  useEffect(() => { carregar(); }, [carregar]);

  const buscarAssetId = useCallback(async (ticker) => {
    const { data } = await supabase.from('invest_assets').select('id').eq('casal_code', casalCode).eq('ticker', ticker).single();
    return data?.id || null;
  }, [casalCode]);

  const registrarNota = useCallback(async (ticker, nota) => {
    const assetId = await buscarAssetId(ticker);
    if (!assetId) return;

    const { error } = await supabase.from('invest_notes').insert({
      casal_code: casalCode,
      asset_id: assetId,
      note_type: nota.noteType,
      description: nota.description,
      decision: nota.decision,
    });
    if (error) { console.error('Erro ao registrar nota:', error); return; }
    await carregar();
  }, [casalCode, buscarAssetId, carregar]);

  /**
   * Registra um dividendo recebido (seção 7).
   * dividendo = { paymentDate, dividendType, quantityHeld, valuePerShare, totalValue, reinvested }
   */
  const registrarDividendo = useCallback(async (ticker, dividendo) => {
    const assetId = await buscarAssetId(ticker);
    if (!assetId) return { erro: 'Ativo não encontrado.' };

    const { error } = await supabase.from('invest_dividends').insert({
      casal_code: casalCode,
      asset_id: assetId,
      payment_date: dividendo.paymentDate,
      dividend_type: dividendo.dividendType,
      quantity_held: dividendo.quantityHeld,
      value_per_share: dividendo.valuePerShare,
      total_value: dividendo.totalValue,
      reinvested: dividendo.reinvested || false,
    });
    if (error) { console.error('Erro ao registrar dividendo:', error); return { erro: error.message }; }
    await carregar();
    return { erro: null };
  }, [casalCode, buscarAssetId, carregar]);

  /**
   * Registra uma revisão de tese / score (seções 11 e 12).
   * revisao = { reviewDate, managementScore, resultsScore, dividendsScore,
   *             financialHealthScore, valuationScore, sectorScore,
   *             conclusion, statusAfterReview }
   */
  const registrarRevisaoTese = useCallback(async (ticker, revisao) => {
    const assetId = await buscarAssetId(ticker);
    if (!assetId) return { erro: 'Ativo não encontrado.' };

    const { error: erroRevisao } = await supabase.from('invest_thesis_reviews').insert({
      casal_code: casalCode,
      asset_id: assetId,
      review_date: revisao.reviewDate,
      management_score: revisao.managementScore,
      results_score: revisao.resultsScore,
      dividends_score: revisao.dividendsScore,
      financial_health_score: revisao.financialHealthScore,
      valuation_score: revisao.valuationScore,
      sector_score: revisao.sectorScore,
      conclusion: revisao.conclusion || null,
      status_after_review: revisao.statusAfterReview,
    });
    if (erroRevisao) { console.error('Erro ao registrar revisão de tese:', erroRevisao); return { erro: erroRevisao.message }; }

    // Atualiza o status do ativo conforme a conclusão da revisão
    if (revisao.statusAfterReview) {
      const { error: erroStatus } = await supabase.from('invest_assets').update({ status: revisao.statusAfterReview }).eq('id', assetId);
      if (erroStatus) console.error('Erro ao atualizar status do ativo:', erroStatus);
    }

    await carregar();
    return { erro: null };
  }, [casalCode, buscarAssetId, carregar]);

  /**
   * Chama o backend para buscar dividendos novos na brapi.dev e
   * inserir os que ainda não existem em invest_dividends.
   */
  const sincronizarDividendos = useCallback(async () => {
    try {
      const resp = await fetch('https://financascasal-backend.vercel.app/api/investimentos?action=sync-dividendos-scrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casalCode }),
      });
      const resultado = await resp.json();
      if (!resp.ok) return { erro: resultado.erro || 'Erro ao sincronizar dividendos.' };
      await carregar();
      return resultado; // { inseridos, ignorados }
    } catch (e) {
      console.error('Erro ao sincronizar dividendos:', e);
      return { erro: e.message };
    }
  }, [casalCode, carregar]);

  /**
   * Busca fundamentos/relatório na brapi.dev e pede à Claude um resumo
   * objetivo. Não recomenda compra/venda — é apoio para o Validador de Tese.
   */
  const analisarComIA = useCallback(async (ticker, assetType) => {
    try {
      const resp = await fetch('https://financascasal-backend.vercel.app/api/investimentos?action=analise-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, assetType }),
      });
      const resultado = await resp.json();
      if (!resp.ok) return { erro: resultado.erro || 'Erro ao gerar análise.' };
      return resultado; // { analise, dadosBrutos }
    } catch (e) {
      console.error('Erro ao analisar com IA:', e);
      return { erro: e.message };
    }
  }, []);

  /**
   * Envia um PDF (relatório, balanço, etc.) pro backend extrair o texto
   * e pedir à Claude uma leitura objetiva — mesmo princípio da análise
   * via scraping, mas com fonte trazida pelo próprio usuário.
   * `pdfBase64` é o conteúdo do arquivo já em base64 (sem o prefixo data:).
   */
  const analisarPdf = useCallback(async (ticker, pdfBase64) => {
    try {
      const resp = await fetch('https://financascasal-backend.vercel.app/api/investimentos?action=analisar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, pdfBase64 }),
      });
      const resultado = await resp.json();
      if (!resp.ok) return { erro: resultado.erro || 'Erro ao analisar PDF.' };
      return resultado; // { analise }
    } catch (e) {
      console.error('Erro ao analisar PDF:', e);
      return { erro: e.message };
    }
  }, []);

  /**
   * Pede à IA uma sugestão dos 6 scores da tese (baseada em dados públicos
   * ou num PDF enviado). Só sugere — quem decide e salva é sempre o usuário,
   * no formulário do Validador de Tese.
   */
  const sugerirScoresTese = useCallback(async (ticker, assetType, pdfBase64) => {
    try {
      const resp = await fetch('https://financascasal-backend.vercel.app/api/investimentos?action=sugerir-scores-tese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, assetType, pdfBase64 }),
      });
      const resultado = await resp.json();
      if (!resp.ok) return { erro: resultado.erro || 'Erro ao sugerir scores.' };
      return resultado; // { scores }
    } catch (e) {
      console.error('Erro ao sugerir scores da tese:', e);
      return { erro: e.message };
    }
  }, []);

  return { ...estado, registrarNota, registrarDividendo, registrarRevisaoTese, sincronizarDividendos, analisarComIA, analisarPdf, sugerirScoresTese, recarregar: carregar };
}
