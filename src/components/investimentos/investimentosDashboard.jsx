import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import SproutIcon from './icons/SproutIcon';
import AlertasPainel from './AlertasPainel';
import './styles.css';

const CORES_SETOR = ['#3E6344', '#7EA77F', '#C89A4A', '#D97C6C', '#A8B89A', '#8C6A4E'];

function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPercentual(valor) {
  return `${(valor ?? 0).toFixed(1)}%`;
}

/**
 * Dashboard principal do Jardim de Investimentos.
 *
 * Espera receber `dados` já calculados a partir das tabelas
 * invest_portfolio_snapshots, invest_assets, invest_dividends.
 * O componente não faz cálculo de negócio — apenas apresenta.
 *
 * Formato esperado de `dados`:
 * {
 *   patrimonioTotal, valorInvestido, lucroPrejuizo,
 *   dividendosMes, dividendosAno, rendaMensalMedia,
 *   rendaAnualProjetada, metaRendaPassiva,
 *   evolucaoPatrimonial: [{ mes, valor }],
 *   evolucaoDividendos: [{ mes, valor }],
 *   distribuicaoPorTipo: [{ tipo, valor }],
 *   distribuicaoPorSetor: [{ setor, valor }],
 *   topAtivos: [{ ticker, peso, valorAtual }],
 *   ativosForaDoPeso: [{ ticker, pesoAtual, pesoAlvo }],
 * }
 */
export default function Dashboard({ dados, aoAbrirAtivo }) {
  if (!dados) {
    return (
      <div className="ji-root ji-dashboard">
        <div className="ji-vazio">Nenhum dado de carteira ainda. Cadastre seu primeiro ativo para começar a cultivar.</div>
      </div>
    );
  }

  const percentualMeta = dados.metaRendaPassiva
    ? Math.min(100, (dados.rendaAnualProjetada / dados.metaRendaPassiva) * 100)
    : 0;

  return (
    <div className="ji-root ji-dashboard">
      <div className="ji-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SproutIcon size={30} />
          <h1>Jardim de Investimentos</h1>
        </div>
        <span className="ji-subtitulo">Não é sobre prever o mercado. É sobre acompanhar, validar e cultivar com disciplina.</span>
      </div>

      <AlertasPainel alertas={dados.alertas} aoAbrirAtivo={aoAbrirAtivo} />

      {/* Indicadores principais */}
      <div className="ji-grid-indicadores">
        <Cartao label="Patrimônio total" valor={formatarMoeda(dados.patrimonioTotal)} />
        <Cartao label="Valor investido" valor={formatarMoeda(dados.valorInvestido)} />
        <Cartao
          label="Lucro / prejuízo"
          valor={formatarMoeda(dados.lucroPrejuizo)}
          negativo={dados.lucroPrejuizo < 0}
        />
        <Cartao label="Dividendos no mês" valor={formatarMoeda(dados.dividendosMes)} />
        <Cartao label="Dividendos no ano" valor={formatarMoeda(dados.dividendosAno)} />
        <Cartao label="Renda passiva média/mês" valor={formatarMoeda(dados.rendaMensalMedia)} />
      </div>

      {/* Meta de renda passiva */}
      <div className="ji-card">
        <div className="ji-card-label">Meta de renda passiva anual</div>
        <div className="ji-card-valor">
          {formatarMoeda(dados.rendaAnualProjetada)} <span style={{ fontSize: 14, color: '#6B6B66' }}>de {formatarMoeda(dados.metaRendaPassiva)}</span>
        </div>
        <div className="ji-card-meta">
          <div className="ji-progress-track">
            <div className="ji-progress-fill" style={{ width: `${percentualMeta}%` }} />
          </div>
        </div>
      </div>

      <div className="ji-grid-duas-colunas">
        {/* Evolução patrimonial */}
        <div className="ji-secao">
          <div className="ji-secao-titulo">Evolução patrimonial</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dados.evolucaoPatrimonial}>
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B6B66" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6B6B66" />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Line type="monotone" dataKey="valor" stroke="#3E6344" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição por tipo de ativo */}
        <div className="ji-secao">
          <div className="ji-secao-titulo">Distribuição por tipo</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dados.distribuicaoPorTipo} dataKey="valor" nameKey="tipo" innerRadius={50} outerRadius={80}>
                {(dados.distribuicaoPorTipo || []).map((_, i) => (
                  <Cell key={i} fill={CORES_SETOR[i % CORES_SETOR.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatarMoeda(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="ji-grid-duas-colunas">
        {/* Dividendos mensais */}
        <div className="ji-secao">
          <div className="ji-secao-titulo">Dividendos mensais</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dados.evolucaoDividendos}>
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B6B66" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6B6B66" />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Bar dataKey="valor" fill="#C89A4A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top ativos */}
        <div className="ji-secao">
          <div className="ji-secao-titulo">Top ativos por peso</div>
          <table className="ji-tabela-ativos">
            <thead>
              <tr><th>Ativo</th><th>Peso</th><th>Valor atual</th></tr>
            </thead>
            <tbody>
              {(dados.topAtivos || []).map((a) => (
                <tr key={a.ticker} onClick={() => aoAbrirAtivo?.(a.ticker)} style={{ cursor: aoAbrirAtivo ? 'pointer' : 'default' }}>
                  <td className="ji-ticker">{a.ticker}</td>
                  <td>{formatarPercentual(a.peso)}</td>
                  <td>{formatarMoeda(a.valorAtual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ativos fora do peso alvo */}
      {dados.ativosForaDoPeso?.length > 0 && (
        <div className="ji-secao">
          <div className="ji-secao-titulo">Ativos fora do peso alvo</div>
          <table className="ji-tabela-ativos">
            <thead>
              <tr><th>Ativo</th><th>Peso atual</th><th>Peso alvo</th><th>Diferença</th></tr>
            </thead>
            <tbody>
              {dados.ativosForaDoPeso.map((a) => {
                const diff = a.pesoAtual - a.pesoAlvo;
                return (
                  <tr key={a.ticker}>
                    <td className="ji-ticker">{a.ticker}</td>
                    <td>{formatarPercentual(a.pesoAtual)}</td>
                    <td>{formatarPercentual(a.pesoAlvo)}</td>
                    <td className={`ji-peso-diff ${diff > 0 ? 'acima' : 'abaixo'}`}>
                      {diff > 0 ? '▲' : '▼'} {formatarPercentual(Math.abs(diff))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
