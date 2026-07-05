import { useState } from 'react';
import './styles.css';

const TIPOS_DIVIDENDO = [
  { value: 'dividendo', label: 'Dividendo' },
  { value: 'rendimento_fii', label: 'Rendimento FII' },
  { value: 'jcp', label: 'JCP' },
  { value: 'amortizacao', label: 'Amortização' },
];

const VAZIO = {
  paymentDate: new Date().toISOString().slice(0, 10),
  dividendType: 'rendimento_fii',
  quantityHeld: '',
  valuePerShare: '',
  reinvested: false,
};

/**
 * Registro de dividendo recebido (seção 7).
 * `quantidadeAtual` é sugerida automaticamente a partir da posição do
 * ativo, mas pode ser ajustada (caso o pagamento seja de uma data com
 * quantidade diferente da atual).
 */
export default function RegistrarDividendo({ ticker, quantidadeAtual, aoRegistrar, aoCancelar }) {
  const [form, setForm] = useState({ ...VAZIO, quantityHeld: quantidadeAtual || '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const valorTotal = (Number(form.quantityHeld) || 0) * (Number(form.valuePerShare) || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);

    if (!form.quantityHeld || !form.valuePerShare) {
      setErro('Preencha quantidade e valor por cota/ação.');
      return;
    }

    setSalvando(true);
    const resultado = await aoRegistrar({
      paymentDate: form.paymentDate,
      dividendType: form.dividendType,
      quantityHeld: Number(form.quantityHeld),
      valuePerShare: Number(form.valuePerShare),
      totalValue: valorTotal,
      reinvested: form.reinvested,
    });
    setSalvando(false);

    if (resultado?.erro) {
      setErro(resultado.erro);
    } else {
      setForm({ ...VAZIO, quantityHeld: quantidadeAtual || '' });
    }
  }

  return (
    <div className="ji-secao">
      <div className="ji-secao-titulo">Registrar dividendo — {ticker}</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {erro && <div style={{ color: '#B3402F', fontSize: 14 }}>{erro}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Data de pagamento">
            <input type="date" value={form.paymentDate} onChange={(e) => atualizar('paymentDate', e.target.value)} />
          </Campo>
          <Campo label="Tipo">
            <select value={form.dividendType} onChange={(e) => atualizar('dividendType', e.target.value)}>
              {TIPOS_DIVIDENDO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Quantidade na data">
            <input type="number" step="0.00000001" value={form.quantityHeld} onChange={(e) => atualizar('quantityHeld', e.target.value)} />
          </Campo>
          <Campo label="Valor por cota/ação (R$)">
            <input type="number" step="0.000001" value={form.valuePerShare} onChange={(e) => atualizar('valuePerShare', e.target.value)} />
          </Campo>
        </div>

        <div style={{ fontSize: 14, color: '#6B6B66' }}>
          Valor total: <strong style={{ color: '#3E6344' }}>{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={form.reinvested} onChange={(e) => atualizar('reinvested', e.target.checked)} />
          Já foi reinvestido
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="ji-botao-primario" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Registrar dividendo'}
          </button>
          <button type="button" onClick={aoCancelar} style={{ background: 'none', border: 'none', color: '#6B6B66', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#6B6B66' }}>
      {label}
      {children}
    </label>
  );
}
