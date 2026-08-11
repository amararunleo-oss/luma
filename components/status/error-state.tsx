"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "@/components/navigation/revenue-link";

export function ErrorState({ title = "Something went wrong", message = "The page could not be loaded. Your data is safe.", reset, global = false }: { title?: string; message?: string; reset?: () => void; global?: boolean }) {
  return <main className={`status-page${global ? " global" : ""}`}><div className="status-mark"><AlertTriangle size={28} aria-hidden="true" /></div><p>Temporary problem</p><h1>{title}</h1><span>{message}</span><div>{reset && <button type="button" onClick={reset}><RefreshCw size={15} />Try again</button>}<Link href="/"><Home size={15} />Go home</Link></div><small>If the problem continues, use the Contact page and include what you were opening.</small></main>;
}
