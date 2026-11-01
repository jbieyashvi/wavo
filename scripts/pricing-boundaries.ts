// Prints boundary checks for the demo pricing rules. Run: npx --yes tsx scripts/pricing-boundaries.ts
import { PLANS, chargesForRental, formatMoney } from '../src/lib/pricing';

let failures = 0;
const check = (label: string, got: number, want: number) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${formatMoney(got)}${ok ? '' : ` (expected ${formatMoney(want)})`}`);
};

for (const p of PLANS) {
  const d = p.hours * 3600;
  const base = p.basePaise;
  check(`${p.hours} h · at deadline`, chargesForRental(p.hours, d, 0).totalPaise, base);
  check(`${p.hours} h · deadline +1 s`, chargesForRental(p.hours, d + 1, 0).totalPaise, base + 3000);
  check(`${p.hours} h · +15 min exactly`, chargesForRental(p.hours, d + 900, 0).totalPaise, base + 3000);
  check(`${p.hours} h · +15 min 1 s`, chargesForRental(p.hours, d + 901, 0).totalPaise, base + 6000);
  check(`${p.hours} h · +30 min exactly`, chargesForRental(p.hours, d + 1800, 0).totalPaise, base + 6000);
  check(`${p.hours} h · at ${p.includedKm} km`, chargesForRental(p.hours, 60, p.includedKm).totalPaise, base);
  check(`${p.hours} h · at ${p.includedKm + 0.1} km`, chargesForRental(p.hours, 60, p.includedKm + 0.1).totalPaise, base + 600);
  check(`${p.hours} h · at ${p.includedKm + 1} km`, chargesForRental(p.hours, 60, p.includedKm + 1).totalPaise, base + 600);
  check(`${p.hours} h · at ${p.includedKm + 1.1} km`, chargesForRental(p.hours, 60, p.includedKm + 1.1).totalPaise, base + 1200);
}
console.log(failures ? `\n${failures} failure(s)` : '\nAll boundary checks passed');
process.exit(failures ? 1 : 0);
