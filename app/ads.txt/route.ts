export const dynamic = "force-dynamic";

export function GET() {
  const configured = process.env.ADS_TXT?.replace(/\\n/g, "\n").trim();
  if (!configured) {
    return new Response("Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(`${configured}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
