# WAVO — design notes

WAVO is a portfolio concept for **hourly, hub-to-hub rental of seated electric scooties in an Indian city**. It is an interactive prototype that runs on simulated data. **No user research or usability testing has been done.** Everything below is design reasoning or an assumption to test. None of it is a finding. The prototype is **not production-ready**.

---

## 1. Audience and scope

**Intended audience (assumed, not researched)**
- City residents and visitors who need a scooty for an hour or more: errands, commutes, a day out. They may be renting for the first time, often one-handed, standing near a hub.
- Riders who are price-sensitive and want every charge (base, deposit, late, extra km) visible *before* they commit.

**In scope**
- The full path: Welcome → Map → 3-step scooty sheet (duration and planned distance → return hub → simulated licence check) → Review booking → Reservation hold → Find 1 of 3 (simulated QR or code entry) → Safety checks 2 of 3 → Payment 3 of 3 (simulated UPI/card authorisation) → Unlock → Active rental → End rental (hub check, photo, helmet, request return) → Lock confirmation → Rental summary.
- Edge cases, reachable in **reviewer mode** (About → reviewer switch, or `?reviewer=1`) from the **Reviewer** pill → Reviewer scenarios:
  - location declined, no scooties nearby
  - scooty taken while confirming
  - licence check ineligible
  - unlock failure and retry, invalid code
  - hold expiry (during scanning and during checks)
  - cosmetic or unsafe damage, with an alternative vehicle
  - wrong hub and outside any hub when ending
  - return hub full (free switch)
  - connection failure while ending
  - lock fails, uncertain or connection lost after the return request, with assisted close
  - breakdown during a rental, low battery
  - rental time jumps and simulated rider movement (Active rental group)
- Responsive layout: designed at 390 px, works down to 320 px; desktop shows a centred phone frame.
- Accessibility work built in (not audited; see section 10 for what was and wasn't checked): native buttons and form controls, labelled controls, a 3 px focus outline, live-region announcements for status changes, and a `prefers-reduced-motion` rule.

**Out of scope**
- Accounts, sign-up, phone numbers or OTPs, real licence/ID checks or document upload, real payments or deposits, wallets, promotions, ride history, notifications, multiple languages, pillion handling, real maps or GPS, hardware unlocking, and any backend.

---

## 2. India conversion — demo area and pricing

**Demo area.** *Sarovar Layout, Nilapur* is fictional. So are its five hubs (Kamal Park Gate, Phool Bazaar, Sarovar Metro, City Library, Old Ghat), their bay counts and helmet stock, the streets and the vehicles. The map is a hand-drawn SVG of this fictional area. Customer screens label prices "Illustrative prices. Taxes not shown." and the ride scene "Static illustration · not your route"; the map itself has no separate label, and About explains that vehicles and availability are sample data.

**One shared pricing model** (`src/lib/pricing.ts`, amounts in paise). Every screen (sheet, review, unlock, ride meter, end-rental summary, receipt) reads from it. **All values are illustrative demo values, not any operator's actual rates.** Taxes are not modelled.

| Plan | Base | Included km |
|---|---|---|
| 1 h | ₹99 | 15 km |
| 2 h (default) | ₹179 | 30 km |
| 4 h | ₹319 | 50 km |
| 8 h | ₹549 | 80 km |

- Late return: ₹30 per started 15 min after the booked time, with no grace period (1 s late = 1 block).
- Extra distance: ₹6 per started km over the allowance. Billed from the same 0.1 km reading the rider sees, so "15.0 / 15 km" costs nothing extra.
- Refundable deposit: ₹500, *proposed* as held, not charged (P10). After a confirmed lock the summary shows it as **"release pending"**, not "released"; after an assisted close or breakdown, **"held until scooty check"**. Release timing would depend on a payment provider and operator, and whether a hold is possible at all depends on the payment method (unresolved, see P10 and section 12). Simulated; nothing is blocked.
- Authorised at the scooty = base + deposit (for example, ₹99 + ₹500 = ₹599): the base is charged, the deposit held. This is authorised after the scooty is identified and the checks pass, not at booking.
- Early return does not refund unused time (proposed policy).

**Shown before reservation** (sheet footer and Review booking): duration, pickup hub, designated return hub, return-by rule, included km, late and excess rates, deposit, hold length, cancellation and late policy, helmet availability at the pickup locker, and the simulated payment choice.

---

## 3. Proposed operator policies (concept) and legal points

These are **proposed policies for this concept and all require validation** with a real operator (and, where noted, a payment provider). They are not any real operator's terms, and no real operator facts were invented to produce them. They resolve the operator questions that section 12 used to list. They are written once in `POLICY` (`src/components/PolicyInfo.tsx`) and the price constants in `src/lib/pricing.ts`, and every screen quotes those, so the wording and numbers stay the same everywhere. Customers see them in the "Rental rules" dialog, labelled "Proposed for this concept — not any operator's published terms."

| # | Topic | Proposed policy | Where it shows |
|---|---|---|---|
| P1 | **Hold length and expiry** | The estimated walk plus 10 min (helmet and checks), clamped to 10–30 min. Holding is free and can't be extended. On expiry the booking ends, the scooty is released, nothing is charged, and any payment authorisation and deposit hold are released. | Review, Reservation, expired view, Rental rules |
| P2 | **Cancellation** | Free any time before unlock. It can't be cancelled while an unlock is in flight. | Review, Reservation, Rental rules |
| P3 | **Unsafe vehicle** | If a pre-ride check finds a safety problem, the booking ends free and that scooty is withdrawn. The nearest other scooty is *suggested* at the same plan price but is **not** held automatically. Cosmetic issues are noted and the rental continues. | Unlock checks, Reservation, Rental rules |
| P4 | **Late return** | ₹30 per *started* 15 min past the return time. **No grace period**: 1 s late is one block. A reminder comes 15 min before the return time. | Ride, End rental, Rental summary, Rental rules |
| P5 | **Billing cutoff** | Billing (time and distance) stops **once**, when the return request at the return hub is accepted. That happens after the hub, photo (or assisted check) and helmet steps pass. Retries, an uncertain lock or a lost connection after that point add nothing. | End rental (request step), Rental summary |
| P6 | **Completion vs vehicle security** | A rental is **complete** only when the lock is confirmed (summary chip "Scooty locked · return confirmed"). If the lock can't be confirmed, the rider can retry or "Close with assistance". The rental then closes with billing still stopped at the request, but **vehicle security is a separate, pending state**: chip "Billing closed · scooty check pending", stat "Closed with assistance", deposit "held until scooty check". It is never shown as fully completed. | Lock-pending screen, assisted-close dialog, Rental summary |
| P7 | **Breakdown during a ride** | Billing stops at the report. The rental is closed with assistance (simulated), security is pending, and the deposit is held until the scooty is checked. | Ride, Rental summary |
| P8 | **Full or closed return hub** | The rental can't end there. The rider switches to another hub through "Change return hub" (a confirmed reassignment). This is **free**, and the return time stays the same. **Detour charges:** there is no credit or adjustment for the detour; its time and distance are billed as usual, so a detour can cause late blocks or extra km (code: `rideCharges` has no reassignment adjustment; Rental rules says so). It is refused once a return is requested. *Requires validation:* whether a rider sent away from a full or closed hub should get extra time or a distance credit. | Review (blocked return hub), Ride, End rental, Rental rules |
| P9 | **Return photo / assisted check** | A return photo is required. If the camera is unavailable, the rider can choose an assisted check instead. In this concept that is **simulated**: nobody is contacted and nothing is inspected. The summary records that the assisted check was used. What a real assisted check would involve is out of scope. | End rental, Rental summary |
| P10 | **Deposit** | ₹500. **Proposed mechanism (as built):** one authorisation at the scooty for base + deposit, with the base charged and the deposit held, not charged. The same mechanism and the same copy are used whichever method (UPI or card) is selected. After a confirmed lock it shows as "release pending". After an assisted close or breakdown it shows as "held until scooty check". **No release time is promised and no refund is promised.** **Unresolved:** whether UPI and card can both support an equivalent authorisation hold and release has **not** been established. The prototype must not be read as assuming they do. If validation shows a method needs a different mechanism (for example, charging the deposit and refunding it later), the customer copy and the simulated payment states for that method must change to match (see section 12). | Review, Pay, Reservation expiry/cancel, Rental summary, Rental rules |
| P11 | **Early return / extension** | No refund for unused time. Before the return time, the rider can move up to a longer plan and pay the base-price difference. Not offered once late, during a return or after a breakdown. | Review, Ride, Rental rules |
| P12 | **Prices** | Illustrative: 1 h ₹99 / 15 km, 2 h ₹179 / 30 km, 4 h ₹319 / 50 km, 8 h ₹549 / 80 km. Excess ₹6 per started km from the 0.1 km reading. Taxes are not shown or modelled. Labelled "Illustrative prices. Taxes not shown." | Sheet, Review, Rental summary |
| P13 | **Licence check** | Once per rider session before the first booking; changing scooty doesn't repeat it (turning reviewer mode off clears scenarios, which resets it). Simulated: no number, photo or document is collected and nothing is verified. *Requires validation:* the recheck frequency (per session, per rental, per period, or on expiry of the document) is a proposal, not a known requirement. | Sheet, Rental rules |
| P14 | **Helmet** | Locker helmets are first come, first served and never reserved. Without a locker helmet or the rider's own, the rental can't start. Where the helmet went is confirmed at return. | Sheet, Review, Unlock checks, End rental |
| P15 | **Insufficient range** | *Before booking:* a planned distance over 85% of the scooty's estimated range shows a "tight" warning, and over the range suggests a scooty with more range; neither blocks booking. *During a rental:* when estimated range left is below the distance to the return hub plus 3 km, the ride shows a warning with a "switch to a closer hub" link, and Help says to switch hub or report a breakdown rather than leave the scooty outside a hub. A breakdown report then follows P7 (billing stops, deposit held). No battery swap, top-up or range credit is offered. *Requires validation:* the 85% and +3 km thresholds, whether booking should be blocked, and whether running out of range is treated as a breakdown or as the rider's responsibility. | Sheet, Ride, Help |

**Legal points: unresolved, internal only.** These are kept out of customer copy. The customer sees only the WAVO rule, never a legal claim, and the booking flow does not show a legal checklist. Each needs checking against official central and state sources.
- Licence class for this vehicle category, including any low-speed e-scooter rules, and the minimum rider age.
- Helmet requirements and standard (rider and pillion), and whether an operator must supply helmets.
- Pillion rules on a rented scooty.
- Fleet registration, insurance, and permits for hubs and parking.
- Tax treatment and invoicing of rental charges, late fees and deposits.
- Consumer-protection obligations on deposits, pre-authorisation holds, charge disputes and refunds.
- Retention and consent rules for return photos, location and licence data.

---

## 4. Assumptions that need research

| # | Assumption | Decision it drove | How to check |
|---|---|---|---|
| A1 | Riders choose on battery/range, walking distance and total cost. | Cards and sheet lead with walk time, battery with range, and the plan price. | Card-sort or preference test. |
| A2 | Hourly plans with included km are easier to budget than per-minute pricing. | Plan picker (1/2/4/8 h) with km allowance; late and excess charges shown as "only if". | Comprehension test: "What do you pay if you're 20 min late?" (expected: 2 blocks, ₹60 extra). |
| A3 | A hold sized to the walk feels fair; a fixed short hold does not. | Walk + 10 min, 10–30 min. | Test hold lengths; measure arrivals vs expiries. |
| A4 | Riders accept a fixed return hub if it's chosen up front and full hubs are handled. | Return hub chosen before booking; free switch when full. | Interviews on trip patterns; test one-way vs round-trip. |
| A5 | A pre-ride checklist (brakes, tyres, mirrors, indicators, lights, helmet, damage) is acceptable friction and improves safety reporting. | Seven required ticks before unlock; a damage report with cosmetic vs unsafe paths. | Measure completion time and drop-off; observe skimming. |
| A6 | A required end photo reduces disputes. | Required photo step with its reason stated. | Compare with an optional photo. |
| A7 | QR stickers fail sometimes. | Code entry always offered beside scanning; loose formats accepted. | Field observation. |
| A8 | UPI is the expected default in India. | UPI preselected, card as alternative (both simulated). | Preference survey. |

---

## 5. Design decisions and reasoning

- **Welcome hero (supplied image).** A first-person handlebar view. It is a *standing kick-scooter* cockpit, which does not match the seated scooty — see section 11. It is kept as supplied and is **not** disguised or redrawn with CSS.
- **One vehicle photo everywhere you choose or find a scooty** (cards, sheet, review, reservation, unlock). It sits on light mint tiles with `object-fit: contain`.
- **Static ride scene.** The active rental opens on a bike-lane illustration labelled "Static illustration · not your route", with a toggle to the simulated map. Time, cost, return hub and help sit on a solid panel below, never on the image.
- **Near-white, pale mint, vivid green, deep charcoal.** Green buttons use dark text, because white on the green fails. Amber is for holds and warnings, red only for blocking errors. Contrast was calculated from the CSS colour tokens (token pairs, not a rendered-page audit), using the WCAG 2.x relative-luminance formula, by a Claude-run script on 1 Nov 2026:

  | Text on background | Ratio |
  |---|---|
  | ink `#141a17` on surface `#ffffff` / bg `#f6f9f6` | 17.65 / 16.64 |
  | ink-2 `#4a5550` on surface / bg / surface-2 `#eef7f0` | 7.76 / 7.32 / 7.09 |
  | on-green `#0a2213` on green `#2cc65e` (primary button) | 7.47 |
  | white on green (not used for text) | 2.25 |
  | green-dark `#0f7a38` on surface / mint `#e3f6e8` | 5.44 / 4.82 |
  | blue `#1f6fe0` on surface | 4.76 |
  | amber `#9a6200` on surface; amber-ink `#6b4300` on amber-soft `#fff4dc` | 5.10; 7.92 |
  | red `#c2372e` on surface / red-soft `#fdecea` | 5.41 / 4.73 |
  | focus outline `#0b57d0` on surface / bg | 6.39 / 6.02 |

  Every pair listed is at least 4.5:1. This does **not** establish that every rendered element meets WCAG AA: text over images, opacity, disabled states, map labels and non-text contrast of borders were not measured.
- **Bricolage Grotesque for display, Inter for UI**, with tabular figures for timers and money.
- **Return validation never moves the rider.** The rider's position changes only through **Reviewer scenarios → Active rental** (rider movement), in reviewer mode. Selecting a hub in End rental only *checks* the position. Position is validated on hub selection, on Continue, on confirm and again in the reducer, so a stale screen cannot complete a wrong-hub return.
- **No silent failures.** A failed lock leaves the rental open and says so ("return requested, billing stopped"), with retry and an assisted close. A failed unlock keeps the hold. A scooty taken at confirm says nothing was held or charged and offers the nearest alternative.
- **Duplicate-action guards.** Confirm booking, Unlock and start, and End rental each ignore repeat taps while the first is handled.
- **Reservation survives Back and refresh.** Back from the hold returns to the map with a "reserved · mm:ss left · View" banner. Refresh restores the countdown from the stored expiry time.
- **Browser Back is meaningful.** Each screen is a history entry, and transient states use replace. During a rental, Back stays on the rental; after the receipt, Back cannot revive it.

### Phase 5 decisions (current flow; Phase 6 changes noted inline)

**One source of truth for the rental** (`src/state/store.tsx`). All rental facts live in one reducer state: draft → reservation (with identify, checks and payment sub-states) → ride (with a return sub-state) → receipt. The screen is *derived* from that state by `resolveRoute`, so a URL, Back or refresh cannot show a screen the state does not allow. The reducer rejects these impossible transitions, and each one is covered by `scripts/state-guards.ts`:
- paying or unlocking without a hold, an identified scooty and all checks
- a second reserve, pay, unlock or return request
- a receipt without a confirmed lock
- a completed rental resuming
- Back erasing an active rental

Simulated results arrive through one function (`resolveSim`). A result for a state that has moved on is ignored.

- **Order: find → checks → pay → unlock.** The payment is authorised only after the rider has identified the scooty and completed the checks. Then a rider who finds an unsafe vehicle never has an authorisation to undo. *Alternative:* pay at booking (the Phase 4 order). It is simpler, but every unsafe-vehicle or failed-unlock path needs a release.
- **Pending is not success.** Payment can be *pending*, *declined* or *cancelled*. Pending shows a neutral card (not green) and "Check payment status". Unlock can be *uncertain*, which shows "Checking vehicle status…". The ride starts only once the status is confirmed.
- **Planned distance and allowance wording.** The sheet asks how far the rider plans to go. Each plan shows "X km included". A planned distance above the allowance, or above the scooty's estimated range, shows a warning but does not block. Excess is billed per *started* km from the 0.1 km reading, so a reading exactly at the allowance costs nothing and +0.1 km costs 1 km.
- **The 3-step sheet keeps choices.** Moving between plan, hub and licence steps, or switching scooty, keeps the plan, planned distance and return hub.
- **Return hub card.** During the ride, a card shows the return hub, its distance and a Directions view (the simulated map with a "Return here" flag). Changing the hub opens a list with distances, then a second confirmation. Nothing changes on a single tap.
- **Grouped checklist plus "Something is wrong".** The checks are grouped (Vehicle condition, Helmet & readiness), and nothing is pre-ticked. "Something is wrong" leads to a cosmetic or unsafe path. Unsafe ends the booking for free, withdraws the vehicle and offers a replacement without auto-holding it.
- **Return steps.** These are location check (with a wrong-hub block, an "edge of hub, check again" state and a full-hub block), photo (required, or an *assisted check* route when the camera is unavailable), helmet (confirmed separately), then **Request return**. After the request, the screen shows "Return requested" until the lock is confirmed (see *Unresolved-lock recovery* below).
- **Unresolved-lock recovery (after billing stops).** Defined so that no completed receipt exists without a confirmed lock or an explicit assisted close:
  1. **Return pending.** Once the request is accepted, billing stops (P5) and the lock screen shows "Return requested", "Scooty locked: Not yet confirmed", "Billing: Stopped at …", the hub and the lock attempts. States: *locking* ("Stay next to the scooty"), *checking* ("Don't move it"), *uncertain* ("We couldn't confirm the lock"), *failed* ("The lock didn't engage") and *network* ("Connection lost"). The rental isn't complete in any of them, and a refresh while locking becomes *uncertain*.
  2. **Vehicle-security instructions.** On every pending state: keep the scooty on its stand inside the bay and stay with it until the lock is confirmed. On *failed*: push it fully onto its stand in the bay, then try again.
  3. **Retry / status check.** *Uncertain* offers "Check lock status"; *failed* and *network* offer "Try locking again". Neither creates a second return or charge. A status check can still come back *failed* (reviewer scenario), so "uncertain → not locked" is shown honestly.
  4. **Simulated assistance escalation.** "Still stuck? Get assistance" opens "Close with assistance?" (billing stays stopped; the scooty still needs a check; deposit stays held; leave it on its stand in the bay; assistance is simulated, nobody is contacted) → "Close the rental" or "Keep trying". It is not offered while *locking* or *checking*.
  5. **Receipt rule.** A Rental summary is created only by a confirmed lock (chip "Scooty locked · return confirmed", deposit "release pending") or by that explicit assisted close (chip "Billing closed · scooty check pending", "Closed with assistance", deposit "held until scooty check"). The reducer enforces this and `scripts/state-guards.ts` asserts it.
  *Requires validation:* what real assistance is, how long a rider is expected to wait at the hub, and who is responsible for the scooty between an assisted close and the check.
- **Lock status checks honour failures.** If the lock result was uncertain, "Check lock status" can still come back *failed* (when that scenario is on in Reviewer scenarios), so "uncertain → not locked" can be shown.
- **Receipt.** It shows the itemised base, late blocks, extra km, total and "Deposit · release pending". A map shows pick-up and return markers and **no route**, because the demo never tracked one. A hub-change note and an assisted-check note appear when relevant. Rating is optional and skippable. "Report an issue with this charge" needs a reason and is recorded once (simulated). There is exactly one receipt per rental. "Start a new rental" clears it.
- **Reviewer scenarios** (Phase 6; was the "Demo menu"). Only in reviewer mode. Grouped by journey stage: Discovery, Booking, Pickup, Active rental and Return. The group for the current stage opens by default. Active rental holds the time jumps, distance boundaries, low battery and simulated movement. Nothing from it appears on customer screens.
- **Range warning detail.** See P15 for range. A planned distance over the allowance suggests the next plan that covers it. None of these block booking.
- **Welcome image kept.** The supplied hero is unchanged. Its alt text says it is a kick-scooter view (see section 11).

---

## 6. Alternatives worth testing

1. Hold length: walk-based vs fixed 15 min vs no hold.
2. Late pricing: 15-min blocks vs a short grace period vs per-minute.
3. Return model: designated hub vs any hub (with or without a fee).
4. Safety checks: seven ticks vs a single "I've checked" with an illustrated guide.
5. Photo step: required vs only when the hub sensor is unsure.
6. Welcome: hero with two CTAs vs straight to the map.

---

## 7. What is simulated

Customer screens state this once in **About this concept**, the "About" pill at the top of the phone. Where an action could otherwise mislead, they also say it in context.

- **Location:** "Use sample location" sets a fixed position. The browser geolocation API is **never** called.
- **Map:** a hand-drawn SVG of a fictional area, not a map provider. No live availability is claimed.
- **Scooties, hubs, battery, range, helmets:** static sample data in `src/lib/data.ts`.
- **Licence check:** a ~1 s simulated check. No number, photo or document is collected and nothing is verified. Shown next to "Check my licence".
- **Payment:** a UPI/Card choice only. No UPI request, no card details, no transaction, no deposit block. Both methods run the same simulated states (processing, authorised, pending, declined, cancelled) and the same "charged base, deposit held" copy; whether that is achievable for each real method is unresolved (P10). Clarified in context on Review, Pay and the Rental summary ("no money moved").
- **Reservation, unlock, taken scooty, full hub, connection failure:** local timers and flags. No backend.
- **QR scan:** an animated viewfinder. **The camera is never accessed**, and the screen says so.
- **Return photo:** "Add photo" attaches a stock image. No camera and no upload. The assisted check is simulated, and nobody is contacted.
- **Support, assistance and charge-issue reports:** each says it is simulated and that nothing was sent or nobody was contacted.
- **Rider movement, distance and time jumps:** only through **Reviewer scenarios → Active rental**, in reviewer mode.
- No API keys, no network calls beyond loading the app, and no phone numbers or codes requested.

---

## 8. Suggested usability tasks

These are for a future moderated session. **They have not been run.**

1. "Book a scooty for 2 hours from Kamal Park Gate, returning to Phool Bazaar. Before confirming, tell me everything you'll pay." *Observe:* whether deposit and the late/excess terms are understood.
2. "What happens if you're 20 minutes late?" (expected: ₹60 extra).
3. "Unlock it. The QR sticker is scratched." *Observe:* whether code entry is found.
4. "During the checks you notice the front brake is weak." *Observe:* the damage report and the alternative vehicle.
5. Reviewer scenario *Return → hub full* (set by the moderator): "End your rental." *Observe:* whether "Change return hub" is found, and whether the rider understands the detour is still billed (P8).
6. Reviewer scenario *Return → Lock fails* or *Connection lost*: "End your rental." *Observe:* trust in "Return requested · Billing stopped · Scooty locked: Not yet confirmed", and whether the rider stays with the scooty.
7. A keyboard-only or screen-reader participant completes tasks 1–3.

---

## 9. Verification logs

**Who ran what.** Every check in this section was run by **Claude** (an AI coding assistant) during implementation sessions, not personally by the designer. No designer walkthrough has been confirmed or recorded for these results; if one is done, add it under *Human walkthroughs* with its date and who did it. Three kinds of evidence are kept apart:

| Kind | What it is | Source |
|---|---|---|
| **Automated checks** | `npx tsc --noEmit`, `npm run build`, `scripts/state-guards.ts`, `scripts/pricing-boundaries.ts` | Run by Claude; pass counts as printed by the scripts |
| **Claude browser checks** | Claude-in-Chrome automation in desktop Chrome on the local dev server: clicks, typed input, page-text reads and screenshots, at the phone frame plus 320×568 and 360×640 same-origin iframes | Run by Claude; results below are what the automation observed |
| **Human walkthroughs** | A person using the prototype | **None recorded** |

**None of this is user testing, device testing or assistive-technology testing.**

### Phase 5 (historical — Claude-run)

Results as recorded at the end of Phase 5; some counts have since changed (see the Phase 6 log in section 13). The full per-scenario table is in `EDGE_CASE_AUDIT.md`. In summary:
- Automated: `npx tsc --noEmit` and `npm run build` are clean.
- Automated: `npx tsx scripts/state-guards.ts`: 50/50 pass at the time (55/55 as of Phase 6) (reducer transitions and guards).
- Automated: `npx tsx scripts/pricing-boundaries.ts`: 36/36 pass (late blocks, km rounding, holds, plans).
- Claude browser checks:
  - the full flow, map to receipt
  - cancel and expiry at the reservation, find, check and post-payment steps
  - refresh at each stage
  - wrong hub, edge of hub and full hub
  - payment pending, declined and cancelled
  - uncertain and failed unlock
  - unsafe vehicle with replacement
  - uncertain and failed lock
  - fast repeated taps on reserve, unlock, hub change and return
  - 320 and 360 px iframes
  - focus in dialogs (programmatic focus plus real Enter and Escape; not Tab traversal)
- Bugs found and fixed:
  - the pending-payment card was green
  - the sheet CTA price didn't match the selected plan
  - "Lock fails" was ignored on a status check after an uncertain lock
  - a receipt map label was clipped
  - the ride pill wrapped the vehicle ID at 320 px

### Phase 4 (historical — Claude-run; some behaviour since changed)

These were Claude browser checks plus the pricing script, recorded before Phase 5. Quoted copy is as it read then. Superseded by Phase 5 and 6:
- Payment now happens after the checks.
- Billing stops at the return request instead of the "first end attempt".
- The deposit shows "release pending" instead of "released".
- The edge-case "Demo" menu became reviewer mode → Reviewer scenarios, and "(demo)" labels were removed from customer screens (Phase 6).

**Booking**
- Licence gate: Review is blocked until the check passes. "Checking…" lasts ~0.9 s, then "Eligible to book (simulated)". The ineligible scenario blocks booking with an explanation.
- Review shows:
  - duration, pickup → return hub, return-by rule and included km
  - helmet stock at the locker
  - due at unlock ₹599 (₹99 + ₹500 deposit)
  - the late and excess rates
  - the UPI/Card choice
  - the hold explanation (walk + 10 min)
- A double-click on Confirm created exactly one reservation.
- Scooty taken: "WV-2481 was just taken… Nothing was held or charged", with the nearest alternative offered.

**Reservation**
- Refresh keeps the countdown. Back shows the map banner with the time left.
- Cancel: the dialog explains it's free. Double-confirming is safe. The reservation is cleared and a toast confirms.
- **Expiry during scanning** and **expiry during checks** both land on the expired view: "nothing was charged and no deposit was taken", with "Hold … again".

**Unlock**
- Invalid code: "doesn't match your reserved scooty".
- Unlock failure: "Couldn't connect… Your hold is still active", with Try again and Enter code. The retry succeeded.
- Unlock is blocked until all seven checks are ticked.
- Cosmetic damage is logged and the rider continues. Unsafe damage (brakes) clears the hold, removes the scooty from the map and offers an alternative at the same hub.
- A double-click on "Unlock and start" produced one rental.

**Rental and return**
- Refresh keeps the rental. Back stays on the rental.
- Wrong hub: "You're at Kamal Park Gate, not Phool Bazaar… 720 m away". Selecting the wrong hub does **not** move the rider (position unchanged) and Continue stays blocked.
- Outside a hub: "about 580 m from Phool Bazaar, outside the hub".
- Missing photo: "Add a photo to continue."
- Connection failure while ending: the rental stays active, no receipt is created, and billing is capped at the first attempt. The retry reached a receipt showing ₹99 + ₹30 = ₹129, the deposit released and a "Billed up to your first end attempt" note. Back from the receipt does not revive the rental.
- Hub full: an inline warning appears, ending at the full hub is blocked, Help offers three alternatives, and the receipt notes the switch.

**Charge boundaries**

Checked by Claude in the browser and with the pricing script against `pricing.ts`:

| Case | Result |
|---|---|
| 1 h plan, 3600 s | 0 late blocks (₹99) |
| 1 h plan, 3601 s | 1 block (₹129) |
| 1 h plan, 4500 s | 1 block |
| 1 h plan, 4501 s | 2 blocks (₹159) |
| 15.0 km and 15.04 km on 15 km | 0 extra |
| 15.1 km | 1 extra km (₹105) |
| 30.7 km on 2 h | ₹179 + ₹6 = ₹185 |
| 8 h plan, 8 h + 1 s, 80.1 km | ₹585 |
| Hold, walk 0 m | 11 min |
| Hold, walk 800 m | 20 min |
| Hold, walk ≥ 1600 m | 30 min (cap) |

In the browser, the time display at the boundary read 00:57 / ₹99, then 00:00 / ₹99, then "Overtime 00:09 / ₹129 · 1 block so far".

**Narrow screens (320×568)**
- There is no horizontal page overflow; the nearby-cards carousel scrolls sideways by design.
- The primary action is visible without scrolling on: Welcome, Review, Reservation, Scanner, Unlock-ready, Rental (End rental), End rental steps, Receipt and the map sheet.

**Console:** no app errors or warnings. The only output was the dev-only Vite HMR notice about a Fast Refresh export.

**Bugs found during this verification and fixed**
- The "hub full" demo flag outlived the rental. It now resets when a rental ends.
- The receipt time could read "2 h 00 min" beside a late block. Seconds are now shown when hours > 0.
- 15.04 km displayed as "15.0 / 15" but billed 1 km. Billing now uses the displayed 0.1 km reading.
- Map markers said "Scooter". They now say "Scooty".
- An ineligible licence showed "Licence check needed" in the sheet footer. It then showed "Not eligible (demo)" (that label has since been reworded).
- Confirming on a scooty that had become unavailable bounced silently to the map. It now shows the "just taken" dialog.
- The withdrawn-vehicle banner persisted after a later rental. It is now hidden once a later rental ends.

---

## 10. Known limitations

- **Not tested with real users, real devices or assistive technology.** No screen reader (VoiceOver, TalkBack, NVDA) was used. Desktop Chrome only, driven by Claude's browser automation. No human walkthrough is recorded. Not production-ready.
- **Accessibility is not audited.** What was checked: contrast of CSS token pairs by calculation (section 5), labelled controls and live regions by reading the code and page text, and dialog focus by programmatic focus plus Enter/Escape. Not checked: rendered-page contrast, text over images, non-text contrast, 200% zoom and reflow beyond 150% text size, touch-target sizes on a device, and screen-reader output.
- The Chrome window could not be resized in this session, so the 320 and 360 px widths were checked in same-origin iframes, not a resized window or a device.
- Refresh restores every step from `sessionStorage`. During the safety checks, a refresh keeps the checklist step and the ticks already made (observed in Phase 5: 2 of 7 ticks kept, hold timer still running). In-flight simulated operations are not resumed blindly: a refresh while paying becomes "payment pending", while unlocking becomes "checking vehicle status", and while locking becomes "lock uncertain". Each then needs an explicit status check.
- After a reviewer time jump, the overtime display can lag the charge by up to 1 s (for example, 14:59 shown at +15:00). The charge and the receipt use the same instant, so they agree with each other. This is an artefact of the reviewer control.
- Reduced motion is handled by a global `prefers-reduced-motion` CSS rule, and there is no JS animation. This was checked by reading the code; it was not checked with emulation or on a device.
- **Keyboard:** real Tab-key traversal was not checked (the automation could not move focus with Tab), so full keyboard operability is unconfirmed. Focus order was checked with programmatic focus plus real Enter and Escape.
- State lives in `sessionStorage`. It is lost when the tab closes and is not shared across tabs.
- Hold expiry and the rental meter rely on timers in an open tab. A real service would enforce these server-side.
- There is no real GPS, map routing, payment, deposit, licence verification or hardware unlock.
- Map tab order: the map and its markers come before the search field. There is no pinch-zoom.
- A toast can briefly overlap a status banner.
- At 125–150% text size on 320×568, some panels scroll to reach secondary actions.

---

## 11. Image assets

| Use | Original (`design/source-images/`) | Bundled (`src/assets/images/`) |
|---|---|---|
| Welcome hero | `welcome-hero-handlebar-pov.png` (1024×1536) | `welcome-hero-handlebar-pov-{640,1024}.webp` |
| Ride scene | `ride-scenic-bike-lane.png` (1024×1536) | `ride-scenic-bike-lane-{640,1024}.webp` |
| Vehicle | `vehicle-white-electric-scooter.png` (1254×1254, alpha) | `vehicle-white-electric-scooter-{320,720}.webp` |

**Asset mismatch — pending replacement**
- **The welcome hero shows a standing kick-scooter cockpit, not a seated scooty.** It is kept because it was supplied. Its alt text describes it honestly. It has deliberately **not** been faked into a seated-scooty cockpit with CSS. Replace it with a seated-scooty handlebar view: export WebP files at the same widths and names, overwrite them in `src/assets/images/`, update `width`/`height`/alt in `src/lib/images.ts`, and retune `object-position` in `.welcome-hero`.
- The ride scene shows a green bike lane with painted chevrons. It is labelled as a static illustration, not the route, and it is also more European than Indian in feel. Consider replacing it.
- The vehicle image (a white seated scooter) matches the concept and is used throughout.
- The images appear to be AI-generated, and there is no licence or provenance information. Confirm usage rights before any public use.

---

## 12. Unresolved questions

**Operator questions.** Section 3 now resolves each one with a *proposed* concept policy. They are design choices, not real operator facts, and they stay unconfirmed until a real operator reviews them:
- Deposit release: P10 deliberately sets **no timing and no refund promise**. A real answer depends on a payment provider.
- **Payment-method-specific deposit mechanism (unresolved).** The prototype applies one mechanism (authorise base + deposit, charge base, hold deposit) to both UPI and card. Whether each method supports an equivalent hold and release has not been checked, and no claim is made either way. Needs a payment-provider answer per method; if they differ, design per-method copy and states (for example, deposit charged then refunded), and update P10, Review, Pay, Reservation expiry/cancel and Rental summary copy together.
- Licence recheck frequency (P13), detour credit when a hub is full or closed (P8), and insufficient-range handling and thresholds (P15).
- What a real assisted check or lock assistance involves (staff visit, sensor, later inspection), how long a rider waits at the hub, who is responsible for the scooty after an assisted close, who resolves disputes, and how long a "scooty check pending" case takes to close (P6, P9, unresolved-lock recovery in section 5).
- Charge-issue response time and the evidence used (photo, lock log, telemetry).
- Whether the hold (P1), the no-grace late rule (P4) and the illustrative prices (P12) are commercially viable. These are assumptions to test, not findings.

**Legal (unresolved, internal only; see section 3).** These cover licence class and age, helmets, pillion, registration, insurance, permits, tax, consumer-protection obligations, and data retention and consent. None of them is stated as fact in customer copy.

**Design gaps for Figma.** See `SCREEN_INVENTORY.md`: the seated-scooty hero image, real-device and assistive-technology checks, and large-text layouts.

---

## 13. Customer view, reviewer mode and the Phase 6 log

**Customer view (default).** The phone shows only the journey plus one **"About"** pill. About opens "About this concept", which explains that vehicles and availability are sample data; that bookings, payments, licence verification, support and assistance are simulated; that prices and rules are proposed, not any operator's terms; that taxes aren't shown; and that location and camera are never used. Its switch turns on reviewer mode. Customer screens don't use "AI", "prototype", "demo", "scenario" or implementation explanations. The full truth about what is simulated lives in this document (section 7) and in About. On screens, the remaining in-context "simulated" lines are there only where an action could otherwise mislead: payment, licence check, scanning, photo or assisted check, support or assistance, and issue reports.

**Reviewer mode.** Turn it on with the About switch or `?reviewer=1`; turn it off with the switch or `?reviewer=0`. It is stored in `sessionStorage` (`wavo-reviewer`). It adds:
- an amber **"Reviewer"** pill that opens **Reviewer scenarios**: Discovery, Booking, Pickup, Active rental (rider movement and time jumps), Return, and Reset;
- dashed amber **reviewer notes** (`ReviewerNote`) next to the screens they explain, such as which scenario drives an edge case.

Turning reviewer mode off also clears every scenario, which resets the simulated licence check.

**Headings.** "Find a scooty" (map, screen-reader heading), "Review booking", "Your scooty is reserved", "Rental in progress", "Rental summary".

**Phase 6 log (Claude-run, 1 Nov 2026).** Claude browser checks in desktop Chrome plus automated checks, as defined in section 9. Not run by the designer, and not user testing.
- Customer mode shows only the About pill. About renders, and its switch shows the Reviewer pill and reviewer notes. `?reviewer=1` turns reviewer mode on.
- Full journey: sample location → sheet → licence check → "Review booking" → "Your scooty is reserved" → scan → 7 checks → pay → unlock → "Rental in progress".
- Lock fails (reviewer scenario): the lock-pending screen shows "Scooty locked: Not yet confirmed", "Billing: Stopped at 6:55 pm" and "Your rental isn't complete until then." "Still stuck? Get assistance" → "Close the rental" gives a Rental summary with the "Billing closed · scooty check pending" chip, "Closed with assistance", total ₹179 (billing frozen at the request), "Deposit · held until scooty check ₹500", and "Assistance is simulated — nobody was contacted."
- Reviewer mode off, normal return: the Rental summary shows "Scooty locked · return confirmed", "Lock confirmed" and "Deposit · release pending". There are no reviewer notes.
- Fixed during the check: on the Rental summary, scrolled content slid under the About/Reviewer pills (the scroll area now starts below them). Two store messages still said "demo" ("…longest rental in this demo", "…isn't in the demo fleet") and were reworded.
- Automated checks: `tsc` clean, build OK, `state-guards` 55/55 (adds the assisted-close and breakdown security/deposit states), `pricing-boundaries` 36/36.

**Evidence-accuracy review (Claude-run, 1 Nov 2026, before Figma preparation).** Documentation: verification attributed to Claude and split into automated checks, Claude browser checks and human walkthroughs (none recorded); the broad WCAG claim replaced with calculated token-pair contrast ratios; P8, P13 and the new P15 (range) marked as requiring validation; the UPI-vs-card deposit mechanism flagged as unresolved (P10, section 12); unresolved-lock recovery defined (section 5); outdated "Demo" control, map-label and section references corrected. Implementation (copy only): Rental rules now says detour time and distance are billed as usual; the lock-pending screen and the assisted-close dialog now tell the rider to keep the scooty on its stand inside the bay. Automated checks after the change: `tsc` clean, build OK, `state-guards` 55/55, `pricing-boundaries` 36/36. Claude browser check: the new Rental rules line renders in the sheet. The lock-screen wording was checked in code and build only, not in the browser.
