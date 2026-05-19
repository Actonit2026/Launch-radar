export function formatDatabaseError(message: string) {
  return `Could not load dashboard data. Run supabase/migrations/0001_initial_schema.sql in your Supabase project, then refresh. Supabase said: ${message}`;
}
