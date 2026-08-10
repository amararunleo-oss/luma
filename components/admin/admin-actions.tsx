"use client";

import { Check, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportStatus } from "@/lib/operations/repository";

export function MonitorAction() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function run() {
    setState("running"); setMessage("");
    try {
      const response = await fetch("/api/admin/monitor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 20 }) });
      const payload = await response.json() as { checked?: number; broken?: number; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Health check failed.");
      setState("done"); setMessage(`${payload.checked ?? 0} checked · ${payload.broken ?? 0} need attention`); router.refresh();
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "Health check failed."); }
  }
  return <div className="admin-monitor-action"><button type="button" disabled={state === "running"} onClick={run}>{state === "running" ? <LoaderCircle className="search-spinner" size={15} /> : state === "done" ? <Check size={15} /> : <Play size={15} />}Run 20 checks</button>{message && <span className={state === "error" ? "error" : ""}>{message}</span>}<button className="admin-refresh" type="button" aria-label="Refresh dashboard" onClick={() => router.refresh()}><RefreshCw size={14} /></button></div>;
}

export function ReportAction({ id, initialStatus }: { id: number; initialStatus: ReportStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  async function change(next: ReportStatus) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!response.ok) throw new Error();
      setStatus(next); router.refresh();
    } finally { setSaving(false); }
  }
  return <select aria-label={`Report ${id} status`} value={status} disabled={saving} onChange={(event) => change(event.target.value as ReportStatus)}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>;
}
