import { useEffect, useState } from 'react';
import { ArrowRight, BatteryWarning, CalendarClock, Clock, FlagTriangleRight, Image as ImageIcon, LifeBuoy, Map as MapIcon, MapPin, Navigation, Navigation2, Phone, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react';
import { At, HubZones, MapView, polylinePoints } from '../components/MapView';
import { Dialog, FootSummary, More } from '../components/ui';
import { AssetImage } from '../components/AssetImage';
import { RIDE_SCENE } from '../lib/images';
import { distanceMeters, hubAt, hubById, scooterById, streetRoute, type Hub } from '../lib/data';
import { OVERTIME_LABEL, REMINDER_MIN, formatClock, formatDuration, formatHours, formatMeters, formatMoney } from '../lib/pricing';
import { billingStop, extensionOptions, reassignOptions, returnBlock, rideCharges, rideDeadline, rideElapsed, useNow, useStore } from '../state/store';
import { hubBlockText } from './ScooterSheet';

export function Ride() {
  const { state, navigate, dispatch, announce } = useStore();
  const now = useNow(!!state.ride);
  const [dialog, setDialog] = useState<null | 'help' | 'reassign' | 'extend' | 'breakdown'>(null);
  // The scenic illustration is the default backdrop; the simulated map (with directions) is one tap away.
  const [view, setView] = useState<'scene' | 'map'>('scene');
  const ride = state.ride;
  const scooter = scooterById(ride?.scooterId);
  if (!ride || !scooter) return null;

  const elapsed = rideElapsed(ride, now);
  const charges = rideCharges(ride, now);
  const bookedSec = ride.hours * 3600;
  const late = elapsed > bookedSec;
  const deadline = rideDeadline(ride);
  const returnHub = hubById(ride.returnHubId)!;
  const toHub = distanceMeters(ride.at, returnHub);
  const atHub = hubAt(ride.at);
  const rangeLeft = Math.max(0, scooter.rangeKm - ride.distanceKm);
  const lowRange = rangeLeft < toHub / 1000 + 3;
  const hubIssue = returnBlock(state, ride.returnHubId, Math.max(now, deadline));
  const remindSoon = !late && bookedSec - elapsed <= REMINDER_MIN * 60;
  const stopped = billingStop(ride);

  return (
    <main className="screen ride" aria-labelledby="ride-title">
      {view === 'scene' ? (
        <figure className="ride-scene">
          <AssetImage asset={RIDE_SCENE} sizes="(min-width: 500px) 420px, 100vw" priority />
        </figure>
      ) : (
        <MapView
          focus={ride.at}
          focusKey={`${ride.at.x}-${ride.at.y}`}
          focusY={0.36}
          interactive={false}
          label={`Map showing your position and the way to the ${returnHub.name} return hub`}
          svgOverlay={
            <>
              <HubZones highlight={ride.returnHubId} alerts={state.hubAlerts} muteOthers />
              <polyline points={polylinePoints(ride.trail)} className="ride-trail" />
              <polyline points={polylinePoints(streetRoute(ride.at, returnHub))} className="walk-line" />
            </>
          }
        >
          <At x={ride.at.x} y={ride.at.y} z={4}>
            <span className="rider-dot" role="img" aria-label="Your position">
              <Navigation2 size={18} aria-hidden="true" />
            </span>
          </At>
          <At x={returnHub.x} y={returnHub.y - 26} z={3}>
            <span className="map-flag" aria-hidden="true">
              Return here
            </span>
          </At>
        </MapView>
      )}

      <div className="ride-top">
        <h1 className="ride-status" id="ride-title">
          <span className="live-dot" aria-hidden="true" /> Rental in progress<span className="sr-only"> · {scooter.id}</span>
        </h1>
        <button type="button" className="btn btn-raised" onClick={() => setDialog('help')}>
          <LifeBuoy size={18} aria-hidden="true" /> Help
        </button>
      </div>

      <div className="ride-dock">
        <div className="ride-view-row">
          {view === 'scene' && <p className="ride-scene-label">Illustration · not your route</p>}
          <button type="button" className="btn btn-raised ride-view-toggle" aria-label={view === 'scene' ? 'Show map and directions' : 'Show illustration'} onClick={() => setView(view === 'scene' ? 'map' : 'scene')}>
            {view === 'scene' ? (
              <>
                <MapIcon size={16} aria-hidden="true" /> <span className="ride-view-toggle-text">Show map</span>
              </>
            ) : (
              <>
                <ImageIcon size={16} aria-hidden="true" /> <span className="ride-view-toggle-text">Show illustration</span>
              </>
            )}
          </button>
        </div>
        <section className="panel ride-panel" aria-label="Rental summary">
          <dl className="glance">
            <div className={late ? 'is-late' : ''}>
              <dt>{stopped ? 'Billed time' : late ? 'Overtime' : 'Time left'}</dt>
              <dd className="tabular">{formatDuration(stopped ? Math.min(elapsed, rideElapsed(ride, stopped)) : late ? elapsed - bookedSec : bookedSec - elapsed)}</dd>
            </div>
            <div>
              <dt>Cost so far</dt>
              <dd className="tabular">{formatMoney(charges.totalPaise)}</dd>
            </div>
            <div className={charges.excessKm > 0 ? 'is-late' : ''}>
              <dt>Distance</dt>
              <dd className="tabular">
                {ride.distanceKm.toFixed(1)}
                <small>/{charges.includedKm} km</small>
              </dd>
            </div>
          </dl>
          <p className="ride-range">
            ~{rangeLeft.toFixed(0)} km estimated range left · {ride.scooterId}
          </p>

          {ride.breakdownAt ? (
            <BreakdownCard />
          ) : (
            <>
              <section className={`ride-return ${hubIssue ? 'is-alert' : ''}`} aria-labelledby="return-h">
                <p className="ride-return-label">
                  <MapPin size={14} aria-hidden="true" /> Return to{ride.changedFromHubId ? ' · changed' : ''}
                </p>
                <div className="ride-return-row">
                  <h2 id="return-h" className="return-name">
                    {returnHub.name}
                  </h2>
                  <button type="button" className="btn-link" onClick={() => setDialog('reassign')}>
                    Change
                  </button>
                </div>
                <p className="return-meta">
                  Due by <strong className="nowrap">{formatClock(deadline)}</strong> · <span className="nowrap">{atHub?.id === returnHub.id ? 'you’re at the hub' : `${formatMeters(toHub)} away`}</span>
                </p>
                {hubIssue && (
                  <p className="inline-error" role="alert">
                    <TriangleAlert size={16} aria-hidden="true" /> {hubBlockText(returnHub, hubIssue, 'return')} Choose another hub — no fee, and your return time stays the same.
                  </p>
                )}
                <More summary="Finding the bays">
                  <p>
                    {returnHub.landmark}. {returnHub.access} Open {returnHub.open}.
                  </p>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => setView('map')} disabled={view === 'map'}>
                    <Navigation size={16} aria-hidden="true" /> Show directions on the map
                  </button>
                </More>
              </section>

              {remindSoon && (
                <p className="inline-warn" role="status">
                  <Clock size={16} aria-hidden="true" /> Due back in {formatDuration(bookedSec - elapsed)}. After {formatClock(deadline)}: {OVERTIME_LABEL}.
                </p>
              )}
              {late && (
                <p className="inline-warn" role="status">
                  <Clock size={16} aria-hidden="true" /> Past your return time — {OVERTIME_LABEL}. {charges.overtimeBlocks} block{charges.overtimeBlocks === 1 ? '' : 's'} so far.
                </p>
              )}
              {lowRange && (
                <div className="inline-warn" role="status">
                  <BatteryWarning size={16} aria-hidden="true" />
                  <span>
                    About {rangeLeft.toFixed(0)} km of estimated range left; {returnHub.name} is {formatMeters(toHub)} away. Head there now, or{' '}
                    <button type="button" className="link-btn" onClick={() => setDialog('reassign')}>
                      switch to a closer hub
                    </button>
                    .
                  </span>
                </div>
              )}

              <div className="ride-actions">
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate({ screen: 'endRide' })}>
                  <FlagTriangleRight size={20} aria-hidden="true" />
                  End rental
                </button>
                <button type="button" className="btn-link" onClick={() => setDialog('extend')}>
                  <CalendarClock size={16} aria-hidden="true" /> Need more time?
                </button>
              </div>
            </>
          )}
          <p className="ride-safety">
            <ShieldCheck size={14} aria-hidden="true" /> Pull over and stop before using your phone.
          </p>
        </section>
      </div>

      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} onReassign={() => setDialog('reassign')} onBreakdown={() => setDialog('breakdown')} rangeLeft={rangeLeft} toHub={toHub} />}
      {dialog === 'reassign' && <ReassignDialog onClose={() => setDialog(null)} />}
      {dialog === 'extend' && <ExtendDialog onClose={() => setDialog(null)} />}
      {dialog === 'breakdown' && (
        <Dialog
          tone="alert"
          title="Report a breakdown?"
          icon={<Wrench size={22} aria-hidden="true" />}
          description="Stop somewhere safe first. Reporting stops billing now, and you can no longer ride or extend. Assistance is simulated — nobody is contacted or dispatched."
          onClose={() => setDialog(null)}
          footer={
            <div className="btn-stack">
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={() => {
                  dispatch({ type: 'REPORT_BREAKDOWN', now: Date.now() });
                  setDialog(null);
                  announce('Breakdown reported. The meter has stopped.');
                }}
              >
                Report breakdown and stop the meter
              </button>
              <button type="button" className="btn btn-secondary btn-block" data-autofocus onClick={() => setDialog(null)}>
                Go back
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}

function BreakdownCard() {
  const { state, dispatch } = useStore();
  const ride = state.ride!;
  const [closing, setClosing] = useState(false);
  return (
    <section className="return-card is-alert" aria-labelledby="bd-h" role="status">
      <p className="eyebrow">
        <Wrench size={14} aria-hidden="true" /> Breakdown reported
      </p>
      <h2 id="bd-h" className="return-name">
        Don’t ride {ride.scooterId}
      </h2>
      <p>
        The meter stopped at {formatClock(ride.breakdownAt!)} — you’re billed up to then, with no overtime after it. Leave the scooty parked safely off the road.
      </p>
      <p className="fine">The rental closes with assistance; the scooty still needs a check, so your deposit stays held until then. Assistance is simulated — no message is sent and nobody is dispatched.</p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={closing}
        onClick={() => {
          setClosing(true);
          dispatch({ type: 'ASSISTED_CLOSE', now: Date.now() });
        }}
      >
        End rental with assistance
      </button>
    </section>
  );
}

function HelpDialog({ onClose, onReassign, onBreakdown, rangeLeft, toHub }: { onClose: () => void; onReassign: () => void; onBreakdown: () => void; rangeLeft: number; toHub: number }) {
  const { state, announce } = useStore();
  const ride = state.ride!;
  const returnHub = hubById(ride.returnHubId)!;
  return (
    <Dialog title="Help" icon={<LifeBuoy size={22} aria-hidden="true" />} onClose={onClose}>
      <p className="callout warn">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>In an emergency, stop somewhere safe and call the emergency number (112 in India).</span>
      </p>

      <section className="help-block" aria-labelledby="help-break">
        <h3 id="help-break">
          <Wrench size={16} aria-hidden="true" /> Breakdown or a safety fault
        </h3>
        <p>Stop and park off the road. Don’t keep riding with weak brakes, a flat tyre or failed lights.</p>
        {!ride.breakdownAt && (
          <button type="button" className="btn btn-secondary btn-block" onClick={onBreakdown}>
            Report a breakdown
          </button>
        )}
      </section>

      <section className="help-block" aria-labelledby="help-batt">
        <h3 id="help-batt">
          <BatteryWarning size={16} aria-hidden="true" /> Low battery
        </h3>
        <p>
          Estimated range left is about {rangeLeft.toFixed(0)} km; {returnHub.name} is {formatMeters(toHub)} away. If it won’t make it, switch to a closer hub or report a breakdown rather than leaving the scooty outside a hub.
        </p>
      </section>

      <section className="help-block" aria-labelledby="help-full">
        <h3 id="help-full">
          <MapPin size={16} aria-hidden="true" /> Return hub full, closed or too far
        </h3>
        <p>You can switch your return hub. You’ll see each option and confirm before anything changes.</p>
        {!ride.breakdownAt && (
          <button type="button" className="btn btn-secondary btn-block" onClick={onReassign}>
            Change return hub
          </button>
        )}
      </section>

      <ul className="area-list">
        <li>
          <button type="button" className="area-btn" onClick={() => announce('Support is simulated — no call is placed.')}>
            <Phone size={18} aria-hidden="true" />
            <span>
              <strong>Call rider support</strong>
              <span>Simulated — no call is placed, nobody is sent</span>
            </span>
          </button>
        </li>
      </ul>
      <p className="fine">The meter keeps running while you’re in Help, unless you report a breakdown.</p>
    </Dialog>
  );
}

export function ReassignDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch, announce } = useStore();
  const now = useNow();
  const ride = state.ride;
  const [picked, setPicked] = useState<Hub | null>(null);
  useEffect(() => {
    if (!ride) onClose();
  }, [ride, onClose]);
  if (!ride) return null;
  const current = hubById(ride.returnHubId)!;
  const options = reassignOptions(state, now);
  const deadline = rideDeadline(ride);

  if (picked) {
    const stillOk = !returnBlock(state, picked.id, Math.max(now, deadline));
    return (
      <Dialog
        title={`Return to ${picked.name} instead?`}
        icon={<MapPin size={22} aria-hidden="true" />}
        description={`Your return hub changes from ${current.name} to ${picked.name}. The deadline stays ${formatClock(deadline)} and there’s no fee. Returns at ${current.name} won’t be accepted after this.`}
        onClose={() => setPicked(null)}
        footer={
          <div className="btn-stack">
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!stillOk}
              onClick={() => {
                dispatch({ type: 'REASSIGN_RETURN', hubId: picked.id, now: Date.now() });
                announce(`Return hub changed to ${picked.name}`);
                onClose();
              }}
            >
              Confirm {picked.name}
            </button>
            <button type="button" className="btn btn-secondary btn-block" data-autofocus onClick={() => setPicked(null)}>
              Back to the list
            </button>
          </div>
        }
      >
        <p className="fine">{picked.access}</p>
        {!stillOk && (
          <p className="inline-error" role="alert">
            {picked.name} can no longer take returns. Go back and pick another hub.
          </p>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog title="Change return hub" icon={<MapPin size={22} aria-hidden="true" />} description={`Currently ${current.name}. Pick a hub, then confirm on the next step. Nothing changes until you confirm.`} onClose={onClose}>
      <ul className="area-list">
        {options.map(({ hub, meters, block }) => (
          <li key={hub.id}>
            <button type="button" className="area-btn" disabled={!!block} onClick={() => setPicked(hub)}>
              <MapPin size={18} aria-hidden="true" />
              <span>
                <strong>{hub.name}</strong>
                <span>{block ? hubBlockText(hub, block, 'return') : `${formatMeters(meters)} away · open ${hub.open}`}</span>
              </span>
              {!block && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="fine">Distances are from your current position. Choosing a hub doesn’t move you.</p>
    </Dialog>
  );
}

function ExtendDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch, announce } = useStore();
  const now = useNow();
  const ride = state.ride;
  const { options, unavailable } = extensionOptions(state, now);
  const [hours, setHours] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ride) return null;
  const picked = options.find((o) => o.plan.hours === hours);

  return (
    <Dialog
      title="Need more time?"
      icon={<CalendarClock size={22} aria-hidden="true" />}
      description={unavailable ? undefined : `Move up to a longer plan before ${formatClock(rideDeadline(ride))}. You pay the difference in base price now and get its extra km. Payment is simulated — no money moves.`}
      onClose={onClose}
      footer={
        unavailable ? (
          <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={onClose}>
            OK
          </button>
        ) : (
          <div className="btn-stack">
            {picked && <FootSummary>Pay {formatMoney(picked.extraPaise)} more now · simulated</FootSummary>}
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!picked || !!picked.block || busy}
              onClick={() => {
                if (!picked) return;
                setBusy(true);
                dispatch({ type: 'EXTEND', hours: picked.plan.hours, now: Date.now() });
                announce(`Extended to ${formatHours(picked.plan.hours)}. New return time ${formatClock(picked.newDeadline)}.`);
                onClose();
              }}
            >
              {picked ? `Extend to ${formatHours(picked.plan.hours)}` : 'Choose a plan'}
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
              Not now
            </button>
          </div>
        )
      }
    >
      {unavailable ? (
        <p>{unavailable}</p>
      ) : (
        <fieldset className="radio-list">
          <legend className="sr-only">Longer plans</legend>
          {options.map((o) => (
            <label key={o.plan.hours} className={`radio-card ${hours === o.plan.hours ? 'is-on' : ''} ${o.block ? 'is-disabled' : ''}`}>
              <input type="radio" name="extend" value={o.plan.hours} checked={hours === o.plan.hours} disabled={!!o.block} onChange={() => setHours(o.plan.hours)} />
              <span>
                <strong>
                  {formatHours(o.plan.hours)} total · +{formatMoney(o.extraPaise)}
                </strong>
                <span className="fine">{o.block ? hubBlockText(hubById(ride.returnHubId), o.block, 'return') : `Due ${formatClock(o.newDeadline)} · +${o.extraKm} km allowance`}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Dialog>
  );
}
