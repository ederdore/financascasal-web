import { ScoreBadge, StatusBadge } from './InvestmentScoreBadge';
import DiarioInvestimento from './DiarioInvestimento';
import './styles.css';

function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Ficha do ativo — página individual (seção 9).
 *
 * `ativo` combina o registro de invest_assets com os agregados
 * calculados (posição atual, dividendos acumulados, rentabilidade)
 * e os arrays de histórico já ordenados por data desc.
 *
 * ativo = {
 *   ticker, name, assetType, status, thesis, targetWeight,
 *   quantidade, precoMedio, valorInvestido, valorAtual,
 *   dividendosAcumulados, rentabilidadeTotal, pesoAtual, score,
 *   historicoCompras: [{ data, quantidade, precoUnitario, valorTotal }],
 *   historicoDividendos: [{ data, tipo, valorTotal }],
 *   notas: [{ id, data, tipo, descricao, decisao }],
 * }
 */
export default function FichaAtivo({ ativo, aoRegistrarNota }) {
  if (!ativo) return null;

  const diffPeso = (ativo.pesoAtual ?? 0) - (ativo.targetWeight ?? 0);

  return (
    <div className="ji-root ji-dashboard">
      <div className="ji-header">
        <div>
          <h1>{ativo.ticker}</h1>
          <span className="ji-subtitulo">{ativo.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status={ativo.status} />
          <ScoreBadge score={ativo.score} />
        </div>
      </div>

      <div className="ji-grid-indicadores">
        <Cartao label="Quantidade" valor={ativo.quantidade} />
        <Cartao label="Preço médio" valor={formatarMoeda(ativo.precoMedio)} />
        <Cartao label="Valor investido" valor={formatarMoeda(ativo.valorInvestido)} />
        <Cartao label="Valor atual" valor={formatarMoeda(ativo.valorAtual)} />
        <Cartao label="Dividendos acumulados" valor={formatarMoeda(ativo.dividendosAcumulados)} />
        <Cartao
          label="Rentabilidade total"
          valor={`${ativo.rentabilidadeTotal >= 0 ? '+' : ''}${(ativo.rentabilidadeTotal ?? 0).toFixed(1)}%`}
          negativo={ativo.rentabilidadeTotal < 0}
        />
      </div>

      <div className="ji-secao">
        <div className="ji-secao-titulo">Peso na carteira</div>
        <p style={{ margin: 0, fontSize: 14 }}>
          Atual: <strong>{(ativo.pesoAtual ?? 0).toFixed(1)}%</strong> · Alvo: <strong>{(ativo.targetWeight ?? 0).toFixed(1)}%</strong>
          {diffPeso !== 0 && (
            <span className={`ji-peso-diff ${diffPeso > 0 ? 'acima' : 'abaixo'}`} style={{ marginLeft: 8 }}>
              {diffPeso > 0 ? '▲ acima do alvo' : '▼ abaixo do alvo'}
            </span>
          )}
        </p>
      </div>

      <div className="ji-secao">
        <div className="ji-secao-titulo">Tese de investimento</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#2A2A28' }}>
          {ativo.thesis || 'Nenhuma tese registrada ainda.'}
        </p>
      </div>

      <div className="ji-grid-duas-colunas">
        <div className="ji-secao">
          <div className="ji-secao-titulo">Histórico de compras</div>
          <TabelaHistoricoCompras itens={ativo.historicoCompras} />
        </div>
        <div className="ji-secao">
          <div className="ji-secao-titulo">Histórico de dividendos</div>
          <TabelaHistoricoDividendos itens={ativo.historicoDividendos} />
        </div>
      </div>

      <div className="ji-secao">
        <div className="ji-secao-titulo">Diário de investimento</div>
        <DiarioInvestimento notas={ativo.notas} aoRegistrar={(nota) => aoRegistrarNota?.(ativo.ticker, nota)} />
      </div>
    </div>
  );
}

function Cartao({ label, valor, negativo }) {
  return (
    <div className="ji-card">
      <div className="ji-card-label">{label}</div>
      <div className={`ji-card-valor ${negativo ? 'negativo' : ''}`}>{valor}</div>
    </div>
  );
}

function TabelaHistoricoCompras({ itens }) {
  if (!itens?.length) return <div className="ji-vazio">Nenhuma compra registrada ainda.</div>;
  return (
    <table className="ji-tabela-ativos">
      <thead><tr><th>Data</th><th>Qtd.</th><th>Preço</th><th>Total</th></tr></thead>
      <tbody>
        {itens.map((c, i) => (
          <tr key={i}>
            <td>{new Date(c.data).toLocaleDateString('pt-BR')}</td>
            <td>{c.quantidade}</td>
            <td>{formatarMoeda(c.precoUnitario)}</td>
            <td>{formatarMoeda(c.valorTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaHistoricoDividendos({ itens }) {
  if (!itens?.length) return <div className="ji-vazio">Nenhum dividendo recebido ainda.</div>;
  return (
    <table className="ji-tabela-ativos">
      <thead><tr><th>Data</th><th>Tipo</th><th>Valor</th></tr></thead>
      <tbody>
        {itens.map((d, i) => (
          <tr key={i}>
            <td>{new Date(d.data).toLocaleDateString('pt-BR')}</td>
            <td>{d.tipo}</td>
            <td>{formatarMoeda(d.valorTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
