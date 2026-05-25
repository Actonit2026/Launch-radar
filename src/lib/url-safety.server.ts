import { lookup } from "node:dns/promises";
import net from "node:net";
import { normaliseUrl } from "@/lib/urls";

function unsafeLocalUrlsAllowedForTests() {
  return process.env.LAUNCHRADAR_ALLOW_LOCAL_TEST_URLS === "1";
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 ||
    first === 192 && second === 168 ||
    first >= 224
  );
}

function ipv4FromMappedIpv6(ip: string) {
  return ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1] ?? null;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fec0:") ||
    normalized.startsWith("ff")
  );
}

export function assertSafeIp(ip: string) {
  if (unsafeLocalUrlsAllowedForTests()) {
    return;
  }

  const mappedIpv4 = ipv4FromMappedIpv6(ip);

  if (mappedIpv4) {
    assertSafeIp(mappedIpv4);
    return;
  }

  const ipVersion = net.isIP(ip);

  if (!ipVersion) {
    throw new Error("SSRF: resolved IP is invalid");
  }

  if (ipVersion === 4 && isPrivateIpv4(ip)) {
    throw new Error("SSRF: resolved IP is private");
  }

  if (ipVersion === 6 && isPrivateIpv6(ip)) {
    throw new Error("SSRF: resolved IP is private");
  }
}

async function resolveHostname(hostname: string) {
  const unbracketed = hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(unbracketed)) {
    return [unbracketed];
  }

  const addresses = await lookup(hostname, {
    all: true,
    verbatim: false,
  });

  if (!addresses.length) {
    throw new Error("DNS resolution returned no addresses.");
  }

  return addresses.map((entry) => entry.address);
}

export async function validateResolvedHostname(hostname: string) {
  const addresses = await resolveHostname(hostname);

  addresses.forEach(assertSafeIp);
  return addresses;
}

export async function validateUrl(input: string) {
  const normalized = normaliseUrl(input);
  const url = new URL(normalized);

  try {
    await validateResolvedHostname(url.hostname);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SSRF:")) {
      throw error;
    }

    throw new Error("Could not validate public DNS for this URL.");
  }

  return normalized;
}
