import { useState } from 'react';
import { supabase } from '../../supabase.js'; // AJUSTE para o caminho real do seu client
import './styles.css';

const TIPOS_ATIVO = [
  { value: 'fii', label: 'Fundo Imobiliário' },
  { value: 'acao', label: 'Ação' },
  { value: 'renda_fixa', label: 'Renda Fixa' },
  { value: 'etf', label: 'ETF' },
];

const OBJETIVOS = [
  { value: 'renda', label: 'Renda' },
  { value: 'crescimento', label: 'Crescimento' },
  { value: 'protecao', label: 'Proteção' },
  { value: 'diversificacao', label: 'Diversificação' },
];

const ORIGENS = [
  { value: 'aporte_mensal', label: 'Aporte mensal' },
  { value: 'reinvestimento_dividendos', label: 'Reinvestimento de dividendos' },
  { value: 'rebalanceamento', label: 'Rebalanceamento' },
];

const VAZIO = {
  ticker: '', name: '', assetType: 'fii', sector: '', subsector: '',
  portfolioGoal: 'renda', targetWeight: '', thesis: '',
  quantidade: '', precoUnitario: '', taxas: '0', dataCompra: new Date().toISOString().slice(0, 10),
  origem: 'aporte_mensal',
};

/**
 * Cadastro de ativo + primeira compra, em uma única tela.
 * Cria o registro em invest_assets e, se quantidade/preço forem
 * informados, já lança a primeira transação em invest_transactions.
 */
export default function CadastroAtivo({ casalCode, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);

    if (!form.ticker.trim() || !form.name.trim()) {
      setErro('Ticker e nome são obrigatórios.');
      return;
    }

    setSalvando(true);
    try {
      const { data: ativoCriado, error: erroAtivo } = await supabase
        .from('invest_assets')
        .insert({
          casal_code: casalCode,
          ticker: form.ticker.trim().toUpperCase(),
          name: form.name.trim(),
          asset_type: form.assetType,
          sector: form.sector || null,
          subsector: form.subsector || null,
          portfolio_goal: form.portfolioGoal,
          target_weight: form.targetWeight ? Number(form.targetWeight) : null,
          thesis: form.thesis || null,
          first_purchase_date: form.dataCompra || null,
        })
        .select()
        .single();

      if (erroAtivo) throw erroAtivo;

      // Se quantidade e preço foram informados, já registra a primeira compra
      const quantidade = Number(form.quantidade);
      const precoUnitario = Number(form.precoUnitario);
      if (quantidade > 0 && precoUnitario > 0) {
        const taxas = Number(form.taxas || 0);
        const { error: erroTransacao } = await supabase.from('invest_transactions').insert({
          casal_code: casalCode,
          asset_id: ativoCriado.id,
          transaction_date: form.dataCompra,
          transaction_type: 'compra',
          quantity: quantidade,
          unit_price: precoUnitario,
          total_value: quantidade * precoUnitario,
          fees: taxas,
          source: form.origem,
        });
        if (erroTransacao) throw erroTransacao;
      }

      setForm(VAZIO);
      aoSalvar?.();
    } catch (e) {
      console.error('Erro ao cadastrar ativo:', e);
      setErro(e.message || 'Erro ao salvar. Tenta de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="ji-root ji-dashboard">
      <div className="ji-header">
        <h1>Novo ativo</h1>
      </div>

      <form onSubmit={handleSubmit} className="ji-secao" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {erro && <div style={{ color: '#B3402F', fontSize: 14 }}>{erro}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Campo label="Ticker*">
            <input value={form.ticker} onChange={(e) => atualizar('ticker', e.target.value)} placeholder="MXRF11" />
          </Campo>
          <Campo label="Nome do ativo*">
            <input value={form.name} onChange={(e) => atualizar('name', e.target.value)} placeholder="Maxi Renda FII" />
          </Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Campo label="Tipo">
            <select value={form.assetType} onChange={(e) => atualizar('assetType', e.target.value)}>
              {TIPOS_ATIVO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Campo>
          <Campo label="Objetivo na carteira">
            <select value={form.portfolioGoal} onChange={(e) => atualizar('portfolioGoal', e.target.value)}>
              {OBJETIVOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Campo>
          <Campo label="Peso alvo (%)">
            <input type="number" step="0.1" value={form.targetWeight} onChange={(e) => atualizar('targetWeight', e.target.value)} placeholder="10" />
          </Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Setor">
            <input value={form.sector} onChange={(e) => atualizar('sector', e.target.value)} placeholder="Papel / CRI" />
          </Campo>
          <Campo label="Subsetor">
            <input value={form.subsector} onChange={(e) => atualizar('subsector', e.target.value)} />
          </Campo>
        </div>

        <Campo label="Tese de investimento">
          <textarea rows={3} value={form.thesis} onChange={(e) => atualizar('thesis', e.target.value)} placeholder="Por que esse ativo entra na carteira?" />
        </Campo>

        <hr style={{ border: 'none', borderTop: '1px solid #E4DDD0', margin: '4px 0' }} />
        <div className="ji-secao-titulo" style={{ margin: 0 }}>Primeira compra (opcional — pode registrar depois)</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Campo label="Data">
            <input type="date" value={form.dataCompra} onChange={(e) => atualizar('dataCompra', e.target.value)} />
          </Campo>
          <Campo label="Quantidade">
            <input type="number" step="0.00000001" value={form.quantidade} onChange={(e) => atualizar('quantidade', e.target.value)} />
          </Campo>
          <Campo label="Preço unitário (R$)">
            <input type="number" step="0.01" value={form.precoUnitario} onChange={(e) => atualizar('precoUnitario', e.target.value)} />
          </Campo>
          <Campo label="Taxas (R$)">
            <input type="number" step="0.01" value={form.taxas} onChange={(e) => atualizar('taxas', e.target.value)} />
          </Campo>
        </div>

        <Campo label="Origem do recurso">
          <select value={form.origem} onChange={(e) => atualizar('origem', e.target.value)}>
            {ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Campo>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" className="ji-botao-primario" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar ativo'}
          </button>
          <button
            type="button"
            onClick={aoCancelar}
            style={{ background: 'none', border: 'none', color: '#6B6B66', cursor: 'pointer', fontSize: 14 }}
          >
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
