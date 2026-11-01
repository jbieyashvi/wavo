/**
 * Fictional demo area: Sarovar Layout, Nilapur — an illustrative Indian-city neighbourhood.
 * Every hub, street, landmark and vehicle here is made up for the prototype.
 * Coordinates are map units (1 unit = 2 m) inside a 900 × 1100 world.
 */
export const WORLD = { width: 900, height: 1100 };
export const METERS_PER_UNIT = 2;
export const AREA_NAME = 'Sarovar Layout';
export const CITY_NAME = 'Nilapur';

export interface Point {
  x: number;
  y: number;
}

export interface Hub extends Point {
  id: string;
  name: string;
  landmark: string;
  w: number;
  h: number;
  /** Return bays at the hub. */
  spaces: number;
  /** Spare helmets in the hub locker (simulated stock). */
  helmets: number;
  /** How to find the bays once you're there. */
  access: string;
  /** Opening hours shown to riders (simulated). Live closures come from the demo menu. */
  open: string;
}

export const HUBS: Hub[] = [
  { id: 'h-park', name: 'Kamal Park Gate', landmark: 'South gate of Kamal Park, Lake Road', x: 392, y: 770, w: 76, h: 32, spaces: 12, helmets: 4, access: 'Bays are just inside the south gate, left of the guard booth. Helmet locker on the booth wall.', open: '6 am – 11 pm' },
  { id: 'h-bazaar', name: 'Phool Bazaar', landmark: 'Market lane off Bazaar Road', x: 690, y: 600, w: 80, h: 34, spaces: 18, helmets: 6, access: 'Turn into the market lane from Bazaar Road; the bays are under the green canopy.', open: '7 am – 10 pm' },
  { id: 'h-metro', name: 'Sarovar Metro', landmark: 'Exit B, Ghat Road', x: 616, y: 960, w: 84, h: 34, spaces: 24, helmets: 8, access: 'Use Exit B. The bays are on the Ghat Road side, past the auto stand — not on the kerb.', open: '5:30 am – 11:30 pm' },
  { id: 'h-library', name: 'City Library', landmark: 'Library forecourt, Temple Street', x: 214, y: 572, w: 76, h: 32, spaces: 10, helmets: 2, access: 'Enter the forecourt from Temple Street; bays line the right-hand wall.', open: '8 am – 9 pm' },
  { id: 'h-ghat', name: 'Old Ghat', landmark: 'Riverside steps, Ghat Road', x: 160, y: 960, w: 76, h: 32, spaces: 8, helmets: 0, access: 'Bays are at the top of the riverside steps, beside the tea stall. No helmet locker here.', open: '6 am – 10 pm' },
];

export interface Scooter extends Point {
  id: string;
  hubId: string;
  battery: number; // percent
  rangeKm: number;
  spot: string; // where it is parked, used in walking hints
  /** Set when the vehicle is out of service; it shows on the map but can't be booked. */
  maintenance?: string;
}

export const SCOOTERS: Scooter[] = [
  { id: 'WV-2481', hubId: 'h-park', x: 374, y: 772, battery: 82, rangeKm: 66, spot: 'Bay 1 at Kamal Park Gate hub' },
  { id: 'WV-0874', hubId: 'h-park', x: 412, y: 772, battery: 91, rangeKm: 73, spot: 'Bay 3 at Kamal Park Gate hub' },
  { id: 'WV-1307', hubId: 'h-bazaar', x: 670, y: 602, battery: 64, rangeKm: 51, spot: 'Bay 2 at Phool Bazaar hub' },
  { id: 'WV-6640', hubId: 'h-bazaar', x: 710, y: 602, battery: 73, rangeKm: 58, spot: 'Bay 5 at Phool Bazaar hub' },
  { id: 'WV-3920', hubId: 'h-metro', x: 594, y: 962, battery: 47, rangeKm: 38, spot: 'Bay 4 at Sarovar Metro hub' },
  { id: 'WV-4096', hubId: 'h-metro', x: 638, y: 962, battery: 58, rangeKm: 46, spot: 'Bay 7 at Sarovar Metro hub' },
  { id: 'WV-5512', hubId: 'h-library', x: 214, y: 574, battery: 12, rangeKm: 9, spot: 'Bay 1 at City Library hub' },
  { id: 'WV-7215', hubId: 'h-ghat', x: 160, y: 962, battery: 22, rangeKm: 17, spot: 'Bay 2 at Old Ghat hub' },
  { id: 'WV-3388', hubId: 'h-library', x: 240, y: 574, battery: 88, rangeKm: 70, spot: 'Bay 4 at City Library hub', maintenance: 'Brake service in progress' },
];

export interface Place extends Point {
  id: string;
  name: string;
  kind: 'park' | 'landmark' | 'transit' | 'district';
}

export const PLACES: Place[] = [
  { id: 'kamal', name: 'Kamal Park', x: 448, y: 660, kind: 'park' },
  { id: 'bazaar', name: 'Phool Bazaar', x: 682, y: 650, kind: 'landmark' },
  { id: 'metro', name: 'Sarovar Metro', x: 616, y: 1010, kind: 'transit' },
  { id: 'library', name: 'City Library', x: 214, y: 528, kind: 'landmark' },
  { id: 'garden', name: 'Nakshatra Garden', x: 842, y: 214, kind: 'park' },
  { id: 'ghat', name: 'Old Ghat', x: 66, y: 1030, kind: 'landmark' },
  { id: 'uttar', name: 'Uttar Nagar', x: 450, y: 196, kind: 'district' },
  { id: 'setu', name: 'Purana Setu', x: 330, y: 456, kind: 'landmark' },
];

/** Areas offered when location access is declined. */
export const MANUAL_AREAS: (Point & { id: string; name: string; hint: string })[] = [
  { id: 'a-park', name: 'Kamal Park South', hint: 'Park gate, Lake Road', x: 470, y: 792 },
  { id: 'a-bazaar', name: 'Phool Bazaar', hint: 'Market lane, Bazaar Road', x: 660, y: 640 },
  { id: 'a-metro', name: 'Sarovar Metro', hint: 'Metro exit B, Ghat Road', x: 590, y: 930 },
  { id: 'a-library', name: 'City Library', hint: 'Library steps, Temple Street', x: 230, y: 610 },
];

/** Simulated device position for "Use demo location". */
export const DEMO_LOCATION: Point = { x: 470, y: 792 };

/** Places the demo "simulate riding" control can move the rider to, besides the hubs. */
export const OFF_HUB_SPOTS: (Point & { id: string; name: string })[] = [
  { id: 'o-lake', name: 'Station Road, between hubs (no hub here)', x: 560, y: 860 },
  { id: 'o-metro-kerb', name: 'Kerbside outside Sarovar Metro hub', x: 520, y: 960 },
  { id: 'o-park-edge', name: 'Edge of Kamal Park Gate hub (position unclear)', x: 436, y: 770 },
];

/** Simulated position for the "outside the service area" demo scenario; it isn't on the demo map. */
export const OUTSIDE_AREA = { name: 'Kanakpura Road', kmToNearestHub: 8.4 };

/** A hub "contains" a point inside its marked rectangle plus a small GPS tolerance (20 m). */
const HUB_TOLERANCE = 10;
export function hubContains(hub: Hub, p: Point): boolean {
  return Math.abs(p.x - hub.x) <= hub.w / 2 + HUB_TOLERANCE && Math.abs(p.y - hub.y) <= hub.h / 2 + HUB_TOLERANCE;
}

/** Inside the marked bays, in the GPS-tolerance band around them (can't be sure), or clearly outside. */
export function hubPlacement(hub: Hub, p: Point): 'inside' | 'edge' | 'outside' {
  const dx = Math.abs(p.x - hub.x);
  const dy = Math.abs(p.y - hub.y);
  if (dx <= hub.w / 2 && dy <= hub.h / 2) return 'inside';
  return hubContains(hub, p) ? 'edge' : 'outside';
}

export function hubAt(p: Point): Hub | undefined {
  return HUBS.find((h) => hubContains(h, p));
}

export function distanceMeters(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_UNIT;
}

/** Simulated street route: along the current street, then turn once. */
export function streetRoute(a: Point, b: Point): Point[] {
  return [a, { x: b.x, y: a.y }, b];
}

export function routeKm(points: Point[]): number {
  let units = 0;
  for (let i = 1; i < points.length; i++) units += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return (units * METERS_PER_UNIT) / 1000;
}

export function hubById(id: string | null | undefined): Hub | undefined {
  return HUBS.find((h) => h.id === id);
}

export function scooterById(id: string | null | undefined): Scooter | undefined {
  return SCOOTERS.find((s) => s.id === id);
}

export function batteryTone(battery: number): 'good' | 'mid' | 'low' {
  if (battery >= 50) return 'good';
  if (battery >= 20) return 'mid';
  return 'low';
}
