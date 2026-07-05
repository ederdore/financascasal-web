import { useState } from 'react';
import './styles.css';

// Checklists da seção 11 — servem como guia de leitura antes de você
// preencher os 6 scores abaixo. Ficam marcados só nesta tela (não são
// persistidos item a item no banco — o que fica salvo é o score
// consolidado por categoria e a conclusão em texto).
const CHECKLIST_FII = [
  'Consistência dos rendimentos',
  'Liquidez',
  'Qualidade da gestão',
  'Diversificação da carteira do fundo',
  'Vacância (se aplicável)',
  'Inadimplência (se aplicável)',
  'P/VP',
  'Dividend yield',
  'Risco do segmento',
  'Novas emissões',
  'Sustentabilidade dos rendimentos',
];

const CHECKLIST_ACAO = [
  'Lucro consistente',
  'Receita crescente',
  'Margem operacional',
  'Dívida controlada',
  'ROE',
  'Payout',
  'Histórico de dividendos',
  'Governança',
  'Vantagem competitiva',
  'Risco setorial',
  'Valuation',
];

const CATEGORIAS_SCORE = [
  { campo: 'managementScore', label: 'Qualidade da gestão', peso: 20 },
  { campo: 'resultsScore', label: 'Histórico de resultados', peso: 20 },
  { campo: 'dividendsScore', label: 'Consistência dos dividendos', peso: 20 },
  { campo: 'financialHealthScore', label: 'Saúde financeira', peso: 15 },
  { campo: 'valuationScore', label: 'Valuation', peso: 15 },
  { campo: 'sectorScore', label: 'Perspectivas do setor', peso: 10 },
];

const STATUS_OPCOES = [
  { value: 'ativo', label: 'Manter ativo' },
  { value: 'em_observacao', label: 'Colocar em observação' },
  { value: 'tese_rompida', label: 'Marcar tese como rompida' },
  { value: 'encerrado', label: 'Encerrar' },
];

const VAZIO = Object.fromEntries(CATEGORIAS_SCORE.map((c) => [c.campo, '']));

function calcularPreview(scores) {
  let soma = 0, pesoTotal = 0;
  for (const c of CATEGORIAS_SCORE) {
    const v = Number(scores[c.campo]);
    if (scores[c.campo] !== '' && !isNaN(v)) { soma += v * (c.peso / 100); pesoTotal += c.peso / 100; }
  }
  return pesoTotal > 0 ? soma / pesoTotal : null;
}

/**
 * Validador de tese (seções 11 e 12).
 * `assetType` decide qual checklist mostrar (fii ou ação/demais).
 * `aoSugerirComIA(ticker, assetType, pdfBase64)` — opcional — pede à IA uma
 * sugestão dos 6 scores, que pré-popula o formulário pra revisão humana.
 */
export default function ValidadorTese({ ticker, assetType, statusAtual, aoRegistrar, aoCancelar, aoSugerirComIA }) {
  const checklist = assetType === 'fii' ? CHECKLIST_FII : CHECKLIST_ACAO;
  const [marcados, setMarcados] = useState({});
  const [scores, setScores] = useState(VAZIO);
  const [conclusao, setConclusao] = useState('');
  const [status, setStatus] = useState(statusAtual || 'ativo');
  const [salvando, setSalvando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [erro, setErro] = useState(null);

  const scorePreview = calcularPreview(scores);

  function toggleItem(item) {
    setMarcados((m) => ({ ...m, [item]: !m[item] }));
  }

  async function aplicarSugestao(pdfBase64) {
    setSugerindo(true);
    setErro(null);
    const resultado = await aoSugerirComIA?.(ticker, assetType, pdfBase64);
    setSugerindo(false);
    if (resultado?.erro) { setErro(resultado.erro); return; }

    const s = resultado.scores;
    setScores({
      managementScore: s.management_score ?? '',
      resultsScore: s.results_score ?? '',
      dividendsScore: s.dividends_score ?? '',
      financialHealthScore: s.financial_health_score ?? '',
      valuationScore: s.valuation_score ?? '',
      sectorScore: s.sector_score ?? '',
    });
    if (s.conclusion) setConclusao(s.conclusion);
  }

  async function handleArquivoPdf(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const base64 = await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result.split(',')[1]);
      leitor.onerror = reject;
      leitor.readAsDataURL(arquivo);
    });
    await aplicarSugestao(base64);
    e.target.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);

    const algumScorePreenchido = CATEGORIAS_SCORE.some((c) => scores[c.campo] !== '');
    if (!algumScorePreenchido) {
      setErro('Preencha ao menos um dos scores por categoria.');
      return;
    }

    setSalvando(true);
    const resultado = await aoRegistrar({
      reviewDate: new Date().toISOString().slice(0, 10),
      managementScore: scores.managementScore !== '' ? Number(scores.managementScore) : null,
      resultsScore: scores.resultsScore !== '' ? Number(scores.resultsScore) : null,
      dividendsScore: scores.dividendsScore !== '' ? Number(scores.dividendsScore) : null,
      financialHealthScore: scores.financialHealthScore !== '' ? Number(scores.financialHealthScore) : null,
      valuationScore: scores.valuationScore !== '' ? Number(scores.valuationScore) : null,
      sectorScore: scores.sectorScore !== '' ? Number(scores.sectorScore) : null,
      conclusion: conclusao || null,
      statusAfterReview: status,
    });
    setSalvando(false);

    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <div className="ji-secao">
      <div className="ji-secao-titulo">Revisar tese — {ticker}</div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#6B6B66', marginBottom: 8 }}>
          Checklist de leitura ({assetType === 'fii' ? 'FII' : 'ação'}) — marque o que já avaliou:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {checklist.map((item) => (
            <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!marcados[item]} onChange={() => toggleItem(item)} />
              {item}
            </label>
          ))}
        </div>
      </div>

      {aoSugerirComIA && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            type="button"
            className="ji-botao-primario"
            style={{ padding: '6px 14px' }}
            onClick={() => aplicarSugestao(null)}
            disabled={sugerindo}
          >
            {sugerindo ? 'Sugerindo...' : '✨ Sugerir scores via dados públicos'}
          </button>
          <label className="ji-botao-primario" style={{ padding: '6px 14px', background: '#C89A4A', cursor: 'pointer' }}>
            {sugerindo ? 'Sugerindo...' : '✨ Sugerir scores via PDF'}
            <input type="file" accept="application/pdf" onChange={handleArquivoPdf} disabled={sugerindo} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {erro && <div style={{ color: '#B3402F', fontSize: 14 }}>{erro}</div>}

        <div style={{ fontSize: 13, color: '#6B6B66' }}>Com base na leitura acima, dê uma nota de 0 a 100 para cada categoria:</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {CATEGORIAS_SCORE.map((c) => (
            <label key={c.campo} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#6B6B66' }}>
              {c.label} <span style={{ fontSize: 11 }}>(peso {c.peso}%)</span>
              <input
                type="number" min="0" max="100"
                value={scores[c.campo]}
                onChange={(e) => setScores((s) => ({ ...s, [c.campo]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        {scorePreview != null && (
          <div style={{ fontSize: 14 }}>
            Score consolidado: <strong style={{ color: '#3E6344' }}>{scorePreview.toFixed(0)}</strong>
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#6B6B66' }}>
          Conclusão da revisão
          <textarea rows={3} value={conclusao} onChange={(e) => setConclusao(e.target.value)} placeholder="O que mudou desde a última revisão? A tese ainda se sustenta?" />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#6B6B66' }}>
          Decisão sobre o ativo
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="ji-botao-primario" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar revisão'}
          </button>
          <button type="button" onClick={aoCancelar} style={{ background: 'none', border: 'none', color: '#6B6B66', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
