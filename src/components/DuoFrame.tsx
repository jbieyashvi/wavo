import { useState } from 'react';
import { ArrowLeft, ArrowRight, BatteryMedium, Footprints, LocateFixed, Map as MapIcon, Route as RouteIcon } from 'lucide-react';
import { AssetImage } from './AssetImage';
import { BatteryMeter } from './BatteryMeter';
import { HubZones, MapView, ScooterMarker, UserDot } from './MapView';
import { Wordmark } from './Icons';
import { FootSummary } from './ui';
import { VEHICLE, WELCOME_HERO } from '../lib/images';
import { AREA_NAME, DEMO_LOCATION, distanceMeters, hubById, type Scooter } from '../lib/data';
import { DEFAULT_HOURS, DEPOSIT_PAISE, formatHours, formatMoney, walkMinutes } from '../lib/pricing';
import { availableScooters, listBase, useStore } from '../state/store';
import { MODEL } from '../screens/ScooterSheet';

type DuoStep = 'welcome' | 'nearby' | 'details';

const STEPS: { id: DuoStep; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'nearby', label: 'Nearby scooties' },
  { id: 'details', label: 'Scooty details' },
];

/**
 * The first three screens laid out for an unfolded two-pane foldable. Each screen keeps
 * its content off the hinge: one pane for context (art or map), one for the task.
 * State is local; only "Set up rental" hands the chosen scooty to the phone prototype.
 */
export function DuoFrame() {
  const { state, navigate, dispatch } = useStore();
  const [step, setStep] = useState<DuoStep>('welcome');
  const scooters = availableScooters(state)
    .map((s) => ({ s, m: distanceMeters(DEMO_LOCATION, s) }))
    .sort((a, b) => a.m - b.m);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = scooters.find((x) => x.s.id === pickedId) ?? scooters[0] ?? null;

  const open = (id: string) => {
    setPickedId(id);
    setStep('details');
  };

  // Hand-off only from browsing, so a booking already in progress on the phone is never replaced.
  const busy = !!(state.reservation || state.ride);
  const setUp = (s: Scooter) => {
    if (state.location.status === 'unknown') dispatch({ type: 'SET_LOCATION', location: { status: 'granted' } });
    navigate({ screen: 'map', scooterId: s.id, step: 'setup' });
  };

  return (
    <section className="duo-stage" aria-labelledby="duo-title">
      <div className="duo-caption">
        <h2 id="duo-title">Foldable · unfolded</h2>
        <div className="duo-steps" role="tablist" aria-label="Foldable screens">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={step === s.id} className={`duo-step ${step === s.id ? 'is-on' : ''}`} onClick={() => setStep(s.id)}>
              <span className="duo-step-n">{i + 1}</span> {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="duo" role="tabpanel" aria-label={STEPS.find((s) => s.id === step)?.label}>
        {step === 'welcome' && (
          <>
            <div className="duo-pane duo-art">
              <AssetImage asset={WELCOME_HERO} className="welcome-hero" sizes="320px" />
            </div>
            <div className="duo-pane duo-panel duo-welcome">
              <Wordmark />
              <h3 className="display duo-title">
                <span>A little ride.</span> <span>A lot to explore.</span>
              </h3>
              <p className="duo-sub">Rent an electric scooty by the hour from hubs around {AREA_NAME}.</p>
              <div className="duo-actions">
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setStep('nearby')}>
                  Let’s ride <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-quiet btn-lg btn-block" onClick={() => setStep('nearby')}>
                  <MapIcon size={20} aria-hidden="true" /> Explore the map
                </button>
              </div>
              <p className="duo-fine">No account needed. Everything here is simulated.</p>
            </div>
          </>
        )}

        {step === 'nearby' && (
          <>
            <div className="duo-pane duo-panel">
              <div className="duo-head">
                <button type="button" className="icon-btn" onClick={() => setStep('welcome')} aria-label="Back to welcome">
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <div>
                  <h3 className="duo-h">Nearby scooties</h3>
                  <p className="duo-meta">
                    <LocateFixed size={14} aria-hidden="true" /> Sample location · {scooters.length} available
                  </p>
                </div>
              </div>
              {scooters.length === 0 ? (
                <p className="duo-sub">No scooties are available right now.</p>
              ) : (
                <ul className="duo-list">
                  {scooters.map(({ s, m }) => (
                    <li key={s.id}>
                      <button type="button" className="duo-card" onClick={() => open(s.id)}>
                        <span className="nearby-thumb">
                          <AssetImage asset={VEHICLE} sizes="52px" alt="" />
                        </span>
                        <span className="nearby-main">
                          <strong>{MODEL.replace(' e-scooty', '')}</strong>
                          <span className="nearby-key">
                            <span className="nowrap">{walkMinutes(m)} min walk</span> ·{' '}
                            <span className={`nowrap tone-${s.battery >= 50 ? 'good' : s.battery >= 20 ? 'mid' : 'low'}`}>
                              <BatteryMedium size={14} aria-hidden="true" /> ~{s.rangeKm} km
                            </span>
                          </span>
                          <span className="nearby-id">
                            {s.id} · {hubById(s.hubId)?.name}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="duo-pane duo-map">
              <DuoMap scooters={scooters.map((x) => x.s)} selected={null} onSelect={open} />
            </div>
          </>
        )}

        {step === 'details' && picked && (
          <>
            <div className="duo-pane duo-map">
              <DuoMap scooters={scooters.map((x) => x.s)} selected={picked.s} onSelect={open} />
            </div>
            <div className="duo-pane duo-panel duo-details">
              <div className="duo-scroll">
                <button type="button" className="btn-link duo-back" onClick={() => setStep('nearby')}>
                  <ArrowLeft size={16} aria-hidden="true" /> Nearby scooties
                </button>
                <div className="duo-vehicle">
                  <span className="sd-art-tile">
                    <AssetImage asset={VEHICLE} className="sd-art" sizes="76px" />
                  </span>
                  <div>
                    <h3 className="duo-h">{MODEL}</h3>
                    <p className="duo-key">
                      <span className="nowrap">
                        <Footprints size={16} aria-hidden="true" /> {walkMinutes(picked.m)} min walk
                      </span>
                      <span className="nowrap">
                        <RouteIcon size={16} aria-hidden="true" /> ~{picked.s.rangeKm} km range
                      </span>
                    </p>
                    <p className="duo-meta">{picked.s.id}</p>
                  </div>
                </div>
                <dl className="facts is-flat">
                  <div>
                    <dt>Battery</dt>
                    <dd>
                      <BatteryMeter value={picked.s.battery} />
                    </dd>
                  </div>
                  <div>
                    <dt>Pickup</dt>
                    <dd>
                      {hubById(picked.s.hubId)?.name} hub
                      <span className="facts-sub">
                        {hubById(picked.s.hubId)?.landmark} · open {hubById(picked.s.hubId)?.open}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Helmets</dt>
                    <dd>{hubById(picked.s.hubId)?.helmets ? `${hubById(picked.s.hubId)?.helmets} in the locker at the last check` : 'None in the locker — bring your own'}</dd>
                  </div>
                </dl>
              </div>
              <div className="duo-foot">
                {busy ? (
                  <p className="duo-fine">You have a booking in progress on the phone. Finish it there first.</p>
                ) : (
                  <>
                    <FootSummary>
                      {formatHours(DEFAULT_HOURS)} from {formatMoney(listBase(state, DEFAULT_HOURS))} · Deposit hold {formatMoney(DEPOSIT_PAISE)}
                    </FootSummary>
                    <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setUp(picked.s)}>
                      Set up rental
                    </button>
                    <p className="duo-fine duo-handoff">Continues in the phone prototype.</p>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        <span className="duo-hinge" aria-hidden="true" />
      </div>
      <p className="duo-note">Two-pane layout explored for a concept foldable (iPhone Duo mock-up). Not tested on a real device.</p>
    </section>
  );
}

function DuoMap({ scooters, selected, onSelect }: { scooters: Scooter[]; selected: Scooter | null; onSelect: (id: string) => void }) {
  return (
    <MapView focus={selected ?? DEMO_LOCATION} focusKey={selected?.id ?? 'me'} label="Map of hubs and scooties" svgOverlay={<HubZones highlight={selected?.hubId ?? null} />}>
      <UserDot point={DEMO_LOCATION} label="Your sample location" />
      {scooters.map((s) => (
        <ScooterMarker key={s.id} scooter={s} selected={selected?.id === s.id} meters={distanceMeters(DEMO_LOCATION, s)} onSelect={() => onSelect(s.id)} />
      ))}
    </MapView>
  );
}
