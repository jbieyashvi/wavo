import { DuoFrame } from './components/DuoFrame';
import { ConceptBar } from './components/DemoMenu';
import { Wordmark } from './components/Icons';
import { StoreProvider, useStore } from './state/store';
import { EndRide } from './screens/EndRide';
import { MapScreen } from './screens/MapScreen';
import { Receipt } from './screens/Receipt';
import { Reservation } from './screens/Reservation';
import { Review } from './screens/Review';
import { Ride } from './screens/Ride';
import { Unlock } from './screens/Unlock';
import { Welcome } from './screens/Welcome';

function CurrentScreen() {
  const { state } = useStore();
  switch (state.route.screen) {
    case 'welcome':
      return <Welcome />;
    case 'map':
      return <MapScreen />;
    case 'review':
      return <Review />;
    case 'reservation':
      return <Reservation />;
    case 'unlock':
      return <Unlock />;
    case 'ride':
      return <Ride />;
    case 'endRide':
      return <EndRide />;
    case 'receipt':
      return <Receipt />;
  }
}

function Phone() {
  const { state, toast } = useStore();
  return (
    <div className="phone" data-screen={state.route.screen}>
      <div className="screen-host" key={state.route.screen}>
        <CurrentScreen />
      </div>
      <ConceptBar />
      <div className="toast-region" role="status" aria-live="polite">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <div className="stage">
        <aside className="stage-note" aria-label="About this concept">
          <Wordmark />
          <p>
            WAVO is a design concept for renting electric scooties by the hour, set in a fictional Indian neighbourhood. Vehicles, bookings, payments, verification and support are simulated — nothing is booked, charged or unlocked.
          </p>
          <p className="stage-hint">“About” at the top of the phone explains what is simulated and turns on reviewer mode for edge cases.</p>
        </aside>
        <Phone />
        <DuoFrame />
      </div>
    </StoreProvider>
  );
}
