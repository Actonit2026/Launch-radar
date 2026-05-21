type HeaderReader = {
  get(name: string): string | null;
};

export function getAppUrl(headers?: HeaderReader) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }

  const origin = headers?.get("origin");

  if (origin) {
    return origin;
  }

  const host = headers?.get("host");

  if (host) {
    const protocol =
      host.includes("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";

    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}
