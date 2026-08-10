import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Config = {
  bucket: string;
  client: S3Client;
};

let cachedConfig: R2Config | null | undefined;

function configuration(): R2Config | null {
  if (cachedConfig !== undefined) return cachedConfig;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    cachedConfig = null;
    return cachedConfig;
  }

  cachedConfig = {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return cachedConfig;
}

export async function headR2Object(key: string) {
  const config = configuration();
  if (!config) return null;
  try {
    const result = await config.client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return {
      etag: result.ETag?.replace(/^"|"$/g, "") ?? "",
      contentType: result.ContentType ?? "image/webp",
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

export async function getR2Object(key: string) {
  const config = configuration();
  if (!config) return null;
  try {
    const result = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!result.Body) return null;
    return {
      body: result.Body.transformToWebStream(),
      etag: result.ETag?.replace(/^"|"$/g, "") ?? "",
      contentType: result.ContentType ?? "image/webp",
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

export function hasR2Configuration() {
  return configuration() !== null;
}
