import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, Database, FileWarning, HeartPulse, ImageOff, LogOut, MonitorCheck, ShieldCheck, VideoOff } from "lucide-react";
import { getAdminAccess } from "@/lib/admin/auth";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getAdminDashboard } from "@/lib/operations/repository";
import { MonitorAction, ReportAction } from "@/components/admin/admin-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalog operations | Luma", robots: { index: false, follow: false } };

function number(value: unknown) { return Number(value ?? 0).toLocaleString("en-US"); }
function date(value?: string | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never"; }

export default async function AdminPage() {
  const access = await getAdminAccess("/admin");
  if (access.status === "anonymous") redirect(access.signInPath);
  if (access.status === "denied") return <AdminDenied email={access.email} />;
  const dashboard = await getAdminDashboard();
  const cards = [
    { label: "Active videos", value: dashboard.stats.active, icon: Database, tone: "good" },
    { label: "Open reports", value: dashboard.openReports, icon: FileWarning, tone: dashboard.openReports ? "warn" : "good" },
    { label: "Metadata issues", value: dashboard.issues.length, icon: AlertTriangle, tone: dashboard.issues.length ? "warn" : "good" },
    { label: "Monitor alerts", value: dashboard.health.unhealthy, icon: HeartPulse, tone: dashboard.health.unhealthy ? "bad" : "good" },
  ];
  return <main className="admin-shell">
    <header className="admin-topbar"><div><Link href="/" aria-label="Back to site"><ArrowLeft size={16} /></Link><span className="brand-dot" /><strong>LUMA OPERATIONS</strong></div><div><span>{access.user.displayName}</span>{!access.user.local && <Link href={chatGPTSignOutPath("/")}><LogOut size={14} />Sign out</Link>}</div></header>
    <div className="admin-container">
      <section className="admin-heading"><div><p>Catalog control center</p><h1>Data health & reports</h1><span>Review catalog quality, visitor reports and provider availability.</span></div><MonitorAction /></section>
      <section className="admin-stat-grid">{cards.map((card) => { const Icon = card.icon; return <article className={card.tone} key={card.label}><span><Icon size={17} /></span><div><strong>{number(card.value)}</strong><p>{card.label}</p></div></article>; })}</section>
      <section className="admin-panel"><header><div><MonitorCheck size={17} /><span>Health monitor</span></div><small>Last run {date(dashboard.lastRun?.startedAt)}</small></header><div className="health-summary"><div><CheckCircle2 size={17} /><span><b>{number(dashboard.health.healthy)}</b> healthy</span></div><div><VideoOff size={17} /><span><b>{number(dashboard.health.unhealthy)}</b> alerts</span></div><div><CircleHelp size={17} /><span><b>{number(dashboard.health.unchecked)}</b> unchecked</span></div>{dashboard.lastRun?.error && <p>{dashboard.lastRun.error}</p>}</div></section>
      <div className="admin-columns">
        <section className="admin-panel"><header><div><FileWarning size={17} /><span>Visitor reports</span></div><small>Latest 50</small></header>{dashboard.reports.length ? <div className="admin-report-list">{dashboard.reports.map((report) => <article key={report.id}><div><Link href={`/watch/${report.videoSlug}`}>{report.videoTitle}</Link><span>{report.category} · {date(report.createdAt)}</span>{report.details && <p>{report.details}</p>}</div><ReportAction id={report.id} initialStatus={report.status} /></article>)}</div> : <AdminEmpty icon={ShieldCheck} title="No visitor reports" text="New reports will appear here." />}</section>
        <section className="admin-panel"><header><div><AlertTriangle size={17} /><span>Catalog issues</span></div><small>Detected from stored data</small></header>{dashboard.issues.length ? <div className="admin-issue-list">{dashboard.issues.map((issue) => <Link href={`/watch/${issue.slug}`} key={`${issue.slug}-${issue.issue}`}><ImageOff size={15} /><span><strong>{issue.title}</strong><small>{issue.issue}</small></span></Link>)}</div> : <AdminEmpty icon={CheckCircle2} title="Catalog looks healthy" text="No metadata problems were detected." />}</section>
      </div>
    </div>
  </main>;
}

function AdminEmpty({ icon: Icon, title, text }: { icon: typeof CheckCircle2; title: string; text: string }) { return <div className="admin-empty"><Icon size={23} /><strong>{title}</strong><span>{text}</span></div>; }
function AdminDenied({ email }: { email: string }) { return <main className="admin-access"><ShieldCheck size={30} /><h1>Administrator access required</h1><p>{email} is signed in but is not included in the administrator allowlist.</p><Link href="/">Return to site</Link></main>; }
