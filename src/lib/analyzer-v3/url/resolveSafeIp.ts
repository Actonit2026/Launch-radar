import { lookup } from "node:dns/promises";
import net from "node:net";

function localUrlsAllowedForTests() {
  return process.env.LAUNCHRADAR_ALLOW_LOCAL_TEST_URLS === "1";
}

function ipv4ToNumber(ip: string) {
  return ip
    .split(".")
    .reduce((value, part) => (value << 8) + Number.parseInt(part, 10), 0) >>> 0;
}

function ipv4InRange(ip: string, base: string, maskBits: number) {
  const ipNum = ipv4ToNumber(ip);
  const baseNum = ipv4ToNumber(base);
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;

  return (ipNum & mask) === (baseNum & mask);
}

export function isUnsafeIpAddress(address: string) {
  if (localUrlsAllowedForTests()) {
    return false;
  }

  const version = net.isIP(address);

  if (version === 4) {
    return (
      ipv4InRange(address, "0.0.0.0", 8) ||
      ipv4InRange(address, "10.0.0.0", 8) ||
      ipv4InRange(address, "127.0.0.0", 8) ||
      ipv4InRange(address, "169.254.0.0", 16) ||
      ipv4InRange(address, "172.16.0.0", 12) ||
      ipv4InRange(address, "192.168.0.0", 16)
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();

    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("ff")
    );
  }

  return true;
}

export async function resolveSafeIp(hostname: string) {
  const results = await lookup(hostname, { all: true, verbatim: false });
  const unsafe = results.find((result) => isUnsafeIpAddress(result.address));

  if (unsafe) {
    throw new Error("Analyzer V3 rejected a private or internal resolved IP.");
  }

  return results.map((result) => result.address);
}
