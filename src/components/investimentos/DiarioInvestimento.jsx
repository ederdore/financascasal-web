import { useState } from 'react';
import './styles.css';

const TIPOS_NOTA = [
  { value: 'compra', label: 'Compra' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'alerta', label: 'Alerta' },
  { value: 'mudanca_tese', label: 'Mudança de tese' },
  { value: 'acompanhamento', label: 'Acompanhamento' },
];

const DECISOES = [
  { value: 'manter', label: 'Manter' },
  { value: 'observar', label: 'Observar' },
  { value: 'reduzir_exposicao', label: 'Reduzir exposição' },
  { value: 'encerrar_tese', label: 'Encerrar tese' },
];

const TIPO_LABEL = Object.fromEntries(TIPOS_NOTA.map((t) => [t.value, t.label]));
const DECISAO_LABEL = Object.fromEntries(DECISOES.map((d) => [d.value, d.label]));

/**
 * Diário de investimento — seção 10.
 * `notas` vem ordenado por data desc. `aoRegistrar` recebe
 * { noteType, description, decision } para persistir em invest_notes.
 */
export default function DiarioInvestimento({ notas, aoRegistrar }) {
  const [tipo, setTipo] = useState('acompanhamento');
  const [descricao, setDescricao] = useState('');
  const [decisao, setDecisao] = useState('manter');

  function handleSubmit() {
    if (!descricao.trim()) return;
    aoRegistrar?.({ noteType: tipo, description: descricao.trim(), decision: decisao });
    setDescricao('');
  }

  return (
    <div>
      {!notas?.length && <div className="ji-vazio">Nenhuma nota registrada ainda.</div>}

      {notas?.map((nota) => (
        <div key={nota.id} className="ji-diario-item">
          <div className="ji-diario-meta">
            <span>{TIPO_LABEL[nota.tipo] || nota.tipo} · {DECISAO_LABEL[nota.decisao] || nota.decisao}</span>
            <span>{new Date(nota.data).toLocaleDateString('pt-BR')}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14 }}>{nota.descricao}</p>
        </div>
      ))}

      <div className="ji-diario-form">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_NOTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <textarea
          rows={3}
          placeholder="Por que essa decisão faz sentido para a sua tese?"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <select value={decisao} onChange={(e) => setDecisao(e.target.value)}>
          {DECISOES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button className="ji-botao-primario" onClick={handleSubmit}>Registrar nota</button>
      </div>
    </div>
  );
}
