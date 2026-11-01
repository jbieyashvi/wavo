import { ArrowRight, Map } from 'lucide-react';
import { AssetImage } from '../components/AssetImage';
import { WELCOME_HERO } from '../lib/images';
import { Wordmark } from '../components/Icons';
import { useStore } from '../state/store';
import { MANUAL_AREAS } from '../lib/data';

export function Welcome() {
  const { state, navigate, dispatch } = useStore();

  const letsRide = () => navigate({ screen: 'map' });
  const explore = () => {
    // Browsing doesn't need location: start from a default area the rider can change.
    if (state.location.status === 'unknown') dispatch({ type: 'SET_LOCATION', location: { status: 'manual', areaId: MANUAL_AREAS[0].id } });
    navigate({ screen: 'map' });
  };

  return (
    <main className="screen welcome" aria-labelledby="welcome-title">
      <div className="welcome-art-wrap">
        <AssetImage asset={WELCOME_HERO} className="welcome-hero" sizes="(min-width: 500px) 420px, 100vw" priority />
      </div>
      <div className="welcome-panel">
        <Wordmark className="welcome-wordmark" />
        <h1 id="welcome-title" className="display welcome-title">
          <span>A little ride.</span> <span>A lot to explore.</span>
        </h1>
        <p className="welcome-sub">Rent an electric scooty by the hour from hubs around Sarovar Layout.</p>
        <div className="welcome-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={letsRide}>
            Let’s ride
            <ArrowRight size={20} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-quiet btn-lg" onClick={explore}>
            <Map size={20} aria-hidden="true" />
            Explore the map
          </button>
        </div>
        <p className="welcome-fine">No account needed. Everything here is simulated — see About.</p>
      </div>
    </main>
  );
}
