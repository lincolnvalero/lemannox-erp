'use client';

interface CalculatorDiagramProps {
  width: number;
  height: number;
  depth: number;
}

// Projeção cabinet/oblíqua simples: face frontal (largura × altura) em
// verdadeira grandeza, com a profundidade projetada em diagonal para trás.
// As três faces visíveis (frente, topo, lateral direita) usam os mesmos
// oito vértices — sem pontos "emprestados" de faces erradas, que era a
// causa do desenho quebrar (a linha de profundidade se unindo à extremidade
// errada do teto) ao digitar a altura.
export function CalculatorDiagram({ width, height, depth }: CalculatorDiagramProps) {
  const w = isNaN(width) || width <= 0 ? 100 : Math.min(width, 300);
  const h = isNaN(height) || height <= 0 ? 100 : Math.min(height, 300);
  const d = isNaN(depth) || depth <= 0 ? 100 : Math.min(depth, 300);

  const viewBoxWidth = 400;
  const viewBoxHeight = 280;

  // Profundidade projetada a 40% do seu valor, sempre para cima-direita.
  const dx = d * 0.4;
  const dy = d * 0.4;

  const totalW = w + dx;
  const totalH = h + dy;
  const x = (viewBoxWidth - totalW) / 2;
  const y = (viewBoxHeight - totalH) / 2 + dy;

  // Face frontal
  const p1 = { x, y };               // topo-esquerda
  const p2 = { x: x + w, y };        // topo-direita
  const p3 = { x: x + w, y: y + h }; // baixo-direita
  const p4 = { x, y: y + h };        // baixo-esquerda
  // Face de trás (deslocada em profundidade)
  const p5 = { x: x + dx, y: y - dy };         // topo-esquerda-fundo
  const p6 = { x: x + w + dx, y: y - dy };     // topo-direita-fundo
  const p7 = { x: x + w + dx, y: y + h - dy }; // baixo-direita-fundo

  const depthAngle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const depthMid = { x: (p3.x + p7.x) / 2, y: (p3.y + p7.y) / 2 };

  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed bg-card p-4">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full text-muted-foreground"
      >
        <g stroke="currentColor" strokeWidth="1" fill="none" strokeLinejoin="round" strokeLinecap="round">
          {/* Topo (largura x profundidade) */}
          <path d={`M ${p1.x} ${p1.y} L ${p5.x} ${p5.y} L ${p6.x} ${p6.y} L ${p2.x} ${p2.y} Z`} fill="hsl(var(--primary) / 0.08)" />
          {/* Lateral direita (profundidade x altura) */}
          <path d={`M ${p2.x} ${p2.y} L ${p6.x} ${p6.y} L ${p7.x} ${p7.y} L ${p3.x} ${p3.y} Z`} fill="hsl(var(--primary) / 0.14)" />
          {/* Arestas de profundidade (tracejadas) */}
          <path d={`M ${p1.x} ${p1.y} L ${p5.x} ${p5.y}`} strokeDasharray="4 2" />
          <path d={`M ${p3.x} ${p3.y} L ${p7.x} ${p7.y}`} strokeDasharray="4 2" />
          <path d={`M ${p6.x} ${p6.y} L ${p7.x} ${p7.y}`} strokeDasharray="4 2" />
          {/* Face frontal (largura x altura) — contorno principal */}
          <path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`} strokeWidth="1.5" />

          <g fontSize="10px">
            {/* Altura — ao lado da aresta frontal direita */}
            <path d={`M ${p3.x + 10} ${p3.y} L ${p2.x + 10} ${p2.y}`} />
            <text x={p3.x + 15} y={y + h / 2} dominantBaseline="middle">{height || 0}mm</text>

            {/* Largura — abaixo da aresta frontal inferior */}
            <path d={`M ${p4.x} ${p4.y + 10} L ${p3.x} ${p3.y + 10}`} />
            <text x={x + w / 2} y={p3.y + 22} textAnchor="middle">{width || 0}mm</text>

            {/* Profundidade — ao longo da própria aresta de profundidade */}
            <text
              x={depthMid.x + 8}
              y={depthMid.y + 8}
              textAnchor="middle"
              transform={`rotate(${depthAngle}, ${depthMid.x + 8}, ${depthMid.y + 8})`}
            >
              {depth || 0}mm
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
