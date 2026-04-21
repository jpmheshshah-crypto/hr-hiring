import Link from "next/link";
import { LogoutButton } from "./logout-button";

type DashboardHeaderProps = {
  current: "home" | "candidates" | "reports";
  title: string;
  description: string;
};

export function DashboardHeader({
  current,
  title,
  description
}: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">
      <div>
        <div className="eyebrow">BPO Hiring Dashboard</div>
        <h1 className="dashboard-header-title">{title}</h1>
        <p className="dashboard-header-copy">{description}</p>
      </div>
      <nav className="dashboard-nav" aria-label="Primary">
        <Link
          className={current === "home" ? "nav-pill nav-pill-active" : "nav-pill"}
          href="/"
        >
          Hiring Requests
        </Link>
        <Link
          className={current === "candidates" ? "nav-pill nav-pill-active" : "nav-pill"}
          href="/candidates"
        >
          Candidate Pipeline
        </Link>
        <Link
          className={current === "reports" ? "nav-pill nav-pill-active" : "nav-pill"}
          href="/reports"
        >
          Reports
        </Link>
        <LogoutButton />
      </nav>
    </header>
  );
}
