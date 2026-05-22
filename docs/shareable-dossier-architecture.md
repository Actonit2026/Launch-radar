# Shareable Dossier Architecture Stub

LaunchRadar can add public dossiers without exposing private user data by using a
separate read-only table or signed route that contains only explicitly selected
public analysis facts.

Launch-safe constraints:

- Dossiers must be opt-in per user.
- Dossiers must not expose user email, billing state, scan debug logs, raw page
  text, private recommendations, or unpublished product notes.
- Include only competitor names, public source URLs, confidence labels, short
  evidence excerpts, and meaningful changes already visible to the owner.
- Every dossier page should include a powered-by LaunchRadar link and a removal
  contact.

Deferred implementation:

- `shared_dossiers` table with `user_id`, `slug`, `title`, `is_public`, and
  `payload_json`.
- Owner-only create/update/delete policies.
- Public read route that serves only `is_public = true` payloads.
- Regenerate payloads from structured facts, not raw snapshots.
