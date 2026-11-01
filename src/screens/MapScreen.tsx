import { useEffect, useState } from 'react';
import { ArrowLeft, BatteryMedium, Clock, Flag, LocateFixed, LocateOff, MapPin, MapPinOff, Search, SearchX, ShieldAlert, SlidersHorizontal, Timer, Unplug, X } from 'lucide-react';
import { At, HubZones, MapView, ScooterMarker, UserDot } from '../components/MapView';
import { Dialog } from '../components/ui';
import { ParkingHelp } from '../components/ParkingHelp';
import { PolicyInfo } from '../components/PolicyInfo';
import { AssetImage } from '../components/AssetImage';
import { VEHICLE } from '../lib/images';
import { MODEL, ScooterSheet } from './ScooterSheet';
import { AREA_NAME, CITY_NAME, DEMO_LOCATION, HUBS, MANUAL_AREAS, OUTSIDE_AREA, PLACES, SCOOTERS, distanceMeters, hubById, scooterById, type Place, type Point } from '../lib/data';
import { HOLD_WARN_SEC, formatDuration, formatMeters, walkMinutes } from '../lib/pricing';
import { availableScooters, bookingBlock, useNow, userPosition, useStore, visibleScooters } from '../state/store';

export function MapScreen() {
  const { state, navigate, dispatch, announce } = useStore();
  const [recenter, setRecenter] = useState(0);
  const [rangeFilter, setRangeFilter] = useState(false);
  const [destination, setDestination] = useState<Place | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [parkingHelp, setParkingHelp] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [dismissedReport, setDismissedReport] = useState<number | null>(null);
  const [changeArea, setChangeArea] = useState(false);
  const now = useNow();

  const lastReport = state.damageReports[state.damageReports.length - 1];
  // Only relevant until the rider moves on: hidden while holding, and once a later rental has ended.
  const withdrawn = lastReport?.unsafe && dismissedReport !== lastReport.at && !state.reservation && !(state.receipt && state.receipt.endedAt > lastReport.at) ? lastReport : null;
  const pos = userPosition(state.location);
  const origin = pos ?? DEMO_LOCATION;
  const selected = scooterById(state.route.scooterId);

  const requiredKm = destination ? Math.ceil(distanceMeters(origin, destination) / 1000 + 2) : 5;
  const all = availableScooters(state, now);
  const scooters = all
    .filter((s) => !rangeFilter || s.rangeKm >= requiredKm)
    .map((s) => ({ s, m: distanceMeters(origin, s) }))
    .sort((a, b) => a.m - b.m);
  const hiddenByFilter = all.length - scooters.length;
  // Unbookable vehicles (maintenance, closed hub) stay visible, dimmed, so the map isn't misleading.
  const shown = visibleScooters(state).filter((s) => !rangeFilter || s.rangeKm >= requiredKm || s.id === state.route.scooterId);
  const ended = state.endedReservation;

  const openScooter = (id: string, step?: 'setup') => navigate({ screen: 'map', scooterId: id, step }, { replace: !!state.route.scooterId });
  const closeScooter = () => navigate({ screen: 'map' }, { replace: true });

  // Escape closes the scooter sheet. Dialogs stop propagation, so this never fires underneath one.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate({ screen: 'map' }, { replace: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, navigate]);

  // The sheet edits a booking draft for whichever scooty is open.
  useEffect(() => {
    if (selected) dispatch({ type: 'SELECT_SCOOTER', scooterId: selected.id });
  }, [selected, dispatch]);

  const focus: Point = selected ?? origin;
  const focusY = selected ? 0.3 : 0.45;
  const prompt = state.location.status === 'unknown';
  const denied = state.location.status === 'denied';
  const outside = state.location.status === 'outside';
  const empty = !prompt && !denied && !outside && scooters.length === 0;
  const holdLeft = state.reservation ? (state.reservation.expiresAt - now) / 1000 : 0;

  const tripLine = destination && (
    <line x1={origin.x} y1={origin.y} x2={destination.x} y2={destination.y} className="trip-line" />
  );

  return (
    <main className="screen map-screen" aria-labelledby="map-title">
      <h1 id="map-title" className="sr-only">
        Find a scooty
      </h1>
      <MapView
        focus={focus}
        focusKey={`${recenter}-${selected?.id ?? 'none'}-${state.location.status}-${pos?.x}`}
        focusY={focusY}
        label={`Map of ${AREA_NAME}, ${CITY_NAME} with ${scooters.length} scooties at hubs`}
        svgOverlay={
          <>
            <HubZones highlight={selected?.hubId} alerts={state.hubAlerts} />
            {tripLine}
            {selected && pos && <line x1={pos.x} y1={pos.y} x2={selected.x} y2={selected.y} className="walk-line" />}
          </>
        }
      >
        {shown.map((s) => {
          const block = all.some((a) => a.id === s.id) ? null : bookingBlock(state, s.id, now);
          return <ScooterMarker key={s.id} scooter={s} selected={s.id === selected?.id} meters={pos ? distanceMeters(pos, s) : null} onSelect={() => openScooter(s.id)} dimmed={!!block} note={block ? 'cannot be booked right now' : undefined} />;
        })}
        {destination && (
          <At x={destination.x} y={destination.y} z={4}>
            <span className="dest-pin" role="img" aria-label={`Destination: ${destination.name}`}>
              <Flag size={16} aria-hidden="true" />
            </span>
          </At>
        )}
        {pos && <UserDot point={pos} manual={state.location.status === 'manual'} label={state.location.status === 'manual' ? 'Your chosen start area' : 'Your location'} />}
      </MapView>

      {/* Top controls */}
      <div className="map-top">
        <div className="search-row">
          <button type="button" className="icon-btn raised" onClick={() => navigate({ screen: 'welcome' })} aria-label="Back to welcome">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="search-field" onClick={() => setSearchOpen(true)} aria-haspopup="dialog">
            <Search size={18} aria-hidden="true" />
            <span className={destination ? '' : 'placeholder'}>{destination ? destination.name : 'Where to?'}</span>
          </button>
          {destination && (
            <button type="button" className="icon-btn raised" onClick={() => setDestination(null)} aria-label={`Clear destination ${destination.name}`}>
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="chip-row">
          <button type="button" className={`chip ${rangeFilter ? 'is-on' : ''}`} aria-pressed={rangeFilter} onClick={() => setRangeFilter((v) => !v)}>
            <SlidersHorizontal size={15} aria-hidden="true" />
            {destination ? `Enough range for trip (${requiredKm}+ km)` : `Range ${requiredKm}+ km`}
          </button>
          <button type="button" className="chip chip-quiet" onClick={() => setChangeArea(true)}>
            <MapPin size={15} aria-hidden="true" />
            {state.location.status === 'manual' ? MANUAL_AREAS.find((a) => a.id === (state.location as { areaId: string }).areaId)?.name : AREA_NAME}
          </button>
        </div>
        {rangeFilter && hiddenByFilter > 0 && (
          <p className="filter-note" role="status">
            Hiding {hiddenByFilter} scooter{hiddenByFilter > 1 ? 's' : ''} with less than {requiredKm} km range.
          </p>
        )}
        {state.reservation && (
          <button type="button" className={`banner banner-reserved ${holdLeft <= HOLD_WARN_SEC ? 'is-urgent' : ''}`} onClick={() => navigate({ screen: 'reservation' })}>
            <Timer size={18} aria-hidden="true" />
            <span>
              <strong>{state.reservation.scooterId} on hold</strong> · {formatDuration(Math.max(0, holdLeft))} left{holdLeft <= HOLD_WARN_SEC ? ' — hurry or it’s released' : ''}
            </span>
            <span className="banner-cta">Resume</span>
          </button>
        )}
        {withdrawn && (
          <div className="banner banner-warn" role="alert">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>
              <strong>Don’t ride {withdrawn.scooterId}.</strong> It’s been withdrawn after your safety report and the hold was released — nothing charged.{' '}
              {selected ? `${selected.id} at ${hubById(selected.hubId)?.name} is shown as an alternative.` : 'Pick another scooty.'}
            </span>
            <button type="button" className="icon-btn ghost small" onClick={() => setDismissedReport(withdrawn.at)} aria-label="Dismiss">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {ended && ended.reason !== 'unsafe' && !state.reservation && (
          <div className="banner banner-warn" role="status">
            {ended.reason === 'expired' ? <Clock size={18} aria-hidden="true" /> : <Unplug size={18} aria-hidden="true" />}
            <span>
              {ended.reason === 'expired'
                ? `Your ${ended.holdMin}-min hold on ${ended.scooterId} ended, so it’s available to others again.`
                : `${ended.scooterId} couldn’t be unlocked, so the booking was released.`}{' '}
              {ended.payStatus === 'authorised' || ended.payStatus === 'pending' ? 'The payment authorisation is being released — nothing was charged.' : 'Nothing was charged.'}
            </span>
            <button type="button" className="icon-btn ghost small" onClick={() => dispatch({ type: 'CLEAR_ENDED' })} aria-label="Dismiss">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Right-side floating control */}
      {!selected && (
        <button
          type="button"
          className={`fab recenter ${empty ? 'above-card' : ''}`}
          onClick={() => {
            setRecenter((n) => n + 1);
            announce(pos ? 'Map re-centred on your location' : `Map re-centred on ${AREA_NAME}`);
          }}
          aria-label={pos ? 'Re-centre map on your location' : 'Re-centre map'}
        >
          <LocateFixed size={22} aria-hidden="true" />
        </button>
      )}

      {/* Bottom content */}
      {selected ? (
        <ScooterSheet
          scooter={selected}
          meters={pos ? distanceMeters(pos, selected) : null}
          isReserved={state.reservation?.scooterId === selected.id}
          reservedOther={state.reservation && state.reservation.scooterId !== selected.id ? state.reservation.scooterId : null}
          step={state.route.step === 'setup' ? 'setup' : 'overview'}
          onClose={closeScooter}
          onSetup={() => navigate({ screen: 'map', scooterId: selected.id, step: 'setup' })}
          onOverview={() => navigate({ screen: 'map', scooterId: selected.id }, { replace: true })}
          onOpen={openScooter}
          onReview={() => navigate({ screen: 'review' })}
          onViewReservation={() => navigate({ screen: 'reservation' })}
          onSwitchHold={() => {
            const old = state.reservation?.scooterId;
            dispatch({ type: 'CANCEL_RESERVATION' });
            dispatch({ type: 'SELECT_SCOOTER', scooterId: selected.id });
            announce(`Hold on ${old} cancelled — nothing charged. Set up ${selected.id} below.`);
            navigate({ screen: 'map', scooterId: selected.id, step: 'setup' }, { replace: true });
          }}
          onHubHelp={() => setParkingHelp(true)}
          onPolicy={() => setPolicy(true)}
        />
      ) : outside ? (
        <section className="map-card empty-card" aria-labelledby="outside-h">
          <span className="empty-icon">
            <MapPinOff size={24} aria-hidden="true" />
          </span>
          <h2 id="outside-h" className="display-sm">
            WAVO isn’t in {OUTSIDE_AREA.name} yet
          </h2>
          <p>
            You’re outside the service area. The nearest hub is about {OUTSIDE_AREA.kmToNearestHub} km away in {AREA_NAME} — too far to walk for a free hold.
          </p>
          <div className="btn-stack">
            <button type="button" className="btn btn-primary btn-block" onClick={() => setChangeArea(true)}>
              Choose a start area in {AREA_NAME}
            </button>
          </div>
        </section>
      ) : empty ? (
        <EmptyCard
          kind={rangeFilter && all.length > 0 ? 'filter' : rangeFilter ? 'range' : 'none'}
          requiredKm={requiredKm}
          destination={destination?.name ?? null}
          origin={origin}
          onClear={() => {
            setRangeFilter(false);
            setDestination(null);
            announce('Filters cleared');
          }}
          onChangeArea={() => setChangeArea(true)}
          onOpen={openScooter}
        />
      ) : (
        !prompt &&
        !denied &&
        !outside && (
          <section className="nearby" aria-labelledby="nearby-h">
            <div className="nearby-head">
              <h2 id="nearby-h">Nearby scooties</h2>
              <span>{scooters.length} available</span>
            </div>
            <ul className="nearby-list">
              {scooters.slice(0, 5).map(({ s, m }) => (
                <li key={s.id}>
                  <button type="button" className="nearby-card" onClick={() => openScooter(s.id)}>
                    <span className="nearby-thumb">
                      <AssetImage asset={VEHICLE} sizes="52px" alt="" />
                    </span>
                    <span className="nearby-main">
                      <strong>
                        <span className="nowrap">{MODEL.replace(' e-scooty', '')}</span>
                        {state.reservation?.scooterId === s.id && <em className="pill">Your hold</em>}
                      </strong>
                      <span className="nearby-key">
                        <span className="nowrap">{walkMinutes(m)} min walk</span> ·{' '}
                        <span className={`nowrap tone-${s.battery >= 50 ? 'good' : s.battery >= 20 ? 'mid' : 'low'}`}>
                          <BatteryMedium size={14} aria-hidden="true" /> ~{s.rangeKm} km
                        </span>
                      </span>
                      <span className="nearby-id">
                        {s.id} · <span className="nowrap">{hubById(s.hubId)?.name}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {prompt && (
        <Dialog
          title="See scooties near you"
          icon={<LocateFixed size={22} aria-hidden="true" />}
          description={`WAVO sorts hubs by walking distance from you. Location is simulated: nothing is read from your device, and a sample position in ${AREA_NAME}, ${CITY_NAME} is used instead.`}
          footer={
            <div className="btn-stack">
              <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={() => dispatch({ type: 'SET_LOCATION', location: { status: 'granted' } })}>
                Use sample location
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: 'SET_LOCATION', location: { status: 'denied' } })}>
                Not now
              </button>
            </div>
          }
        />
      )}

      {(denied || changeArea) && (
        <Dialog
          title={denied ? 'Location is off' : 'Choose a start area'}
          icon={denied ? <LocateOff size={22} aria-hidden="true" /> : <MapPin size={22} aria-hidden="true" />}
          onClose={denied ? undefined : () => setChangeArea(false)}
          description={denied ? 'No problem — pick where you are and we’ll show hubs around there. You can turn location on any time.' : 'Distances and walking times are measured from here.'}
        >
          <ul className="area-list">
            {MANUAL_AREAS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="area-btn"
                  onClick={() => {
                    dispatch({ type: 'SET_LOCATION', location: { status: 'manual', areaId: a.id } });
                    setChangeArea(false);
                    announce(`Showing scooties near ${a.name}`);
                  }}
                >
                  <MapPin size={18} aria-hidden="true" />
                  <span>
                    <strong>{a.name}</strong>
                    <span>{a.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              dispatch({ type: 'SET_LOCATION', location: { status: 'granted' } });
              setChangeArea(false);
            }}
          >
            <LocateFixed size={18} aria-hidden="true" /> Use sample location instead
          </button>
        </Dialog>
      )}

      {searchOpen && (
        <SearchDialog
          origin={origin}
          onClose={() => setSearchOpen(false)}
          onPick={(p) => {
            setDestination(p);
            setSearchOpen(false);
            setRangeFilter(true);
            announce(`Destination set to ${p.name}. Showing scooties with enough range.`);
          }}
        />
      )}

      {parkingHelp && <ParkingHelp onClose={() => setParkingHelp(false)} />}
      {policy && <PolicyInfo onClose={() => setPolicy(false)} />}

    </main>
  );
}

function SearchDialog({ origin, onClose, onPick }: { origin: Point; onClose: () => void; onPick: (p: Place) => void }) {
  const [q, setQ] = useState('');
  const results = PLACES.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog title="Where to?" onClose={onClose} icon={<Search size={22} aria-hidden="true" />}>
      <label className="field">
        <span className="sr-only">Search places in {AREA_NAME}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${AREA_NAME} places`} autoComplete="off" data-autofocus />
      </label>
      <p className="fine">WAVO serves {AREA_NAME} only.</p>
      <ul className="area-list" aria-label="Places">
        {results.map((p) => (
          <li key={p.id}>
            <button type="button" className="area-btn" onClick={() => onPick(p)}>
              <Flag size={18} aria-hidden="true" />
              <span>
                <strong>{p.name}</strong>
                <span>{formatMeters(distanceMeters(origin, p))} away</span>
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="fine">No places match “{q}”. Try “park” or “metro”.</li>}
      </ul>
    </Dialog>
  );
}

function EmptyCard({ kind, requiredKm, destination, origin, onClear, onChangeArea, onOpen }: { kind: 'filter' | 'range' | 'none'; requiredKm: number; destination: string | null; origin: Point; onClear: () => void; onChangeArea: () => void; onOpen: (id: string) => void }) {
  const { state } = useStore();
  const nearHubs = HUBS.map((h) => ({ h, m: distanceMeters(origin, h) })).sort((a, b) => a.m - b.m).slice(0, 3);
  const longest = [...availableScooters(state)].sort((a, b) => b.rangeKm - a.rangeKm)[0];
  return (
    <section className="map-card empty-card" aria-labelledby="empty-h">
      <span className="empty-icon">
        <SearchX size={24} aria-hidden="true" />
      </span>
      {kind === 'filter' && (
        <>
          <h2 id="empty-h" className="display-sm">
            No scooties match your filters
          </h2>
          <p>None of the available scooties has the {requiredKm}+ km estimated range {destination ? `for a trip to ${destination} and back` : 'you filtered for'}.</p>
          {longest && (
            <p className="fine">
              The longest range available is {longest.id} at ~{longest.rangeKm} km. {destination ? 'A closer destination would fit.' : ''}
            </p>
          )}
          <div className="btn-stack">
            <button type="button" className="btn btn-primary btn-block" onClick={onClear}>
              Clear filters
            </button>
            {longest && (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => onOpen(longest.id)}>
                View {longest.id} (~{longest.rangeKm} km)
              </button>
            )}
          </div>
        </>
      )}
      {kind !== 'filter' && (
        <>
          <h2 id="empty-h" className="display-sm">
            No scooties free near you right now
          </h2>
          <p>Every scooty at the hubs nearest you is rented, charging or in maintenance. Try another start area, or check again later.</p>
          <ul className="hub-mini-list" aria-label="Nearest hubs">
            {nearHubs.map(({ h, m }) => (
              <li key={h.id}>
                <MapPin size={14} aria-hidden="true" /> <strong>{h.name}</strong> · {formatMeters(m)} · 0 free · {SCOOTERS.filter((s) => s.hubId === h.id).length} docked
              </li>
            ))}
          </ul>
          <div className="btn-stack">
            {kind === 'range' && (
              <button type="button" className="btn btn-primary btn-block" onClick={onClear}>
                Clear filters
              </button>
            )}
            <button type="button" className={`btn ${kind === 'range' ? 'btn-secondary' : 'btn-primary'} btn-block`} onClick={onChangeArea}>
              Try another start area
            </button>
          </div>
          <p className="fine">Alternative: bus 41A and auto-rickshaw stands run along Lake Ring Road.</p>
        </>
      )}
    </section>
  );
}
