export function PageSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <main id="main" className="page">
      <div className="skeleton-stack" role="status" aria-live="polite">
        <div className="skeleton-block skeleton-hero" />
        <div className="skeleton-block skeleton-line" />
        <div className="skeleton-block skeleton-line short" />
        <div className="skeleton-block skeleton-line" />
        <p className="sr-only">{label}</p>
      </div>
    </main>
  );
}
