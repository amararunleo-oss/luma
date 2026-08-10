export class AppError extends Error {
  constructor(public status: number, public code: string, public publicMessage: string) {
    super(publicMessage);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown) {
  const requestId = crypto.randomUUID();
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.publicMessage, requestId } }, {
      status: error.status,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
  console.error(`[${requestId}] Unexpected request failure`, error);
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", requestId } }, {
    status: 500,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
