'use client';

interface CalculatorDiagramProps {
  width: number;
  height: number;
  depth: number;
}

export function CalculatorDiagram({ width, height, depth }: CalculatorDiagramProps) {
  const w = isNaN(width) || width <= 0 ? 100 : Math.min(width, 300);
  const h = isNaN(height) || height <= 0 ? 100 : Math.min(height, 300);
  const d = isNaN(depth) || depth <= 0 ? 100 : Math.min(depth, 300);

  const viewBoxWidth = 400;
  const viewBoxHeight = 300;

  const x = (viewBoxWidth - w) / 2;
  const y = (viewBoxHeight - h) / 2;
  const dx = d / 2;
  const dy = d / 2;

  const points = {
    p1: { x, y },
    p2: { x: x + w, y },
    p3: { x: x + w, y: y + h },
    p4: { x, y: y + h },
    p5: { x: x + dx, y: y - dy },
    p6: { x: x + w + dx, y: y - dy },
    p7: { x: x + w + dx, y: y + h - dy },
  };

  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed bg-card p-4">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full text-muted-foreground"
      >
        <g stroke="currentColor" strokeWidth="1" fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path
            d={`M ${points.p1.x} ${points.p1.y} L ${points.p5.x} ${points.p5.y} L ${points.p6.x} ${points.p6.y} L ${points.p2.x} ${points.p2.y}`}
            strokeDasharray="4 2"
          />
          <path
            d={`M ${points.p4.x} ${points.p4.y} L ${points.p3.x} ${points.p3.y} L ${points.p7.x} ${points.p7.y} L ${points.p4.x + dx} ${points.p4.y - dy} Z`}
            fill="hsl(var(--primary) / 0.05)"
          />
          <path
            d={`M ${points.p3.x} ${points.p3.y} L ${points.p2.x} ${points.p2.y} L ${points.p6.x} ${points.p6.y} L ${points.p7.x} ${points.p7.y} Z`}
            fill="hsl(var(--primary) / 0.1)"
          />
          <g fontSize="10px">
            <path d={`M ${points.p3.x + 10} ${points.p3.y} L ${points.p2.x + 10} ${points.p2.y}`} />
            <text x={points.p3.x + 15} y={y + h / 2} dominantBaseline="middle">
              {height || 0}mm
            </text>
            <path d={`M ${points.p4.x} ${points.p4.y + 10} L ${points.p3.x} ${points.p3.y + 10}`} />
            <text x={x + w / 2} y={points.p3.y + 20} textAnchor="middle">
              {width || 0}mm
            </text>
            <path
              d={`M ${points.p7.x + 5} ${points.p7.y + 5} L ${points.p3.x + 5} ${points.p3.y + 5}`}
              transform={`rotate(-30, ${points.p7.x}, ${points.p7.y})`}
            />
            <text
              x={points.p7.x}
              y={points.p7.y + h / 4}
              textAnchor="middle"
              transform={`rotate(60, ${points.p7.x}, ${y + h / 2})`}
            >
              {depth || 0}mm
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
