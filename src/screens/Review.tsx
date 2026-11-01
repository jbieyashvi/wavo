import { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, CreditCard, SearchX, Tag, TriangleAlert, Wallet } from 'lucide-react';
import { Dialog, FootSummary, More, SimTag } from '../components/ui';
import { AssetImage } from '../components/AssetImage';
import { PolicyInfo, POLICY } from '../components/PolicyInfo';
import { VEHICLE } from '../lib/images';
import { DEMO_LOCATION, HUBS, distanceMeters, hubById, scooterById, type Scooter } from '../lib/data';
import { DEMO_PRICE_RISE_PAISE, DEPOSIT_NOTE, DEPOSIT_PAISE, EXCESS_LABEL, OVERTIME_LABEL, formatClock, formatHours, formatMeters, formatMoney, planFor } from '../lib/pricing';
import { availableScooters, bookingBlock, holdMinutesFor, listBase, projectedDeadline, returnBlock, useNow, userPosition, useStore, type PaymentMethod } from '../state/store';
import { MODEL, hubBlockText } from './ScooterSheet';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: typeof Wallet }[] = [
  { id: 'upi', label: 'UPI', icon: Wallet },
  { id: 'card', label: 'Card', icon: CreditCard },
];

export function Review() {
  const { state, navigate, dispatch, announce } = useStore();
  const now = useNow();
  const [policy, setPolicy] = useState(false);
  const [taken, setTaken] = useState<{ id: string; alt: Scooter | null } | null>(null);
  const [priceChanged, setPriceChanged] = useState<{ from: number; to: number } | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const draft = state.draft;
  const scooter = scooterById(draft?.scooterId);
  if (!draft || !scooter) return null;

  const origin = userPosition(state.location) ?? DEMO_LOCATION;
  const plan = planFor(draft.hours);
  const base = listBase(state, draft.hours);
  const pickup = hubById(scooter.hubId);
  const returnHub = hubById(draft.returnHubId);
  const holdMin = holdMinutesFor(state, scooter.id);
  const by = projectedDeadline(state, draft, now);
  const returnBlocked = returnBlock(state, draft.returnHubId, by);
  const backToSetup = () => navigate({ screen: 'map', scooterId: scooter.id, step: 'setup' }, { replace: true });

  const release = () => {
    submitting.current = false;
    setBusy(false);
  };

  const confirm = () => {
    // One tap, one hold: ignore repeats while the first confirm is being handled.
    if (submitting.current || returnBlocked) return;
    submitting.current = true;
    setBusy(true);
    // Reviewer scenario: list price changes between showing the review and confirming.
    if (state.scenarios.priceChange) {
      dispatch({ type: 'APPLY_PRICE_CHANGE' });
      setPriceChanged({ from: base, to: base + DEMO_PRICE_RISE_PAISE });
      release();
      return;
    }
    const stillFree = !bookingBlock(state, scooter.id, Date.now());
    if (state.scenarios.scooterTaken || !stillFree) {
      dispatch({ type: 'MARK_UNAVAILABLE', scooterId: scooter.id });
      dispatch({ type: 'SET_SCENARIO', patch: { scooterTaken: false } });
      const alt =
        availableScooters(state)
          .filter((s) => s.id !== scooter.id)
          .sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b))[0] ?? null;
      setTaken({ id: scooter.id, alt });
      release();
      return;
    }
    dispatch({ type: 'RESERVE', now: Date.now(), quotedBasePaise: base });
    announce(`${scooter.id} held for ${holdMin} minutes`);
    navigate({ screen: 'reservation' }, { replace: true });
  };

  const sameHub = pickup?.id === returnHub?.id;
  const expires = formatClock(now + holdMin * 60_000);

  return (
    <main className="screen review" aria-labelledby="rv-title">
      <header className="page-head">
        <button type="button" className="icon-btn" onClick={backToSetup} aria-label="Back to rental setup">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="top-title">Step 3 of 3</span>
      </header>
      <div className="page-scroll">
        <h1 id="rv-title" className="display screen-title">
          Review booking
        </h1>
        <div className="vrow">
          <span className="vrow-art">
            <AssetImage asset={VEHICLE} sizes="56px" priority />
          </span>
          <div>
            <p className="vrow-model">{MODEL}</p>
            <p className="vrow-meta">
              {scooter.id} · {scooter.battery}% · ~{scooter.rangeKm} km range
            </p>
          </div>
        </div>

        {returnBlocked && (
          <section className="callout alert" role="alert" aria-labelledby="rv-rehub">
            <TriangleAlert size={18} aria-hidden="true" />
            <div>
              <strong id="rv-rehub">Your return hub can’t take this rental.</strong>
              <p>{hubBlockText(returnHub, returnBlocked, 'return')} Choose a new return hub to continue.</p>
              <label className="select-field">
                <span>New return hub</span>
                <select value="" onChange={(e) => e.target.value && dispatch({ type: 'UPDATE_DRAFT', patch: { returnHubId: e.target.value } })}>
                  <option value="">Choose…</option>
                  {HUBS.filter((h) => !returnBlock(state, h.id, by)).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} · {formatMeters(distanceMeters(scooter, h))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        <section className="setup-sec" aria-labelledby="rv-trip">
          <div className="sec-head">
            <h2 id="rv-trip" className="sec-h">
              Rental
            </h2>
            <button type="button" className="btn-link" onClick={backToSetup}>
              Change
            </button>
          </div>
          <dl className="facts is-flat">
            <div>
              <dt>Duration</dt>
              <dd>
                {formatHours(plan.hours)}
                <span className="facts-sub">Due back {formatHours(plan.hours)} after unlock</span>
              </dd>
            </div>
            <div>
              <dt>Included distance</dt>
              <dd>{plan.includedKm} km</dd>
            </div>
            {sameHub ? (
              <div>
                <dt>Pickup & return</dt>
                <dd>
                  {pickup?.name} hub
                  <span className="facts-sub">The rental can only end inside this hub.</span>
                </dd>
              </div>
            ) : (
              <div>
                <dt>Pickup → return</dt>
                <dd>
                  {pickup?.name} → {returnHub?.name}
                  <span className="facts-sub">The rental can only end inside {returnHub?.name}.</span>
                </dd>
              </div>
            )}
            <div>
              <dt>Helmet</dt>
              <dd>{pickup?.helmets ? `${pickup.helmets} in the locker at the last check, not reserved` : `None at ${pickup?.name} — bring your own`}</dd>
            </div>
          </dl>
          {draft.tripKm != null && draft.tripKm > scooter.rangeKm && (
            <p className="inline-warn">
              <TriangleAlert size={16} aria-hidden="true" /> Your planned {draft.tripKm} km is more than this battery’s estimated {scooter.rangeKm} km.
            </p>
          )}
          <More summary="Included distance vs battery range">
            <p>Included distance is part of the price, not a promise of range. This battery is estimated at about {scooter.rangeKm} km, and there’s no charging during a rental.</p>
          </More>
        </section>

        <section className="setup-sec" aria-labelledby="rv-cost">
          <div className="sec-head">
            <h2 id="rv-cost" className="sec-h">
              Charges
            </h2>
            <SimTag>Illustrative prices</SimTag>
          </div>
          <dl className="lines">
            <div>
              <dt>Rental · {formatHours(plan.hours)}</dt>
              <dd className="tabular">{formatMoney(base)}</dd>
            </div>
            <div>
              <dt>Deposit hold · refundable</dt>
              <dd className="tabular">{formatMoney(DEPOSIT_PAISE)}</dd>
            </div>
          </dl>
          <p className="fine">Both are authorised at the scooty after your safety checks, just before unlock. Taxes not shown.</p>
          <dl className="lines is-rates">
            <div>
              <dt>Late return</dt>
              <dd>{OVERTIME_LABEL}</dd>
            </div>
            <div>
              <dt>Extra distance</dt>
              <dd>{EXCESS_LABEL}</dd>
            </div>
            <div>
              <dt>Early return</dt>
              <dd>No refund of unused time</dd>
            </div>
          </dl>
          <More summary="When the deposit is released">
            <p>{DEPOSIT_NOTE}</p>
          </More>
        </section>

        <fieldset className="pay-choice setup-sec">
          <legend className="sec-h">Pay with</legend>
          {PAYMENT_OPTIONS.map((o) => (
            <label key={o.id} className={`check radio ${draft.payment === o.id ? 'is-on' : ''}`}>
              <input type="radio" name="payment" value={o.id} checked={draft.payment === o.id} onChange={() => dispatch({ type: 'UPDATE_DRAFT', patch: { payment: o.id } })} />
              <span className="check-box" aria-hidden="true" />
              <o.icon size={18} aria-hidden="true" />
              <span>{o.label}</span>
            </label>
          ))}
          <p className="fine">Simulated: no UPI request is sent, no card details are collected and no money moves.</p>
        </fieldset>

        <section className="setup-sec" aria-labelledby="rv-policy">
          <h2 id="rv-policy" className="sec-h">
            Cancellation and return
          </h2>
          <ul className="policy-list">
            <li>{POLICY.cancellation}</li>
            <li>Return only at {returnHub?.name}, with a parking photo and the lock confirmed.</li>
          </ul>
          <button type="button" className="link-row" onClick={() => setPolicy(true)}>
            <span>Rental terms</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </section>
      </div>
      <div className="page-foot">
        <FootSummary>
          Held free for {holdMin} min, to {expires} · no charge yet
        </FootSummary>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={confirm} disabled={busy || !!returnBlocked} aria-busy={busy}>
          Confirm and hold
        </button>
      </div>

      {policy && <PolicyInfo onClose={() => setPolicy(false)} />}

      {priceChanged && (
        <Dialog
          tone="alert"
          title="The price has changed"
          icon={<Tag size={22} aria-hidden="true" />}
          description={`The ${formatHours(plan.hours)} rental is now ${formatMoney(priceChanged.to)} (was ${formatMoney(priceChanged.from)}). Nothing has been held or charged. Review the new total before confirming.`}
          onClose={() => setPriceChanged(null)}
          footer={
            <div className="btn-stack">
              <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={() => setPriceChanged(null)}>
                Review new price
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate({ screen: 'map' }, { replace: true })}>
                Don’t book
              </button>
            </div>
          }
        />
      )}

      {taken && (
        <Dialog
          tone="alert"
          title={`${taken.id} was just taken`}
          icon={<SearchX size={22} aria-hidden="true" />}
          description="Someone else reserved it a moment before you. Nothing was held or charged. Your duration, return hub and payment choice are kept."
          onClose={() => setTaken(null)}
          footer={
            <div className="btn-stack">
              {taken.alt && (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  data-autofocus
                  onClick={() => {
                    const alt = taken.alt!;
                    setTaken(null);
                    navigate({ screen: 'map', scooterId: alt.id }, { replace: true });
                  }}
                >
                  View {taken.alt.id} at {hubById(taken.alt.hubId)?.name}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate({ screen: 'map' }, { replace: true })}>
                Back to map
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}

