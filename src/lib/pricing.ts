/**
 * Single source of truth for every price, allowance and time rule in the prototype.
 *
 * Concept assumption: hourly, hub-based e-scooty rental. Every number below is an
 * ILLUSTRATIVE DEMO VALUE chosen for the prototype — not any operator's actual rate.
 * Amounts are stored in paise (₹1 = 100 paise) to avoid float drift.
 * Taxes are not modelled; their treatment needs confirming with a tax adviser.
 */
export const CURRENCY = 'INR';
export const RATES_NOTE = 'Illustrative prices. Taxes not shown.';

export interface Plan {
  hours: number;
  basePaise: number;
  includedKm: number;
}

/** Bookable durations. The base price covers the booked time and the included distance. */
export const PLANS: Plan[] = [
  { hours: 1, basePaise: 9900, includedKm: 15 },
  { hours: 2, basePaise: 17900, includedKm: 30 },
  { hours: 4, basePaise: 31900, includedKm: 50 },
  { hours: 8, basePaise: 54900, includedKm: 80 },
];
export const DEFAULT_HOURS = 2;

/** Late return: charged per started block after the booked time ends. No grace period. */
export const OVERTIME_BLOCK_MIN = 15;
export const OVERTIME_BLOCK_PAISE = 3000;
/** Distance beyond the plan’s allowance, charged per started km. */
export const EXCESS_KM_PAISE = 600;
/** Refundable deposit. Simulated: nothing is blocked or charged in the demo. */
export const DEPOSIT_PAISE = 50000;

/**
 * Reservation hold = estimated walk + a pickup buffer for collecting the helmet and doing
 * the pre-ride checks, kept between a floor and a ceiling. Holding is free.
 */
export const HOLD_BUFFER_MIN = 10;
export const HOLD_MIN_MIN = 10;
export const HOLD_MAX_MIN = 30;

/** Walking pace used for "x min walk" estimates. */
export const WALK_M_PER_MIN = 80;

const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(paise: number): string {
  return formatter.format(paise / 100);
}

export function planFor(hours: number): Plan {
  return PLANS.find((p) => p.hours === hours) ?? PLANS.find((p) => p.hours === DEFAULT_HOURS)!;
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

export function holdMinutesForWalk(meters: number): number {
  return Math.min(HOLD_MAX_MIN, Math.max(HOLD_MIN_MIN, walkMinutes(meters) + HOLD_BUFFER_MIN));
}

/** Started overtime blocks once `elapsedSec` passes the booked duration (1 s late = 1 block). */
export function overtimeBlocks(elapsedSec: number, hours: number): number {
  const late = elapsedSec - hours * 3600;
  return late > 0 ? Math.ceil(late / (OVERTIME_BLOCK_MIN * 60)) : 0;
}

/** Started km beyond the allowance (15.0 km on a 15 km plan = 0; 15.1 km = 1). */
export function excessKm(distanceKm: number, includedKm: number): number {
  // Bill from the same 0.1 km reading the rider sees, so "15.0 / 15 km" never costs extra.
  const over = Math.round((Math.round(distanceKm * 10) / 10 - includedKm) * 10) / 10;
  return over > 0 ? Math.ceil(over) : 0;
}

export interface RentalCharges {
  hours: number;
  includedKm: number;
  basePaise: number;
  overtimeBlocks: number;
  overtimePaise: number;
  excessKm: number;
  excessPaise: number;
  totalPaise: number;
}

/**
 * The booked base is charged in full; ending early doesn’t refund unused time.
 * `quote` overrides the plan's list price with the base and allowance the rider actually agreed to.
 */
export function chargesForRental(hours: number, elapsedSec: number, distanceKm: number, quote?: { basePaise: number; includedKm: number }): RentalCharges {
  const plan = { ...planFor(hours), ...quote };
  const blocks = overtimeBlocks(elapsedSec, plan.hours);
  const km = excessKm(distanceKm, plan.includedKm);
  const overtimePaise = blocks * OVERTIME_BLOCK_PAISE;
  const excessPaise = km * EXCESS_KM_PAISE;
  return {
    hours: plan.hours,
    includedKm: plan.includedKm,
    basePaise: plan.basePaise,
    overtimeBlocks: blocks,
    overtimePaise,
    excessKm: km,
    excessPaise,
    totalPaise: plan.basePaise + overtimePaise + excessPaise,
  };
}

/** Demo "price changed" scenario: list prices rise by this much between viewing and confirming. */
export const DEMO_PRICE_RISE_PAISE = 2000;

/** Simulated reminder window before the return deadline. */
export const REMINDER_MIN = 15;
/** Hold time left at which the pickup screens show a warning. */
export const HOLD_WARN_SEC = 180;

export const TAX_NOTE = 'Taxes not shown.';
export const DEPOSIT_NOTE = 'The deposit is held, not charged. Its release starts once the scooty is confirmed locked at the return hub; release timing isn’t fixed, so your rental summary shows it as pending.';

export const OVERTIME_LABEL = `${formatMoney(OVERTIME_BLOCK_PAISE)} per started ${OVERTIME_BLOCK_MIN} min late`;
export const EXCESS_LABEL = `${formatMoney(EXCESS_KM_PAISE)} per km over the included distance`;

export function formatHours(hours: number): string {
  return `${hours} hr${hours === 1 ? '' : 's'}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDurationWords(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min${sec ? ` ${String(sec).padStart(2, '0')} s` : ''}`;
  if (m === 0) return `${sec} s`;
  return `${m} min ${String(sec).padStart(2, '0')} s`;
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatKm(km: number, digits = 1): string {
  return `${km.toFixed(digits)} km`;
}

export function formatMeters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 10) * 10} m`;
}
