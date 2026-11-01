import { memo } from 'react';
import { PLACES, WORLD } from '../lib/data';

/** Static base layer of the fictional Sarovar Layout map. Drawn once, memoised. */

const V_STREETS = [120, 330, 560, 780];
const H_STREETS = [110, 560, 760, 960];
// Outskirts drawn below the world so the map never shows a blank edge when panned past the south boundary.
const DRAW_H = WORLD.height + 480;
const RIVER = 'M -40 300 C 120 250, 220 450, 360 440 S 560 320, 700 390 S 860 540, 960 500';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildings() {
  const rand = rng(42);
  const xs = [0, ...V_STREETS, WORLD.width];
  const ys = [0, ...H_STREETS, WORLD.height + 60, DRAW_H];
  const rects: { x: number; y: number; w: number; h: number; tone: number }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + 16;
      const x1 = xs[i + 1] - 16;
      const y0 = ys[j] + 16;
      const y1 = ys[j + 1] - 16;
      let y = y0;
      while (y < y1 - 18) {
        const h = Math.min(y1 - y, 26 + rand() * 40);
        let x = x0;
        while (x < x1 - 18) {
          const w = Math.min(x1 - x, 24 + rand() * 46);
          rects.push({ x, y, w: w - 6, h: h - 6, tone: Math.floor(rand() * 3) });
          x += w;
        }
        y += h;
      }
    }
  }
  return rects;
}

const BUILDINGS = buildings();
const TONES = ['#E6ECE8', '#DFE6E2', '#EAEFEC'];

const PARK_TREES = (() => {
  const rand = rng(7);
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 46; i++) pts.push({ x: 350 + rand() * 190, y: 580 + rand() * 160, r: 4 + rand() * 6 });
  for (let i = 0; i < 26; i++) pts.push({ x: 796 + rand() * 100, y: 124 + rand() * 200, r: 4 + rand() * 7 });
  return pts;
})();

function Label({ x, y, children, size = 12, weight = 650, tone = 'ink', spacing = 0 }: { x: number; y: number; children: string; size?: number; weight?: number; tone?: 'ink' | 'park' | 'water' | 'muted'; spacing?: number }) {
  return (
    <text x={x} y={y} className={`map-label map-label-${tone}`} fontSize={size} fontWeight={weight} letterSpacing={spacing} textAnchor="middle">
      {children}
    </text>
  );
}

function CityMapInner() {
  return (
    <svg className="city-map" width={WORLD.width} height={DRAW_H} viewBox={`0 0 ${WORLD.width} ${DRAW_H}`} aria-hidden="true">
      <rect width={WORLD.width} height={DRAW_H} fill="#F3F6F2" />

      <g>
        {BUILDINGS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill={TONES[b.tone]} />
        ))}
      </g>

      {/* Parks */}
      <rect x={342} y={572} width={206} height={176} rx={26} fill="#A9E3A0" />
      <path d="M352 700 C 400 640 470 690 538 600" stroke="#E4F6E4" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M445 580 V 740" stroke="#E4F6E4" strokeWidth={5} fill="none" strokeLinecap="round" />
      <ellipse cx={480} cy={700} rx={30} ry={16} fill="#8CCBF7" />
      <path d="M790 118 H 900 V 330 H 820 C 800 300 790 260 790 230z" fill="#A9E3A0" />
      <rect x={136} y={576} width={180} height={60} rx={16} fill="#BDEAB4" />
      {PARK_TREES.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={t.r} fill={i % 3 === 0 ? '#5FC46A' : '#7FD584'} />
      ))}

      {/* Water */}
      <path d={RIVER} stroke="#B4E5B0" strokeWidth={104} fill="none" />
      <path d={RIVER} stroke="#6FB8F2" strokeWidth={66} fill="none" />
      <path d={RIVER} stroke="#8CCBF7" strokeWidth={40} fill="none" />
      <path d="M700 392 V 520 C 700 540 690 548 676 548 H 640" stroke="#6FB8F2" strokeWidth={18} fill="none" />
      <path d="M0 990 H 96 C 116 1012 112 1060 146 1100 H 0z" fill="#6FB8F2" />
      <path d="M0 1004 H 84 C 100 1022 98 1062 122 1100" stroke="#8CCBF7" strokeWidth={8} fill="none" />

      {/* Road casings then fills */}
      <g stroke="#D3DDD7" strokeLinecap="round">
        {V_STREETS.map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={DRAW_H} strokeWidth={x === 560 || x === 780 ? 22 : 15} />
        ))}
        {[...H_STREETS, WORLD.height + 60].map((y) => (
          <line key={y} x1={0} y1={y} x2={WORLD.width} y2={y} strokeWidth={y === 760 || y === 960 ? 22 : 15} />
        ))}
        <line x1={560} y1={620} x2={640} y2={562} strokeWidth={13} />
      </g>
      <g stroke="#FFFFFF" strokeLinecap="round">
        {V_STREETS.map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={DRAW_H} strokeWidth={x === 560 || x === 780 ? 17 : 10} />
        ))}
        {[...H_STREETS, WORLD.height + 60].map((y) => (
          <line key={y} x1={0} y1={y} x2={WORLD.width} y2={y} strokeWidth={y === 760 || y === 960 ? 17 : 10} />
        ))}
        <line x1={560} y1={620} x2={640} y2={562} strokeWidth={9} />
      </g>
      {/* Bridge rails */}
      <g stroke="#C3CEC8" strokeWidth={2}>
        {V_STREETS.map((x) => {
          const y = x === 120 ? 296 : x === 330 ? 436 : x === 560 ? 352 : 438;
          const w = x === 560 || x === 780 ? 11 : 7;
          return (
            <g key={x}>
              <line x1={x - w} y1={y - 40} x2={x - w} y2={y + 40} />
              <line x1={x + w} y1={y - 40} x2={x + w} y2={y + 40} />
            </g>
          );
        })}
      </g>

      {/* Street names */}
      <g className="map-street">
        <text x={566} y={500} transform="rotate(90 566 500)">Station Road</text>
        <text x={336} y={880} transform="rotate(90 336 880)">Temple Street</text>
        <text x={792} y={680} transform="rotate(90 792 680)">Bazaar Road</text>
        <text x={210} y={756}>Lake Road</text>
        <text x={420} y={956}>Ghat Road</text>
        <text x={640} y={106}>Ring Road</text>
      </g>

      {/* River name on its curve */}
      <path id="river-label-path" d="M 400 425 C 470 400 540 345 640 372" fill="none" />
      <text className="map-label map-label-water" fontSize={12} fontWeight={600} letterSpacing={3}>
        <textPath href="#river-label-path">NILA RIVER</textPath>
      </text>

      <Label x={700} y={850} size={11} weight={700} tone="muted" spacing={3}>
        SAROVAR LAYOUT
      </Label>
      {PLACES.map((p) => (
        <Label key={p.id} x={p.x} y={p.y} size={p.kind === 'district' ? 11 : 12.5} weight={p.kind === 'district' ? 700 : 650} spacing={p.kind === 'district' ? 3 : 0} tone={p.kind === 'park' ? 'park' : p.kind === 'district' ? 'muted' : 'ink'}>
          {p.kind === 'district' ? p.name.toUpperCase() : p.name}
        </Label>
      ))}
    </svg>
  );
}

export const CityMap = memo(CityMapInner);
