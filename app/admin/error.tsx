"use client";

import { ErrorState } from "@/components/status/error-state";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} title="Operations dashboard unavailable" message="The database or monitoring service could not be reached. No catalog changes were made." />;
}
