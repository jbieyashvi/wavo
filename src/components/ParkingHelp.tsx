import { MapPin } from 'lucide-react';
import { Dialog } from './ui';

export function ParkingHelp({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="How hubs and returns work"
      onClose={onClose}
      icon={<MapPin size={22} aria-hidden="true" />}
      footer={
        <button type="button" className="btn btn-primary btn-block" onClick={onClose} data-autofocus>
          Got it
        </button>
      }
    >
      <ol className="steps">
        <li>
          <strong>Pick up at a hub.</strong> Every scooty lives in a marked hub (the blue <abbr title="hub">H</abbr> areas on the map).
        </li>
        <li>
          <strong>Return to your chosen hub.</strong> You pick the return hub when booking. The rental can only end inside that hub.
        </li>
        <li>
          <strong>Park in a bay.</strong> Centre stand down, handlebar locked, helmet back in the hub locker.
        </li>
        <li>
          <strong>Take a quick photo.</strong> It records the scooty’s condition when you returned it.
        </li>
        <li>
          <strong>Outside the hub, or at a different one?</strong> The rental can’t end yet and the meter keeps running. If your hub is full, you can switch for free.
        </li>
      </ol>
      <p className="fine">These are WAVO’s proposed rental rules, not legal rules.</p>
    </Dialog>
  );
}
