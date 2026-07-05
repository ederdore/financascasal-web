// Classificação de score conforme seção 12 do documento:
// 90-100 excelente | 80-89 bom | 70-79 atenção | <70 revisar tese
function classificarScore(score) {
  if (score >= 90) return { label: 'Excelente', classe: 'excelente' };
  if (score >= 80) return { label: 'Bom', classe: 'bom' };
  if (score >= 70) return { label: 'Atenção', classe: 'atencao' };
  return { label: 'Revisar tese', classe: 'revisar' };
}

export function ScoreBadge({ score }) {
  if (score == null) return <span className="ji-badge status-em_observacao">Sem score</span>;
  const { label, classe } = classificarScore(score);
  return <span className={`ji-badge ${classe}`}>{score.toFixed(0)} · {label}</span>;
}

const STATUS_LABEL = {
  ativo: 'Ativo',
  em_observacao: 'Em observação',
  tese_rompida: 'Tese rompida',
  encerrado: 'Encerrado',
};

export function StatusBadge({ status }) {
  return <span className={`ji-badge status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}
