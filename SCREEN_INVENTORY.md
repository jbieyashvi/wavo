# WAVO — screen inventory for Figma

This inventory covers the customer journey and its error states, in the order a rider meets them. It is built from the running concept (Phase 6). **Nothing here is validated with real users.** Prices and rules are the *proposed* concept policies in `DESIGN_NOTES.md` section 3 (P1–P15).

**How to reach the edge states.** Open "About" → turn on reviewer mode (or load `?reviewer=1`). Then use the amber **Reviewer** pill → *Reviewer scenarios* group. Reviewer-only UI (the Reviewer pill, dashed amber notes) is **not** part of the customer design. Design it only as a separate reviewer frame.

## 1. Main journey

| # | Screen (heading) | Route / component | Key content | Primary / secondary actions | Back behaviour |
|---|---|---|---|---|---|
| 1 | Welcome | `welcome` · `Welcome.tsx` | Hero, value line, "No account needed. Everything here is simulated — see About." | Let’s ride · Explore the map | — |
| 2 | **Find a scooty** (map; heading is screen-reader only) | `map` · `MapScreen.tsx` | Location prompt → "Use sample location"; map with hub markers; search "Where to?"; filter "Range 5+ km"; **Nearby scooties** row (cards lead with model, walk time and range; ID · hub secondary) | Select scooty | Back → Welcome |
| 3 | Scooty sheet · step 1 Duration & distance | `map` + `step` · `ScooterSheet.tsx` | Battery, range, plan picker 1/2/4/8 h with km allowance, planned distance, "Illustrative prices" tag, "Rental rules" link | Set up rental | Close → map |
| 4 | Sheet · step 2 Return hub | same | Hubs with distance, status (open / closing / closed / full) | Continue | Step back |
| 5 | Sheet · step 3 Licence check | same | "Check my licence" + simulated fine print | Review booking | Step back |
| 6 | **Review booking** ("Step 3 of 3") | `review` · `Review.tsx` | Divider sections: Rental (Change); Charges (rental · deposit hold, rates, "When the deposit is released"); Pay with UPI / Card + simulated line; Cancellation and return. Footer summary "Held free for N min, to {time} · no charge yet" | Confirm and hold · Change · Rental terms | Back → sheet step 3 |
| 7 | **Scooty reserved** | `reservation` · `Reservation.tsx` | Hold countdown and expiry time, hub · bay, walking directions, Beep to find it | I'm at the scooty · Cancel hold (free) · Can't find it? | Back → map (keeps the reservation) |
| 8 | "Find it · 1 of 3" — Scan | `unlock` · `Unlock.tsx` (scanner) | Viewfinder (camera never opened), one-line simulated note | Scan QR code · Enter code · Get help · torch | Back → reservation |
| 9 | "Checks · 2 of 3" — "Check WV-xxxx" | `Unlock.tsx` | "Identified · still locked" row; two sections (Vehicle condition / Before you ride), 7 required ticks; "Something wrong?" section; footer "N of 7 checked" or the unticked error | Continue to payment · Report a problem | Step back |
| 10 | "Pay · 3 of 3" — "Pay and unlock" | `Unlock.tsx` | One-line status; "At unlock" section (Rental, Deposit hold · refundable — no combined total), late rate, return hub; footer summary "Rental ₹X · Deposit hold ₹500" | Pay with UPI / card · Release booking | Step back |
| 11 | Ready to unlock | `Unlock.tsx` | Payment authorised (simulated — no money moved) | Unlock and start rental | — (paid) |
| 12 | **Rental in progress** | `ride` · `Ride.tsx` | Time left / cost so far / distance; range line; "Return to" hub (22 px) with due time and distance; "Finding the bays" (collapsed, holds directions); illustration secondary; safety line | End rental · Change (hub) · Need more time? · Help | Browser Back stays on the ride |
| 13 | End rental · 1 Location | `endRide` · `EndRide.tsx` | "Return at {hub}", hub map, inside/outside status | Continue | Back → ride |
| 14 | End rental · 2 Photo & helmet | same | Add photo / Retake; helmet radios (locker / own) | Continue | Step back |
| 15 | End rental · 3 Request | same | Time used / distance / hub; "Charges so far" (late and extra only when > ₹0), total if you request now; "What happens next" (billing-stop and lock-pending rules) | Request return and lock | Step back |
| 16 | Locking | `EndRide.tsx` (lock) | "Return requested", progress | — | Locked in |
| 17 | **Rental summary** — confirmed | `receipt` · `Receipt.tsx` | Chip "Scooty locked · return confirmed"; **Charges** first (non-zero lines, Total charged, "Deposit hold · release pending"); zero-value late/extra rows inside "Charge details"; **Return** (Lock confirmed, Return requested, Time billed, Distance) then map; optional rating | Start a new rental · Report an issue with this charge | Back → map (receipt kept) |

## 2. Error and edge states

| Screen | State | What the rider sees | Reviewer scenario |
|---|---|---|---|
| Map | Location declined | Explanation + "Use sample location instead" | Discovery → Location declined |
| Map | Outside service area | "WAVO serves Sarovar Layout only." | Discovery → Outside the service area |
| Map | No scooties | Empty state "Try another start area, or check again later." | Discovery → No scooties available |
| Map / sheet | Pickup hub closed / closing in 20 min | Hub status, booking blocked or warned | Discovery → hub closed / closes in 20 min |
| Sheet | Licence pending / not eligible / connection error | Neutral pending, clear refusal, retry | Booking → Licence check … |
| Sheet / Review | Trip longer than allowance or range | Inline warning, suggest longer plan / more range (not blocking) | — (enter a planned distance) |
| Review | Return hub can't take the rental | Alert + "New return hub" select; confirm disabled | Return → hub full / closed (before booking) |
| Review | Price changed | Dialog "The price has changed" — Review new price / Don't book | Booking → Price rises before confirming |
| Review | Scooty taken | Dialog "{id} was just taken" — view nearest / Back to map | Discovery → Scooty taken while booking |
| Reservation | Hold warning / expired | Countdown warning; expired view, nothing charged | Pickup → Expire hold now |
| Reservation | Cancel hold | Alert dialog "Yes, cancel for free" | — |
| Scan | Scanner unavailable | Code entry route | Pickup → Scanner unavailable |
| Checks | Missing ticks | Error, focus on first unticked | — |
| Checks | Report a problem — cosmetic / unsafe | Cosmetic: noted, continue. Unsafe: booking ended free, scooty withdrawn, nearest other suggested (not held) | — |
| Pay | Declined / pending / cancelled | "didn't go through… nothing was charged" + retry; pending never shown as success | Pickup → Payment … |
| Unlock | Fails / times out / uncertain | Retry or release; "Checking vehicle status" until confirmed | Pickup → Unlock … |
| Ride | 15-min reminder, at return time, late | Reminder; late blocks accrue (no grace) | Active rental → time jumps |
| Ride | Low battery / insufficient range | Warning with distance to hub + "switch to a closer hub"; Help suggests switching or reporting a breakdown (P15) | Active rental → Low battery |
| Ride | Change return hub | List with distances → "Return to X instead?" (free, same return time; detour time and distance billed as usual — P8) | — |
| Ride | Need more time? | Extend dialog, base-price difference, simulated payment | — |
| Ride | Breakdown | Report → billing stops → closed with assistance; summary pending | Help → breakdown |
| End · Location | Wrong hub / edge / outside / hub full / hub closed | Heading + consequence ("The rental and meter stay active…") + one primary recovery in the footer (Back to rental / Check position again / Choose another return hub) | Active rental movement; Return → hub full / closed |
| End · Photo | Camera unavailable | Assisted check (simulated) instead of photo | Return → Camera unavailable |
| End · Helmet | Not confirmed | "Tell us where the helmet is." | — |
| Lock | Lock fails | "The lock didn't engage"; push onto stand; keep it on its stand in the bay; Scooty locked: Not yet confirmed; Billing: Stopped at …; "Your rental isn't complete until then." Try locking again / Still stuck? Get assistance | Return → Lock fails |
| Lock | Uncertain / connection lost | "Return requested", Check lock status; no summary yet | Return → Lock result uncertain / Connection lost |
| Lock | Close with assistance (dialog) | Billing stays stopped; check pending; deposit held; assistance simulated | — |
| **Rental summary — pending** | Assisted close or breakdown | Chip "Billing closed · scooty check pending"; "Closed with assistance" / "Breakdown reported"; "Deposit hold · kept until scooty check" | Return → Lock fails, then assistance |
| Rental summary | Report an issue | Reason required; "Reporting is simulated — nothing was sent" | — |

**Overlays (all screens):** About this concept · Rental rules (`PolicyInfo`) · Parking / hub help (`ParkingHelp`) · toasts. **Reviewer only:** Reviewer scenarios dialog, reviewer notes.

## 3. Terminology (use exactly)

- **scooty** (not scooter or bike); **hub**, **return hub**; **rental** (not ride or trip, in headings); **hold** (pre-unlock reservation); **booking** + ID `B-XXXX`; vehicle ID `WV-NNNN`.
- **Return requested** → **Lock confirmed** / **Closed with assistance**. Use "complete" only for a confirmed lock.
- **Deposit · held, not charged** (Review) → **release pending** (locked) / **held until scooty check** (assisted or breakdown).
- **Illustrative prices. Taxes not shown.** Use "Simulated" only where an action could mislead.

## 4. Prices and policies (single source)

- Prices: `src/lib/pricing.ts` — 1 h ₹99/15 km · 2 h ₹179/30 km · 4 h ₹319/50 km · 8 h ₹549/80 km · ₹30 per started 15 min late (no grace) · ₹6 per started km over · ₹500 deposit · hold walk + 10 min (10–30) · reminder 15 min before.
- Policy text: `POLICY` in `src/components/PolicyInfo.tsx`. Review, End rental, Ride and Rental summary quote it, so copy stays the same everywhere.

## 5. Component states to design

- Buttons: primary / secondary / link, disabled, busy (`aria-busy`), `aria-disabled` with explanation.
- Radios and checkboxes (`check`, `check radio`), on / off / error.
- Chips: `rc-status` ok / pending; `sim-tag`; hub status (open, closing, closed, full).
- Callouts: info / alert / warn; inline warnings.
- Dialogs: standard, alert (`tone="alert"`), with footer stacks.
- Countdown (hold), live meter (ride), stepper (End rental 1–3, Unlock 1–3).
- Map markers: scooty, hub, selected, "Return here", receipt P/R labels.

## 6. Back-navigation checks

Observed by Claude's browser automation in desktop Chrome (Phases 5–6), not by a person and not on a device:
- Review → back → sheet step 3.
- Browser Back during a ride stays on the ride.
- From the Rental summary, Start a new rental goes to the map. Back stays on the map; the old rental is not revived.
- Refresh restores each step (`sessionStorage`).

Not fully checked: every step-back combination inside the sheet and End rental.

## 7. Visual hierarchy pass — before / after

Visual cleanup only. Prices, policies, validation and rental logic did not change; `scripts/state-guards.ts` and `scripts/pricing-boundaries.ts` still pass.

| Screen | Before | After |
|---|---|---|
| All | Mixed 15 px body text; price inside buttons ("Pay ₹X + hold deposit"); cards nested in cards | 16 px body and controls, 14 labels, 12–13 metadata, 22–24 headings; divider sections, no card-in-card; one summary line above one full-width button; controls ≥ 44 px (the sheet's drag handle stays 26 px) |
| Map | "Scooties at nearby hubs"; cards led with the ID | "Nearby scooties"; model → walk · range → ID · hub |
| Review | Long footer note; "Confirm and hold for N min" | One-line footer summary; "Confirm and hold" |
| Scan | Long simulated note; "Can't find it" wrapped at 320 px | One-line note; "Get help"; buttons stay on one line |
| Checks | One long list; "Checks done — continue to payment"; "Something is wrong" | Two sections; tick count in the footer; "Continue to payment"; "Report a problem" in its own section |
| Pay | "Total authorised" row merged the charge and the hold | Rental and deposit hold on separate lines, never summed; shorter status messages with one recovery each |
| Ride | Boxed return card, directions and image competing with "End rental at {hub}" | Time / cost / range first; flat "Return to" block; directions behind "Finding the bays"; one primary "End rental" + text link "Need more time?" |
| End rental | Recovery buttons inside the error callout; ₹0 late/extra lines | Heading + consequence + one primary recovery in the footer; one task per step; ₹0 lines hidden |
| Receipt | Map and stat tiles first; ₹0 rows always shown | Charges, deposit status and return confirmation first; ₹0 rows under "Charge details"; map last. Non-zero charges and pending status are always visible |

**How this was checked (in a desktop browser, not with users):** the booking → receipt flow at the 390 px frame, plus the lock-fail → assisted-close pending receipt; an automated check at 320 / 360 / 390 / 430 px for horizontal overflow, the footer covering scroll content, and controls under 44 px, with every "More" section expanded and a stress-test hub name of 41 characters; and Tab-key focus on the receipt. This is not a full accessibility audit.

## 8. Honest open items for the Figma pass

- The welcome hero is a kick-scooter cockpit, not a seated scooty (DESIGN_NOTES §11). Replace it.
- No real-user, real-device or assistive-technology testing has been done. Large-text layouts at 320 px partly scroll.
- All operator policies are **proposed**. A real operator must confirm P1–P15, especially the deposit mechanism per payment method (UPI vs card hold is unresolved, P10), deposit timing (none is promised), what a real assisted check is, licence recheck frequency (P13), detour billing (P8) and range handling (P15).
- Legal items (licence class and age, helmets, pillion, registration, insurance, permits, tax, consumer rules, data retention) are unresolved and kept out of customer copy.
- Map is illustrative (no routing, no live availability).
