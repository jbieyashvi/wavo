import { useState, type ReactNode } from "react";
import { FlaskConical, Info, RotateCcw } from "lucide-react";
import { Dialog } from "./ui";
import {
  DEMO_LOCATION,
  HUBS,
  OFF_HUB_SPOTS,
  SCOOTERS,
  distanceMeters,
  hubById,
  scooterById,
} from "../lib/data";
import {
  availableScooters,
  userPosition,
  useStore,
  type HubAlert,
  type Scenarios,
} from "../state/store";

type Item = {
  key: string;
  title: string;
  body?: string;
  armed?: boolean;
  disabled?: string | boolean;
  action: () => void;
};

/** Spots the demo can move the rider to. Nothing else changes the rider's simulated position. */
const SPOTS = [
  ...HUBS.map((h) => ({ id: h.id, name: `${h.name} hub`, x: h.x, y: h.y })),
  ...OFF_HUB_SPOTS,
];

/** The one "About this concept" entry, plus the reviewer menu when reviewer mode is on. */
export function ConceptBar() {
  const { reviewer } = useStore();
  const [about, setAbout] = useState(false);
  const [scenarios, setScenarios] = useState(false);
  // Dialogs sit outside the pill row so they cover the whole phone, not the positioned row.
  return (
    <>
      <div className="concept-pills">
        <button
          type="button"
          className="demo-pill"
          onClick={() => setAbout(true)}
          aria-haspopup="dialog"
        >
          <Info size={14} aria-hidden="true" />
          About<span className="sr-only"> this concept</span>
        </button>
        {reviewer && (
          <button
            type="button"
            className="demo-pill is-reviewer"
            onClick={() => setScenarios(true)}
            aria-haspopup="dialog"
          >
            <FlaskConical size={14} aria-hidden="true" />
            Reviewer
            <span className="sr-only"> scenarios</span>
          </button>
        )}
      </div>
      {about && <AboutConcept onClose={() => setAbout(false)} />}
      {reviewer && scenarios && (
        <DemoMenu onClose={() => setScenarios(false)} />
      )}
    </>
  );
}

function AboutConcept({ onClose }: { onClose: () => void }) {
  const { reviewer, setReviewer, announce } = useStore();
  return (
    <Dialog
      title="About this concept"
      icon={<Info size={22} aria-hidden="true" />}
      onClose={onClose}
      description="WAVO is a design concept for renting electric scooties by the hour from neighbourhood hubs. Sarovar Layout, Nilapur and its hubs are fictional."
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onClose}
          data-autofocus
        >
          Done
        </button>
      }
    >
      <ul className="about-list">
        <li>
          <strong>Vehicles and availability</strong> are sample data. Nothing
          shown is live.
        </li>
        <li>
          <strong>Bookings</strong> are simulated. No scooty is held, unlocked
          or locked.
        </li>
        <li>
          <strong>Payments</strong> are simulated. No UPI request is sent, no
          card details are collected and no money moves.
        </li>
        <li>
          <strong>Licence verification</strong> is simulated. No licence or
          document is collected or verified.
        </li>
        <li>
          <strong>Support and assistance</strong> are simulated. No message is
          sent and nobody is contacted.
        </li>
        <li>
          Prices and rental rules are proposed for this concept. They are not
          any operator’s terms, and taxes aren’t shown.
        </li>
        <li>Your device location and camera are never used.</li>
      </ul>
      <label className="switch-row">
        <span>
          <strong>Reviewer mode</strong>
          <br />
          <span className="fine">
            Adds a scenario menu and notes on how each step is simulated.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={reviewer}
          onChange={(e) => {
            setReviewer(e.target.checked);
            announce(
              e.target.checked
                ? "Reviewer mode on"
                : "Reviewer mode off — scenarios cleared",
            );
          }}
        />
      </label>
    </Dialog>
  );
}

/** Reviewer menu for edge cases, grouped by journey stage. Only rendered in reviewer mode. */
function DemoMenu({ onClose }: { onClose: () => void }) {
  const [spot, setSpot] = useState(SPOTS[0].id);
  const { state, dispatch, navigate, announce } = useStore();
  const ride = state.ride;
  const res = state.reservation;
  const sc = state.scenarios;
  const origin = userPosition(state.location) ?? DEMO_LOCATION;
  const nearest = () => {
    const pool = availableScooters(state);
    return [...(pool.length ? pool : SCOOTERS)].sort(
      (a, b) => distanceMeters(origin, a) - distanceMeters(origin, b),
    )[0];
  };
  const set = (patch: Partial<Scenarios>) =>
    dispatch({ type: "SET_SCENARIO", patch });
  const run = (fn: () => void, message: string) => {
    fn();
    onClose();
    announce(message);
  };
  const ensureLocation = () => {
    if (
      state.location.status !== "granted" &&
      state.location.status !== "manual"
    )
      dispatch({ type: "SET_LOCATION", location: { status: "granted" } });
  };
  const alertHub = (hubId: string, alert: HubAlert | null) =>
    dispatch({ type: "SET_HUB_ALERT", hubId, alert });
  const toggle = (patch: Partial<Scenarios>, on: boolean, label: string) =>
    run(
      () => set(patch),
      on ? `Scenario on: ${label}` : `Scenario off: ${label}`,
    );
  const elapsedAt = (seconds: number, label: string) =>
    run(
      () => dispatch({ type: "SET_ELAPSED", seconds, now: Date.now() }),
      `Rental time set to ${label}`,
    );
  const pickupHub = hubById(nearest()?.hubId);
  const busy = ride ? "Not during a rental." : false;
  const needRide = ride ? false : "Start a rental first.";
  const booked = ride ? ride.hours * 3600 : 0;
  const allowance = ride?.includedKm ?? 0;

  const groups: { title: string; stage: boolean; items: Item[] }[] = [
    {
      title: "Discovery",
      stage: !ride && !res,
      items: [
        {
          key: "denied",
          title: "Location declined",
          body: "Rider picks a start area by hand.",
          disabled: busy,
          action: () =>
            run(
              () => (
                dispatch({
                  type: "SET_LOCATION",
                  location: { status: "denied" },
                }),
                navigate({ screen: "map" })
              ),
              "Scenario: location declined",
            ),
        },
        {
          key: "outside",
          title: "Outside the service area",
          body: "Rider is 8 km away; nothing can be booked.",
          disabled: busy,
          action: () =>
            run(
              () => (
                dispatch({
                  type: "SET_LOCATION",
                  location: { status: "outside" },
                }),
                navigate({ screen: "map" })
              ),
              "Scenario: outside the service area",
            ),
        },
        {
          key: "none",
          title: "No scooties available",
          armed: sc.noScooters,
          disabled: busy,
          action: () =>
            run(
              () => (
                ensureLocation(),
                set({ noScooters: !sc.noScooters }),
                navigate({ screen: "map" })
              ),
              sc.noScooters
                ? "Scenario: scooties back"
                : "Scenario: no scooties available",
            ),
        },
        {
          key: "closed",
          title: `${pickupHub?.name ?? "Nearest"} hub closed`,
          body: "Its scooties show but can’t be booked.",
          armed: state.hubAlerts[pickupHub?.id ?? ""]?.kind === "closed",
          disabled: busy,
          action: () =>
            pickupHub &&
            run(
              () =>
                alertHub(
                  pickupHub.id,
                  state.hubAlerts[pickupHub.id]?.kind === "closed"
                    ? null
                    : { kind: "closed" },
                ),
              `Scenario: ${pickupHub.name} closed toggled`,
            ),
        },
        {
          key: "closing",
          title: `${pickupHub?.name ?? "Nearest"} hub closes in 20 min`,
          body: "Too soon to collect or return there.",
          armed: state.hubAlerts[pickupHub?.id ?? ""]?.kind === "closing",
          disabled: busy,
          action: () =>
            pickupHub &&
            run(
              () =>
                alertHub(
                  pickupHub.id,
                  state.hubAlerts[pickupHub.id]?.kind === "closing"
                    ? null
                    : { kind: "closing", closesAt: Date.now() + 20 * 60_000 },
                ),
              `Scenario: ${pickupHub.name} closing toggled`,
            ),
        },
        {
          key: "taken",
          title: "Scooty taken while booking",
          body: "The next “Confirm booking” finds it gone.",
          armed: sc.scooterTaken,
          disabled: busy || (res ? "Cancel your hold first." : false),
          action: () =>
            run(
              () => (
                ensureLocation(),
                set({ scooterTaken: !sc.scooterTaken, noScooters: false })
              ),
              "Scenario: scooty-taken toggled",
            ),
        },
      ],
    },
    {
      title: "Booking",
      stage: !ride && !res && !!state.draft,
      items: [
        ...(["pending", "ineligible", "error"] as const).map((v) => ({
          key: `lic-${v}`,
          title: {
            pending: "Licence check pending",
            ineligible: "Licence check: not eligible",
            error: "Licence check: connection error",
          }[v],
          armed: sc.licence === v,
          disabled: busy || (res ? "Cancel your hold first." : false),
          action: () =>
            toggle(
              { licence: sc.licence === v ? "ok" : v },
              sc.licence !== v,
              `licence ${v} (next check)`,
            ),
        })),
        {
          key: "price",
          title: "Price rises before confirming",
          armed: sc.priceChange,
          disabled: busy || (res ? "Cancel your hold first." : false),
          action: () =>
            toggle(
              { priceChange: !sc.priceChange },
              !sc.priceChange,
              "price change at confirm",
            ),
        },
        ...(["fail", "pending", "cancel"] as const).map((v) => ({
          key: `pay-${v}`,
          title: {
            fail: "Payment declined",
            pending: "Payment stays pending",
            cancel: "Payment cancelled",
          }[v],
          body: "Applies to the next payment at the scooty.",
          armed: sc.payment === v,
          disabled: busy,
          action: () =>
            toggle(
              { payment: sc.payment === v ? "ok" : v },
              sc.payment !== v,
              `payment ${v}`,
            ),
        })),
      ],
    },
    {
      title: "Pickup",
      stage: !!res,
      items: [
        {
          key: "expire",
          title: "Expire hold now",
          disabled: res ? false : "No active hold.",
          action: () =>
            run(
              () =>
                dispatch({
                  type: "EXPIRE_RESERVATION",
                  now: (res?.expiresAt ?? 0) + 1,
                }),
              "Scenario: hold expired",
            ),
        },
        {
          key: "scanner",
          title: "Scanner unavailable",
          body: "Only manual code entry is offered.",
          armed: sc.scannerUnavailable,
          disabled: busy,
          action: () =>
            toggle(
              { scannerUnavailable: !sc.scannerUnavailable },
              !sc.scannerUnavailable,
              "scanner unavailable",
            ),
        },
        ...(["fail", "timeout", "uncertain"] as const).map((v) => ({
          key: `unlock-${v}`,
          title: {
            fail: "Unlock fails",
            timeout: "Unlock times out",
            uncertain: "Unlock result uncertain",
          }[v],
          body: "Applies to the next unlock attempt.",
          armed: sc.unlock === v,
          disabled: busy,
          action: () =>
            toggle(
              { unlock: sc.unlock === v ? "ok" : v },
              sc.unlock !== v,
              `unlock ${v}`,
            ),
        })),
      ],
    },
    {
      title: "Active rental",
      stage: !!ride && !ride.ret.requestedAt,
      items: ride
        ? [
            {
              key: "t-remind",
              title: "16 min before return time",
              body: "Shows the deadline reminder.",
              action: () =>
                elapsedAt(booked - 16 * 60 + 30, "16 min before the deadline"),
            },
            {
              key: "t-dead",
              title: "Exactly at return time",
              body: "No overtime yet (no grace period after this).",
              action: () => elapsedAt(booked, "the deadline"),
            },
            {
              key: "t-dead1",
              title: "1 second after return time",
              body: "First 15-min block charged.",
              action: () => elapsedAt(booked + 1, "1 s late"),
            },
            {
              key: "t-15",
              title: "15 min late",
              body: "Still 1 block.",
              action: () => elapsedAt(booked + 900, "15 min late"),
            },
            {
              key: "t-151",
              title: "15 min 1 s late",
              body: "2 blocks.",
              action: () => elapsedAt(booked + 901, "15 min 1 s late"),
            },
            {
              key: "d-at",
              title: `Distance = ${allowance} km allowance`,
              body: "No extra-km charge.",
              action: () =>
                run(
                  () => dispatch({ type: "SET_DISTANCE", km: allowance }),
                  `Scenario: distance ${allowance} km`,
                ),
            },
            {
              key: "d-over",
              title: `Distance = ${allowance}.1 km`,
              body: "1 started km over the allowance.",
              action: () =>
                run(
                  () => dispatch({ type: "SET_DISTANCE", km: allowance + 0.1 }),
                  `Scenario: distance ${allowance}.1 km`,
                ),
            },
            {
              key: "low",
              title: "Low battery",
              body: "Sets distance so ~2 km of range is left.",
              action: () =>
                run(
                  () =>
                    dispatch({
                      type: "SET_DISTANCE",
                      km: Math.max(
                        0,
                        (scooterById(ride.scooterId)?.rangeKm ?? 0) - 2,
                      ),
                    }),
                  "Scenario: low battery",
                ),
            },
            {
              key: "full",
              title: "Return hub full",
              armed: state.hubAlerts[ride.returnHubId]?.kind === "full",
              action: () =>
                run(
                  () =>
                    alertHub(
                      ride.returnHubId,
                      state.hubAlerts[ride.returnHubId]?.kind === "full"
                        ? null
                        : { kind: "full" },
                    ),
                  "Scenario: return hub full toggled",
                ),
            },
            {
              key: "rclosed",
              title: "Return hub closed",
              armed: state.hubAlerts[ride.returnHubId]?.kind === "closed",
              action: () =>
                run(
                  () =>
                    alertHub(
                      ride.returnHubId,
                      state.hubAlerts[ride.returnHubId]?.kind === "closed"
                        ? null
                        : { kind: "closed" },
                    ),
                  "Scenario: return hub closed toggled",
                ),
            },
          ]
        : [
            {
              key: "none",
              title: "Rental controls",
              body: "Available once a rental starts.",
              disabled: needRide,
              action: () => {},
            },
          ],
    },
    {
      title: "Return",
      stage: !!ride?.ret.requestedAt,
      items: [
        {
          key: "camera",
          title: "Camera unavailable",
          body: "Return photo replaced by an assisted check.",
          armed: sc.cameraUnavailable,
          action: () =>
            toggle(
              { cameraUnavailable: !sc.cameraUnavailable },
              !sc.cameraUnavailable,
              "camera unavailable",
            ),
        },
        {
          key: "lock-fail",
          title: "Lock fails",
          body: "Applies to the next lock attempt or lock status check.",
          armed: sc.lock === "fail",
          action: () =>
            toggle(
              { lock: sc.lock === "fail" ? "ok" : "fail" },
              sc.lock !== "fail",
              "lock fails",
            ),
        },
        {
          key: "lock-unc",
          title: "Lock result uncertain",
          armed: sc.lock === "uncertain",
          action: () =>
            toggle(
              { lock: sc.lock === "uncertain" ? "ok" : "uncertain" },
              sc.lock !== "uncertain",
              "lock uncertain",
            ),
        },
        {
          key: "net",
          title: "Connection lost during return",
          armed: sc.returnNetwork,
          action: () =>
            toggle(
              { returnNetwork: !sc.returnNetwork },
              !sc.returnNetwork,
              "connection lost on return",
            ),
        },
      ],
    },
  ];

  let rider: ReactNode = null;
  if (ride && !ride.ret.requestedAt) {
    rider = (
      <div className="demo-row">
        <label htmlFor="demo-move" className="fine">
          Move simulated rider
        </label>
        <select
          id="demo-move"
          value={spot}
          onChange={(e) => setSpot(e.target.value)}
        >
          {SPOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            const s = SPOTS.find((x) => x.id === spot);
            if (s)
              run(
                () => dispatch({ type: "MOVE_RIDER", to: { x: s.x, y: s.y } }),
                `Scenario: rider moved to ${s.name}`,
              );
          }}
        >
          Move
        </button>
      </div>
    );
  }

  return (
    <>
      {
        <Dialog
          title="Reviewer scenarios"
          icon={<FlaskConical size={22} aria-hidden="true" />}
          onClose={onClose}
          description="Turn on an edge case, then carry on with the normal flow. WV-3388 is always in maintenance. Turn reviewer mode off in About to clear every scenario."
        >
          {groups.map((g) => (
            <details key={g.title} className="demo-group" open={g.stage}>
              <summary>{g.title}</summary>
              {g.title === "Active rental" && rider}
              <ul className="scenario-list">
                {g.items.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      className="scenario"
                      onClick={s.action}
                      disabled={!!s.disabled}
                      aria-pressed={s.armed === undefined ? undefined : s.armed}
                    >
                      <span className="scenario-text">
                        <strong>
                          {s.title}
                          {s.armed && <em className="pill">On</em>}
                        </strong>
                        {(typeof s.disabled === "string" || s.body) && (
                          <span>
                            {typeof s.disabled === "string"
                              ? s.disabled
                              : s.body}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <div className="scenario-tools">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                run(() => {
                  dispatch({ type: "RESET" });
                  navigate({ screen: "welcome" }, { replace: true });
                }, "Reset to the start")
              }
            >
              <RotateCcw size={18} aria-hidden="true" /> Reset everything
            </button>
          </div>
        </Dialog>
      }
    </>
  );
}
