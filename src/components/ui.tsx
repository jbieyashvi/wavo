import { useEffect, useId, useRef, type ReactNode, type PointerEvent } from 'react';
import { ChevronDown, FlaskConical, X } from 'lucide-react';
import { useStore } from '../state/store';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside `container`, closes on Escape and restores focus on unmount. */
export function useFocusTrap(container: React.RefObject<HTMLElement>, active: boolean, onEscape?: () => void) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const el = container.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escRef.current) {
        e.stopPropagation();
        escRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [active, container]);
}

interface DialogProps {
  title: string;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'alert';
  icon?: ReactNode;
  description?: string;
}

/** Modal panel that rises from the bottom of the phone frame. */
export function Dialog({ title, onClose, children, footer, tone = 'default', icon, description }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, true, onClose);
  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`dialog tone-${tone}`} role={tone === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined} tabIndex={-1}>
        <div className="dialog-head">
          {icon && <span className="dialog-icon">{icon}</span>}
          <h2 id={`${id}-t`} className="dialog-title">
            {title}
          </h2>
          {onClose && (
            <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="dialog-body">
          {description && (
            <p id={`${id}-d`} className="dialog-desc">
              {description}
            </p>
          )}
          {children}
        </div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

interface SheetProps {
  label: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  id?: string;
}

/** Non-modal bottom sheet with two heights. Content scrolls; the footer stays reachable. */
export function BottomSheet({ label, expanded, onExpandedChange, children, footer, id }: SheetProps) {
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  const onDown = (e: PointerEvent) => {
    start.current = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (start.current == null) return;
    const dy = e.clientY - start.current;
    start.current = null;
    dragged.current = Math.abs(dy) > 24;
    if (dy < -24) onExpandedChange(true);
    else if (dy > 24) onExpandedChange(false);
  };
  return (
    <section id={id} className={`sheet ${expanded ? 'is-expanded' : ''}`} aria-label={label}>
      <button
        type="button"
        className="sheet-handle"
        aria-expanded={expanded}
        aria-label={expanded ? 'Show less' : 'Show more details'}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onExpandedChange(!expanded);
        }}
        onPointerDown={onDown}
        onPointerUp={onUp}
      >
        <span aria-hidden="true" />
      </button>
      <div className="sheet-scroll">{children}</div>
      {footer && <div className="sheet-foot">{footer}</div>}
    </section>
  );
}

/**
 * Small tag kept only where an action could otherwise mislead: payment, licence check and
 * assistance are simulated, so they say so in the customer flow too.
 */
export function SimTag({ children = 'Simulated' }: { children?: ReactNode }) {
  return <span className="sim-tag">{children}</span>;
}

/** How the concept is simulated, for reviewers. Renders nothing in the normal customer flow. */
export function ReviewerNote({ children }: { children: ReactNode }) {
  const { reviewer } = useStore();
  if (!reviewer) return null;
  return (
    <p className="reviewer-note">
      <FlaskConical size={13} aria-hidden="true" />
      <span>
        <span className="sr-only">Reviewer note: </span>
        {children}
      </span>
    </p>
  );
}

/** Optional explanation, collapsed by default. Native details/summary keeps keyboard and AT support. */
export function More({ summary, children, open, className = '' }: { summary: ReactNode; children: ReactNode; open?: boolean; className?: string }) {
  return (
    <details className={`more ${className}`} open={open}>
      <summary>
        <span>{summary}</span>
        <ChevronDown size={18} aria-hidden="true" className="more-chev" />
      </summary>
      <div className="more-body">{children}</div>
    </details>
  );
}

/** Short price line that sits above a footer button, so the button keeps one action label. */
export function FootSummary({ children }: { children: ReactNode }) {
  return <p className="foot-sum tabular">{children}</p>;
}
