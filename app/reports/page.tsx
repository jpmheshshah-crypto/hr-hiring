"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const applicationStages = [
  "applied",
  "screened",
  "shortlisted",
  "interview_scheduled",
  "selected",
  "rejected"
] as const;

const stageLabels: Record<string, string> = {
  applied: "New Lead",
  screened: "AI Screened",
  shortlisted: "Qualified",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected"
};

type ApplicationReportRow = {
  id: string;
  application_status: string;
  applied_at: string;
  candidates: {
    full_name: string;
    phone: string;
    city: string | null;
    total_experience: number | null;
    english_level: string | null;
    source: string | null;
  } | null;
  hiring_requests: {
    role_title: string;
    headcount_needed: number;
    status: string;
    location: string | null;
  } | null;
  screening_calls:
    | {
        call_status: string;
        call_summary: string | null;
        created_at: string;
      }[]
    | null;
  interviews:
    | {
        interview_status: string;
        scheduled_at: string | null;
      }[]
    | null;
};

type ApplicationReportRawRow = Omit<
  ApplicationReportRow,
  "candidates" | "hiring_requests"
> & {
  candidates:
    | {
        full_name: string;
        phone: string;
        city: string | null;
        total_experience: number | null;
        english_level: string | null;
        source: string | null;
      }[]
    | null;
  hiring_requests:
    | {
        role_title: string;
        headcount_needed: number;
        status: string;
        location: string | null;
      }[]
    | null;
};

type HiringRequestReport = {
  id: string;
  role_title: string;
  headcount_needed: number;
  status: string;
  location: string | null;
  created_at: string;
};

function normalizeApplication(row: ApplicationReportRawRow): ApplicationReportRow {
  return {
    ...row,
    candidates: row.candidates?.[0] ?? null,
    hiring_requests: row.hiring_requests?.[0] ?? null
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

export default function ReportsPage() {
  const [applications, setApplications] = useState<ApplicationReportRow[]>([]);
  const [hiringRequests, setHiringRequests] = useState<HiringRequestReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadReports();
  }, []);

  async function loadReports() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const [applicationsResult, hiringRequestsResult] = await Promise.all([
        supabase
          .from("applications")
          .select(
            `
              id,
              application_status,
              applied_at,
              candidates (
                full_name,
                phone,
                city,
                total_experience,
                english_level,
                source
              ),
              hiring_requests (
                role_title,
                headcount_needed,
                status,
                location
              ),
              screening_calls (
                call_status,
                call_summary,
                created_at
              ),
              interviews (
                interview_status,
                scheduled_at
              )
            `
          )
          .order("applied_at", { ascending: false }),
        supabase
          .from("hiring_requests")
          .select("id, role_title, headcount_needed, status, location, created_at")
          .order("created_at", { ascending: false })
          .limit(8)
      ]);

      if (applicationsResult.error) {
        throw applicationsResult.error;
      }

      if (hiringRequestsResult.error) {
        throw hiringRequestsResult.error;
      }

      setApplications(
        ((applicationsResult.data as ApplicationReportRawRow[] | null) ?? []).map(
          normalizeApplication
        )
      );
      setHiringRequests((hiringRequestsResult.data as HiringRequestReport[] | null) ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load reports.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const stageCounts = applicationStages.reduce<Record<string, number>>((accumulator, stage) => {
      accumulator[stage] = applications.filter(
        (application) => application.application_status === stage
      ).length;
      return accumulator;
    }, {});

    const callsCompleted = applications.reduce((count, application) => {
      return (
        count +
        (application.screening_calls ?? []).filter(
          (call) => call.call_status === "completed"
        ).length
      );
    }, 0);

    const interviewsScheduled = applications.reduce((count, application) => {
      return count + (application.interviews ?? []).length;
    }, 0);

    const openHeadcount = hiringRequests.reduce((count, request) => {
      if (request.status === "closed") {
        return count;
      }

      return count + request.headcount_needed;
    }, 0);

    const selected = stageCounts.selected ?? 0;
    const conversionRate =
      applications.length > 0 ? Math.round((selected / applications.length) * 100) : 0;

    return {
      totalApplications: applications.length,
      openHeadcount,
      callsCompleted,
      interviewsScheduled,
      conversionRate,
      stageCounts
    };
  }, [applications, hiringRequests]);

  const sourceCounts = useMemo(() => {
    const counts = applications.reduce<Record<string, number>>((accumulator, application) => {
      const source = application.candidates?.source || "Unknown";
      accumulator[source] = (accumulator[source] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [applications]);

  const latestApplications = applications.slice(0, 6);

  return (
    <main className="page-shell">
      <DashboardHeader
        current="reports"
        title="Hiring reports and recruiter performance."
        description="Track hiring demand, candidate movement, AI call outcomes, interview volume, and source quality from the same Supabase data."
      />

      <section className="hero">
        <div className="eyebrow">Reports</div>
        <h1>See the health of your BPO hiring pipeline in one view.</h1>
        <p>
          These numbers update from your live hiring requests, candidates, calls, and
          interviews. Use this page to understand how quickly roles are moving from
          new lead to final decision.
        </p>
        <div className="hero-stats">
          <article className="stat-card">
            <span className="mini-label">Candidates</span>
            <strong>{metrics.totalApplications}</strong>
            <div className="muted">All people in the hiring pipeline</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Open headcount</span>
            <strong>{metrics.openHeadcount}</strong>
            <div className="muted">Across active requests</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">AI calls completed</span>
            <strong>{metrics.callsCompleted}</strong>
            <div className="muted">Screening calls with outcomes</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Selection rate</span>
            <strong>{metrics.conversionRate}%</strong>
            <div className="muted">Selected from total candidates</div>
          </article>
        </div>
      </section>

      {errorMessage ? <div className="status-error">{errorMessage}</div> : null}
      {isLoading ? <div className="status-success">Loading reports from Supabase...</div> : null}

      <section className="report-grid">
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 className="section-title">Stage breakdown</h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => void loadReports()}>
              Refresh
            </button>
          </div>
          <div className="report-list">
            {applicationStages.map((stage) => (
              <div className="report-row" key={stage}>
                <span>{stageLabels[stage]}</span>
                <strong>{metrics.stageCounts[stage] ?? 0}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Sources</div>
          <h2 className="section-title">Candidate source mix</h2>
          <div className="report-list">
            {sourceCounts.length === 0 ? (
              <div className="empty-state">No source data yet.</div>
            ) : null}
            {sourceCounts.map(([source, count]) => (
              <div className="report-row" key={source}>
                <span>{source}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Interviews</div>
          <h2 className="section-title">Interview volume</h2>
          <div className="metric-feature">
            <strong>{metrics.interviewsScheduled}</strong>
            <p>Interview entries created from the candidate detail screen.</p>
          </div>
        </article>
      </section>

      <section className="report-grid">
        <article className="panel">
          <div className="eyebrow">Requests</div>
          <h2 className="section-title">Latest hiring requests</h2>
          <div className="report-list">
            {hiringRequests.length === 0 ? (
              <div className="empty-state">No hiring requests yet.</div>
            ) : null}
            {hiringRequests.map((request) => (
              <div className="report-row report-row-tall" key={request.id}>
                <div>
                  <strong>{request.role_title}</strong>
                  <div className="muted">
                    {request.location ?? "No location"} | {request.status} |{" "}
                    {formatDate(request.created_at)}
                  </div>
                </div>
                <strong>{request.headcount_needed}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Activity</div>
          <h2 className="section-title">Latest candidate activity</h2>
          <div className="report-list">
            {latestApplications.length === 0 ? (
              <div className="empty-state">No candidate activity yet.</div>
            ) : null}
            {latestApplications.map((application) => (
              <div className="report-row report-row-tall" key={application.id}>
                <div>
                  <strong>{application.candidates?.full_name ?? "Unnamed candidate"}</strong>
                  <div className="muted">
                    {application.hiring_requests?.role_title ?? "No role"} |{" "}
                    {stageLabels[application.application_status] ??
                      application.application_status}
                  </div>
                </div>
                <span className="candidate-badge">
                  {application.candidates?.english_level ?? "NA"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
