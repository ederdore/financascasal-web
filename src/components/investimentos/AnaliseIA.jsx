import { useState } from 'react';
import './styles.css';

function arquivoParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result.split(',')[1]); // remove o prefixo data:application/pdf;base64,
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Botão + painel de análise com IA (seções 11/17).
 * Duas fontes: scraping do StatusInvest (rápido, automático) ou
 * upload de um PDF (relatório gerencial, balanço etc — mais confiável,
 * já que vem direto da fonte oficial que você escolher).
 * Nenhuma das duas recomenda compra/venda — é leitura de apoio pro
 * Validador de Tese.
 */
export default function AnaliseIA({ ticker, assetType, aoAnalisar, aoAnalisarPdf }) {
  const [analise, setAnalise] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleAnalisarScraping() {
    setCarregando(true);
    setErro(null);
    const resultado = await aoAnalisar(ticker, assetType);
    setCarregando(false);
    if (resultado?.erro) setErro(resultado.erro);
    else setAnalise(resultado.analise);
  }

  async function handleArquivoSelecionado(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const base64 = await arquivoParaBase64(arquivo);
      const resultado = await aoAnalisarPdf(ticker, base64);
      if (resultado?.erro) setErro(resultado.erro);
      else setAnalise(resultado.analise);
    } catch (e) {
      setErro('Não foi possível ler o arquivo.');
    } finally {
      setCarregando(false);
      e.target.value = '';
    }
  }

  return (
    <div className="ji-secao">
      <div className="ji-secao-titulo">Análise com IA</div>
      {!analise && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="ji-botao-primario" onClick={handleAnalisarScraping} disabled={carregando}>
            {carregando ? 'Analisando...' : 'Analisar dados públicos'}
          </button>
          <label className="ji-botao-primario" style={{ background: '#C89A4A', cursor: 'pointer' }}>
            {carregando ? 'Analisando...' : 'Analisar PDF (relatório)'}
            <input type="file" accept="application/pdf" onChange={handleArquivoSelecionado} disabled={carregando} style={{ display: 'none' }} />
          </label>
        </div>
      )}
      {erro && <div style={{ color: '#B3402F', fontSize: 14, marginTop: 8 }}>{erro}</div>}
      {analise && (
        <>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: '#2A2A28' }}>{analise}</p>
          <button
            onClick={() => setAnalise(null)}
            style={{ background: 'none', border: 'none', color: '#6B6B66', cursor: 'pointer', fontSize: 13 }}
          >
            Gerar de novo
          </button>
          <div style={{ fontSize: 12, color: '#6B6B66', marginTop: 8 }}>
            Isso é uma leitura objetiva dos dados fornecidos, não uma recomendação de compra ou venda.
          </div>
        </>
      )}
    </div>
  );
}
