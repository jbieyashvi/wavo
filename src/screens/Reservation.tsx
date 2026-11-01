import { useState } from 'react';
import { ArrowLeft, ChevronRight, LifeBuoy, ScanLine, ShieldAlert, TimerOff, TriangleAlert, Unplug } from 'lucide-react';
import { HubZones, MapView, ScooterMarker, UserDot } from '../components/MapView';
import { Dialog, More } from '../components/ui';
import { AssetImage } from '../components/AssetImage';
import { VEHICLE } from '../lib/images';
import { RingButton } from './ScooterSheet';
import { DEMO_LOCATION, distanceMeters, hubById, scooterById, type Point } from '../lib/data';
import { HOLD_WARN_SEC, formatClock, formatDuration, formatHours, formatMeters, formatMoney, walkMinutes } from '../lib/pricing';
import { availableScooters, listBase, useNow, userPosition, useStore } from '../state/store';

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function heading(from: Point, to: Point): string {
  const angle = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return COMPASS[Math.round(((angle + 360) % 360) / 45) % 8];
}

export function Reservation() {
  const { state, navigate, dispatch, announce } = useStore();
  const now = useNow(!!state.reservation);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cantFind, setCantFind] = useState(false);
  const reservation = state.reservation;
  const ended = state.endedReservation;
  const scooter = scooterById(reservation?.scooterId ?? ended?.scooterId);
  const pos = userPosition(state.location) ?? DEMO_LOCATION;

  if (!scooter) return null;

  const meters = distanceMeters(pos, scooter);
  const mid = { x: (pos.x + scooter.x) / 2, y: (pos.y + scooter.y) / 2 };

  if (!reservation) {
    const reason = ended?.reason ?? 'expired';
    const stillAvailable = reason === 'expired' && availableScooters(state).some((s) => s.id === scooter.id);
    const alt =
      availableScooters(state)
        .filter((s) => s.id !== scooter.id)
        .sort((a, b) => Number(b.hubId === scooter.hubId) - Number(a.hubId === scooter.hubId) || distanceMeters(pos, a) - distanceMeters(pos, b))[0] ?? null;
    const paid = ended?.payStatus === 'authorised' || ended?.payStatus === 'pending';
    const money = paid ? 'The payment authorisation and deposit hold are released — nothing was charged.' : 'Nothing was charged and no deposit was taken.';
    const copy = {
      expired: { icon: <TimerOff size={26} aria-hidden="true" />, title: 'Your hold has ended', body: `The ${ended?.holdMin}-minute hold on ${scooter.id} ran out before it was unlocked, so it’s been released for other riders.` },
      unsafe: { icon: <ShieldAlert size={26} aria-hidden="true" />, title: `Don’t ride ${scooter.id}`, body: `Thanks for reporting it. ${scooter.id} has been taken out of service for inspection and your booking ended, free of charge.` },
      unlockFailed: { icon: <Unplug size={26} aria-hidden="true" />, title: `${scooter.id} couldn’t be unlocked`, body: 'The booking was released so you aren’t charged for a scooty you can’t use. If it unlocks by itself, don’t ride it — leave it locked in the hub.' },
    }[reason];
    const leave = () => {
      dispatch({ type: 'CLEAR_ENDED' });
      navigate({ screen: 'map' }, { replace: true });
    };
    return (
      <main className="screen reservation is-expired" aria-labelledby="res-title">
        <div className="res-expired">
          <span className="empty-icon warn">{copy.icon}</span>
          <h1 id="res-title" className="display">
            {copy.title}
          </h1>
          <p>
            {copy.body} {money}
          </p>
          <p className="fine">Your duration, return hub and payment choice are kept for your next booking.</p>
          <div className="btn-stack">
            {stillAvailable && state.draft && (
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={() => {
                  dispatch({ type: 'RESERVE', scooterId: scooter.id, now: Date.now(), quotedBasePaise: listBase(state, state.draft!.hours) });
                  announce(`${scooter.id} held again`);
                }}
              >
                Hold {scooter.id} again
              </button>
            )}
            {!stillAvailable && alt && (
              <>
                <p className="foot-sum">
                  {alt.id} · {hubById(alt.hubId)?.name} · ~{alt.rangeKm} km range · {walkMinutes(distanceMeters(pos, alt))} min walk
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={() => {
                    dispatch({ type: 'CLEAR_ENDED' });
                    dispatch({ type: 'SELECT_SCOOTER', scooterId: alt.id });
                    navigate({ screen: 'map', scooterId: alt.id }, { replace: true });
                  }}
                >
                  {reason === 'expired' ? `View ${alt.id}` : `Book ${alt.id} instead`}
                </button>
              </>
            )}
            <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={leave}>
              {reason === 'expired' ? 'Find another scooty' : 'Back to map'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const left = Math.max(0, (reservation.expiresAt - now) / 1000);
  const fraction = left / (reservation.holdMin * 60);
  const pickup = hubById(reservation.pickupHubId);
  const returnHub = hubById(reservation.returnHubId);
  const R = 46;
  const C = 2 * Math.PI * R;
  const urgent = left <= HOLD_WARN_SEC;

  return (
    <main className="screen reservation" aria-labelledby="res-title">
      <MapView
        className="res-map"
        focus={mid}
        focusKey={scooter.id}
        focusY={0.2}
        label={`Map showing your position and ${scooter.id}`}
        svgOverlay={
          <>
            <HubZones highlight={reservation.pickupHubId} />
            <line x1={pos.x} y1={pos.y} x2={scooter.x} y2={scooter.y} className="walk-line" />
          </>
        }
      >
        <ScooterMarker scooter={scooter} selected meters={meters} onSelect={() => announce(`${scooter.id}: ${scooter.spot}`)} />
        <UserDot point={pos} manual={state.location.status === 'manual'} label="Your position" />
      </MapView>

      <div className="map-top">
        <div className="search-row">
          <button type="button" className="icon-btn raised" onClick={() => navigate({ screen: 'map' })} aria-label="Back to map (keeps your reservation)">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <span className="top-title">Reservation</span>
        </div>
      </div>

      <section className="panel res-panel" aria-labelledby="res-title">
        <div className="res-head">
          <div className="countdown" role="timer" aria-label={`${formatDuration(left)} left on your reservation`}>
            <svg viewBox="0 0 108 108" aria-hidden="true">
              <circle cx="54" cy="54" r={R} className="countdown-track" />
              <circle cx="54" cy="54" r={R} className={`countdown-bar ${urgent ? 'is-urgent' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} />
            </svg>
            <span className="countdown-time" aria-hidden="true">
              {formatDuration(left)}
            </span>
          </div>
          <div>
            <h1 id="res-title" className="display">
              Scooty reserved
            </h1>
            <p className="res-meta">
              Hold ends at {formatClock(reservation.expiresAt)}. If it runs out, it’s released and nothing is charged.
            </p>
          </div>
        </div>

        {urgent && (
          <p className="inline-warn" role="status">
            <TriangleAlert size={16} aria-hidden="true" /> Less than {Math.ceil(left / 60)} min left. Reach the scooty and finish the checks before {formatClock(reservation.expiresAt)}, or it’s released.
          </p>
        )}

        <div className="vrow res-where">
          <span className="vrow-art">
            <AssetImage asset={VEHICLE} sizes="56px" />
          </span>
          <div>
            <p className="vrow-model">
              {pickup?.name} hub · {scooter.spot.replace(/ at .*$/, '')}
            </p>
            <p className="vrow-meta">
              White scooty <span className="res-id-inline">{scooter.id}</span> · ID under the QR code, below the handlebar
            </p>
          </div>
        </div>

        <More summary={`Walking directions · ${walkMinutes(meters)} min, ${formatMeters(meters)}`}>
          <ol className="walk-steps">
            <li>Head {heading(pos, scooter)} from your position.</li>
            <li>{scooter.spot}.</li>
            <li>Can’t see it? Use “Beep to find it” and listen.</li>
          </ol>
          <p>Guidance is approximate — there are no turn-by-turn directions.</p>
        </More>

        <dl className="lines res-summary" aria-label="Booking summary">
          <div>
            <dt>Rental</dt>
            <dd className="tabular">
              {formatHours(reservation.hours)} · {formatMoney(reservation.basePaise)}
            </dd>
          </div>
          <div>
            <dt>Return to</dt>
            <dd>{returnHub?.name}</dd>
          </div>
          <div>
            <dt>Helmet</dt>
            <dd>{pickup?.helmets ? `${pickup.helmets} in locker at last check` : 'Bring your own'}</dd>
          </div>
          <div>
            <dt>Booking</dt>
            <dd>{reservation.ref}</dd>
          </div>
        </dl>
        <p className="fine">Payment happens at the scooty, after the safety checks.</p>

        <div className="res-find">
          <RingButton scooterId={scooter.id} />
          <button type="button" className="link-row" onClick={() => setCantFind(true)}>
            <span>Can’t find it?</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="panel-actions">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate({ screen: 'unlock' })}>
            <ScanLine size={20} aria-hidden="true" />
            I’m at the scooty
          </button>
          <button type="button" className="btn btn-danger-text btn-block" onClick={() => setConfirmCancel(true)}>
            Cancel hold (free)
          </button>
        </div>
      </section>

      {cantFind && (
        <Dialog
          title="Can’t find it?"
          icon={<LifeBuoy size={22} aria-hidden="true" />}
          onClose={() => setCantFind(false)}
          footer={
            <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={() => setCantFind(false)}>
              Done
            </button>
          }
        >
          <ul className="policy-list">
            <li>
              <strong>Where:</strong> {pickup?.name} hub — {scooter.spot}.
            </li>
            <li>
              <strong>Which one:</strong> {scooter.id} is printed under the QR code below the handlebar. Other scooties in the hub won’t accept this booking’s code.
            </li>
            <li>
              <strong>Hub access:</strong> {pickup?.access}
            </li>
          </ul>
          <RingButton scooterId={scooter.id} compact />
          <p className="fine">
            Still nothing? Support is simulated in this concept — no message is sent and nobody is contacted. You can cancel the hold for free and pick another scooty.
          </p>
        </Dialog>
      )}

      {confirmCancel && (
        <Dialog
          tone="alert"
          title="Cancel this reservation?"
          description={`Cancelling before unlock is free. ${scooter.id} is released straight away and other riders can take it.`}
          onClose={() => setConfirmCancel(false)}
          footer={
            <div className="btn-stack">
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={() => {
                  if (!state.reservation) return;
                  dispatch({ type: 'CANCEL_RESERVATION' });
                  announce(`Hold on ${scooter.id} cancelled — it’s free for others again`);
                  navigate({ screen: 'map' }, { replace: true });
                }}
              >
                Yes, cancel for free
              </button>
              <button type="button" className="btn btn-secondary btn-block" data-autofocus onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}
