export const dynamic = "force-dynamic";

export function GET() {
  const configured = process.env.ADS_TXT?.replace(/\\n/g, "\n").trim();
  const body = configured || "# Add authorized seller records before enabling advertising.\n";
  return new Response(`${body}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": configured ? "public, max-age=3600" : "no-store",
    },
  });
}
