import './styles.css';

const ORDEM_SEVERIDADE = { alerta: 0, atencao: 1, info: 2 };
const ICONE_SEVERIDADE = { alerta: '🔴', atencao: '🟡', info: 'ℹ️' };

/**
 * Painel de alertas (seção 13). Recebe `alertas` no formato
 * { tipo, ticker?, severidade, mensagem } já calculado pelo hook.
 */
export default function AlertasPainel({ alertas, aoAbrirAtivo }) {
  if (!alertas?.length) {
    return (
      <div className="ji-secao">
        <div className="ji-secao-titulo">Alertas</div>
        <div className="ji-vazio">Nenhum alerta no momento — carteira dentro do esperado. 🌱</div>
      </div>
    );
  }

  const ordenados = [...alertas].sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade]);

  return (
    <div className="ji-secao">
      <div className="ji-secao-titulo">Alertas ({alertas.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ordenados.map((a, i) => (
          <div
            key={i}
            onClick={() => a.ticker && aoAbrirAtivo?.(a.ticker)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14,
              padding: '8px 10px', borderRadius: 8, background: '#F4EFE7',
              cursor: a.ticker && aoAbrirAtivo ? 'pointer' : 'default',
            }}
          >
            <span>{ICONE_SEVERIDADE[a.severidade] || '•'}</span>
            <span>{a.mensagem}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
