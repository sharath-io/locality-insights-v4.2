import { forwardRef, useMemo } from 'react';
import type { LocationReport, POIItem } from '@/types';
import {
  computeBBoxFromReport,
  projectToSVG,
  computeLabelPositions,
} from '@/lib/brochure/engine';

interface Props {
  report: LocationReport;
  projectName: string;
}

const CANVAS_W = 900;
const CANVAS_H = 620;
const SITE_X = 450;
const SITE_Y = 310;

const POI_COLORS: Record<string, string> = {
  HOSPITALS: '#e74c3c',
  'METRO/RAILWAY': '#2980b9',
  SCHOOLS: '#27ae60',
  COLLEGES: '#27ae60',
  'IT PARKS': '#8e44ad',
};
const DEFAULT_POI_COLOR = '#e67e22';

function colorForType(type: string): string {
  return POI_COLORS[type] ?? DEFAULT_POI_COLOR;
}

const BrochureCanvas = forwardRef<SVGSVGElement, Props>(function BrochureCanvas(
  { report, projectName },
  ref,
) {
  const bbox = useMemo(() => computeBBoxFromReport(report), [report]);

  // Flatten POIs (up to 12 total) and tag with type
  const flatPois = useMemo(() => {
    const all: Array<POIItem & { type: string }> = [];
    for (const g of report.pois) for (const it of g.items) all.push({ ...it, type: g.type });
    all.sort((a, b) => a.distanceKm - b.distanceKm);
    return all.slice(0, 12);
  }, [report]);

  const projectedPois = useMemo(
    () =>
      flatPois.map((poi) => {
        const { x, y } = projectToSVG(poi.lat, poi.lng, bbox, CANVAS_W, CANVAS_H);
        return { poi, x, y };
      }),
    [flatPois, bbox],
  );

  const labelPlacements = useMemo(
    () =>
      computeLabelPositions(
        flatPois,
        { x: SITE_X, y: SITE_Y },
        CANVAS_W,
        CANVAS_H,
        bbox,
      ),
    [flatPois, bbox],
  );

  // Paper texture horizontal lines
  const textureLines = [];
  for (let y = 50; y < CANVAS_H; y += 50) {
    textureLines.push(
      <line
        key={`tex-${y}`}
        x1={0}
        x2={CANVAS_W}
        y1={y}
        y2={y}
        stroke="#ede8de"
        strokeWidth={0.5}
      />,
    );
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* LAYER 1 — BACKGROUND */}
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#f5f0e8" />
      {textureLines}

      {/* LAYER 2 — MOCK ROADS */}
      {/* Local roads */}
      <path
        d="M 60 200 Q 300 240 500 290 T 860 360"
        stroke="#c8c2b0"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 120 520 Q 320 400 500 340 T 840 230"
        stroke="#c8c2b0"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Main roads */}
      <path
        d="M 40 380 Q 240 330 460 320 T 870 280"
        stroke="#3d5a7a"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 460 60 Q 430 230 450 310 T 470 580"
        stroke="#3d5a7a"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Highway */}
      <path
        d="M 0 320 Q 220 280 450 310 T 900 290"
        stroke="#0f1e35"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 0 320 Q 220 280 450 310 T 900 290"
        stroke="white"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="10 8"
      />

      {/* LAYER 4 — POI PINS AND LABELS (under site marker) */}
      {labelPlacements.map((lp, i) => {
        const proj = projectedPois.find((p) => p.poi === lp.poi);
        if (!proj) return null;
        const name = lp.poi.name;
        const distance = `${lp.poi.distanceKm.toFixed(1)} km`;
        const nameWidth = Math.max(60, name.length * 5.5);
        const distWidth = distance.length * 5.5 + 6;
        const rectW = Math.max(nameWidth, distWidth) + 12;
        const rectH = 28;
        const isRight = lp.quadrant.endsWith('right');
        const rectX = isRight ? lp.labelX - rectW : lp.labelX;
        const rectY = lp.labelY - 14;
        return (
          <g key={`poi-${i}`}>
            <line
              x1={proj.x}
              y1={proj.y}
              x2={isRight ? rectX + rectW : rectX}
              y2={lp.labelY}
              stroke="#b0a898"
              strokeWidth={0.7}
              strokeDasharray="3 3"
            />
            <rect
              x={rectX}
              y={rectY}
              width={rectW}
              height={rectH}
              fill="white"
              stroke="#d4b077"
              strokeWidth={0.7}
              rx={3}
            />
            <text
              x={rectX + 6}
              y={rectY + 11}
              fontSize={10}
              fontFamily="Poppins, sans-serif"
              fontWeight={500}
              fill="#0f1e35"
            >
              {name.length > 24 ? `${name.slice(0, 22)}…` : name}
            </text>
            <text
              x={rectX + 6}
              y={rectY + 23}
              fontSize={9}
              fontFamily="Poppins, sans-serif"
              fontWeight={600}
              fill="#b8954a"
            >
              {distance}
            </text>
            <circle
              cx={proj.x}
              cy={proj.y}
              r={5}
              fill={colorForType((lp.poi as POIItem & { type?: string }).type ?? '')}
              stroke="white"
              strokeWidth={1.5}
            />
          </g>
        );
      })}

      {/* LAYER 3 — SITE MARKER */}
      <circle cx={SITE_X} cy={SITE_Y} r={22} fill="#c0392b" opacity={0.15} />
      <circle
        cx={SITE_X}
        cy={SITE_Y}
        r={16}
        fill="none"
        stroke="#c0392b"
        strokeWidth={1}
        opacity={0.4}
      />
      <circle cx={SITE_X} cy={SITE_Y} r={9} fill="#c0392b" stroke="white" strokeWidth={2} />
      <rect x={SITE_X - 20} y={SITE_Y + 14} width={40} height={18} rx={3} fill="#c0392b" />
      <text
        x={SITE_X}
        y={SITE_Y + 26}
        fontSize={9}
        fontFamily="Poppins, sans-serif"
        fontWeight={600}
        fill="white"
        textAnchor="middle"
      >
        SITE
      </text>

      {/* LAYER 5 — FRAME */}
      {/* Header */}
      <rect x={0} y={0} width={CANVAS_W} height={46} fill="#0f1e35" />
      <text
        x={20}
        y={29}
        fontSize={13}
        fontFamily="Poppins, sans-serif"
        fontWeight={600}
        fill="#b8954a"
        style={{ letterSpacing: '3px' }}
      >
        CONNECTIVITY MAP
      </text>
      <text
        x={880}
        y={29}
        fontSize={14}
        fontFamily="'Playfair Display', serif"
        fill="white"
        textAnchor="end"
      >
        {projectName}
      </text>

      {/* Footer */}
      <rect x={0} y={592} width={CANVAS_W} height={28} fill="#0f1e35" />
      <text
        x={CANVAS_W / 2}
        y={610}
        fontSize={8}
        fontFamily="Poppins, sans-serif"
        fontWeight={400}
        fill="#b8954a"
        textAnchor="middle"
        style={{ letterSpacing: '2px' }}
      >
        PREMIUM LOCATION INTELLIGENCE  ·  LOCATEIQ
      </text>

      {/* Gold border */}
      <rect
        x={4}
        y={4}
        width={CANVAS_W - 8}
        height={CANVAS_H - 8}
        fill="none"
        stroke="#b8954a"
        strokeWidth={1}
      />
    </svg>
  );
});

export default BrochureCanvas;
