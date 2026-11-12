# Admin Portal Design Spec (2026-11-07)

## Goal
Add a **separate-in-area but same-app** admin portal at `#/admin` (protected) for the **creator admin only** to **manage Supabase Auth users and player/profile details**.

## Confirmed requirements
- **Portal shape:** same app, protected admin area (`#/admin`).
- **Scope:** both — manage login accounts and player/profile details.
- **Access:** single admin (you only) for now.
- **Canonical creator admin email:** `adityanaik.12d@gmail.com` (align hardcoded checks in `supabase/schema.sql` and `web/src/api.ts`).
- **Must support:** create account for others, delete account if needed, view/search users, edit profile fields (name/mobile/role/batting hand/bowling style/location).
- **Recommended:** password reset/invite, block delete if user owns app records (with explanation), lightweight audit log.

## Constraints / security
- Creating/deleting Auth users requires **Supabase Admin/service-role** privileges — **must not** be exposed in the browser client.
- Admin checks must be centralized and consistent (fix current mismatch).
- Follow least privilege; RLS must prevent non-admin access to admin operations.

## Architecture (Approach A — approved)
- **Frontend:** new `AdminPortalScreen` routed under `#/admin` in `web/src/App.tsx`/`routes.ts`. Hidden/nav only for creator admin.
- **Backend (privileged):** Supabase **Edge Functions** (e.g. `admin-list-users`, `admin-create-user`, `admin-invite-or-set-password`, `admin-update-profile`, `admin-delete-user`, `admin-audit-log`) using the **service-role** key. Each function validates the caller JWT and enforces `auth.email() === 'adityanaik.12d@gmail.com'` (or centralized helper). Returns safe DTOs (no service-role key leakage).
- **Data:** introduce `public.profiles` (1:1 with `auth.users`) for reliable profile/player management and to support admin edits regardless of `user_metadata`. Keep `user_metadata` in sync where sensible.

## Data model (proposed)
**`public.profiles`**
- `id` uuid PK (matches `auth.users.id`)
- `email` text
- `name` text, `mobile` text
- `role` text (BATSMAN/BOWLER/KEEPER/ALL_ROUNDER or app role)
- `batting_hand` text, `bowling_style` text, `location` text
- `created_at` timestamptz default now(), `updated_at` timestamptz default now()
- RLS: user can read/update own profile; **creator admin only** can read/list/update profiles for admin purposes (or via Edge Functions using service role). Prefer service-role for admin bulk ops.

**`public.admin_audit_log` (v1 lightweight)**
- `id` uuid PK default gen_random_uuid()
- `actor_id` uuid, `actor_email` text
- `action` text (user.create|user.delete|profile.update|...)
- `target_user_id` uuid, `target_email` text
- `details` jsonb
- `ip` text (optional), `created_at` timestamptz default now()
- RLS: only creator admin readable (or insert-only via Edge Functions).

**Ownership check for delete:** before deleting a user, inspect app-owned data (e.g. `matches` where `config->>'ownerId' = user_id`, tournaments owned/created if applicable). If found → **block delete** and return a structured error listing blocking resources (IDs/names). Admin must reassign/archive first in v1.

## API / Edge Functions (v1)
- `GET /functions/v1/admin-list-users` — list users + profiles (paginated/search)
- `POST /functions/v1/admin-create-user` — create Auth user (invite or set temp password), create/update profile, audit log
- `POST /functions/v1/admin-invite-user` or `POST /functions/v1/admin-reset-password` — send invite/reset
- `PUT /functions/v1/admin-update-profile` — edit profile fields
- `POST /functions/v1/admin-delete-user` — check ownership, block or delete (with confirmation token/explicit confirm), audit log, handle cleanup
- All require Authorization: Bearer <user jwt> + admin check.

## UI / routes
- Add route `#/admin` (and/or `/admin` handling) gated by `isCreatorAdmin(currentUser)`.
- Screens: **Users list** (search/filter), **User detail/edit profile**, **Create user** form, **Delete** with confirmation + ownership warning, **Audit log** (simple).
- Hide admin entry points from non-admins.

## Migration / alignment
- Update `supabase/schema.sql` delete policy email to `adityanaik.12d@gmail.com` (and ensure consistency).
- Update `web/src/api.ts` admin checks to use a single canonical constant `CREATOR_ADMIN_EMAIL = 'adityanaik.12d@gmail.com'`.
- Create `profiles` table + RLS + updated_at trigger; backfill from existing `auth.users.user_metadata` where possible.
- Deploy Edge Functions with secrets (`SUPABASE_SERVICE_ROLE_KEY`) set in Supabase project (never in client).

## Testing / acceptance
- Non-admin cannot access `#/admin` or call Edge Functions (401/403).
- Create user works, profile created/linked, appears in list.
- Edit profile updates UI/display.
- Delete blocked if owns matches (shows blocking list); after removing/reassigning ownership or with policy change proceeds only with explicit confirmation.
- Audit log records create/delete/edits.
- Canonical email aligned everywhere; no service-role key in client bundle.

## Rollout
1. Schema + RLS + `profiles` + audit log (SQL migration)
2. Edge Functions (deploy)
3. Admin UI in app (route + screens) + central admin check
4. Align existing hardcoded emails
5. Test with creator account, then use
6. Optional: tighten delete policy to use profiles/roles table if expanding beyond single admin later

## Notes
- Keep delete conservative (block by default) to avoid breaking match ownership/history.
- For v1 single admin, service-role in Edge Functions is acceptable with strict JWT + email checks.
- If expanding to multi-admin later, migrate to role-based claims/table.
