# WAVO — edge-case audit (Phases 5–6)

**Claude** (an AI coding assistant) checked these with Claude-in-Chrome browser automation in desktop Chrome on a local dev server; they were not run personally by the designer, and no human walkthrough is recorded. Claude used using the phone frame plus 320×568 and 360×640 same-origin iframes. Some were also checked with two scripts:
- `scripts/state-guards.ts` (55/55 pass as of Phase 6)
- `scripts/pricing-boundaries.ts` (36/36 pass)

**This is functional verification of a simulated prototype. It is not user testing, device testing or assistive-technology testing.** Edge states are reached through **reviewer mode** (About → switch, or `?reviewer=1`) → Reviewer scenarios. Policies are the *proposed* concept policies P1–P15 in DESIGN_NOTES §3. Everything is simulated: there are no real payments, identity checks, GPS, hardware unlocking or support messages.

How to read the Check result column:
- **Pass (browser)**: observed in Chrome.
- **Pass (script)**: asserted by a script against the reducer or the pricing module.
- **Partly tested**: some of the case was checked and some was not.
- **Not tested**: not checked at all.

## A. Pricing and charges

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Returned exactly at the deadline (2 h plan) | Base only | ₹179, 0 late blocks | Pass (browser + script) | — |
| 1 s late | 1 started 15-min block | ₹209 (+₹30) | Pass (browser + script) | No grace period (proposed policy P4) |
| 15:00 late / 15:01 late | 1 block / 2 blocks | ₹209 / ₹239 | Pass (browser + script) | The overtime display can lag the charge by up to 1 s after a reviewer time jump |
| Distance exactly at the allowance (30.0 km on 30 km) | No extra charge | ₹179, "0 km" extra | Pass (browser + script) | — |
| Allowance + 0.1 km (30.1 km) | 1 started km | +₹6 (₹215) | Pass (browser + script) | — |
| Fractional reading (e.g. 15.04 km) | Billed from the displayed 0.1 km reading | Rounded to 15.0 → no extra | Pass (script) | — |
| Itemised receipt | Base, late, extra km and total shown separately | ₹179 + ₹30 late + ₹24 (4 km) = ₹233 | Pass (browser) | Taxes not modelled |
| Deposit after return | Shown as held, release pending, not charged | "Deposit · release pending ₹500"; no release time or refund promised | Pass (browser + script, Phase 6) | Real release timing needs a payment provider (P10) |
| Planned distance over the allowance or over the range | Warn, suggest a longer plan or a scooty with more range, don't block | Warnings in the sheet and on Review | Partly tested | The thresholds (85% "tight") are assumptions |

## B. Booking and payment

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Double reserve (fast taps) | One hold | Second reserve ignored, same ref | Pass (browser + script) | — |
| Reserve without a verified licence | Refused | Review blocked; reducer refuses | Pass (browser + script) | The licence check is simulated |
| 3-step sheet keeps choices | Plan, distance and hub survive step changes | Kept in the draft | Partly tested | Seen: the 2 h plan was kept after switching to the replacement scooty; not every step-back combination was checked |
| Pay before identify and checks | Refused | Reducer refuses; the payment step is 3 of 3 | Pass (script) | — |
| Payment pending | Never shown as success | Neutral card, "Check payment status"; unlock blocked | Pass (browser + script) | — |
| Payment pending, then refresh | Still pending, no false confirmation | Restored as pending; the status check then authorised it | Pass (browser) | — |
| Payment declined or cancelled | Clear failure, nothing charged, retry | "didn't go through… Nothing was charged", retry offered | Pass (browser) | — |
| Double pay | One authorisation | A second PAY while processing or authorised is ignored | Pass (script) | — |
| Hold expiry after authorisation | Hold ends, authorisation and deposit released | "authorisation and deposit hold are released" | Pass (browser + script) | A late payment result is ignored (script) |

## C. Pickup, checks and unlock

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Cancel hold | Free, confirmed, cleared | alertdialog "Yes, cancel for free" → cleared plus a toast | Pass (browser) | A toast can briefly overlap a status banner |
| Hold expiry on reservation / find / checks | Expired view, nothing charged; survives refresh | As expected | Pass (browser) | Timers run in the tab only |
| Refresh during the safety checks | Same step, ticks kept, hold keeps running | 2 of 7 ticks kept, hold still counting | Pass (browser) | — |
| Checklist with missing ticks | Blocked, no silent ticks | Nothing pre-ticked; the error focuses the first unticked item | Pass (browser + script) | — |
| "Something is wrong" → unsafe (brakes) | Booking ended free, vehicle withdrawn, replacement offered without an auto-hold | WV-0874 withdrawn (7 left); WV-2481 offered and opens its sheet | Pass (browser) | — |
| Unlock uncertain plus fast taps | "Checking vehicle status", no ride until confirmed, exactly one ride | As expected; refresh → status confirmed → one ride | Pass (browser + script) | — |
| Unlock failed / timed out | Retry or release; release leaves no ride | As expected | Pass (browser) | — |
| Uncertain unlock, then the status check fails | Not unlocked, no ride | The status check honours the armed failure | Pass (script) | — |
| Cancel or expire during unlocking | Refused while in flight | Reducer refuses | Pass (script) | — |

## D. During the ride

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Browser Back during a ride | Stays on the ride | Stays | Pass (browser) | — |
| Refresh during a ride | Ride and meter restored | Restored | Pass (browser) | sessionStorage only; lost when the tab closes |
| Return-hub card with directions | Shows hub, distance and a map with a "Return here" flag | As expected | Pass (browser) | The illustrative map has no routing |
| Change return hub | Only through a confirmed reassignment | List with distances → "Return to X instead?" → changed once (double-click safe) | Pass (browser) | Free, same return time (proposed policy P8) |
| Change hub after the return was requested | Refused | Reducer refuses | Pass (script) | — |
| Low battery | Warns | Reviewer scenario sets ~2 km left | Partly tested | Not checked against every hub distance |

## E. Return

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Wrong hub | Blocked with an explanation | Red alert, Continue aria-disabled and inert | Pass (browser + script) | — |
| Edge of hub | Ask to re-check | "right on the edge… check again" | Pass (browser) | — |
| Outside any hub (kerb, lake) | Blocked, meter keeps running | "about 460/380 m… meter stays active" | Pass (browser) | — |
| Return hub full | Blocked, "Choose another return hub" | As expected | Pass (browser + script) | Free switch, same return time (proposed P8) |
| Return hub closed | Blocked like full | Reviewer scenario exists | Not tested | — |
| No photo | Required | "Add a photo to continue" | Pass (browser) | — |
| Camera unavailable | Assisted route | The assisted check (simulated) replaces the photo; the summary notes it | Partly tested | A real assisted check is undefined (P9) |
| Helmet not confirmed | Confirmed separately, blocked until done | "Tell us where the helmet is." | Pass (browser + script) | — |
| Double return request | One request time | Triple-click → one requestedAt | Pass (browser + script) | — |
| Billing after the request | Stops once at the request | Frozen at ₹233 through the uncertain lock and refresh; Phase 6: frozen at ₹179 through a failed lock and assisted close | Pass (browser + script) | Proposed policy P5; needs operator confirmation |
| Lock uncertain | "Return requested", no receipt yet | "We couldn't confirm the lock"; refresh keeps it pending | Pass (browser + script) | — |
| Lock failed | Rental stays open, no receipt | As expected; retry or assisted close. Lock-pending screen: "Scooty locked: Not yet confirmed", "Your rental isn’t complete until then." | Pass (browser + script) | — |
| Lock failed → Close with assistance | Rental closes; billing stays stopped at the request; security shown as pending, never "completed" | Summary chip "Billing closed · scooty check pending", "Closed with assistance", "Deposit · held until scooty check"; security `checkPending`, deposit `heldForCheck` | Pass (browser + script, Phase 6) | Real check process undefined (P6) |
| Breakdown → summary | Same pending security/deposit state | Summary shows "Breakdown reported"; deposit held until check | Pass (script) | Not re-checked in the browser in Phase 6 |
| Uncertain lock, then the status check fails | No receipt | The status check honours the armed failure | Pass (script) | — |
| Connection lost during return | Return stays requested, no receipt | Reviewer scenario exists; same path as an uncertain lock | Partly tested | — |
| Second lock result | No second receipt | No-op | Pass (script) | — |

## F. Receipt and after

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Confirmed return summary | Complete only on a confirmed lock | Chip "Scooty locked · return confirmed", "Lock confirmed", "Deposit · release pending" | Pass (browser + script, Phase 6) | — |
| Exactly one receipt | One per rental | One; repeated results are no-ops | Pass (browser + script) | — |
| Receipt map | Pick-up and return markers, no route | Markers plus labels, aspect-fit, no route; labels visible at 320 px | Pass (browser) | Illustrative map |
| Refresh on the receipt | Receipt kept, ride not revived | As expected | Pass (browser + script) | — |
| Charge-issue report | Reason required, recorded once, nothing sent | Disabled until a reason is chosen; "Reporting is simulated — nothing was sent" | Pass (browser + script) | — |
| Rating | Optional and skippable | "Skip rating" → "Rating skipped" | Pass (browser) | — |
| Start a new rental | Clears the old receipt, ride and reservation; keeps location | As expected; Back stays on the map | Pass (browser + script) | — |

## G. Layout and access

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| 320 px full flow | No page horizontal scroll | scrollWidth 316; only the pannable map layer and the clipped scanner image are wider | Pass (browser, iframe) | Iframe, not a device |
| 360 px | Same | As expected | Pass (browser, iframe) | Iframe, not a device |
| Ride pill at 320 px | The vehicle ID doesn't wrap | nowrap | Pass (browser, iframe) | — |
| Long content | Wraps without overflow | Long warnings wrap at 320 px | Partly tested | Large text sizes and long translated strings not tested |
| Keyboard focus in dialogs | Focus moves in, Escape closes, focus returns | Observed on the issue dialog | Pass (browser) | Real Tab traversal not tested (the automation couldn't press Tab) |
| Reduced motion | Animations disabled | Global `prefers-reduced-motion` rule; no JS animation | Partly tested | Code inspection only; not emulated |
| Screen reader | Labels and live regions announced | aria labels and live regions in code | Not tested | No assistive-technology testing |
| Welcome image | Supplied image kept; mismatch noted | Kept; the alt text says it is a kick-scooter view; noted in DESIGN_NOTES section 11 | Pass (inspection) | Needs a seated-scooty replacement |

## H. Customer view and reviewer mode (Phase 6)

| Scenario | Expected behaviour | Implemented behaviour | Check result | Remaining limitation |
|---|---|---|---|---|
| Default customer view | No dev/debug controls or dev language | Only the "About" pill; no Reviewer pill or reviewer notes. A source scan found no "demo/prototype/AI/scenario" in customer strings; two store messages were reworded | Pass (browser + source scan) | The scan covers literals in `src/`; dynamic strings were checked by reading them |
| About this concept | One accessible entry stating what is simulated | A dialog listing sample vehicles/availability and simulated bookings, payments, licence verification and support; proposed prices and rules; taxes not shown; no location or camera | Pass (browser) | — |
| Reviewer mode on/off | Switch or `?reviewer=1/0`; off clears scenarios | The switch sets `wavo-reviewer`, and the Reviewer pill and notes appear or disappear; `?reviewer=1` turns it on | Pass (browser) | `?reviewer=0` checked by code only |
| Contextual truthfulness | Payment, licence, assistance never imply real effects | "no money moved", "no licence is verified", "nobody was contacted" lines kept in context | Pass (browser) | — |
| Pills over scrolled content | Content doesn't slide under the About/Reviewer pills | The summary scroll area starts below the pills (fixed in Phase 6) | Pass (browser) | Other screens have fixed headers; not re-checked at 320 px |
