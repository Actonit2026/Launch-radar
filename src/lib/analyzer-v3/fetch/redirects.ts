export function redirectedAcrossOrigin(requestedUrl: string, finalUrl: string) {
  try {
    return new URL(requestedUrl).origin !== new URL(finalUrl).origin;
  } catch {
    return true;
  }
}
