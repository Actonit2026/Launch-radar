export function formatDatabaseError(message: string) {
  console.error("Database request failed.", { message });
  return "Could not load the latest workspace data. Please refresh and try again.";
}
