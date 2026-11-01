import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { CityMap } from './CityMap';
import { HUBS, WORLD, batteryTone, type Hub, type Point, type Scooter } from '../lib/data';
import { ScooterGlyph } from './Icons';

interface MapViewProps {
  focus: Point;
  /** Change this to re-centre on `focus` (e.g. a counter bumped by the re-centre button). */
  focusKey: string | number;
  /** Where the focus point sits vertically, as a fraction of the viewport height. */
  focusY?: number;
  label: string;
  children?: ReactNode;
  svgOverlay?: ReactNode;
  className?: string;
  interactive?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function MapView({ focus, focusKey, focusY = 0.5, label, children, svgOverlay, className = '', interactive = true }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 700 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bound = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, Math.min(0, size.w - WORLD.width), 0),
      // Extra slack at the bottom so markers near the south edge can sit above a bottom sheet.
      y: clamp(y, Math.min(0, size.h - WORLD.height) - size.h * 0.4, 0),
    }),
    [size.w, size.h],
  );

  useLayoutEffect(() => {
    setOffset(bound(size.w / 2 - focus.x, size.h * focusY - focus.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, focus.x, focus.y, focusY, size.w, size.h]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      ref.current?.setPointerCapture(e.pointerId);
    }
    setOffset(bound(d.ox + dx, d.oy + dy));
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    suppressClick.current = d.moved;
    drag.current = null;
    setDragging(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || e.target !== e.currentTarget) return;
    const step = 80;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setOffset((o) => bound(o.x + m[0], o.y + m[1]));
  };

  useEffect(() => () => void (drag.current = null), []);

  return (
    <div
      ref={ref}
      className={`map-view ${dragging ? 'is-dragging' : ''} ${className}`}
      role="region"
      aria-label={interactive ? `${label}. Use arrow keys to pan the map.` : label}
      tabIndex={interactive ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation();
          e.preventDefault();
          suppressClick.current = false;
        }
      }}
    >
      <div className="map-layer" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`, width: WORLD.width, height: WORLD.height }}>
        <CityMap />
        {svgOverlay && (
          <svg className="map-overlay" width={WORLD.width} height={WORLD.height} viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} aria-hidden="true">
            {svgOverlay}
          </svg>
        )}
        {children}
      </div>
    </div>
  );
}

/** Absolutely positions its child at a world coordinate. */
export function At({ x, y, children, z = 1 }: { x: number; y: number; children: ReactNode; z?: number }) {
  return (
    <div className="map-at" style={{ left: x, top: y, zIndex: z }}>
      {children}
    </div>
  );
}

export function UserDot({ point, manual = false, label }: { point: Point; manual?: boolean; label: string }) {
  return (
    <At x={point.x} y={point.y} z={3}>
      {manual ? (
        <span className="manual-pin" role="img" aria-label={label}>
          <MapPin size={22} strokeWidth={2.4} aria-hidden="true" />
        </span>
      ) : (
        <span className="user-dot" role="img" aria-label={label}>
          <span className="user-dot-pulse" />
          <span className="user-dot-core" />
        </span>
      )}
    </At>
  );
}

export function ScooterMarker({ scooter, selected, meters, onSelect, dimmed, note }: { scooter: Scooter; selected: boolean; meters: number | null; onSelect: () => void; dimmed?: boolean; note?: string }) {
  const tone = batteryTone(scooter.battery);
  const where = meters != null ? `, ${Math.round(meters / 10) * 10} metres away` : '';
  return (
    <At x={scooter.x} y={scooter.y} z={selected ? 5 : 2}>
      <button
        type="button"
        className={`scooter-marker ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Scooty ${scooter.id}, ${scooter.battery}% battery, about ${scooter.rangeKm} km range${where}${note ? `, ${note}` : ''}`}
      >
        <span className="scooter-marker-body">
          <ScooterGlyph size={18} />
        </span>
        <span className={`scooter-marker-batt tone-${tone}`} aria-hidden="true">
          {scooter.battery}
        </span>
      </button>
    </At>
  );
}

/** Rental hubs: the only places a rental can start or end. `highlight` marks the booking’s return hub. */
export function HubZones({ highlight, alerts = {}, muteOthers = false, hubs = HUBS }: { highlight?: string | null; alerts?: Record<string, { kind: string }>; muteOthers?: boolean; hubs?: Hub[] }) {
  return (
    <g>
      {hubs.map((z) => {
        const on = z.id === highlight;
        return (
          <g key={z.id} className={`parking-zone ${on ? 'is-on' : ''} ${alerts[z.id] ? 'is-full' : ''} ${muteOthers && !on ? 'is-muted' : ''}`}>
            <rect x={z.x - z.w / 2} y={z.y - z.h / 2} width={z.w} height={z.h} rx={10} />
            <g transform={`translate(${z.x - z.w / 2 + 4} ${z.y - z.h / 2 - 10})`}>
              <rect width={20} height={20} rx={6} className="parking-zone-badge" />
              <text x={10} y={14.5} textAnchor="middle" className="parking-zone-p">
                H
              </text>
            </g>
            <text x={z.x} y={z.y + z.h / 2 + 15} textAnchor="middle" className="hub-name">
              {z.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function polylinePoints(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
