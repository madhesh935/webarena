import { NavLink, Outlet } from "react-router-dom";
import { Bookmark, GitBranch, Compass, BookOpen } from "lucide-react";
import { FRAMING, PRODUCT_NAME } from "../constants";
import { useViewportHeight } from "../hooks/useViewportHeight";

const links = [
  { to: "/", label: "Stories", icon: BookOpen, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/connections", label: "Connections", icon: GitBranch },
  { to: "/saved", label: "Saved", icon: Bookmark },
];

export function AppShell() {
  useViewportHeight();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <NavLink to="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="6" y="4" width="20" height="24" rx="1.5" fill="#FFFCF6" stroke="#252722" />
            <path d="M8 8h16M8 12h12M8 16h14M8 20h10" stroke="#B83B15" strokeWidth="1.2" />
          </svg>
          <span className="brand-copy">
            <span className="brand-name">{PRODUCT_NAME}</span>
            <span className="brand-note">{FRAMING}</span>
          </span>
        </NavLink>
        <nav className="nav-desktop" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <l.icon size={16} aria-hidden="true" />
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
      <footer className="app-footer">
        <p>
          <strong>{PRODUCT_NAME}</strong> · {FRAMING}
        </p>
        <p className="meta">
          Listening, household, and purchase records stay separate. Notes you add stay on this device.
        </p>
      </footer>
      <nav className="bottom-nav" aria-label="Primary">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <l.icon size={18} aria-hidden="true" />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
