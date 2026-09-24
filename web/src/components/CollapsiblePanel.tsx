import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  storageKey: string;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** localStorage read is wrapped in try/catch since private-browsing modes
 * and storage-blocking settings can make it throw rather than just miss. */
function readStoredOpen(storageKey: string, defaultOpen: boolean): boolean {
  try {
    const stored = localStorage.getItem(`panel-open:${storageKey}`);
    return stored == null ? defaultOpen : stored === "1";
  } catch {
    return defaultOpen;
  }
}

export function CollapsiblePanel({
  title,
  storageKey,
  className,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(() => readStoredOpen(storageKey, defaultOpen));

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`panel-open:${storageKey}`, next ? "1" : "0");
      } catch {
        // Persisting collapsed state is a nice-to-have, not required.
      }
      return next;
    });
  }

  return (
    <div className={`panel collapsible-panel ${className ?? ""}`}>
      <button type="button" className="collapsible-header" onClick={toggle} aria-expanded={open}>
        <h2>{title}</h2>
        <span className={`chevron ${open ? "open" : ""}`}>▾</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
