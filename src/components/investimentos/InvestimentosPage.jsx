import { useState } from 'react';
import { useInvestimentos } from './useInvestimentos';
import Dashboard from './Dashboard';
import FichaAtivo from './FichaAtivo';

/**
 * Página principal do módulo — troca entre Dashboard e Ficha do Ativo.
 * Não usa React Router; se seu app já tem rotas de URL para outras
 * seções, me diga e eu adapto para <Route>/useParams.
 */
export default function InvestimentosPage({ casalCode }) {
  const { dados, ativos, loading, erro, registrarNota } = useInvestimentos(casalCode);
  const [tickerSelecionado, setTickerSelecionado] = useState(null);

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
        <FichaAtivo ativo={ativoSelecionado} aoRegistrarNota={registrarNota} />
      </div>
    );
  }

  return <Dashboard dados={dados} aoAbrirAtivo={setTickerSelecionado} />;
}
