import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEMO_LOCATION, HUBS, MANUAL_AREAS, SCOOTERS, distanceMeters, hubAt, hubById, hubPlacement, routeKm, scooterById, streetRoute, type Hub, type Point } from '../lib/data';
import { DEFAULT_HOURS, DEMO_PRICE_RISE_PAISE, DEPOSIT_PAISE, PLANS, chargesForRental, holdMinutesForWalk, planFor, type RentalCharges } from '../lib/pricing';

/*
 * The rental lifecycle lives here and only here. Screens read state and dispatch intents;
 * the reducer refuses any transition the current state doesn't allow, so stale screens,
 * repeated taps, refreshes and Back can't create impossible combinations:
 *
 *   draft ─RESERVE→ reservation(hold) ─identify→ checks ─pay→ unlock ─→ ride
 *   ride ─RETURN_REQUEST→ return pending (billing stopped) ─lock confirmed→ receipt
 *
 * Slow simulated services (licence check, payment, unlock, lock) are modelled as explicit
 * in-flight statuses. A timer in the provider resolves them; a refresh mid-flight turns them
 * into "unknown — check status" rather than guessing an outcome.
 */

export type Screen = 'welcome' | 'map' | 'review' | 'reservation' | 'unlock' | 'ride' | 'endRide' | 'receipt';

export interface Route {
  screen: Screen;
  /** Scooter whose sheet is open on the map. */
  scooterId?: string;
  /** Which part of the map sheet is showing. */
  step?: 'setup';
}

export type LocationState =
  | { status: 'unknown' }
  | { status: 'granted' }
  | { status: 'denied' }
  | { status: 'outside' }
  | { status: 'manual'; areaId: string };

/** Simulated eligibility only — no licence details or documents are ever collected. */
export type LicenceStatus = 'unchecked' | 'checking' | 'verified' | 'pending' | 'ineligible' | 'error';
export type PaymentMethod = 'upi' | 'card';

export interface Scenarios {
  noScooters: boolean;
  scooterTaken: boolean;
  priceChange: boolean;
  licence: 'ok' | 'pending' | 'ineligible' | 'error';
  payment: 'ok' | 'fail' | 'pending' | 'cancel';
  scannerUnavailable: boolean;
  unlock: 'ok' | 'fail' | 'timeout' | 'uncertain';
  returnNetwork: boolean;
  lock: 'ok' | 'fail' | 'uncertain';
  cameraUnavailable: boolean;
}

export type HubAlert = { kind: 'full' } | { kind: 'closed' } | { kind: 'closing'; closesAt: number };

/** What the rider is choosing on the map sheet and review screen, before anything is held. */
export interface Draft {
  scooterId: string;
  hours: number;
  /** Null when the previous choice stopped being valid and the rider must pick again. */
  returnHubId: string | null;
  /** Optional planned distance, only used to warn about range and allowance. */
  tripKm: number | null;
  payment: PaymentMethod;
}

export interface Booking {
  ref: string;
  scooterId: string;
  hours: number;
  /** Price and allowance the rider confirmed — later list-price changes don't apply. */
  basePaise: number;
  includedKm: number;
  pickupHubId: string;
  returnHubId: string;
  payment: PaymentMethod;
}

export type PaymentStatus = 'none' | 'processing' | 'pending' | 'checking' | 'failed' | 'cancelled' | 'authorised';
export type UnlockStatus = 'locked' | 'unlocking' | 'checking' | 'failed' | 'timeout';

export interface Reservation extends Booking {
  createdAt: number;
  expiresAt: number;
  holdMin: number;
  /** The rider scanned or typed this vehicle's code. A different code never gets here. */
  identified: boolean;
  checks: string[];
  /** Cosmetic damage the rider logged; kept apart from the safety checks. */
  cosmetic: string[];
  checksDone: boolean;
  payStatus: PaymentStatus;
  unlock: UnlockStatus;
}

export type LockStatus = 'locking' | 'checking' | 'uncertain' | 'failed' | 'network';

export interface ReturnProgress {
  photo: 'none' | 'taken' | 'assisted';
  helmet: 'none' | 'returned' | 'own';
  /** First time the rider asked to end; billing stops here exactly once. */
  requestedAt: number | null;
  lock: LockStatus | null;
  attempts: number;
}

export interface Ride extends Booking {
  startedAt: number;
  /** Extra seconds added by the demo time controls. */
  offsetSec: number;
  /** Simulated rider position. Only the labelled demo movement control changes it. */
  at: Point;
  trail: Point[];
  distanceKm: number;
  changedFromHubId: string | null;
  extendedFromHours: number | null;
  breakdownAt: number | null;
  ret: ReturnProgress;
}

export interface Receipt extends Booking {
  startedAt: number;
  requestedAt: number;
  endedAt: number;
  durationSec: number;
  distanceKm: number;
  charges: RentalCharges;
  depositPaise: number;
  /**
   * Proposed policy: after a confirmed lock the deposit release is requested ("release pending");
   * if the lock was never confirmed it stays held until the scooty check completes. No timing is promised.
   */
  deposit: 'releasePending' | 'heldForCheck';
  /** Whether the vehicle is known to be secured. Billing can be final while this is still pending. */
  security: 'locked' | 'checkPending';
  rating: number | null;
  issue: string | null;
  changedFromHubId: string | null;
  extendedFromHours: number | null;
  closedBy: 'lock' | 'assistance';
  /** Billing stopped at a breakdown report rather than a return request. */
  breakdown: boolean;
  photo: ReturnProgress['photo'];
  endPoint: Point;
}

export interface DamageReport {
  scooterId: string;
  items: string[];
  unsafe: boolean;
  at: number;
}

export interface AppState {
  route: Route;
  location: LocationState;
  scenarios: Scenarios;
  licence: LicenceStatus;
  licenceChecks: number;
  /** Simulated list-price change applied by the demo. */
  priceRisePaise: number;
  unavailable: string[];
  draft: Draft | null;
  reservation: Reservation | null;
  /** A reservation that ended without a rental, so the UI can explain why. */
  endedReservation: { scooterId: string; holdMin: number; reason: 'expired' | 'unsafe' | 'unlockFailed'; payStatus: PaymentStatus } | null;
  ride: Ride | null;
  receipt: Receipt | null;
  hubAlerts: Record<string, HubAlert>;
  damageReports: DamageReport[];
}

export const NO_SCENARIOS: Scenarios = {
  noScooters: false,
  scooterTaken: false,
  priceChange: false,
  licence: 'ok',
  payment: 'ok',
  scannerUnavailable: false,
  unlock: 'ok',
  returnNetwork: false,
  lock: 'ok',
  cameraUnavailable: false,
};

export const initialState: AppState = {
  route: { screen: 'welcome' },
  location: { status: 'unknown' },
  scenarios: NO_SCENARIOS,
  licence: 'unchecked',
  licenceChecks: 0,
  priceRisePaise: 0,
  unavailable: [],
  draft: null,
  reservation: null,
  endedReservation: null,
  ride: null,
  receipt: null,
  hubAlerts: {},
  damageReports: [],
};

export type Action =
  | { type: 'ROUTE'; route: Route }
  | { type: 'SET_LOCATION'; location: LocationState }
  | { type: 'SET_SCENARIO'; patch: Partial<Scenarios> }
  | { type: 'SET_HUB_ALERT'; hubId: string; alert: HubAlert | null }
  | { type: 'CHECK_LICENCE' }
  | { type: 'MARK_UNAVAILABLE'; scooterId: string }
  | { type: 'SELECT_SCOOTER'; scooterId: string }
  | { type: 'UPDATE_DRAFT'; patch: Partial<Omit<Draft, 'scooterId'>> }
  | { type: 'APPLY_PRICE_CHANGE' }
  | { type: 'RESERVE'; now: number; scooterId?: string; quotedBasePaise: number }
  | { type: 'CANCEL_RESERVATION' }
  | { type: 'EXPIRE_RESERVATION'; now: number }
  | { type: 'CLEAR_ENDED' }
  | { type: 'IDENTIFY'; scooterId: string }
  | { type: 'TOGGLE_CHECK'; id: string }
  | { type: 'LOG_COSMETIC'; items: string[]; now: number }
  | { type: 'REPORT_UNSAFE'; items: string[]; now: number }
  | { type: 'CONFIRM_CHECKS' }
  | { type: 'PAY'; now: number }
  | { type: 'CANCEL_PAYMENT' }
  | { type: 'CHECK_PAYMENT' }
  | { type: 'UNLOCK'; now: number }
  | { type: 'UNLOCK_FAILED_RELEASE' }
  | { type: 'SIM_RESOLVE'; op: SimOp['kind']; now: number }
  | { type: 'MOVE_RIDER'; to: Point }
  | { type: 'ADD_DISTANCE'; km: number }
  | { type: 'SET_DISTANCE'; km: number }
  | { type: 'FAST_FORWARD'; seconds: number }
  | { type: 'SET_ELAPSED'; seconds: number; now: number }
  | { type: 'REASSIGN_RETURN'; hubId: string; now: number }
  | { type: 'EXTEND'; hours: number; now: number }
  | { type: 'REPORT_BREAKDOWN'; now: number }
  | { type: 'RETURN_PHOTO'; photo: ReturnProgress['photo'] }
  | { type: 'RETURN_HELMET'; helmet: ReturnProgress['helmet'] }
  | { type: 'RETURN_REQUEST'; now: number }
  | { type: 'LOCK_RETRY' }
  | { type: 'LOCK_STATUS' }
  | { type: 'ASSISTED_CLOSE'; now: number }
  | { type: 'RATE'; rating: number }
  | { type: 'REPORT_CHARGE_ISSUE'; reason: string }
  | { type: 'RESET' };

/* ───────────────────────── Rules shared by screens and the reducer ───────────────────────── */

/** Pre-ride checklist, grouped. The helmet line depends on what the pickup hub stocks. */
export function pickupChecks(hub: Hub | undefined) {
  return [
    {
      group: 'Vehicle condition',
      items: [
        { id: 'brakes', label: 'Both brakes grip firmly when squeezed' },
        { id: 'tyres', label: 'Tyres look inflated, with no cuts or bulges' },
        { id: 'lights', label: 'Headlight, brake light, indicators and horn work' },
        { id: 'mirrors', label: 'Both mirrors are fitted and adjusted' },
      ],
    },
    {
      group: 'Helmet & readiness',
      items: [
        hub && hub.helmets > 0
          ? { id: 'helmet', label: 'I’m wearing a fastened helmet — from the hub locker or my own' }
          : { id: 'helmet', label: 'I’m wearing my own fastened helmet (this hub has no locker helmets)' },
        { id: 'licence', label: 'I’m carrying my driving licence' },
        { id: 'route', label: 'I know my return hub and deadline' },
      ],
    },
  ];
}

export function checkIds(hub: Hub | undefined): string[] {
  return pickupChecks(hub).flatMap((g) => g.items.map((i) => i.id));
}

export function listBase(state: Pick<AppState, 'priceRisePaise'>, hours: number): number {
  return planFor(hours).basePaise + state.priceRisePaise;
}

export function holdMinutesFor(state: Pick<AppState, 'location'>, scooterId: string): number {
  const scooter = scooterById(scooterId);
  const from = userPosition(state.location) ?? DEMO_LOCATION;
  return holdMinutesForWalk(scooter ? distanceMeters(from, scooter) : 0);
}

export type HubBlock = { reason: 'closed' } | { reason: 'full' } | { reason: 'closing'; closesAt: number } | null;

/** Can this hub take a return by `by` (a timestamp)? Closing counts if it shuts before then. */
export function returnBlock(state: Pick<AppState, 'hubAlerts'>, hubId: string | null | undefined, by: number): HubBlock {
  const a = hubId ? state.hubAlerts[hubId] : undefined;
  if (!a) return null;
  if (a.kind === 'closed') return { reason: 'closed' };
  if (a.kind === 'full') return { reason: 'full' };
  return a.closesAt < by ? { reason: 'closing', closesAt: a.closesAt } : null;
}

/** Can a scooty be collected from this hub before the hold would end? */
export function pickupBlock(state: Pick<AppState, 'hubAlerts'>, hubId: string, by: number): HubBlock {
  const b = returnBlock(state, hubId, by);
  return b?.reason === 'full' ? null : b;
}

/** Latest a rental booked now could be due back: full hold, then the whole duration. */
export function projectedDeadline(state: Pick<AppState, 'location'>, draft: Pick<Draft, 'scooterId' | 'hours'>, now: number): number {
  return now + holdMinutesFor(state, draft.scooterId) * 60_000 + draft.hours * 3_600_000;
}

export type ReturnCheck =
  | { ok: true; hub: Hub }
  | { ok: false; reason: 'blocked'; designated: Hub; block: NonNullable<HubBlock> }
  | { ok: false; reason: 'outside'; designated: Hub; meters: number }
  | { ok: false; reason: 'edge'; designated: Hub }
  | { ok: false; reason: 'wrongHub'; designated: Hub; at: Hub; meters: number };

/**
 * The one return rule, checked on the end-rental screen and again inside the reducer on
 * confirmation: only the booking’s return hub counts, it must be able to take the scooty,
 * and the rider’s simulated position must be clearly inside its bays.
 */
export function checkReturn(state: Pick<AppState, 'ride' | 'hubAlerts'>, now: number): ReturnCheck | null {
  const ride = state.ride;
  const designated = hubById(ride?.returnHubId);
  if (!ride || !designated) return null;
  const block = returnBlock(state, designated.id, now);
  if (block) return { ok: false, reason: 'blocked', designated, block };
  const placement = hubPlacement(designated, ride.at);
  if (placement === 'inside') return { ok: true, hub: designated };
  if (placement === 'edge') return { ok: false, reason: 'edge', designated };
  const at = hubAt(ride.at);
  const meters = distanceMeters(ride.at, designated);
  if (at && at.id !== designated.id) return { ok: false, reason: 'wrongHub', designated, at, meters };
  return { ok: false, reason: 'outside', designated, meters };
}

/** Hubs the rider may switch their return to, nearest first, with why others are excluded. */
export function reassignOptions(state: Pick<AppState, 'ride' | 'hubAlerts'>, now: number) {
  const ride = state.ride;
  if (!ride) return [];
  const deadline = rideDeadline(ride);
  return HUBS.filter((h) => h.id !== ride.returnHubId)
    .map((h) => ({ hub: h, meters: distanceMeters(ride.at, h), block: returnBlock(state, h.id, Math.max(now, deadline)) }))
    .sort((a, b) => a.meters - b.meters);
}

/** Booking extension (demo policy): move up to a longer plan before the deadline, paying the difference. */
export function extensionOptions(state: Pick<AppState, 'ride' | 'hubAlerts'>, now: number) {
  const ride = state.ride;
  if (!ride) return { options: [], unavailable: 'No active rental.' };
  if (ride.ret.requestedAt) return { options: [], unavailable: 'Your return is already in progress.' };
  if (ride.breakdownAt) return { options: [], unavailable: 'Extensions aren’t offered after a breakdown report.' };
  const elapsed = rideElapsed(ride, now);
  if (elapsed >= ride.hours * 3600) return { options: [], unavailable: 'Extensions have to be requested before the return deadline. Overtime is charged instead.' };
  const current = planFor(ride.hours);
  const longer = PLANS.filter((p) => p.hours > ride.hours);
  if (!longer.length) return { options: [], unavailable: `${ride.hours} hours is the longest rental available.` };
  const options = longer.map((p) => {
    const newDeadline = ride.startedAt - ride.offsetSec * 1000 + p.hours * 3_600_000;
    return { plan: p, extraPaise: p.basePaise - current.basePaise, newDeadline, extraKm: p.includedKm - current.includedKm, block: returnBlock(state, ride.returnHubId, newDeadline) };
  });
  return { options, unavailable: null };
}

export function rideElapsed(ride: Ride, now: number): number {
  return Math.max(0, (now - ride.startedAt) / 1000 + ride.offsetSec);
}

/** When billing stopped (return requested or breakdown reported), if it has. */
export function billingStop(ride: Ride): number | null {
  const stops = [ride.ret.requestedAt, ride.breakdownAt].filter((t): t is number => t != null);
  return stops.length ? Math.min(...stops) : null;
}

/** Elapsed time that counts for charges: the clock stops once, at the first billing stop. */
export function billedElapsed(ride: Ride, now: number): number {
  const stop = billingStop(ride);
  return rideElapsed(ride, stop != null ? Math.min(now, stop) : now);
}

export function rideCharges(ride: Ride, now: number): RentalCharges {
  return chargesForRental(ride.hours, billedElapsed(ride, now), ride.distanceKm, { basePaise: ride.basePaise, includedKm: ride.includedKm });
}

/** Wall-clock time the booked duration ends, including demo time shifts. */
export function rideDeadline(ride: Ride): number {
  return ride.startedAt - ride.offsetSec * 1000 + ride.hours * 3_600_000;
}

export function userPosition(location: LocationState): Point | null {
  if (location.status === 'granted') return DEMO_LOCATION;
  if (location.status === 'manual') {
    const area = MANUAL_AREAS.find((a) => a.id === location.areaId);
    return area ? { x: area.x, y: area.y } : null;
  }
  return null;
}

/** Vehicles that could be booked right now. Maintenance, withdrawn and closed-hub vehicles are excluded. */
export function availableScooters(state: AppState, now = Date.now()) {
  if (state.scenarios.noScooters || state.location.status === 'outside') return [];
  return SCOOTERS.filter((s) => !s.maintenance && !state.unavailable.includes(s.id) && s.id !== state.ride?.scooterId && !pickupBlock(state, s.hubId, now + holdMinutesFor(state, s.id) * 60_000));
}

/** Vehicles drawn on the map, including ones that can't be booked (shown with the reason). */
export function visibleScooters(state: AppState) {
  if (state.scenarios.noScooters || state.location.status === 'outside') return [];
  return SCOOTERS.filter((s) => !state.unavailable.includes(s.id) && s.id !== state.ride?.scooterId);
}

/** Why a specific vehicle can't be booked, or null if it can. */
export function bookingBlock(state: AppState, scooterId: string, now = Date.now()): string | null {
  const s = scooterById(scooterId);
  if (!s) return 'This scooty isn’t part of the WAVO fleet.';
  if (s.maintenance) return `In maintenance — ${s.maintenance.toLowerCase()}. It can’t be booked.`;
  if (state.unavailable.includes(s.id) || state.scenarios.noScooters) return 'No longer available — someone else booked it or it was withdrawn.';
  const hub = hubById(s.hubId);
  const block = pickupBlock(state, s.hubId, now + holdMinutesFor(state, s.id) * 60_000);
  if (block?.reason === 'closed') return `${hub?.name} hub is closed, so pickups there are paused.`;
  if (block?.reason === 'closing') return `${hub?.name} hub closes before you could collect it.`;
  return null;
}

function makeRef(now: number): string {
  return `B-${(now % 1_000_000).toString(36).toUpperCase().padStart(4, '0')}`;
}

/** Keep the visible screen consistent with the rental lifecycle, whatever history says. */
export function resolveRoute(state: AppState, wanted: Route): Route {
  if (state.ride) {
    // Once a return is requested the rider stays on the return screen until it is confirmed.
    if (state.ride.ret.requestedAt) return { screen: 'endRide' };
    return wanted.screen === 'endRide' ? wanted : { screen: 'ride' };
  }
  switch (wanted.screen) {
    case 'review':
      if (state.reservation) return { screen: 'reservation' };
      return state.draft && state.draft.returnHubId && state.licence === 'verified' ? wanted : { screen: 'map', scooterId: state.draft?.scooterId, step: state.draft ? 'setup' : undefined };
    case 'reservation':
      return state.reservation || state.endedReservation ? wanted : { screen: 'map' };
    case 'unlock':
      if (state.reservation) return wanted;
      return state.endedReservation ? { screen: 'reservation' } : { screen: 'map' };
    case 'ride':
    case 'endRide':
      return state.receipt ? { screen: 'receipt' } : { screen: 'map' };
    case 'receipt':
      return state.receipt ? wanted : { screen: 'map' };
    default:
      return wanted;
  }
}

/* ───────────────────────────────────────── Reducer ───────────────────────────────────────── */

function endReservation(state: AppState, reason: NonNullable<AppState['endedReservation']>['reason']): AppState {
  const r = state.reservation;
  if (!r) return state;
  return { ...state, reservation: null, endedReservation: { scooterId: r.scooterId, holdMin: r.holdMin, reason, payStatus: r.payStatus } };
}

function startRide(state: AppState, now: number): AppState {
  const r = state.reservation;
  const scooter = scooterById(r?.scooterId);
  // Belt and braces: every precondition is re-checked, not assumed from the screen.
  if (!r || !scooter || state.ride || !r.identified || !r.checksDone || r.payStatus !== 'authorised') return state;
  const at = { x: scooter.x, y: scooter.y };
  const { createdAt: _c, expiresAt: _e, holdMin: _h, identified: _i, checks: _k, cosmetic: _m, checksDone: _d, payStatus: _p, unlock: _u, ...booking } = r;
  return {
    ...state,
    reservation: null,
    endedReservation: null,
    draft: null,
    receipt: null,
    ride: { ...booking, startedAt: now, offsetSec: 0, at, trail: [at], distanceKm: 0, changedFromHubId: null, extendedFromHours: null, breakdownAt: null, ret: { photo: 'none', helmet: 'none', requestedAt: null, lock: null, attempts: 0 } },
  };
}

function completeRide(state: AppState, now: number, closedBy: Receipt['closedBy']): AppState {
  const ride = state.ride;
  if (!ride) return state;
  const stop = billingStop(ride) ?? now;
  const durationSec = billedElapsed(ride, stop);
  const { startedAt, offsetSec: _o, at, trail: _t, distanceKm, changedFromHubId, extendedFromHours, breakdownAt, ret, ...booking } = ride;
  const hubAlerts = Object.fromEntries(Object.entries(state.hubAlerts).filter(([, a]) => a.kind !== 'full'));
  return {
    ...state,
    ride: null,
    // "Hub full" is a per-rental demo condition; closures stay until the demo clears them.
    hubAlerts,
    receipt: {
      ...booking,
      startedAt,
      requestedAt: stop,
      endedAt: now,
      durationSec,
      distanceKm,
      charges: rideCharges(ride, stop),
      depositPaise: DEPOSIT_PAISE,
      deposit: closedBy === 'lock' ? 'releasePending' : 'heldForCheck',
      security: closedBy === 'lock' ? 'locked' : 'checkPending',
      rating: null,
      issue: null,
      changedFromHubId,
      extendedFromHours,
      closedBy,
      breakdown: breakdownAt != null,
      photo: ret.photo,
      endPoint: at,
    },
  };
}

function patchReservation(state: AppState, patch: Partial<Reservation>): AppState {
  return state.reservation ? { ...state, reservation: { ...state.reservation, ...patch } } : state;
}

function patchRet(state: AppState, patch: Partial<ReturnProgress>): AppState {
  return state.ride ? { ...state, ride: { ...state.ride, ret: { ...state.ride.ret, ...patch } } } : state;
}

export function resolveSim(state: AppState, op: SimOp['kind'], now: number): AppState {
  const sc = state.scenarios;
  const once = (patch: Partial<Scenarios>) => ({ ...sc, ...patch });
  switch (op) {
    case 'licence': {
      if (state.licence !== 'checking') return state;
      const checks = state.licenceChecks + 1;
      if (sc.licence === 'error') return { ...state, licence: 'error', licenceChecks: checks, scenarios: once({ licence: 'ok' }) };
      if (sc.licence === 'ineligible') return { ...state, licence: 'ineligible', licenceChecks: checks };
      // A pending review completes on the next status check (demo).
      if (sc.licence === 'pending') return checks >= 2 ? { ...state, licence: 'verified', licenceChecks: checks, scenarios: once({ licence: 'ok' }) } : { ...state, licence: 'pending', licenceChecks: checks };
      return { ...state, licence: 'verified', licenceChecks: checks };
    }
    case 'payment': {
      const p = state.reservation?.payStatus;
      // No reservation (e.g. the hold expired) means nothing to confirm — never a false success.
      if (p === 'checking') return patchReservation(state, { payStatus: 'authorised' });
      if (p !== 'processing') return state;
      if (sc.payment === 'fail') return { ...patchReservation(state, { payStatus: 'failed' }), scenarios: once({ payment: 'ok' }) };
      if (sc.payment === 'cancel') return { ...patchReservation(state, { payStatus: 'cancelled' }), scenarios: once({ payment: 'ok' }) };
      if (sc.payment === 'pending') return { ...patchReservation(state, { payStatus: 'pending' }), scenarios: once({ payment: 'ok' }) };
      return patchReservation(state, { payStatus: 'authorised' });
    }
    case 'unlock': {
      const u = state.reservation?.unlock;
      // A status check honours an armed failure, so "uncertain → did not unlock" can be demoed.
      if (u === 'checking') return sc.unlock === 'fail' ? { ...patchReservation(state, { unlock: 'failed' }), scenarios: once({ unlock: 'ok' }) } : startRide(state, now);
      if (u !== 'unlocking') return state;
      if (sc.unlock === 'fail') return { ...patchReservation(state, { unlock: 'failed' }), scenarios: once({ unlock: 'ok' }) };
      if (sc.unlock === 'timeout') return { ...patchReservation(state, { unlock: 'timeout' }), scenarios: once({ unlock: 'ok' }) };
      if (sc.unlock === 'uncertain') return { ...patchReservation(state, { unlock: 'checking' }), scenarios: once({ unlock: 'ok' }) };
      return startRide(state, now);
    }
    case 'lock': {
      const l = state.ride?.ret.lock;
      if (l === 'checking') return sc.lock === 'fail' ? { ...patchRet(state, { lock: 'failed' }), scenarios: once({ lock: 'ok' }) } : completeRide(state, now, 'lock');
      if (l !== 'locking') return state;
      if (sc.returnNetwork) return { ...patchRet(state, { lock: 'network' }), scenarios: once({ returnNetwork: false }) };
      if (sc.lock === 'fail') return { ...patchRet(state, { lock: 'failed' }), scenarios: once({ lock: 'ok' }) };
      if (sc.lock === 'uncertain') return { ...patchRet(state, { lock: 'uncertain' }), scenarios: once({ lock: 'ok' }) };
      return completeRide(state, now, 'lock');
    }
    default:
      return state;
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ROUTE':
      return { ...state, route: resolveRoute(state, action.route) };
    case 'SET_LOCATION':
      return { ...state, location: action.location };
    case 'SET_SCENARIO': {
      const next = { ...state, scenarios: { ...state.scenarios, ...action.patch } };
      // Changing the eligibility scenario invalidates the previous simulated check.
      return 'licence' in action.patch ? { ...next, licence: 'unchecked', licenceChecks: 0 } : next;
    }
    case 'SET_HUB_ALERT': {
      const hubAlerts = { ...state.hubAlerts };
      if (action.alert) hubAlerts[action.hubId] = action.alert;
      else delete hubAlerts[action.hubId];
      return { ...state, hubAlerts };
    }
    case 'CHECK_LICENCE':
      return state.licence === 'checking' || state.licence === 'verified' ? state : { ...state, licence: 'checking' };
    case 'MARK_UNAVAILABLE':
      return state.unavailable.includes(action.scooterId) ? state : { ...state, unavailable: [...state.unavailable, action.scooterId] };
    case 'SELECT_SCOOTER': {
      const scooter = scooterById(action.scooterId);
      if (!scooter || state.reservation || state.ride || state.draft?.scooterId === scooter.id) return state;
      // The rider's choices carry over to the new vehicle; licence status is per rider, so it isn't rechecked.
      const d = state.draft;
      return { ...state, draft: { scooterId: scooter.id, hours: d?.hours ?? DEFAULT_HOURS, returnHubId: d ? d.returnHubId : scooter.hubId, tripKm: d?.tripKm ?? null, payment: d?.payment ?? 'upi' } };
    }
    case 'UPDATE_DRAFT':
      return state.draft && !state.reservation ? { ...state, draft: { ...state.draft, ...action.patch } } : state;
    case 'APPLY_PRICE_CHANGE':
      return { ...state, priceRisePaise: state.priceRisePaise + DEMO_PRICE_RISE_PAISE, scenarios: { ...state.scenarios, priceChange: false } };
    case 'RESERVE': {
      // Guards make repeated taps, double submits and stale history entries harmless.
      if (state.reservation || state.ride || state.licence !== 'verified' || !state.draft || !state.draft.returnHubId) return state;
      const draft = action.scooterId ? { ...state.draft, scooterId: action.scooterId } : state.draft;
      const scooter = scooterById(draft.scooterId);
      if (!scooter || bookingBlock(state, scooter.id, action.now)) return state;
      // The price the rider saw must still be the price; otherwise the screen has to reconfirm.
      if (action.quotedBasePaise !== listBase(state, draft.hours)) return state;
      if (returnBlock(state, draft.returnHubId, projectedDeadline(state, draft, action.now))) return state;
      const holdMin = holdMinutesFor(state, scooter.id);
      return {
        ...state,
        draft,
        endedReservation: null,
        reservation: {
          ref: makeRef(action.now),
          scooterId: scooter.id,
          hours: draft.hours,
          basePaise: action.quotedBasePaise,
          includedKm: planFor(draft.hours).includedKm,
          pickupHubId: scooter.hubId,
          returnHubId: draft.returnHubId!,
          payment: draft.payment,
          createdAt: action.now,
          holdMin,
          expiresAt: action.now + holdMin * 60_000,
          identified: false,
          checks: [],
          cosmetic: [],
          checksDone: false,
          payStatus: 'none',
          unlock: 'locked',
        },
      };
    }
    case 'CANCEL_RESERVATION': {
      const u = state.reservation?.unlock;
      // While the vehicle may be unlocking, cancelling could strand an open scooty.
      if (u === 'unlocking' || u === 'checking') return state;
      return { ...state, reservation: null, endedReservation: null };
    }
    case 'EXPIRE_RESERVATION': {
      const r = state.reservation;
      if (!r || r.expiresAt > action.now || r.unlock === 'unlocking' || r.unlock === 'checking') return state;
      return endReservation(state, 'expired');
    }
    case 'CLEAR_ENDED':
      return { ...state, endedReservation: null };
    case 'IDENTIFY':
      return state.reservation && action.scooterId === state.reservation.scooterId ? patchReservation(state, { identified: true }) : state;
    case 'TOGGLE_CHECK': {
      const r = state.reservation;
      if (!r || r.checksDone) return state;
      return patchReservation(state, { checks: r.checks.includes(action.id) ? r.checks.filter((c) => c !== action.id) : [...r.checks, action.id] });
    }
    case 'LOG_COSMETIC': {
      const r = state.reservation;
      if (!r || !action.items.length) return state;
      const next = patchReservation(state, { cosmetic: [...new Set([...r.cosmetic, ...action.items])] });
      return { ...next, damageReports: [...state.damageReports, { scooterId: r.scooterId, items: action.items, unsafe: false, at: action.now }] };
    }
    case 'REPORT_UNSAFE': {
      const r = state.reservation;
      if (!r || r.unlock !== 'locked') return state;
      // An unsafe vehicle is withdrawn and the hold (and any payment authorisation) released at no charge.
      const next = endReservation({ ...state, damageReports: [...state.damageReports, { scooterId: r.scooterId, items: action.items, unsafe: true, at: action.now }] }, 'unsafe');
      return { ...next, unavailable: [...state.unavailable, r.scooterId] };
    }
    case 'CONFIRM_CHECKS': {
      const r = state.reservation;
      if (!r || !r.identified) return state;
      const all = checkIds(hubById(r.pickupHubId)).every((id) => r.checks.includes(id));
      return all ? patchReservation(state, { checksDone: true }) : state;
    }
    case 'PAY': {
      const r = state.reservation;
      // One payment attempt at a time; never after authorisation, never on an expired hold.
      if (!r || !r.checksDone || r.expiresAt <= action.now || !['none', 'failed', 'cancelled'].includes(r.payStatus)) return state;
      return patchReservation(state, { payStatus: 'processing' });
    }
    case 'CANCEL_PAYMENT':
      return state.reservation?.payStatus === 'processing' ? patchReservation(state, { payStatus: 'cancelled' }) : state;
    case 'CHECK_PAYMENT':
      return state.reservation?.payStatus === 'pending' ? patchReservation(state, { payStatus: 'checking' }) : state;
    case 'UNLOCK': {
      const r = state.reservation;
      if (!r || !r.identified || !r.checksDone || r.payStatus !== 'authorised' || r.expiresAt <= action.now) return state;
      if (r.unlock !== 'locked' && r.unlock !== 'failed' && r.unlock !== 'timeout') return state;
      return patchReservation(state, { unlock: 'unlocking' });
    }
    case 'UNLOCK_FAILED_RELEASE': {
      const r = state.reservation;
      return r && (r.unlock === 'failed' || r.unlock === 'timeout') ? endReservation(state, 'unlockFailed') : state;
    }
    case 'SIM_RESOLVE':
      return resolveSim(state, action.op, action.now);
    case 'MOVE_RIDER': {
      const ride = state.ride;
      if (!ride || ride.ret.requestedAt) return state;
      const leg = streetRoute(ride.at, action.to);
      return { ...state, ride: { ...ride, at: action.to, trail: [...ride.trail, ...leg.slice(1)], distanceKm: ride.distanceKm + routeKm(leg) } };
    }
    case 'ADD_DISTANCE':
      return state.ride && !state.ride.ret.requestedAt ? { ...state, ride: { ...state.ride, distanceKm: state.ride.distanceKm + action.km } } : state;
    case 'SET_DISTANCE':
      return state.ride && !state.ride.ret.requestedAt ? { ...state, ride: { ...state.ride, distanceKm: action.km } } : state;
    case 'FAST_FORWARD':
      return state.ride ? { ...state, ride: { ...state.ride, offsetSec: state.ride.offsetSec + action.seconds } } : state;
    case 'SET_ELAPSED':
      return state.ride ? { ...state, ride: { ...state.ride, offsetSec: action.seconds - (action.now - state.ride.startedAt) / 1000 } } : state;
    case 'REASSIGN_RETURN': {
      const ride = state.ride;
      const hub = hubById(action.hubId);
      if (!ride || !hub || ride.ret.requestedAt || action.hubId === ride.returnHubId) return state;
      if (returnBlock(state, hub.id, Math.max(action.now, rideDeadline(ride)))) return state;
      return { ...state, ride: { ...ride, returnHubId: hub.id, changedFromHubId: ride.changedFromHubId ?? ride.returnHubId } };
    }
    case 'EXTEND': {
      const opt = extensionOptions(state, action.now).options.find((o) => o.plan.hours === action.hours);
      const ride = state.ride;
      if (!ride || !opt || opt.block) return state;
      return { ...state, ride: { ...ride, hours: opt.plan.hours, basePaise: ride.basePaise + opt.extraPaise, includedKm: opt.plan.includedKm, extendedFromHours: ride.extendedFromHours ?? ride.hours } };
    }
    case 'REPORT_BREAKDOWN':
      return state.ride && !state.ride.breakdownAt && !state.ride.ret.requestedAt ? { ...state, ride: { ...state.ride, breakdownAt: action.now } } : state;
    case 'RETURN_PHOTO':
      return state.ride && !state.ride.ret.requestedAt ? patchRet(state, { photo: action.photo }) : state;
    case 'RETURN_HELMET':
      return state.ride && !state.ride.ret.requestedAt ? patchRet(state, { helmet: action.helmet }) : state;
    case 'RETURN_REQUEST': {
      const ride = state.ride;
      // Revalidate everything at the moment of confirming, whatever the screen showed.
      if (!ride || ride.ret.requestedAt || ride.ret.photo === 'none' || ride.ret.helmet === 'none' || !checkReturn(state, action.now)?.ok) return state;
      return patchRet(state, { requestedAt: action.now, lock: 'locking', attempts: 1 });
    }
    case 'LOCK_RETRY': {
      const ret = state.ride?.ret;
      return ret?.requestedAt && (ret.lock === 'failed' || ret.lock === 'network') ? patchRet(state, { lock: 'locking', attempts: ret.attempts + 1 }) : state;
    }
    case 'LOCK_STATUS':
      return state.ride?.ret.lock === 'uncertain' ? patchRet(state, { lock: 'checking' }) : state;
    case 'ASSISTED_CLOSE': {
      const ride = state.ride;
      // Simulated support closes a rental that can't end normally: a stuck lock or a breakdown.
      if (!ride || !(ride.breakdownAt || (ride.ret.requestedAt && ride.ret.lock !== 'locking' && ride.ret.lock !== 'checking'))) return state;
      return completeRide(state, action.now, 'assistance');
    }
    case 'RATE':
      return state.receipt ? { ...state, receipt: { ...state.receipt, rating: action.rating } } : state;
    case 'REPORT_CHARGE_ISSUE':
      return state.receipt && !state.receipt.issue ? { ...state, receipt: { ...state.receipt, issue: action.reason } } : state;
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

/* ─────────────────────────────── Simulated services (timers) ─────────────────────────────── */

type SimOp = { kind: 'licence' | 'payment' | 'unlock' | 'lock'; key: string; ms: number };

/** The one in-flight simulated call, if any. Only one can be in flight in this flow. */
function pendingSim(state: AppState): SimOp | null {
  if (state.licence === 'checking') return { kind: 'licence', key: `licence:${state.licenceChecks}`, ms: 900 };
  const r = state.reservation;
  if (r?.payStatus === 'processing' || r?.payStatus === 'checking') return { kind: 'payment', key: `pay:${r.ref}:${r.payStatus}`, ms: r.payStatus === 'processing' ? 1600 : 1100 };
  if (r?.unlock === 'unlocking' || r?.unlock === 'checking') return { kind: 'unlock', key: `unlock:${r.ref}:${r.unlock}`, ms: r.unlock === 'unlocking' ? 1500 : 2200 };
  const ret = state.ride?.ret;
  if (ret?.lock === 'locking' || ret?.lock === 'checking') return { kind: 'lock', key: `lock:${ret.attempts}:${ret.lock}`, ms: ret.lock === 'locking' ? 1400 : 1100 };
  return null;
}

/* ─────────────────────────────────────── Persistence ─────────────────────────────────────── */

const STORAGE_KEY = 'wavo-state-v4';

/**
 * Restore after a refresh. Calls that were in flight have an unknown outcome, so they become
 * "check status" states instead of being replayed or assumed to have succeeded.
 */
export function loadState(): AppState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    let s: AppState = { ...initialState, ...parsed, scenarios: { ...NO_SCENARIOS, ...parsed.scenarios } };
    if (s.licence === 'checking') s = { ...s, licence: 'unchecked' };
    const r = s.reservation;
    if (r) {
      const payStatus = r.payStatus === 'processing' || r.payStatus === 'checking' ? 'pending' : r.payStatus;
      const unlock = r.unlock === 'unlocking' ? 'checking' : r.unlock;
      s = { ...s, reservation: { ...r, payStatus, unlock } };
      s = reducer(s, { type: 'EXPIRE_RESERVATION', now: Date.now() });
    }
    const ret = s.ride?.ret;
    if (s.ride && ret?.lock === 'locking') s = { ...s, ride: { ...s.ride, ret: { ...ret, lock: 'uncertain' } } };
    return { ...s, route: resolveRoute(s, s.route) };
  } catch {
    return initialState;
  }
}

const REVIEWER_KEY = 'wavo-reviewer';

/** Reviewer mode shows the scenario menu and simulation notes. Off by default; `?reviewer=1` turns it on. */
function readReviewer(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('reviewer');
    if (q === '1' || q === '0') sessionStorage.setItem(REVIEWER_KEY, q);
    return sessionStorage.getItem(REVIEWER_KEY) === '1';
  } catch {
    return false;
  }
}

interface Store {
  state: AppState;
  reviewer: boolean;
  setReviewer: (on: boolean) => void;
  navigate: (route: Route, opts?: { replace?: boolean }) => void;
  back: () => void;
  dispatch: React.Dispatch<Action>;
  announce: (message: string) => void;
  toast: string | null;
}

const StoreContext = createContext<Store | null>(null);

function sameRoute(a: Route | undefined, b: Route): boolean {
  return !!a && a.screen === b.screen && a.scooterId === b.scooterId && a.step === b.step;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const [reviewer, setReviewerState] = useState(readReviewer);

  const setReviewer = useCallback((on: boolean) => {
    setReviewerState(on);
    try {
      sessionStorage.setItem(REVIEWER_KEY, on ? '1' : '0');
    } catch {
      /* not persisted — fine */
    }
    // Leaving reviewer mode disarms every scenario so the customer flow behaves normally.
    if (!on) dispatch({ type: 'SET_SCENARIO', patch: NO_SCENARIOS });
  }, []);

  // Persist so a refresh keeps the reservation / ride / receipt in progress.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — state simply won't survive a refresh */
    }
  }, [state]);

  // Browser history: seed the current entry and listen for back/forward.
  useEffect(() => {
    window.history.replaceState({ route: state.route }, '');
    const onPop = (e: PopStateEvent) => {
      const route = (e.state?.route as Route | undefined) ?? { screen: 'welcome' };
      dispatch({ type: 'ROUTE', route });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State can change underneath the current screen (e.g. a hold expires mid-unlock).
  useEffect(() => {
    const resolved = resolveRoute(state, state.route);
    if (!sameRoute(resolved, state.route)) dispatch({ type: 'ROUTE', route: resolved });
  }, [state]);

  // If the guard redirected (e.g. back into a finished ride), keep history in sync.
  useEffect(() => {
    if (!sameRoute(window.history.state?.route, state.route)) {
      window.history.replaceState({ route: state.route }, '');
    }
  }, [state.route]);

  // Reservation expiry: a single timeout. It is re-armed when the reservation changes, so an
  // expiry deferred during an in-flight unlock fires as soon as that unlock fails.
  useEffect(() => {
    const r = state.reservation;
    if (!r) return;
    const id = window.setTimeout(() => dispatch({ type: 'EXPIRE_RESERVATION', now: Date.now() }), Math.max(0, r.expiresAt - Date.now()) + 50);
    return () => window.clearTimeout(id);
  }, [state.reservation]);

  // Resolve whichever simulated call is in flight.
  const sim = pendingSim(state);
  useEffect(() => {
    if (!sim) return;
    const id = window.setTimeout(() => dispatch({ type: 'SIM_RESOLVE', op: sim.kind, now: Date.now() }), sim.ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim?.key]);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const navigate = useCallback((route: Route, opts?: { replace?: boolean }) => {
    if (opts?.replace) window.history.replaceState({ route }, '');
    else window.history.pushState({ route }, '');
    dispatch({ type: 'ROUTE', route });
  }, []);

  const back = useCallback(() => window.history.back(), []);

  const value = useMemo(() => ({ state, reviewer, setReviewer, navigate, back, dispatch, announce, toast }), [state, reviewer, setReviewer, navigate, back, announce, toast]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Re-renders every `intervalMs` while `active`; the interval is cleared on unmount. */
export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
