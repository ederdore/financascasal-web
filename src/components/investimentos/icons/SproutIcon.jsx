// Ícone de navegação "Investimentos" — muda crescendo em vaso,
// desenhado no mesmo estilo outline/stroke dos demais ícones do sistema
// (Jardim = casa, Patrimônio = árvore). Aqui: broto em crescimento,
// reforçando a ideia de "cultivar patrimônio" sem repetir a árvore.

export default function SproutIcon({ size = 28, color = '#3E6344', strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* vaso */}
      <path d="M7 15 L8 21 H16 L17 15" />
      <path d="M6.5 15 H17.5" />
      {/* caule */}
      <path d="M12 15 V9" />
      {/* folha esquerda */}
      <path d="M12 12 C9 12 7.5 10 7.5 7 C10.5 7 12 8.5 12 12 Z" />
      {/* folha direita */}
      <path d="M12 10 C15 10 16.5 8 16.5 5.5 C13.7 5.5 12 7 12 10 Z" />
    </svg>
  );
}
