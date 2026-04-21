import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Page Not Found</div>
        <h1>This dashboard page does not exist.</h1>
        <p>
          The route may be wrong, or the record you tried to open is no longer
          available.
        </p>
        <div className="button-row">
          <Link className="secondary-link-button" href="/">
            Back to hiring requests
          </Link>
          <Link className="primary-button" href="/candidates">
            Open candidate pipeline
          </Link>
        </div>
      </section>
    </main>
  );
}
