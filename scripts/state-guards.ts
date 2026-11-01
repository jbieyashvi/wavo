// Checks the rental state machine refuses impossible transitions. Run: npx --yes tsx scripts/state-guards.ts
import { HUBS, OFF_HUB_SPOTS, scooterById } from '../src/lib/data';
import { checkIds, initialState, reducer, resolveRoute, resolveSim, type Action, type AppState } from '../src/state/store';

let failures = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
};
const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);

const T0 = 1_800_000_000_000;
const SC = 'WV-2481';
const sc = scooterById(SC)!;
const pickupHub = HUBS.find((h) => h.id === sc.hubId)!;

let s: AppState = { ...initialState, location: { status: 'granted' }, licence: 'verified' };
s = run(s, { type: 'SELECT_SCOOTER', scooterId: SC });
const quote = 17900;
const reserved = run(s, { type: 'RESERVE', quotedBasePaise: quote, now: T0 } as Action);
ok('reserve creates a hold', !!reserved.reservation);
const twice = run(reserved, { type: 'RESERVE', quotedBasePaise: quote, now: T0 + 10 } as Action);
ok('second reserve is ignored (same ref)', twice.reservation?.ref === reserved.reservation?.ref);
ok('stale quote is refused', !run(s, { type: 'RESERVE', quotedBasePaise: quote - 100, now: T0 } as Action).reservation);
ok('reserve without verified licence refused', !run({ ...s, licence: 'pending' }, { type: 'RESERVE', quotedBasePaise: quote, now: T0 } as Action).reservation);

// Rental impossible without checks / payment
const now = T0 + 60_000;
ok('PAY before checks refused', run(reserved, { type: 'PAY', now } as Action).reservation?.payStatus === 'none');
ok('UNLOCK before identify/checks/pay refused', run(reserved, { type: 'UNLOCK', now } as Action).reservation?.unlock === 'locked');
let p = run(reserved, { type: 'IDENTIFY', scooterId: 'WV-0000' } as Action);
ok('identify with wrong ID refused', !p.reservation?.identified);
p = run(reserved, { type: 'IDENTIFY', scooterId: SC } as Action);
const ids = checkIds(pickupHub);
p = run(p, { type: 'CONFIRM_CHECKS' } as Action);
ok('confirm with 0 ticks refused', !p.reservation?.checksDone);
p = run(p, ...ids.slice(0, -1).map((id) => ({ type: 'TOGGLE_CHECK', id }) as Action), { type: 'CONFIRM_CHECKS' } as Action);
ok('confirm with one item missing refused', !p.reservation?.checksDone);
p = run(p, { type: 'TOGGLE_CHECK', id: ids[ids.length - 1] } as Action, { type: 'CONFIRM_CHECKS' } as Action);
ok('confirm with all items accepted', !!p.reservation?.checksDone);
ok('unticking after confirm is refused', run(p, { type: 'TOGGLE_CHECK', id: ids[0] } as Action).reservation?.checks.length === ids.length);
const paying = run(p, { type: 'PAY', now } as Action);
ok('PAY → processing', paying.reservation?.payStatus === 'processing');
ok('double PAY while processing ignored', run(paying, { type: 'PAY', now } as Action).reservation?.payStatus === 'processing');
ok('UNLOCK while payment processing refused', run(paying, { type: 'UNLOCK', now } as Action).reservation?.unlock === 'locked');
const pendingPay = resolveSim({ ...paying, scenarios: { ...paying.scenarios, payment: 'pending' } }, 'payment', now);
ok('pending payment is not authorised', pendingPay.reservation?.payStatus === 'pending');
ok('UNLOCK with pending payment refused', run(pendingPay, { type: 'UNLOCK', now } as Action).reservation?.unlock === 'locked');
const failed = resolveSim({ ...paying, scenarios: { ...paying.scenarios, payment: 'fail' } }, 'payment', now);
ok('failed payment → failed, retry allowed', failed.reservation?.payStatus === 'failed' && run(failed, { type: 'PAY', now } as Action).reservation?.payStatus === 'processing');
const expiredDuringPay = run(paying, { type: 'EXPIRE_RESERVATION', now: reserved.reservation!.expiresAt + 1 } as Action);
ok('expiry during payment ends hold; late payment result is ignored', !resolveSim(expiredDuringPay, 'payment', now).reservation);
const authorised = resolveSim(paying, 'payment', now);
ok('PAY after authorisation ignored', run(authorised, { type: 'PAY', now } as Action).reservation?.payStatus === 'authorised');
ok('PAY on expired hold refused', run(p, { type: 'PAY', now: reserved.reservation!.expiresAt } as Action).reservation?.payStatus === 'none');

const unlocking = run(authorised, { type: 'UNLOCK', now } as Action);
ok('UNLOCK → unlocking', unlocking.reservation?.unlock === 'unlocking');
ok('double UNLOCK ignored', run(unlocking, { type: 'UNLOCK', now } as Action).reservation?.unlock === 'unlocking');
ok('cancel during unlock refused', !!run(unlocking, { type: 'CANCEL_RESERVATION' } as Action).reservation);
ok('expiry during unlock refused', !!run(unlocking, { type: 'EXPIRE_RESERVATION', now: reserved.reservation!.expiresAt + 1 } as Action).reservation);
const uncertain = resolveSim({ ...unlocking, scenarios: { ...unlocking.scenarios, unlock: 'uncertain' } }, 'unlock', now);
ok('uncertain unlock → checking, no ride yet', uncertain.reservation?.unlock === 'checking' && !uncertain.ride);
let r = resolveSim(unlocking, 'unlock', now);
ok('unlock starts exactly one ride and clears the hold', !!r.ride && !r.reservation);
ok('second unlock result is a no-op', resolveSim(r, 'unlock', now + 5) === r);
ok('route while riding resolves to ride screen even for welcome', resolveRoute(r, { screen: 'welcome' }).screen === 'ride');
ok('selecting a scooty while riding refused', run(r, { type: 'SELECT_SCOOTER', scooterId: 'WV-0874' } as Action).draft === r.draft);

// Return
ok('return request without photo/helmet refused', !run(r, { type: 'RETURN_REQUEST', now } as Action).ride?.ret.requestedAt);
const offHub = OFF_HUB_SPOTS[0];
let rr = run(r, { type: 'MOVE_RIDER', to: { x: offHub.x, y: offHub.y } } as Action, { type: 'RETURN_PHOTO', photo: 'taken' } as Action, { type: 'RETURN_HELMET', helmet: 'returned' } as Action);
ok('return request away from hub refused', !run(rr, { type: 'RETURN_REQUEST', now } as Action).ride?.ret.requestedAt);
const other = HUBS.find((h) => h.id !== r.ride!.returnHubId)!;
rr = run(rr, { type: 'MOVE_RIDER', to: { x: other.x, y: other.y } } as Action);
ok('return request at wrong hub refused', !run(rr, { type: 'RETURN_REQUEST', now } as Action).ride?.ret.requestedAt);
const home = HUBS.find((h) => h.id === r.ride!.returnHubId)!;
rr = run(rr, { type: 'MOVE_RIDER', to: { x: home.x, y: home.y } } as Action);
ok('return request at a full hub refused', !run({ ...rr, hubAlerts: { [home.id]: { kind: 'full' } } } as AppState, { type: 'RETURN_REQUEST', now } as Action).ride?.ret.requestedAt);
const req = run(rr, { type: 'RETURN_REQUEST', now: now + 1000 } as Action);
ok('return request at designated hub accepted', req.ride?.ret.requestedAt === now + 1000);
ok('double return request keeps first time', run(req, { type: 'RETURN_REQUEST', now: now + 9000 } as Action).ride?.ret.requestedAt === now + 1000);
ok('distance frozen after request', run(req, { type: 'SET_DISTANCE', km: 99 } as Action).ride?.distanceKm === req.ride?.distanceKm);
ok('hub reassignment refused after request', run(req, { type: 'REASSIGN_RETURN', hubId: other.id, now } as Action).ride?.returnHubId === home.id);
const lockFailed = resolveSim({ ...req, scenarios: { ...req.scenarios, lock: 'fail' } }, 'lock', now + 2000);
ok('failed lock → no receipt, ride kept', lockFailed.ride?.ret.lock === 'failed' && !lockFailed.receipt);
const lockUnc = resolveSim({ ...req, scenarios: { ...req.scenarios, lock: 'uncertain' } }, 'lock', now + 2000);
const lockChecking = run(lockUnc, { type: 'LOCK_STATUS' } as Action);
ok('uncertain lock → status check → no receipt yet', lockUnc.ride?.ret.lock === 'uncertain' && lockChecking.ride?.ret.lock === 'checking' && !lockChecking.receipt);
const checkFailed = resolveSim({ ...lockChecking, scenarios: { ...lockChecking.scenarios, lock: 'fail' } }, 'lock', now + 3000);
ok('status check with armed failure → failed, no receipt', checkFailed.ride?.ret.lock === 'failed' && !checkFailed.receipt);
ok('status check otherwise confirms → one receipt', !!resolveSim(lockChecking, 'lock', now + 3000).receipt);
ok('assisted close not allowed while locking', !run(req, { type: 'ASSISTED_CLOSE', now } as Action).receipt);
const done = resolveSim(req, 'lock', now + 60 * 60_000);
ok('lock confirmed → exactly one receipt, ride cleared', !!done.receipt && !done.ride);
ok('billing stopped at request time', done.receipt?.requestedAt === now + 1000 && done.receipt?.durationSec === 1);
ok('deposit is release pending, not charged', done.receipt?.deposit === 'releasePending' && done.receipt.charges.totalPaise === quote);
ok('confirmed lock → security locked', done.receipt?.security === 'locked' && done.receipt.closedBy === 'lock');
const assisted = run(lockFailed, { type: 'ASSISTED_CLOSE', now: now + 4000 } as Action);
ok('assisted close after failed lock → receipt with check pending', assisted.receipt?.security === 'checkPending' && assisted.receipt.closedBy === 'assistance');
ok('assisted close → deposit held for check, not release pending', assisted.receipt?.deposit === 'heldForCheck');
ok('assisted close → billing still stopped at request', assisted.receipt?.requestedAt === now + 1000 && assisted.receipt.charges.totalPaise === quote);
const brokeDown = run(r, { type: 'REPORT_BREAKDOWN', now: now + 2000 } as Action, { type: 'ASSISTED_CLOSE', now: now + 5000 } as Action);
ok('breakdown → assisted close → check pending, deposit held, flagged', brokeDown.receipt?.security === 'checkPending' && brokeDown.receipt.deposit === 'heldForCheck' && brokeDown.receipt.breakdown === true);
ok('second lock result does not make a second receipt', resolveSim(done, 'lock', now + 70 * 60_000) === done);
ok('assisted close after receipt is a no-op', run(done, { type: 'ASSISTED_CLOSE', now } as Action) === done);
ok('route after completion cannot reach the ride', resolveRoute(done, { screen: 'ride' }).screen !== 'ride');
ok('charge issue recorded once', run(done, { type: 'REPORT_CHARGE_ISSUE', reason: 'a' } as Action, { type: 'REPORT_CHARGE_ISSUE', reason: 'b' } as Action).receipt?.issue === 'a');
const fresh = run(done, { type: 'RESET' } as Action);
ok('new rental clears old receipt and ride', !fresh.receipt && !fresh.ride && !fresh.reservation);

console.log(failures ? `\n${failures} failure(s)` : '\nAll state-guard checks passed');
process.exit(failures ? 1 : 0);
