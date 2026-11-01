import { Scale } from 'lucide-react';
import { Dialog } from './ui';
import { DEPOSIT_PAISE, EXCESS_LABEL, HOLD_BUFFER_MIN, HOLD_MAX_MIN, HOLD_MIN_MIN, OVERTIME_LABEL, RATES_NOTE, REMINDER_MIN, formatMoney } from '../lib/pricing';

/**
 * WAVO's proposed rental rules (DESIGN_NOTES "Proposed operator policies"). Every screen quotes these
 * strings so the policy reads the same everywhere. Legal questions stay in the internal docs.
 */
export const POLICY = {
  hold: `Your hold covers the walk to the hub plus ${HOLD_BUFFER_MIN} min for a helmet and checks, between ${HOLD_MIN_MIN} and ${HOLD_MAX_MIN} min.`,
  cancellation: 'Free to cancel any time before you unlock. If the hold runs out, the booking ends, nothing is charged and any payment authorisation is released.',
  unsafe: 'If a safety check finds a problem, the booking ends free and that scooty is taken out of service. We suggest another nearby at the same plan price; it isn’t held until you book it.',
  lateReturn: `Past your return time, ${OVERTIME_LABEL}, with no grace period. We remind you ${REMINDER_MIN} min before.`,
  billingStop: 'Billing stops once, when your return request at the return hub is accepted — retries don’t add time. The rental is complete only when the scooty is confirmed locked.',
  lockPending: 'If the lock can’t be confirmed, billing still stops at your request, but the scooty check stays pending and the deposit stays held until it’s done.',
  deposit: `${formatMoney(DEPOSIT_PAISE)} refundable deposit, held (not charged) at unlock. Its release starts once the scooty is confirmed locked; release timing isn’t fixed, so it shows as pending.`,
  earlyReturn: 'Returning early doesn’t refund unused booked time.',
  payment: 'The rental price is charged and the deposit held at the scooty, after your safety checks and just before unlock. Holding is free.',
  extension: 'Before your return time you can move up to a longer plan and pay the difference in base price. Not offered once late, during a return or after a breakdown report.',
  breakdown: 'If the scooty breaks down, report it: billing stops at the report and the rental is closed with assistance. The deposit stays held until the scooty is checked.',
  reassign: 'Change your return hub only with “Change return hub”, to a hub that can take the scooty before your return time. No fee, and your return time stays the same. Time and distance on the way there are billed as usual.',
  hubFull: 'If your return hub is full or closed, the rental can’t end there. Switch to another hub for free with “Change return hub”.',
  photo: 'A return photo is required. If your camera isn’t available, you can ask for an assisted check instead.',
};

export function PolicyInfo({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="Rental rules"
      icon={<Scale size={22} aria-hidden="true" />}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-block" onClick={onClose} data-autofocus>
          Done
        </button>
      }
    >
      <section className="policy-block" aria-labelledby="pol-h">
        <h3 id="pol-h">How renting works</h3>
        <p className="fine">Proposed for this concept — not any operator’s published terms.</p>
        <ul className="policy-list">
          <li>Hourly booking from one hub to a designated return hub. Rentals can only end inside that hub.</li>
          <li>{RATES_NOTE}</li>
          <li>{POLICY.hold}</li>
          <li>{POLICY.cancellation}</li>
          <li>{POLICY.unsafe}</li>
          <li>A licence check is needed once before your first booking; changing scooty doesn’t repeat it.</li>
          <li>{POLICY.payment}</li>
          <li>{POLICY.deposit}</li>
          <li>Locker helmets are first come, first served and never reserved. With no locker helmet and none of your own, the rental can’t start.</li>
          <li>{POLICY.lateReturn}</li>
          <li>Extra distance: {EXCESS_LABEL}, rounded up to the next whole km from a 0.1 km reading. Included distance is part of the price, not a promise of battery range.</li>
          <li>{POLICY.earlyReturn}</li>
          <li>{POLICY.extension}</li>
          <li>{POLICY.reassign}</li>
          <li>{POLICY.hubFull}</li>
          <li>{POLICY.photo}</li>
          <li>{POLICY.billingStop}</li>
          <li>{POLICY.lockPending}</li>
          <li>{POLICY.breakdown}</li>
        </ul>
      </section>
    </Dialog>
  );
}
