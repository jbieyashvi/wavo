import { batteryTone } from '../lib/data';

export function BatteryMeter({ value, large = false }: { value: number; large?: boolean }) {
  const tone = batteryTone(value);
  return (
    <span className={`battery ${large ? 'is-large' : ''} tone-${tone}`} role="img" aria-label={`Battery ${value}%${tone === 'low' ? ', low' : ''}`}>
      <span className="battery-shell" aria-hidden="true">
        <span className="battery-fill" style={{ width: `${value}%` }} />
      </span>
      <strong aria-hidden="true">{value}%</strong>
    </span>
  );
}
