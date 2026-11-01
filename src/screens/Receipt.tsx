import { useId, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock3, Flag, Map, Star } from 'lucide-react';
import { Dialog, More, ReviewerNote } from '../components/ui';
import { CityMap } from '../components/CityMap';
import { WORLD, hubById, type Point } from '../lib/data';
import { DEPOSIT_NOTE, OVERTIME_BLOCK_MIN, RATES_NOTE, formatClock, formatDurationWords, formatHours, formatKm, formatMoney } from '../lib/pricing';
import { useStore } from '../state/store';

/** Width ÷ height of the receipt map frame (.rc-map: full card width × 210px on a ~340px column). */
const MAP_ASPECT = 340 / 210;

const ISSUE_REASONS = ['Late-return charge looks wrong', 'Distance looks wrong', 'I returned it but was charged for longer', 'Something else'];

/** Cropped map with labelled pick-up and return markers. No route is drawn — none was tracked. */
function LocationMap({ pickup, ret, end }: { pickup: Point & { name: string }; ret: Point & { name: string }; end: Point | null }) {
  const pts = [pickup, ret, ...(end ? [end] : [])];
  // Wide side padding leaves room for the marker labels; the label sits above each marker.
  let minX = Math.min(...pts.map((p) => p.x)) - 170;
  let maxX = Math.max(...pts.map((p) => p.x)) + 170;
  let minY = Math.min(...pts.map((p) => p.y)) - 70;
  let maxY = Math.max(...pts.map((p) => p.y)) + 50;
  // Keep a readable minimum area, then match the frame's aspect ratio so nothing is cropped.
  const grow = (lo: number, hi: number, min: number): [number, number] => (hi - lo >= min ? [lo, hi] : [lo - (min - (hi - lo)) / 2, hi + (min - (hi - lo)) / 2]);
  [minX, maxX] = grow(minX, maxX, 380);
  [minY, maxY] = grow(minY, maxY, 240);
  [minX, maxX] = grow(minX, maxX, (maxY - minY) * MAP_ASPECT);
  [minY, maxY] = grow(minY, maxY, (maxX - minX) / MAP_ASPECT);
  // Shift (not shrink) the box back inside the drawn map where it fits.
  const clamp = (lo: number, size: number, world: number) => (size >= world ? lo : Math.max(0, Math.min(lo, world - size)));
  const w = maxX - minX;
  const h = maxY - minY;
  minX = clamp(minX, w, WORLD.width);
  minY = clamp(minY, h, WORLD.height);
  maxX = minX + w;
  maxY = minY + h;
  const marker = (p: Point, label: string, kind: 'pickup' | 'return' | 'end', letter: string) => (
    <g className={`rc-marker is-${kind}`}>
      <circle cx={p.x} cy={p.y} r={13} />
      <text x={p.x} y={p.y + 4.5} textAnchor="middle" className="rc-marker-letter">
        {letter}
      </text>
      <text x={p.x} y={p.y - 20} textAnchor="middle" className="rc-marker-label">
        {label}
      </text>
    </g>
  );
  const same = pickup.x === ret.x && pickup.y === ret.y;
  return (
    <svg className="route-preview" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={same ? `Map: picked up and returned at ${ret.name}` : `Map: picked up at ${pickup.name}, returned at ${ret.name}. Route not shown.`}>
      <CityMap />
      {!same && marker(pickup, `Pick-up · ${pickup.name}`, 'pickup', 'P')}
      {end && marker(end, 'Ended here', 'end', 'E')}
      {marker(ret, same ? `Pick-up & return · ${ret.name}` : `Return · ${ret.name}`, 'return', 'R')}
    </svg>
  );
}

export function Receipt() {
  const { state, navigate, dispatch, announce } = useStore();
  const r = state.receipt;
  const ratingId = useId();
  const [issueOpen, setIssueOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [ratingDone, setRatingDone] = useState(false);
  if (!r) return null;
  const pickup = hubById(r.pickupHubId)!;
  const returned = hubById(r.returnHubId)!;
  const c = r.charges;
  const locked = r.security === 'locked';
  const endedAway = r.closedBy === 'assistance' && Math.hypot(r.endPoint.x - returned.x, r.endPoint.y - returned.y) > 40;

  const newRental = () => {
    const location = state.location;
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_LOCATION', location });
    navigate({ screen: 'map' }, { replace: true });
  };

  return (
    <main className="screen receipt" aria-labelledby="rc-title">
      <div className="page-scroll">
        <header className="rc-head">
          <span className={`rc-check ${locked ? '' : 'is-pending'}`}>
            {locked ? <CheckCircle2 size={30} aria-hidden="true" /> : <Clock3 size={30} aria-hidden="true" />}
          </span>
          <h1 id="rc-title" className="display">
            Rental summary
          </h1>
          <p className={`rc-status ${locked ? 'is-ok' : 'is-pending'}`} role="status">
            {locked ? 'Scooty locked · return confirmed' : 'Billing closed · scooty check pending'}
          </p>
          <p className="muted">
            {r.scooterId} · booking {r.ref} · {new Date(r.endedAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
          {!locked && (
            <p className="fine">
              {r.breakdown ? 'Closed with assistance after your breakdown report.' : 'The lock couldn’t be confirmed, so the rental was closed with assistance.'} The scooty still needs to be checked at the hub; your deposit stays held until then. Assistance is simulated — nobody was contacted.
            </p>
          )}
        </header>

        <ReviewerNote>{locked ? 'Closed by a confirmed lock.' : 'Closed by the assisted-close path; security = checkPending, deposit = heldForCheck.'}</ReviewerNote>

        <section className="setup-sec" aria-labelledby="rc-charges">
          <h2 id="rc-charges" className="sec-h">
            Charges
          </h2>
          <dl className="lines">
            <div>
              <dt>
                Rental · {formatHours(c.hours)}, {c.includedKm} km included
              </dt>
              <dd className="tabular">{formatMoney(c.basePaise)}</dd>
            </div>
            {c.overtimePaise > 0 && (
              <div>
                <dt>
                  Late return · {c.overtimeBlocks} × {OVERTIME_BLOCK_MIN} min
                </dt>
                <dd className="tabular">{formatMoney(c.overtimePaise)}</dd>
              </div>
            )}
            {c.excessPaise > 0 && (
              <div>
                <dt>Extra distance · {c.excessKm} km</dt>
                <dd className="tabular">{formatMoney(c.excessPaise)}</dd>
              </div>
            )}
            <div className="total">
              <dt>Total charged</dt>
              <dd className="tabular">{formatMoney(c.totalPaise)}</dd>
            </div>
          </dl>
          <dl className="lines rc-deposit">
            <div>
              <dt>{r.deposit === 'releasePending' ? 'Deposit hold · release pending' : 'Deposit hold · kept until scooty check'}</dt>
              <dd className="tabular">{formatMoney(r.depositPaise)}</dd>
            </div>
          </dl>
          <p className="fine">
            {r.deposit === 'releasePending' ? DEPOSIT_NOTE : 'The deposit is held, not charged. Its release can start once the scooty check is complete; no release time is set yet.'} Paid with {r.payment === 'upi' ? 'UPI' : 'card'} — simulated, no money moved.
          </p>
          <More summary="Charge details">
            <dl className="lines is-rates">
              {c.overtimePaise === 0 && (
                <div>
                  <dt>Late return</dt>
                  <dd className="tabular">{formatMoney(0)}</dd>
                </div>
              )}
              {c.excessPaise === 0 && (
                <div>
                  <dt>Extra distance · {c.excessKm} km</dt>
                  <dd className="tabular">{formatMoney(0)}</dd>
                </div>
              )}
            </dl>
            <p>
              Billing stopped {r.breakdown ? 'at your breakdown report' : 'when your return request was accepted'}. Late time is counted in started {OVERTIME_BLOCK_MIN}-minute blocks; extra km in started km from the 0.1 km reading. {RATES_NOTE}
            </p>
          </More>
          {r.extendedFromHours && <p className="fine">Extended from {formatHours(r.extendedFromHours)} during the rental; the rental line is the longer plan.</p>}
          {r.changedFromHubId && <p className="fine">Return hub changed from {hubById(r.changedFromHubId)?.name} to {returned.name} — no fee.</p>}
          {r.photo === 'assisted' && <p className="fine">No return photo — an assisted check was requested instead.</p>}
          {r.issue ? (
            <p className="callout ok" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>Issue noted: “{r.issue}”. Reporting is simulated — nothing was sent and nobody will reply.</span>
            </p>
          ) : (
            <button type="button" className="link-row" onClick={() => setIssueOpen(true)}>
              <span>
                <Flag size={16} aria-hidden="true" /> Report an issue with this charge
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </section>

        <section className="setup-sec" aria-labelledby="rc-return">
          <h2 id="rc-return" className="sec-h">
            Return
          </h2>
          <dl className="facts is-flat">
            <div>
              <dt>{locked ? 'Lock confirmed' : 'Closed with assistance'}</dt>
              <dd className="tabular">
                {formatClock(r.endedAt)} · {returned.name}
              </dd>
            </div>
            <div>
              <dt>{r.breakdown ? 'Breakdown reported' : 'Return requested'}</dt>
              <dd className="tabular">{formatClock(r.requestedAt)}</dd>
            </div>
            <div>
              <dt>Time billed</dt>
              <dd className="tabular">{formatDurationWords(r.durationSec)}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd className="tabular">{formatKm(r.distanceKm)}</dd>
            </div>
          </dl>
          <div className="rc-map">
            <LocationMap pickup={pickup} ret={returned} end={endedAway ? r.endPoint : null} />
          </div>
        </section>

        {!ratingDone ? (
          <fieldset className="rating setup-sec">
            <legend id={ratingId}>
              How was your rental? <span className="muted">Optional</span>
            </legend>
            <div className="stars" role="radiogroup" aria-labelledby={ratingId}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={`star ${r.rating != null && n <= r.rating ? 'is-on' : ''}`}>
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={r.rating === n}
                    onChange={() => {
                      dispatch({ type: 'RATE', rating: n });
                      announce('Thanks for the rating');
                    }}
                  />
                  <Star size={30} aria-hidden="true" />
                  <span className="sr-only">
                    {n} star{n > 1 ? 's' : ''}
                  </span>
                </label>
              ))}
            </div>
            {r.rating != null ? (
              <p className="fine" role="status">
                Thanks — saved on this device for this visit only.
              </p>
            ) : (
              <button type="button" className="link-btn" onClick={() => setRatingDone(true)}>
                Skip rating
              </button>
            )}
          </fieldset>
        ) : (
          <p className="fine">Rating skipped.</p>
        )}
      </div>
      <div className="page-foot">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={newRental}>
          <Map size={20} aria-hidden="true" />
          Start a new rental
        </button>
      </div>

      {issueOpen && (
        <Dialog
          title="Report an issue with this charge"
          icon={<Flag size={22} aria-hidden="true" />}
          description="Reporting is simulated — nothing is sent and nobody will reply."
          onClose={() => setIssueOpen(false)}
          footer={
            <div className="btn-stack">
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={!reason}
                onClick={() => {
                  if (!reason) return;
                  dispatch({ type: 'REPORT_CHARGE_ISSUE', reason });
                  setIssueOpen(false);
                  announce('Issue noted');
                }}
              >
                Report issue
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setIssueOpen(false)}>
                Cancel
              </button>
            </div>
          }
        >
          <fieldset className="radio-list">
            <legend className="sr-only">What’s wrong?</legend>
            {ISSUE_REASONS.map((x) => (
              <label key={x} className={`radio-card ${reason === x ? 'is-on' : ''}`}>
                <input type="radio" name="issue" value={x} checked={reason === x} onChange={() => setReason(x)} />
                <span>{x}</span>
              </label>
            ))}
          </fieldset>
        </Dialog>
      )}
    </main>
  );
}
