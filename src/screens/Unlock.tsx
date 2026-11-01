import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, BadgeCheck, Camera, CameraOff, Check, CheckCircle2, Clock, CreditCard, Flashlight, FlashlightOff, Keyboard, LifeBuoy, Loader2, LockOpen, ScanLine, ShieldAlert, Timer, Wallet, Wrench, XCircle } from 'lucide-react';
import { Dialog, FootSummary, More, ReviewerNote, SimTag } from '../components/ui';
import { AssetImage } from '../components/AssetImage';
import { VEHICLE } from '../lib/images';
import { RingButton } from './ScooterSheet';
import { checkIds, pickupChecks, useNow, useStore } from '../state/store';
import { hubById, scooterById } from '../lib/data';
import { DEPOSIT_NOTE, DEPOSIT_PAISE, HOLD_WARN_SEC, OVERTIME_LABEL, formatClock, formatDuration, formatHours, formatMoney } from '../lib/pricing';

/** Cosmetic issues are logged and the rental can go ahead; safety issues end the booking at no charge. */
const DAMAGE_ITEMS = [
  { id: 'scratch', label: 'Scratches or scuffs', unsafe: false },
  { id: 'panel', label: 'Dent or cracked body panel', unsafe: false },
  { id: 'seat', label: 'Torn or dirty seat', unsafe: false },
  { id: 'brakes', label: 'Brakes weak or not working', unsafe: true },
  { id: 'tyre', label: 'Flat or damaged tyre', unsafe: true },
  { id: 'mirror', label: 'Missing or broken mirror', unsafe: true },
  { id: 'lights', label: 'Lights, indicators or horn not working', unsafe: true },
  { id: 'other', label: 'Something else feels unsafe', unsafe: true },
];

export function Unlock() {
  const { state, navigate } = useStore();
  const now = useNow(!!state.reservation);
  const reservation = state.reservation;
  const scooter = scooterById(reservation?.scooterId);
  if (!scooter || !reservation) return null;
  const left = Math.max(0, (reservation.expiresAt - now) / 1000);

  const holdChip = (dark = false) => (
    <span className={`hold-chip ${left <= HOLD_WARN_SEC ? 'is-urgent' : ''} ${dark ? 'on-dark' : ''}`} role="timer" aria-label={`${formatDuration(left)} left on your hold`}>
      <Timer size={14} aria-hidden="true" /> Hold {formatDuration(left)}
    </span>
  );

  if (!reservation.identified) return <Identify holdChip={holdChip(true)} onBack={() => navigate({ screen: 'reservation' })} />;
  if (!reservation.checksDone) return <Checklist holdChip={holdChip()} left={left} />;
  return <PayAndUnlock holdChip={holdChip()} left={left} />;
}

/* ───────────── 1. Identify the vehicle: scan, or type its code ───────────── */

function Identify({ holdChip, onBack }: { holdChip: JSX.Element; onBack: () => void }) {
  const { state, dispatch, announce } = useStore();
  const scooter = scooterById(state.reservation?.scooterId)!;
  const scannerDown = state.scenarios.scannerUnavailable || state.scenarios.cameraUnavailable;
  const [mode, setMode] = useState<'scan' | 'code'>(scannerDown ? 'code' : 'scan');
  const [scanning, setScanning] = useState(false);
  const [torch, setTorch] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [help, setHelp] = useState(false);
  const timer = useRef<number>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (mode === 'code') codeRef.current?.focus();
    else headingRef.current?.focus();
  }, [mode]);

  const identified = () => {
    dispatch({ type: 'IDENTIFY', scooterId: scooter.id });
    announce(`${scooter.id} identified. Now the safety checks.`);
  };

  const scan = () => {
    if (scanning) return;
    setScanning(true);
    timer.current = window.setTimeout(identified, 900);
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    // Accept "WV-3920", "wv 3920" or just the four digits.
    const digits = code.toUpperCase().replace(/[\s-]+/g, '').replace(/^WV/, '');
    const normalised = `WV-${digits}`;
    if (!/^\d{4}$/.test(digits)) {
      setCodeError(`Enter the 4 digits after WV-, e.g. ${scooter.id.slice(3)}.`);
      return;
    }
    // A different vehicle's code never identifies or unlocks it — only the held scooty counts.
    if (normalised !== scooter.id) {
      setCodeError(`${normalised} isn’t your booked scooty. Your booking is for ${scooter.id} — check the code under the QR and try again. Nothing was unlocked.`);
      return;
    }
    setCodeError('');
    identified();
  };

  return (
    <main className="screen scanner" aria-labelledby="scan-title">
      <header className="page-head on-dark">
        <button type="button" className="icon-btn dark" onClick={onBack} aria-label="Back to reservation (keeps your hold)">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="top-title">Find it · 1 of 3</span>
        {holdChip}
      </header>

      {mode === 'code' ? (
        <form className="code-form" onSubmit={submitCode} noValidate>
          {scannerDown && (
            <p className="callout on-dark" role="status">
              <CameraOff size={18} aria-hidden="true" /> The scanner isn’t available right now, so enter the code instead.
            </p>
          )}
          <h1 id="scan-title" className="display on-dark-title" tabIndex={-1} ref={headingRef}>
            Enter scooty code
          </h1>
          <p className="on-dark-muted">It’s printed under the QR code below the handlebar. Your booked scooty is {scooter.id}.</p>
          <ReviewerNote>Type {scooter.id} to match; any other code shows the wrong-scooty error.</ReviewerNote>
          <label htmlFor="scooter-code" className="code-label">
            Scooty code
          </label>
          <input
            id="scooter-code"
            ref={codeRef}
            className="code-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError('');
            }}
            placeholder="WV-0000"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!codeError}
            aria-describedby={codeError ? 'code-err' : undefined}
          />
          {codeError && (
            <p id="code-err" className="inline-error on-dark" role="alert">
              {codeError}
            </p>
          )}
          <div className="btn-stack">
            <button type="submit" className="btn btn-primary btn-lg btn-block">
              Confirm code
            </button>
            {!scannerDown && (
              <button type="button" className="btn btn-on-dark btn-block" onClick={() => setMode('scan')}>
                <ScanLine size={18} aria-hidden="true" /> Back to scanner
              </button>
            )}
            <button type="button" className="btn btn-on-dark btn-block" onClick={() => setHelp(true)}>
              <LifeBuoy size={18} aria-hidden="true" /> Can’t find the scooty?
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={`viewfinder ${torch ? 'torch' : ''}`}>
            <div className="viewfinder-scene" aria-hidden="true">
              <AssetImage asset={VEHICLE} className="vf-scooter" sizes="280px" alt="" />
            </div>
            <div className="scan-frame" aria-hidden="true">
              <span className="corner tl" />
              <span className="corner tr" />
              <span className="corner bl" />
              <span className="corner br" />
              {!scanning && <span className="scan-line" />}
              <svg className="vf-qr" viewBox="0 0 21 21" aria-hidden="true">
                <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" fill="currentColor" />
                <path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z" fill="#141814" />
                <path d="M9 1h2v2H9zM9 5h3v2H9zM8 9h2v3H8zM12 9h3v2h-3zM16 9h3v2h-3zM9 13h2v2H9zM13 13h2v3h-2zM17 14h2v2h-2zM9 17h3v3H9zM15 18h4v2h-4z" fill="currentColor" />
              </svg>
            </div>
          </div>

          <div className="scanner-panel">
            {scanning ? (
              <div className="scan-status" role="status">
                <Loader2 size={22} className="spin" aria-hidden="true" />
                <h1 id="scan-title" className="on-dark-title sm" tabIndex={-1} ref={headingRef}>
                  Reading {scooter.id}…
                </h1>
              </div>
            ) : (
              <>
                <h1 id="scan-title" className="on-dark-title sm" tabIndex={-1} ref={headingRef}>
                  Point at the QR code below the handlebar
                </h1>
                <p className="on-dark-muted">
                  <Camera size={14} aria-hidden="true" /> Simulated — your camera isn’t opened. Scanning identifies the scooty; it unlocks after your checks.
                </p>
              </>
            )}
            <div className="btn-stack">
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={scan} disabled={scanning}>
                Scan QR code
              </button>
              <div className="scanner-row">
                <button type="button" className="btn btn-on-dark" onClick={() => setMode('code')} disabled={scanning}>
                  <Keyboard size={18} aria-hidden="true" /> Enter code
                </button>
                <button type="button" className="btn btn-on-dark" onClick={() => setHelp(true)}>
                  <LifeBuoy size={18} aria-hidden="true" /> Get help
                </button>
                <button type="button" className="icon-btn dark" aria-pressed={torch} onClick={() => setTorch((t) => !t)} aria-label={torch ? 'Turn torch off' : 'Turn torch on'}>
                  {torch ? <FlashlightOff size={20} aria-hidden="true" /> : <Flashlight size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {help && <FindHelp onClose={() => setHelp(false)} />}
    </main>
  );
}

function FindHelp({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  const scooter = scooterById(state.reservation?.scooterId)!;
  const hub = hubById(scooter.hubId);
  return (
    <Dialog
      title="Can’t find it?"
      icon={<LifeBuoy size={22} aria-hidden="true" />}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={onClose}>
          Done
        </button>
      }
    >
      <ul className="policy-list">
        <li>
          <strong>Bay:</strong> {hub?.name} hub — {scooter.spot}.
        </li>
        <li>
          <strong>ID:</strong> {scooter.id}, printed under the QR code below the handlebar.
        </li>
        <li>
          <strong>Access:</strong> {hub?.access}
        </li>
      </ul>
      <RingButton scooterId={scooter.id} compact />
      <p className="fine">Support is simulated in this concept — no message is sent and nobody is contacted. You can cancel the hold for free from the reservation screen.</p>
    </Dialog>
  );
}

/* ───────────── 2. Pre-ride checks ───────────── */

function Checklist({ holdChip, left }: { holdChip: JSX.Element; left: number }) {
  const { state, navigate, dispatch, announce } = useStore();
  const reservation = state.reservation!;
  const scooter = scooterById(reservation.scooterId)!;
  const pickup = hubById(reservation.pickupHubId);
  const groups = pickupChecks(pickup);
  const ids = checkIds(pickup);
  const [checkError, setCheckError] = useState(false);
  const [wrongOpen, setWrongOpen] = useState(false);
  const [damage, setDamage] = useState<Record<string, boolean>>({});
  const [damageError, setDamageError] = useState(false);
  const [unsafeConfirm, setUnsafeConfirm] = useState<string[] | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const done = ids.filter((id) => reservation.checks.includes(id)).length;

  const confirm = () => {
    const missing = ids.filter((id) => !reservation.checks.includes(id));
    if (missing.length) {
      setCheckError(true);
      document.getElementById(`chk-${missing[0]}`)?.focus();
      return;
    }
    dispatch({ type: 'CONFIRM_CHECKS' });
    announce('Checks confirmed. Next: payment, then unlock.');
  };

  const submitDamage = () => {
    const items = DAMAGE_ITEMS.filter((d) => damage[d.id]);
    if (!items.length) {
      setDamageError(true);
      return;
    }
    if (items.some((d) => d.unsafe)) {
      setUnsafeConfirm(items.map((d) => d.label));
      return;
    }
    // Cosmetic only: logged against the vehicle. It never ticks a safety check for the rider.
    dispatch({ type: 'LOG_COSMETIC', items: items.map((d) => d.label), now: Date.now() });
    setWrongOpen(false);
    setDamage({});
    announce('Cosmetic damage logged. Finish the checks to continue.');
  };

  return (
    <main className="screen unlock-ready" aria-labelledby="ready-title">
      <header className="page-head">
        <button type="button" className="icon-btn" onClick={() => navigate({ screen: 'reservation' })} aria-label="Back to reservation (keeps your hold)">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="top-title">Checks · 2 of 3</span>
        {holdChip}
      </header>
      <div className="page-scroll">
        <h1 id="ready-title" className="display screen-title" tabIndex={-1} ref={headingRef}>
          Check {scooter.id}
        </h1>
        <div className="vrow">
          <span className="vrow-art">
            <AssetImage asset={VEHICLE} sizes="56px" priority />
          </span>
          <div>
            <p className="vrow-model">
              <CheckCircle2 size={16} aria-hidden="true" className="ok-ink" /> Identified · still locked
            </p>
            <p className="vrow-meta">
              {scooter.battery}% battery · ~{scooter.rangeKm} km range
            </p>
          </div>
        </div>

        {left <= HOLD_WARN_SEC && (
          <p className="inline-warn" role="status">
            <Clock size={16} aria-hidden="true" /> Hold ends at {formatClock(reservation.expiresAt)}. If it runs out, the scooty is released and nothing is charged.
          </p>
        )}

        <div className="checklist-wrap" aria-describedby={checkError ? 'check-err' : undefined}>
          <p className="muted">Tick each item yourself. Your hold keeps running while you check.</p>
          {groups.map((g) => (
            <fieldset key={g.group} className="checklist setup-sec">
              <legend className="sec-h">{g.group}</legend>
              {g.items.map((c) => {
                const on = reservation.checks.includes(c.id);
                return (
                  <label key={c.id} className={`check ${on ? 'is-on' : ''}`}>
                    <input
                      id={`chk-${c.id}`}
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        dispatch({ type: 'TOGGLE_CHECK', id: c.id });
                        setCheckError(false);
                      }}
                    />
                    <span className="check-box" aria-hidden="true">
                      <Check size={16} strokeWidth={3} />
                    </span>
                    <span>{c.label}</span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          {reservation.cosmetic.length > 0 && (
            <p className="inline-warn" role="status">
              <Wrench size={16} aria-hidden="true" /> Noted as existing cosmetic damage: {reservation.cosmetic.join(', ')}. You won’t be blamed for it.
            </p>
          )}
          <section className="setup-sec" aria-labelledby="wrong-h">
            <h2 id="wrong-h" className="sec-h">
              Something wrong?
            </h2>
            <p className="fine">If anything is unsafe, don’t ride. Reporting it ends the booking free.</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setWrongOpen(true)}>
              <AlertTriangle size={18} aria-hidden="true" /> Report a problem
            </button>
          </section>
        </div>
      </div>
      <div className="page-foot">
        {checkError ? (
          <p id="check-err" className="inline-error" role="alert">
            {ids.length - done} item{ids.length - done === 1 ? '' : 's'} still unticked. Confirm each one, or report a problem.
          </p>
        ) : (
          <FootSummary>
            {done} of {ids.length} checked
          </FootSummary>
        )}
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={confirm}>
          <BadgeCheck size={20} aria-hidden="true" />
          Continue to payment
        </button>
      </div>

      {wrongOpen && !unsafeConfirm && (
        <Dialog
          title="What’s wrong?"
          icon={<Wrench size={22} aria-hidden="true" />}
          description={`Tell us about ${scooter.id}. Reports are simulated — nothing is sent and no photos are taken.`}
          onClose={() => setWrongOpen(false)}
          footer={
            <div className="btn-stack">
              <button type="button" className="btn btn-primary btn-block" onClick={submitDamage}>
                Continue
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setWrongOpen(false)}>
                Cancel
              </button>
            </div>
          }
        >
          {(['Cosmetic — you can still ride', 'Safety — don’t ride'] as const).map((title, i) => (
            <fieldset key={title} className="checklist compact">
              <legend>{title}</legend>
              {DAMAGE_ITEMS.filter((d) => d.unsafe === (i === 1)).map((d) => (
                <label key={d.id} className={`check ${damage[d.id] ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!damage[d.id]}
                    onChange={(e) => {
                      setDamage((s) => ({ ...s, [d.id]: e.target.checked }));
                      setDamageError(false);
                    }}
                  />
                  <span className="check-box" aria-hidden="true">
                    <Check size={16} strokeWidth={3} />
                  </span>
                  <span>{d.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {damageError && (
            <p className="inline-error" role="alert">
              Choose at least one item, or cancel.
            </p>
          )}
        </Dialog>
      )}

      {unsafeConfirm && (
        <Dialog
          tone="alert"
          title={`Don’t ride ${scooter.id}`}
          icon={<ShieldAlert size={22} aria-hidden="true" />}
          description={`You reported: ${unsafeConfirm.join(', ')}. This ends the booking at no charge and takes ${scooter.id} out of service for inspection. We’ll suggest the nearest replacement next.`}
          onClose={() => setUnsafeConfirm(null)}
          footer={
            <div className="btn-stack">
              <button type="button" className="btn btn-danger btn-block" onClick={() => dispatch({ type: 'REPORT_UNSAFE', items: unsafeConfirm, now: Date.now() })}>
                Report and end booking
              </button>
              <button type="button" className="btn btn-secondary btn-block" data-autofocus onClick={() => setUnsafeConfirm(null)}>
                Go back
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}

/* ───────────── 3. Pay (simulated) and unlock ───────────── */

function PayAndUnlock({ holdChip, left }: { holdChip: JSX.Element; left: number }) {
  const { state, navigate, dispatch } = useStore();
  const reservation = state.reservation!;
  const scooter = scooterById(reservation.scooterId)!;
  const returnHub = hubById(reservation.returnHubId);
  const pay = reservation.payStatus;
  const unlock = reservation.unlock;
  const [confirmRelease, setConfirmRelease] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [pay, unlock]);
  const Method = reservation.payment === 'upi' ? Wallet : CreditCard;
  const methodName = reservation.payment === 'upi' ? 'UPI' : 'card';
  const busy = pay === 'processing' || pay === 'checking' || unlock === 'unlocking' || unlock === 'checking';

  let title: string;
  let body: JSX.Element | string;
  if (pay !== 'authorised') {
    title = { none: 'Pay and unlock', processing: 'Authorising payment…', pending: 'Payment pending', checking: 'Checking payment status…', failed: 'Payment didn’t go through', cancelled: 'Payment cancelled', authorised: '' }[pay];
    body = {
      none: `By ${methodName}: the rental is charged and the deposit is held. Then you unlock.`,
      processing: 'Waiting for the payment service. Don’t pay again.',
      pending: 'Not confirmed yet. Don’t pay again — check the status. If your hold runs out first, any authorisation is released.',
      checking: 'Asking the payment service for the outcome.',
      failed: `The ${methodName} payment was declined. Nothing was charged. Your hold keeps running.`,
      cancelled: 'Nothing was charged. Your hold keeps running.',
      authorised: '',
    }[pay];
  } else {
    title = { locked: 'Ready to unlock', unlocking: `Unlocking ${scooter.id}…`, checking: 'Checking vehicle status…', failed: 'Unlock didn’t work', timeout: 'No response from the scooty' }[unlock];
    body = {
      locked: `Payment authorised (simulated). The rental clock starts when ${scooter.id} unlocks.`,
      unlocking: 'Stay next to the scooty. This usually takes a few seconds.',
      checking: 'No clear answer from the scooty yet. Don’t ride or move it until this finishes. You won’t be charged twice.',
      failed: `The rental hasn’t started and nothing is billed. Try again, or release the booking.`,
      timeout: `The rental hasn’t started. Move closer and try again, or release the booking.`,
    }[unlock];
  }

  return (
    <main className="screen unlock-ready" aria-labelledby="pay-title">
      <header className="page-head">
        <button type="button" className="icon-btn" onClick={() => navigate({ screen: 'reservation' })} disabled={busy} aria-label="Back to reservation (keeps your hold)">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="top-title">Pay · 3 of 3</span>
        {holdChip}
      </header>
      <div className="page-scroll">
        <section className={`status-card ${pay === 'failed' || unlock === 'failed' || unlock === 'timeout' ? 'is-alert' : busy ? 'is-busy' : ''}`} role="status" aria-live="polite">
          <span className="status-icon" aria-hidden="true">
            {busy ? <Loader2 size={24} className="spin" /> : pay === 'failed' || unlock === 'failed' || unlock === 'timeout' ? <AlertTriangle size={24} /> : pay === 'pending' ? <Clock size={24} /> : pay === 'cancelled' ? <XCircle size={24} /> : pay === 'authorised' ? <LockOpen size={24} /> : <Method size={24} />}
          </span>
          <h1 id="pay-title" className="display-sm" tabIndex={-1} ref={headingRef}>
            {title}
          </h1>
          <p>{body}</p>
        </section>

        {left <= HOLD_WARN_SEC && pay !== 'authorised' && (
          <p className="inline-warn" role="status">
            <Clock size={16} aria-hidden="true" /> Hold ends at {formatClock(reservation.expiresAt)}.
          </p>
        )}

        <section className="setup-sec" aria-labelledby="charges-h">
          <div className="sec-head">
            <h2 id="charges-h" className="sec-h">
              At unlock
            </h2>
            <SimTag>Simulated payment</SimTag>
          </div>
          <dl className="lines">
            <div>
              <dt>
                Rental · {formatHours(reservation.hours)}, {reservation.includedKm} km
              </dt>
              <dd className="tabular">{formatMoney(reservation.basePaise)}</dd>
            </div>
            <div>
              <dt>Deposit hold · refundable</dt>
              <dd className="tabular">{formatMoney(DEPOSIT_PAISE)}</dd>
            </div>
          </dl>
          <dl className="lines is-rates">
            <div>
              <dt>Late return</dt>
              <dd>{OVERTIME_LABEL}</dd>
            </div>
            <div>
              <dt>Return only at</dt>
              <dd>{returnHub?.name}</dd>
            </div>
          </dl>
          <More summary="When the deposit is released">
            <p>{DEPOSIT_NOTE}</p>
          </More>
          <p className="fine">Simulated: no UPI request is sent, no card details are collected and no money moves.</p>
        </section>
      </div>
      <div className="page-foot">
        {(pay === 'none' || pay === 'failed' || pay === 'cancelled') && (
          <FootSummary>
            Rental {formatMoney(reservation.basePaise)} · Deposit hold {formatMoney(DEPOSIT_PAISE)}
          </FootSummary>
        )}
        <div className="btn-stack">
          {pay === 'none' || pay === 'failed' || pay === 'cancelled' ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => dispatch({ type: 'PAY', now: Date.now() })}>
              <Method size={20} aria-hidden="true" /> {pay === 'none' ? `Pay with ${methodName}` : 'Try payment again'}
            </button>
          ) : pay === 'processing' ? (
            <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => dispatch({ type: 'CANCEL_PAYMENT' })}>
              Cancel payment
            </button>
          ) : pay === 'pending' ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => dispatch({ type: 'CHECK_PAYMENT' })}>
              Check payment status
            </button>
          ) : pay === 'checking' ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled aria-busy="true">
              Checking…
            </button>
          ) : unlock === 'locked' || unlock === 'failed' || unlock === 'timeout' ? (
            <>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => dispatch({ type: 'UNLOCK', now: Date.now() })}>
                <LockOpen size={20} aria-hidden="true" /> {unlock === 'locked' ? 'Unlock and start rental' : 'Try unlocking again'}
              </button>
              {unlock !== 'locked' && (
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmRelease(true)}>
                  Release booking
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled aria-busy="true">
              {unlock === 'checking' ? 'Checking vehicle status…' : 'Unlocking…'}
            </button>
          )}
          {(unlock === 'failed' || unlock === 'timeout') && (
            <p className="fine">
              <LifeBuoy size={14} aria-hidden="true" /> Support is simulated — nobody is contacted.
            </p>
          )}
        </div>
      </div>

      {confirmRelease && (
        <Dialog
          title="Release this booking?"
          description={`${scooter.id} never unlocked, so nothing is charged. Any payment authorisation and deposit hold are released. You can then pick another scooty.`}
          onClose={() => setConfirmRelease(false)}
          footer={
            <div className="btn-stack">
              <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'UNLOCK_FAILED_RELEASE' })}>
                Release booking
              </button>
              <button type="button" className="btn btn-secondary btn-block" data-autofocus onClick={() => setConfirmRelease(false)}>
                Keep trying
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}
