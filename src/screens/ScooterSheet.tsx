import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BadgeCheck, Check, ChevronRight, CircleDashed, Clock, Footprints, IdCard, Info, Loader2, Route as RouteIcon, ShieldX, Timer, TriangleAlert, Volume2, WifiOff, Wrench, X } from 'lucide-react';
import { BottomSheet, FootSummary, More, ReviewerNote, SimTag } from '../components/ui';
import { AssetImage } from '../components/AssetImage';
import { VEHICLE } from '../lib/images';
import { BatteryMeter } from '../components/BatteryMeter';
import { HUBS, distanceMeters, hubById, type Hub, type Scooter } from '../lib/data';
import { DEFAULT_HOURS, DEPOSIT_PAISE, EXCESS_KM_PAISE, OVERTIME_BLOCK_PAISE, PLANS, formatClock, formatHours, formatMeters, formatMoney, planFor, walkMinutes } from '../lib/pricing';
import { availableScooters, bookingBlock, listBase, pickupBlock, projectedDeadline, returnBlock, useNow, useStore, visibleScooters, type HubBlock } from '../state/store';

export function useRing(): ['idle' | 'ringing' | 'done', () => void] {
  const [state, setState] = useState<'idle' | 'ringing' | 'done'>('idle');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const ring = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setState('ringing');
    timers.current = [window.setTimeout(() => setState('done'), 2200), window.setTimeout(() => setState('idle'), 7000)];
  };
  return [state, ring];
}

export function RingButton({ scooterId, compact = false }: { scooterId: string; compact?: boolean }) {
  const [ring, doRing] = useRing();
  return (
    <div className={`ring ${compact ? 'is-compact' : ''}`}>
      <button type="button" className={`btn btn-secondary ${ring === 'ringing' ? 'is-ringing' : ''}`} onClick={doRing} disabled={ring === 'ringing'} aria-describedby={`ring-status-${scooterId}`}>
        <Volume2 size={18} aria-hidden="true" className="ring-icon" />
        {ring === 'ringing' ? 'Beeping…' : 'Beep to find it'}
      </button>
      <p id={`ring-status-${scooterId}`} className="ring-status" role="status" aria-live="polite">
        {ring === 'ringing' && `Beeping ${scooterId} — listen for two short beeps.`}
        {ring === 'done' && (
          <>
            <Check size={14} aria-hidden="true" /> {scooterId} beeped and flashed its indicators.
          </>
        )}
      </p>
    </div>
  );
}

export const MODEL = 'WAVO S2 e-scooty';

/** Locker stock is never promised: it was the count at the last stock check. */
export function helmetLine(hub: Hub | undefined): string {
  if (!hub) return '';
  return hub.helmets > 0
    ? `${hub.name} locker had ${hub.helmets} spare helmet${hub.helmets === 1 ? '' : 's'} at the last stock check. They aren’t reserved for you — bring your own if you can.`
    : `No locker helmets at ${hub.name} — bring your own. A rental can’t start without a fastened helmet.`;
}

export function hubBlockText(hub: Hub | undefined, block: HubBlock, purpose: 'pickup' | 'return'): string {
  if (!block || !hub) return '';
  if (block.reason === 'closed') return `${hub.name} is closed right now.`;
  if (block.reason === 'full') return `${hub.name} has no free return bays right now.`;
  return purpose === 'pickup' ? `${hub.name} closes at ${formatClock(block.closesAt)}, before your hold would end.` : `${hub.name} closes at ${formatClock(block.closesAt)}, before this rental could be due back.`;
}

interface Props {
  scooter: Scooter;
  step: 'overview' | 'setup';
  meters: number | null;
  reservedOther: string | null;
  isReserved: boolean;
  onClose: () => void;
  onSetup: () => void;
  onOverview: () => void;
  onOpen: (id: string, step?: 'setup') => void;
  onReview: () => void;
  onViewReservation: () => void;
  onSwitchHold: () => void;
  onHubHelp: () => void;
  onPolicy: () => void;
}

export function ScooterSheet(props: Props) {
  const { scooter, step } = props;
  const [expanded, setExpanded] = useState(step === 'setup');
  useEffect(() => setExpanded(step === 'setup'), [step]);
  return (
    <BottomSheet
      label={step === 'setup' ? `Set up rental of ${scooter.id}` : `Scooty ${scooter.id} details`}
      expanded={expanded}
      onExpandedChange={setExpanded}
      footer={step === 'setup' ? <SetupFooter {...props} /> : <OverviewFooter {...props} />}
      id="scooter-sheet"
    >
      {step === 'setup' ? <Setup {...props} /> : <Overview {...props} />}
    </BottomSheet>
  );
}

/* ───────────── Part 1: vehicle overview ───────────── */

function Overview({ scooter, meters, onClose, onOpen, onHubHelp, onPolicy }: Props) {
  const { state } = useStore();
  const now = useNow();
  const pickup = hubById(scooter.hubId);
  const walk = meters != null ? walkMinutes(meters) : null;
  const block = bookingBlock(state, scooter.id, now);
  const alert = pickup ? state.hubAlerts[pickup.id] : undefined;
  const sameHub = visibleScooters(state).filter((s) => s.hubId === scooter.hubId && s.id !== scooter.id);
  const alt = block ? bestAlternative(state, scooter, meters) : null;

  return (
    <>
      <header className="sd-head">
        <span className="sd-art-tile">
          <AssetImage asset={VEHICLE} className="sd-art" sizes="88px" />
        </span>
        <div className="sd-title">
          <h2 className="sd-model">
            WAVO S2 <span className="nowrap">e-scooty</span>
          </h2>
          <p className="sd-walk">
            {meters != null ? (
              <>
                <span className="nowrap">
                  <Footprints size={16} aria-hidden="true" /> {walk} min walk
                </span>
                <span className="nowrap">
                  <RouteIcon size={16} aria-hidden="true" /> ~{scooter.rangeKm} km range
                </span>
              </>
            ) : (
              <>
                <span className="nowrap">
                  <RouteIcon size={16} aria-hidden="true" /> ~{scooter.rangeKm} km range
                </span>
              </>
            )}
          </p>
          <p className="sd-spot">{scooter.id}</p>
        </div>
        <button type="button" className="icon-btn sd-close" onClick={onClose} aria-label="Close scooty details">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {block && (
        <div className="callout alert" role="status">
          {scooter.maintenance ? <Wrench size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
          <span>
            <strong>Can’t be booked.</strong> {block}
            {alt ? ` ${alt.id} at ${hubById(alt.hubId)?.name} is the closest alternative.` : ''}
          </span>
        </div>
      )}

      <dl className="facts">
        <div>
          <dt>Battery</dt>
          <dd>
            <BatteryMeter value={scooter.battery} />
          </dd>
        </div>
        <div>
          <dt>Pickup</dt>
          <dd>
            {pickup?.name} hub · {scooter.spot.replace(/ at .*$/, '')}
            <span className="facts-sub">
              {pickup?.landmark} · open {pickup?.open}
              {alert?.kind === 'closing' ? ` · closing early today at ${formatClock(alert.closesAt)}` : ''}
              {alert?.kind === 'closed' ? ' · closed right now' : ''}
            </span>
          </dd>
        </div>
        <div>
          <dt>Helmets</dt>
          <dd>
            {pickup?.helmets ? `${pickup.helmets} in the locker at the last check` : 'None in the locker — bring your own'}
            {!!pickup?.helmets && <span className="facts-sub">Not reserved for you. Bring your own if you can.</span>}
          </dd>
        </div>
      </dl>

      {sameHub.length > 0 && (
        <section className="same-hub" aria-labelledby="samehub-h">
          <h3 id="samehub-h" className="section-h">
            Also at this hub
          </h3>
          <ul className="chip-row">
            {sameHub.map((s) => (
              <li key={s.id}>
                <button type="button" className="chip" onClick={() => onOpen(s.id)}>
                  {s.id} · {s.maintenance ? 'maintenance' : `${s.battery}% · ~${s.rangeKm} km`}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sd-actions">
        {!block && <RingButton scooterId={scooter.id} />}
        <button type="button" className="link-row" onClick={onHubHelp}>
          <span>How hubs and returns work</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="link-row" onClick={onPolicy}>
          <span>Rental terms</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function bestAlternative(state: ReturnType<typeof useStore>['state'], scooter: Scooter, _meters: number | null, minRange = 0) {
  return (
    availableScooters(state)
      .filter((s) => s.id !== scooter.id && s.rangeKm >= minRange)
      // Same hub first, then the nearest hub, then the fullest battery.
      .sort((a, b) => Number(b.hubId === scooter.hubId) - Number(a.hubId === scooter.hubId) || distanceMeters(scooter, a) - distanceMeters(scooter, b) || b.rangeKm - a.rangeKm)[0] ?? null
  );
}

function OverviewFooter({ scooter, meters, isReserved, reservedOther, onSetup, onViewReservation, onSwitchHold, onOpen }: Props) {
  const { state } = useStore();
  const now = useNow();
  if (isReserved)
    return (
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onViewReservation}>
        <Timer size={20} aria-hidden="true" /> Resume your hold
      </button>
    );
  if (reservedOther)
    return (
      <div className="sheet-foot-note">
        <p>You already have {reservedOther} on hold. One booking at a time.</p>
        <div className="btn-stack">
          <button type="button" className="btn btn-primary btn-block" onClick={onViewReservation}>
            Resume {reservedOther}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onSwitchHold}>
            Cancel that hold and book {scooter.id}
          </button>
        </div>
      </div>
    );
  const block = bookingBlock(state, scooter.id, now);
  if (block) {
    const alt = bestAlternative(state, scooter, meters);
    return alt ? (
      <>
        <FootSummary>
          {hubById(alt.hubId)?.name} · ~{alt.rangeKm} km range
        </FootSummary>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => onOpen(alt.id)}>
          View {alt.id} instead
        </button>
      </>
    ) : (
      <p className="sheet-foot-note">No other scooty is available right now.</p>
    );
  }
  const plan = planFor(state.draft?.hours ?? DEFAULT_HOURS);
  return (
    <>
      <FootSummary>
        {formatHours(plan.hours)} from {formatMoney(listBase(state, plan.hours))} · Deposit hold {formatMoney(DEPOSIT_PAISE)}
      </FootSummary>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onSetup}>
        Set up rental
      </button>
    </>
  );
}

/* ───────────── Part 2: rental setup ───────────── */

function Setup({ scooter, onOverview, onOpen }: Props) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const draft = state.draft?.scooterId === scooter.id ? state.draft : null;
  const hours = draft?.hours ?? DEFAULT_HOURS;
  const plan = planFor(hours);
  const returnHubId = draft ? draft.returnHubId : scooter.hubId;
  const returnHub = hubById(returnHubId);
  const by = projectedDeadline(state, { scooterId: scooter.id, hours }, now);
  const returnBlocked = returnBlock(state, returnHubId, by);
  const tripKm = draft?.tripKm ?? null;
  const [tripText, setTripText] = useState(tripKm != null ? String(tripKm) : '');
  useEffect(() => setTripText(tripKm != null ? String(tripKm) : ''), [tripKm]);

  const rangeShort = tripKm != null && tripKm > scooter.rangeKm;
  const rangeTight = tripKm != null && !rangeShort && tripKm > scooter.rangeKm * 0.85;
  const overAllowance = tripKm != null && tripKm > plan.includedKm;
  const better = tripKm != null && (rangeShort || rangeTight) ? bestAlternative(state, scooter, null, Math.ceil(tripKm / 0.85)) : null;
  const longerPlan = overAllowance ? PLANS.find((p) => p.hours > hours && p.includedKm >= tripKm!) : null;

  const commitTrip = (text: string) => {
    const n = Number(text.replace(',', '.'));
    const km = text.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : Math.min(500, Math.round(n));
    dispatch({ type: 'UPDATE_DRAFT', patch: { tripKm: km } });
    setTripText(km != null ? String(km) : '');
  };

  return (
    <>
      <header className="setup-head">
        <button type="button" className="btn btn-ghost btn-back" onClick={onOverview}>
          <ArrowLeft size={18} aria-hidden="true" /> Details
        </button>
        <h2 className="screen-h">Set up rental</h2>
        <p className="muted">
          {scooter.id} · from {hubById(scooter.hubId)?.name}
        </p>
      </header>

      <section className="setup-sec" aria-labelledby="plan-h">
        <div className="sec-head">
          <h3 id="plan-h" className="sec-h">
            Duration
          </h3>
          <SimTag>Illustrative prices</SimTag>
        </div>
        <fieldset className="duration-grid">
          <legend className="sr-only">Duration</legend>
          {PLANS.map((p) => (
            <label key={p.hours} className={`duration-opt ${p.hours === hours ? 'is-on' : ''}`}>
              <input type="radio" name={`dur-${scooter.id}`} value={p.hours} checked={p.hours === hours} onChange={() => dispatch({ type: 'UPDATE_DRAFT', patch: { hours: p.hours } })} />
              <span className="dur-h">{formatHours(p.hours)}</span>
              <span className="dur-price tabular">{formatMoney(listBase(state, p.hours))}</span>
              <span className="dur-km">{p.includedKm} km incl.</span>
            </label>
          ))}
        </fieldset>
        <p className="fine">
          Each plan includes the distance shown. Over it: {formatMoney(EXCESS_KM_PAISE)} per started km. Late: {formatMoney(OVERTIME_BLOCK_PAISE)} per started 15 min.
        </p>
      </section>

      <section className="setup-sec" aria-labelledby="range-h">
        <p id="range-h" className="range-line">
          <RouteIcon size={18} aria-hidden="true" /> Estimated battery range: <strong>{scooter.rangeKm} km</strong>
        </p>
        {plan.includedKm > scooter.rangeKm && (
          <p className="inline-warn" role="note">
            <TriangleAlert size={16} aria-hidden="true" /> This plan includes {plan.includedKm} km, more than this battery’s estimated {scooter.rangeKm} km. Plan for less riding, or pick a fuller scooty.
          </p>
        )}
        <More summary="How range works">
          <p>Included km is part of the price, not a promise of battery range. Range is an estimate and varies with load, hills and speed. There’s no charging during a rental.</p>
        </More>
        <More summary="Check trip distance" open={tripKm != null}>
          <form
            className="trip-form"
            onSubmit={(e) => {
              e.preventDefault();
              commitTrip(tripText);
            }}
          >
            <label className="field">
              <span>Trip distance (optional)</span>
              <span className="input-suffix">
                <input inputMode="decimal" value={tripText} onChange={(e) => setTripText(e.target.value)} onBlur={() => commitTrip(tripText)} placeholder="e.g. 20" aria-describedby="trip-hint" />
                <span aria-hidden="true">km</span>
              </span>
            </label>
            <button type="submit" className="btn btn-secondary">
              Check
            </button>
          </form>
          <p id="trip-hint" className="fine">
            Only used to warn you about range and included distance.
          </p>
        </More>
        <div aria-live="polite">
          {rangeShort && (
            <div className="inline-warn">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>
                {tripKm} km is more than this scooty’s estimated {scooter.rangeKm} km.{' '}
                {better ? `${better.id} (~${better.rangeKm} km) is a better fit.` : 'No available scooty is estimated to cover that — plan a shorter trip.'}
              </span>
            </div>
          )}
          {rangeTight && (
            <div className="inline-warn">
              <Info size={16} aria-hidden="true" />
              <span>
                {tripKm} km is close to the estimated {scooter.rangeKm} km — little margin to get back to the hub.
                {better ? ` ${better.id} (~${better.rangeKm} km) has more charge.` : ''}
              </span>
            </div>
          )}
          {(rangeShort || rangeTight) && (
            <div className="btn-row">
              {better && (
                <button type="button" className="btn btn-secondary" onClick={() => onOpen(better.id, 'setup')}>
                  Switch to {better.id}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'UPDATE_DRAFT', patch: { tripKm: Math.floor(scooter.rangeKm * 0.8) } })}>
                Plan {Math.floor(scooter.rangeKm * 0.8)} km instead
              </button>
            </div>
          )}
          {overAllowance && !rangeShort && (
            <p className="fine">
              {tripKm} km is {tripKm! - plan.includedKm} km over the {plan.includedKm} km included — about {formatMoney((tripKm! - plan.includedKm) * EXCESS_KM_PAISE)} extra
              {longerPlan ? `, or choose ${formatHours(longerPlan.hours)} (${longerPlan.includedKm} km incl.).` : '.'}
            </p>
          )}
          {tripKm != null && !rangeShort && !rangeTight && !overAllowance && (
            <p className="fine">
              <Check size={14} aria-hidden="true" /> {tripKm} km fits the estimated range and the {plan.includedKm} km included.
            </p>
          )}
        </div>
      </section>

      <section className="setup-sec" aria-labelledby="return-h">
        <h3 id="return-h" className="sec-h">
          Return hub
        </h3>
        <label className="select-field">
          <span>The rental can only end at this hub</span>
          <select
            value={returnHubId ?? ''}
            aria-invalid={!returnHubId || !!returnBlocked}
            aria-describedby="return-err"
            onChange={(e) => dispatch({ type: 'UPDATE_DRAFT', patch: { returnHubId: e.target.value || null } })}
          >
            {!returnHubId && <option value="">Choose a return hub</option>}
            {HUBS.map((h) => {
              const b = returnBlock(state, h.id, by);
              return (
                <option key={h.id} value={h.id} disabled={!!b && h.id !== returnHubId}>
                  {h.name}
                  {h.id === scooter.hubId ? ' (same hub)' : ` · ${formatMeters(distanceMeters(scooter, h))}`}
                  {b ? ` — ${b.reason === 'closing' ? `closes ${formatClock(b.closesAt)}` : b.reason}` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <p id="return-err" className={returnBlocked || !returnHubId ? 'inline-error' : 'fine'} role={returnBlocked ? 'alert' : undefined}>
          {returnBlocked ? `${hubBlockText(returnHub, returnBlocked, 'return')} Choose another hub.` : !returnHubId ? 'Choose where you’ll return the scooty.' : `${returnHub?.landmark} · open ${returnHub?.open}`}
        </p>
      </section>

      <LicenceCard />
    </>
  );
}

export function LicenceCard() {
  const { state, dispatch } = useStore();
  const licence = state.licence;
  return (
    <section className="setup-sec licence-card" aria-labelledby="licence-h">
      <div className="sec-head">
        <h3 id="licence-h" className="sec-h">
          <IdCard size={18} aria-hidden="true" /> Licence check
        </h3>
        <SimTag />
      </div>
      <div id="licence-state" className={`licence-state is-${licence}`} role="status" aria-live="polite">
        {licence === 'unchecked' && <p>Needed once before your first booking.</p>}
        {licence === 'checking' && (
          <p>
            <Loader2 size={16} aria-hidden="true" className="spin" /> Checking…
          </p>
        )}
        {licence === 'verified' && (
          <p>
            <BadgeCheck size={16} aria-hidden="true" /> Eligible to book.
          </p>
        )}
        {licence === 'pending' && (
          <>
            <p>
              <Clock size={16} aria-hidden="true" /> <strong>Review in progress.</strong> You can set up the rental, but can’t confirm until it finishes.
            </p>
            <ol className="progress-steps" aria-label="Licence review progress">
              <li className="is-done">
                <Check size={14} aria-hidden="true" /> Details received
              </li>
              <li className="is-current">
                <CircleDashed size={14} aria-hidden="true" /> Manual review
              </li>
              <li>
                <CircleDashed size={14} aria-hidden="true" /> Decision
              </li>
            </ol>
          </>
        )}
        {licence === 'ineligible' && (
          <>
            <p>
              <ShieldX size={16} aria-hidden="true" /> <strong>Not eligible to book.</strong> We couldn’t match an active licence for this type of vehicle to your profile.
            </p>
            <p className="fine">Check your licence is current and covers two-wheelers, then contact rider support (simulated — no message is sent). You can still browse the map.</p>
          </>
        )}
        {licence === 'error' && (
          <p>
            <WifiOff size={16} aria-hidden="true" /> <strong>Couldn’t reach the check service.</strong> This isn’t a decision about your eligibility. Try again.
          </p>
        )}
      </div>
      {(licence === 'unchecked' || licence === 'error') && (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: 'CHECK_LICENCE' })}>
          {licence === 'error' ? 'Try again' : 'Check my licence'}
        </button>
      )}
      {licence === 'pending' && (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: 'CHECK_LICENCE' })}>
          Refresh status
        </button>
      )}
      <More summary="What this check does">
        <p>It’s simulated: no licence number, photo or document is collected, and no licence is verified. It’s done once per visit; changing scooty won’t repeat it.</p>
      </More>
      <ReviewerNote>Outcomes (pending, ineligible, service error) are set in the Booking scenarios.</ReviewerNote>
    </section>
  );
}

function SetupFooter({ scooter, onReview }: Props) {
  const { state } = useStore();
  const now = useNow();
  const [error, setError] = useState<string | null>(null);
  const draft = state.draft?.scooterId === scooter.id ? state.draft : null;
  const hours = draft?.hours ?? DEFAULT_HOURS;
  const base = listBase(state, hours);
  const by = projectedDeadline(state, { scooterId: scooter.id, hours }, now);
  const block = bookingBlock(state, scooter.id, now) ?? (pickupBlock(state, scooter.hubId, now) ? 'Pickup hub unavailable.' : null);
  useEffect(() => setError(null), [state.licence, draft?.returnHubId]);

  const review = () => {
    const problem = block
      ? block
      : !draft?.returnHubId
        ? 'Choose a return hub first.'
        : returnBlock(state, draft.returnHubId, by)
          ? 'Your return hub can’t take this rental — choose another.'
          : state.licence === 'pending'
            ? 'Your licence review is still in progress. You can confirm once it’s finished.'
            : state.licence === 'ineligible'
              ? 'Booking is blocked: the licence check didn’t pass.'
              : state.licence !== 'verified'
                ? 'Check your licence before reviewing.'
                : null;
    if (problem) {
      setError(problem);
      window.setTimeout(() => document.getElementById(problem.includes('licence') ? 'licence-h' : 'return-h')?.scrollIntoView({ block: 'center' }), 50);
      return;
    }
    onReview();
  };

  return (
    <>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <FootSummary>
        Rental {formatMoney(base)} · Deposit hold {formatMoney(DEPOSIT_PAISE)}
      </FootSummary>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={review}>
        Review booking
      </button>
    </>
  );
}
