import { useState } from 'react';
import { useInvestimentos } from './useInvestimentos';
import Dashboard from './investimentosDashboard';
import FichaAtivo from './FichaAtivo';
import CadastroAtivo from './CadastroAtivo';

/**
 * Página principal do módulo — troca entre Dashboard e Ficha do Ativo.
 * Não usa React Router; se seu app já tem rotas de URL para outras
 * seções, me diga e eu adapto para <Route>/useParams.
 */
export default function InvestimentosPage({ casalCode }) {
  const {
    dados, ativos, loading, erro,
    registrarNota, registrarDividendo, registrarRevisaoTese,
    sincronizarDividendos, analisarComIA, analisarPdf, sugerirScoresTese, recarregar,
  } = useInvestimentos(casalCode);
  const [sincronizando, setSincronizando] = useState(false);
  const [tickerSelecionado, setTickerSelecionado] = useState(null);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6B6B66' }}>Carregando seu jardim de investimentos...</div>;
  }

  if (erro) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#B3402F' }}>
        Não foi possível carregar os investimentos. Detalhe: {erro.message}
      </div>
    );
  }

  if (mostrarCadastro) {
    return (
      <CadastroAtivo
        casalCode={casalCode}
        aoSalvar={async () => { setMostrarCadastro(false); await recarregar(); }}
        aoCancelar={() => setMostrarCadastro(false)}
      />
    );
  }

  const ativoSelecionado = ativos.find((a) => a.ticker === tickerSelecionado);

  if (ativoSelecionado) {
    return (
      <div>
        <button
          onClick={() => setTickerSelecionado(null)}
          style={{ margin: 16, background: 'none', border: 'none', color: '#3E6344', fontSize: 14, cursor: 'pointer' }}
        >
          ← voltar ao painel
        </button>
        <FichaAtivo
          ativo={ativoSelecionado}
          aoRegistrarNota={registrarNota}
          aoRegistrarDividendo={registrarDividendo}
          aoRegistrarRevisaoTese={registrarRevisaoTese}
          aoAnalisarIA={analisarComIA}
          aoAnalisarPdf={analisarPdf}
          aoSugerirScoresTese={sugerirScoresTese}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px 0' }}>
        <button
          onClick={async () => { setSincronizando(true); const r = await sincronizarDividendos(); setSincronizando(false); if (r?.erro) alert(r.erro); }}
          disabled={sincronizando}
          style={{ background: 'none', border: '1px solid #7EA77F', color: '#3E6344', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}
        >
          {sincronizando ? 'Sincronizando...' : '↻ Sincronizar dividendos'}
        </button>
        <button className="ji-botao-primario" onClick={() => setMostrarCadastro(true)}>+ Novo ativo</button>
      </div>
      <Dashboard dados={dados} aoAbrirAtivo={setTickerSelecionado} />
    </div>
  );
}
