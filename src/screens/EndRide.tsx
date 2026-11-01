import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, CheckCircle2, HardHat, Loader2, Lock, MapPin, Navigation2, Phone, RefreshCcw, ShieldAlert, WifiOff } from 'lucide-react';
import { At, HubZones, MapView, polylinePoints } from '../components/MapView';
import { Dialog, More, ReviewerNote, SimTag } from '../components/ui';
import { POLICY } from '../components/PolicyInfo';
import { AssetImage } from '../components/AssetImage';
import { VEHICLE } from '../lib/images';
import { hubById, scooterById } from '../lib/data';
import { OVERTIME_BLOCK_MIN, TAX_NOTE, formatClock, formatDurationWords, formatHours, formatKm, formatMeters, formatMoney } from '../lib/pricing';
import { billedElapsed, checkReturn, rideCharges, useNow, useStore, type ReturnCheck } from '../state/store';
import { hubBlockText } from './ScooterSheet';
import { ReassignDialog } from './Ride';

type Step = 0 | 1 | 2;
const STEPS = ['Location', 'Photo & helmet', 'Request'];

function problemText(check: Exclude<ReturnCheck, { ok: true }>): { title: string; body: string } {
  switch (check.reason) {
    case 'blocked':
      return {
        title: hubBlockText(check.designated, check.block, 'return'),
        body: 'The rental can’t end there, so it stays active. Switch to another hub — no fee, same return time.',
      };
    case 'edge':
      return {
        title: `We can’t tell if you’re inside ${check.designated.name}`,
        body: 'Nothing has ended yet. Move the scooty fully into a marked bay, then check again.',
      };
    case 'outside':
      return {
        title: `You’re about ${formatMeters(Math.max(20, check.meters))} from ${check.designated.name}`,
        body: 'The rental and meter stay active. Ride into the hub’s marked bays, then check again.',
      };
    case 'wrongHub':
      return {
        title: `You’re at ${check.at.name}, not your return hub`,
        body: `The rental and meter stay active. Ride to ${check.designated.name}, ${formatMeters(check.meters)} away, or change your return hub on the rental screen.`,
      };
  }
}

export function EndRide() {
  const { state } = useStore();
  if (!state.ride || !scooterById(state.ride.scooterId)) return null;
  return state.ride.ret.requestedAt ? <LockProgress /> : <ReturnSteps />;
}

function ReturnSteps() {
  const { state, dispatch, announce, back } = useStore();
  const now = useNow();
  const ride = state.ride!;
  const scooter = scooterById(ride.scooterId)!;
  const [step, setStep] = useState<Step>(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [rechecked, setRechecked] = useState(0);
  const [reassign, setReassign] = useState(false);
  const requesting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [step]);

  const designated = hubById(ride.returnHubId)!;
  const check = checkReturn(state, now)!;
  const problem = check.ok ? null : problemText(check);
  const charges = rideCharges(ride, now);
  const elapsed = billedElapsed(ride, now);
  const cameraDown = state.scenarios.cameraUnavailable;

  const toStart = (message: string) => {
    setStep(0);
    setStepError(null);
    announce(message);
  };

  const next = () => {
    if (!check.ok) return toStart('Return can’t be completed here');
    if (step === 0) {
      setStep(1);
      setStepError(null);
    } else if (step === 1) {
      if (ride.ret.photo === 'none' || ride.ret.helmet === 'none') {
        setStepError(ride.ret.photo === 'none' ? 'Add a photo, or request an assisted check.' : 'Tell us where the helmet is.');
        return;
      }
      setStep(2);
      setStepError(null);
    }
  };

  const request = () => {
    if (requesting.current) return;
    // Revalidated here and again in the reducer, at the moment of confirming.
    const fresh = checkReturn(state, Date.now());
    if (!fresh?.ok) return toStart('Your position or hub changed — check again');
    requesting.current = true;
    dispatch({ type: 'RETURN_REQUEST', now: Date.now() });
    window.setTimeout(() => (requesting.current = false), 800);
  };

  return (
    <main className="screen end-ride" aria-labelledby="end-title">
      <header className="page-head">
        <button type="button" className="icon-btn" onClick={() => (step === 0 ? back() : setStep((s) => (s - 1) as Step))} aria-label={step === 0 ? 'Back to rental' : `Back to ${STEPS[step - 1]}`}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="top-title">End rental</span>
        <span className="meter-chip tabular" aria-label={`Charges so far: ${formatMoney(charges.totalPaise)}`}>
          {formatMoney(charges.totalPaise)}
        </span>
      </header>

      <ol className="stepper" aria-label="End rental steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="stepper-dot" aria-hidden="true">
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <div className="page-scroll">
        {step === 0 && (
          <>
            <h1 id="end-title" className="display-sm" tabIndex={-1} ref={headingRef}>
              Return at {designated.name}
            </h1>
            <p className="muted">Your booking can only end here.</p>
            <div className="mini-map">
              <MapView
                focus={{ x: (designated.x + ride.at.x) / 2, y: (designated.y + ride.at.y) / 2 }}
                focusKey={`${designated.id}-${ride.at.x}-${ride.at.y}`}
                interactive={false}
                label={`Map showing your return hub, ${designated.name}, and your position`}
                svgOverlay={
                  <>
                    <HubZones highlight={designated.id} alerts={state.hubAlerts} muteOthers />
                    <polyline points={polylinePoints(ride.trail)} className="ride-trail" />
                  </>
                }
              >
                <At x={ride.at.x} y={ride.at.y} z={4}>
                  <span className="rider-dot" role="img" aria-label="Your position">
                    <Navigation2 size={16} aria-hidden="true" />
                  </span>
                </At>
              </MapView>
            </div>

            {problem ? (
              <section className="callout block is-emph" role="alert" aria-labelledby="blocked-h" key={rechecked}>
                <ShieldAlert size={22} aria-hidden="true" />
                <div>
                  <h2 id="blocked-h">{problem.title}</h2>
                  <p>{problem.body}</p>
                  {check.ok === false && check.reason === 'blocked' && <p className="fine">Can’t reach another hub? Support isn’t available in this concept — nobody is contacted.</p>}
                </div>
              </section>
            ) : (
              <p className="callout ok" role="status">
                <CheckCircle2 size={20} aria-hidden="true" />
                <span>
                  You’re inside <strong>{designated.name}</strong>.
                </span>
              </p>
            )}
            <More summary="Finding the bays">
              <p>
                {designated.landmark}. {designated.access}
              </p>
            </More>
          </>
        )}

        {step === 1 && (
          <>
            <h1 id="end-title" className="display-sm" tabIndex={-1} ref={headingRef}>
              Photo and helmet
            </h1>
            <section aria-labelledby="photo-h">
              <h2 id="photo-h" className="sec-h end-sub">
                Parking photo
              </h2>
              <p className="muted">The whole scooty in a bay, on its centre stand.</p>
              <div className={`photo-frame ${ride.ret.photo === 'taken' ? 'has-photo' : ''}`}>
                {ride.ret.photo === 'taken' ? (
                  <div className="photo-sim" role="img" aria-label={`Photo of ${scooter.id} parked at ${designated.name}`}>
                    <span className="photo-bay" aria-hidden="true">
                      <span>H</span>
                    </span>
                    <AssetImage asset={VEHICLE} className="photo-scooter" sizes="220px" alt="" />
                    <span className="photo-stamp">{designated.name}</span>
                  </div>
                ) : ride.ret.photo === 'assisted' ? (
                  <div className="photo-empty">
                    <CheckCircle2 size={30} aria-hidden="true" />
                    <span>Assisted check requested instead of a photo</span>
                  </div>
                ) : (
                  <div className="photo-empty">
                    {cameraDown ? <CameraOff size={30} aria-hidden="true" /> : <Camera size={30} aria-hidden="true" />}
                    <span>{cameraDown ? 'Camera unavailable' : 'No photo yet'}</span>
                  </div>
                )}
              </div>
              <div className="btn-stack">
                {ride.ret.photo === 'none' ? (
                  <>
                    {!cameraDown && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-block"
                        onClick={() => {
                          dispatch({ type: 'RETURN_PHOTO', photo: 'taken' });
                          setStepError(null);
                          announce('Photo added');
                        }}
                      >
                        <Camera size={18} aria-hidden="true" /> Add photo
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn ${cameraDown ? 'btn-secondary' : 'btn-ghost'} btn-block`}
                      onClick={() => {
                        dispatch({ type: 'RETURN_PHOTO', photo: 'assisted' });
                        setStepError(null);
                        announce('Assisted check requested');
                      }}
                    >
                      Can’t take a photo? Request an assisted check
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => dispatch({ type: 'RETURN_PHOTO', photo: 'none' })}>
                    <RefreshCcw size={18} aria-hidden="true" /> {ride.ret.photo === 'taken' ? 'Retake' : 'Use a photo instead'}
                  </button>
                )}
              </div>
              <p className="fine">Simulated: your camera isn’t opened and nothing is sent. A photo protects you if damage is reported later.</p>
              <ReviewerNote>“Add photo” attaches the stock vehicle image. “Camera unavailable” is a Return scenario.</ReviewerNote>
            </section>

            <fieldset className="radio-list" aria-describedby="helmet-note">
              <legend className="sec-h end-sub">
                <HardHat size={16} aria-hidden="true" /> Helmet
              </legend>
              {(
                [
                  ['returned', `Locker helmet back in the ${designated.name} locker`],
                  ['own', 'I used my own helmet'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className={`radio-card ${ride.ret.helmet === v ? 'is-on' : ''}`}>
                  <input type="radio" name="helmet" value={v} checked={ride.ret.helmet === v} onChange={() => dispatch({ type: 'RETURN_HELMET', helmet: v })} />
                  <span>{label}</span>
                </label>
              ))}
              <p id="helmet-note" className="fine">
                The scooty locks itself after you request the return; that’s confirmed separately.
              </p>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="end-title" className="display-sm" tabIndex={-1} ref={headingRef}>
              Request the return
            </h1>
            <dl className="facts is-flat">
              <div>
                <dt>Time used</dt>
                <dd className="tabular">
                  {formatDurationWords(elapsed)} of {formatHours(ride.hours)}
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd className="tabular">
                  {formatKm(ride.distanceKm)} of {charges.includedKm} km
                </dd>
              </div>
              <div>
                <dt>Return hub</dt>
                <dd>{designated.name}</dd>
              </div>
            </dl>
            <section className="setup-sec" aria-labelledby="sum-h">
              <div className="sec-head">
                <h2 id="sum-h" className="sec-h">
                  Charges so far
                </h2>
                <SimTag>Illustrative prices</SimTag>
              </div>
              <dl className="lines">
                <div>
                  <dt>Rental · {formatHours(ride.hours)}</dt>
                  <dd className="tabular">{formatMoney(charges.basePaise)}</dd>
                </div>
                {charges.overtimeBlocks > 0 && (
                  <div>
                    <dt>
                      Late · {charges.overtimeBlocks} × {OVERTIME_BLOCK_MIN} min
                    </dt>
                    <dd className="tabular">{formatMoney(charges.overtimePaise)}</dd>
                  </div>
                )}
                {charges.excessKm > 0 && (
                  <div>
                    <dt>Extra distance · {charges.excessKm} km</dt>
                    <dd className="tabular">{formatMoney(charges.excessPaise)}</dd>
                  </div>
                )}
                <div className="total">
                  <dt>Total if you request now</dt>
                  <dd className="tabular">{formatMoney(charges.totalPaise)}</dd>
                </div>
              </dl>
              <p className="fine">
                {TAX_NOTE} Payment is simulated — no money moves.
              </p>
            </section>
            <section className="setup-sec" aria-labelledby="next-h">
              <h2 id="next-h" className="sec-h">
                What happens next
              </h2>
              <ul className="policy-list">
                <li>{POLICY.billingStop}</li>
                <li>{POLICY.lockPending}</li>
              </ul>
            </section>
          </>
        )}
      </div>

      <div className="page-foot">
        {step === 0 && check.ok === false ? (
          <div className="btn-stack">
            {check.reason === 'blocked' ? (
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setReassign(true)}>
                Choose another return hub
              </button>
            ) : check.reason === 'edge' ? (
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setRechecked((n) => n + 1)}>
                <RefreshCcw size={18} aria-hidden="true" /> Check position again
              </button>
            ) : null}
            <button type="button" className={`btn ${check.reason === 'blocked' || check.reason === 'edge' ? 'btn-secondary' : 'btn-primary btn-lg'} btn-block`} onClick={back}>
              Back to rental
            </button>
          </div>
        ) : step < 2 ? (
          <>
            {stepError && (
              <p className="inline-error" role="alert">
                {stepError}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={next} aria-disabled={!check.ok}>
              Continue
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={request}>
            <Lock size={20} aria-hidden="true" /> Request return and lock
          </button>
        )}
      </div>
      {reassign && <ReassignDialog onClose={() => setReassign(false)} />}
    </main>
  );
}

function LockProgress() {
  const { state, dispatch, announce } = useStore();
  const ride = state.ride!;
  const ret = ride.ret;
  const designated = hubById(ride.returnHubId)!;
  const charges = rideCharges(ride, ret.requestedAt!);
  const [assist, setAssist] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [ret.lock]);
  const busy = ret.lock === 'locking' || ret.lock === 'checking';

  const copy = {
    locking: { title: `Locking ${ride.scooterId}…`, body: 'Stay next to the scooty. This usually takes a few seconds.' },
    checking: { title: 'Checking vehicle status…', body: 'Asking the scooty whether it locked. Don’t move it.' },
    uncertain: { title: 'We couldn’t confirm the lock', body: 'The scooty may or may not have locked. Your return is requested but not confirmed. Check the status — you won’t be charged twice.' },
    failed: { title: 'The lock didn’t engage', body: 'Push the scooty fully onto its stand in the bay, then try again. Your return is requested but not confirmed.' },
    network: { title: 'Connection lost', body: 'We couldn’t reach the scooty. Your return is requested but not confirmed. Retrying won’t create a second return or charge.' },
  }[ret.lock ?? 'locking'];

  return (
    <main className="screen end-ride" aria-labelledby="lock-title">
      <header className="page-head">
        <span className="top-title">Return requested</span>
        <span className="meter-chip tabular" aria-label={`Billed: ${formatMoney(charges.totalPaise)}`}>
          {formatMoney(charges.totalPaise)}
        </span>
      </header>
      <div className="page-scroll">
        <section className={`status-card ${busy ? 'is-busy' : 'is-alert'}`} role="status" aria-live="polite">
          <span className="status-icon" aria-hidden="true">
            {busy ? <Loader2 size={24} className="spin" /> : ret.lock === 'network' ? <WifiOff size={24} /> : <ShieldAlert size={24} />}
          </span>
          <h1 id="lock-title" className="display-sm" tabIndex={-1} ref={headingRef}>
            {copy.title}
          </h1>
          <p>{copy.body}</p>
        </section>
        <dl className="lines status-lines">
          <div>
            <dt>Return requested</dt>
            <dd className="tabular">{formatClock(ret.requestedAt!)}</dd>
          </div>
          <div>
            <dt>Scooty locked</dt>
            <dd>Not yet confirmed</dd>
          </div>
          <div>
            <dt>Billing</dt>
            <dd>Stopped at {formatClock(ret.requestedAt!)}</dd>
          </div>
          <div>
            <dt>Hub</dt>
            <dd>{designated.name}</dd>
          </div>
          {ret.attempts > 1 && (
            <div>
              <dt>Lock attempts</dt>
              <dd className="tabular">{ret.attempts}</dd>
            </div>
          )}
        </dl>
        <p className="fine">Keep the scooty on its stand inside the bay and stay with it until the lock is confirmed. Your rental isn’t complete until then.</p>
      </div>
      <div className="page-foot">
        <div className="btn-stack">
          {busy ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled aria-busy="true">
              {ret.lock === 'checking' ? 'Checking…' : 'Locking…'}
            </button>
          ) : ret.lock === 'uncertain' ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => dispatch({ type: 'LOCK_STATUS' })}>
              Check lock status
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => dispatch({ type: 'LOCK_RETRY' })}>
              <RefreshCcw size={20} aria-hidden="true" /> Try locking again
            </button>
          )}
          {!busy && (
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setAssist(true)}>
              <Phone size={18} aria-hidden="true" /> Still stuck? Get assistance
            </button>
          )}
        </div>
      </div>
      {assist && (
        <Dialog
          title="Close with assistance?"
          icon={<MapPin size={22} aria-hidden="true" />}
          description={`Billing stays stopped at your return request. The rental closes, but because the lock isn’t confirmed, ${ride.scooterId} still needs a check at ${designated.name} and your deposit stays held until then. Leave it on its stand inside the bay. Assistance is simulated — nobody is contacted.`}
          onClose={() => setAssist(false)}
          footer={
            <div className="btn-stack">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  dispatch({ type: 'ASSISTED_CLOSE', now: Date.now() });
                  announce('Rental closed with assistance — scooty check pending');
                }}
              >
                Close the rental
              </button>
              <button type="button" className="btn btn-secondary btn-block" data-autofocus onClick={() => setAssist(false)}>
                Keep trying
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}
