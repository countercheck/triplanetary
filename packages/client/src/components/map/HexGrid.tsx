import { useMemo, useCallback } from "react";
import { defineHex, Grid, rectangle } from "honeycomb-grid";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { HexData, HexEntry } from "@triplanetary/shared";

// Hex type → fill color
const HEX_COLORS: Record<string, string> = {
  space: "#0a0a1a",
  gravity: "#0d1a3a",
  planet: "#4a7c59",
  asteroid: "#5a4a2a",
  clandestine: "#3a0a3a",
};

interface Props {
  data: HexData;
  /** Inclusive q range [min, max] to render */
  qRange: [number, number];
  /** Inclusive r range [min, max] to render */
  rRange: [number, number];
  onHexClick: (q: number, r: number) => void;
  selectedHex?: string | null;
}

export function HexGrid({
  data,
  qRange,
  rRange,
  onHexClick,
  selectedHex,
}: Props) {
  const [qMin, qMax] = qRange;
  const [rMin, rMax] = rRange;
  const hexSize = data.meta.hexSize;
  const orientation = data.meta.orientation;

  const grid = useMemo(() => {
    const ProtoHex = defineHex({
      dimensions: hexSize,
      orientation,
      origin: "topLeft",
    });
    return new Grid(
      ProtoHex,
      rectangle({
        width: qMax - qMin + 1,
        height: rMax - rMin + 1,
        start: { q: qMin, r: rMin },
      }),
    );
  }, [hexSize, orientation, qMin, qMax, rMin, rMax]);

  const hexes = useMemo(() => [...grid], [grid]);

  const svgWidth = (qMax - qMin + 2) * hexSize * Math.sqrt(3);
  const svgHeight = (rMax - rMin + 2) * hexSize * 1.5;

  const handleClick = useCallback(
    (q: number, r: number) => () => onHexClick(q, r),
    [onHexClick],
  );

  return (
    <TransformWrapper minScale={0.3} maxScale={4} limitToBounds={false}>
      <TransformComponent>
        <svg width={svgWidth} height={svgHeight} style={{ display: "block" }}>
          <defs>
            <marker
              id="gravity-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#4488ff" />
            </marker>
          </defs>
          <g>
            {hexes.map((hex) => {
              const { q, r } = hex;
              const key = `${q},${r}`;
              const entry: HexEntry | undefined = data.hexes[key];
              const type = entry?.type ?? "space";
              const points = hex.corners.map((c) => `${c.x},${c.y}`).join(" ");
              // hex.x and hex.y are the center coordinates in honeycomb-grid v4
              const cx = hex.x;
              const cy = hex.y;
              const isSelected = selectedHex === key;

              return (
                <g
                  key={key}
                  onClick={handleClick(q, r)}
                  style={{ cursor: "pointer" }}
                >
                  <polygon
                    points={points}
                    fill={HEX_COLORS[type] ?? HEX_COLORS["space"]!}
                    stroke={isSelected ? "#ffcc00" : "#1a2a4a"}
                    strokeWidth={isSelected ? 2 : 0.5}
                    data-type={type}
                    data-q={q}
                    data-r={r}
                  />
                  {/* Gravity arrow */}
                  {entry?.type === "gravity" &&
                    entry.offset &&
                    (() => {
                      const [dq, dr] = entry.offset;
                      const dx =
                        hexSize * (Math.sqrt(3) * dq + (Math.sqrt(3) / 2) * dr);
                      const dy = hexSize * (1.5 * dr);
                      const len = Math.sqrt(dx * dx + dy * dy);
                      const scale = (hexSize * 0.5) / len;
                      return (
                        <line
                          x1={cx}
                          y1={cy}
                          x2={cx + dx * scale}
                          y2={cy + dy * scale}
                          stroke="#4488ff"
                          strokeWidth={1.5}
                          markerEnd="url(#gravity-arrow)"
                        />
                      );
                    })()}
                  {/* Body label */}
                  {entry?.type === "planet" && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill="#ffffff"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {entry.body ?? ""}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </TransformComponent>
    </TransformWrapper>
  );
}
