# Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a creator-only `#/admin` portal in the same app to manage Supabase Auth users and player/profile details (list/search, create, edit profile, invite/reset, delete with ownership block + confirmation) backed by service-role Supabase Edge Functions and auditable data.

**Architecture:** Approach A from the approved spec: React web UI calls Supabase Edge Functions (`supabase.functions.invoke`) that verify the caller JWT and enforce canonical admin `adityanaik.12d@gmail.com` before using the service-role client for privileged Auth/admin operations. A new `public.profiles` table (1:1 with `auth.users`) stores editable player/profile fields; `public.admin_audit_log` records admin actions. Deletes are blocked when the target owns app records (v1: matches via `config.ownerId`).

**Tech Stack:** React 19 + Vite + TypeScript (`web/`), Vitest, `@supabase/supabase-js` v2, Supabase Postgres + RLS + SQL migrations (repo `supabase/*.sql`), Supabase Edge Functions (Deno TypeScript, service-role key via function secrets), Capacitor web assets.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-portal-design.md` (the plan argues from the spec; executors read both).

## Global Constraints

- **Canonical creator admin email:** `adityanaik.12d@gmail.com` — use this exact value everywhere (SQL delete policy, web admin checks, Edge Function checks). Replace mismatches (e.g. `adityanaik1207@gmail.com` in `web/src/api.ts`).
- **No service-role key in client:** browser code may use only the existing anon/publishable Supabase client and `functions.invoke` with the user’s JWT. Service-role key lives only in Edge Function secrets.
- **Single admin v1:** only the canonical creator email is authorized for admin UI and admin Edge Functions. Do not implement multi-admin roles in v1.
- **Delete is conservative:** block deletion when target owns app data (v1: `public.matches` where `config->>'ownerId' = <target user id>`); return structured blocking resources; require explicit client confirmation before calling delete.
- **Safe responses:** Edge Functions return DTOs only (no secrets, no raw service-role responses beyond necessary fields).
- **Preserve existing behavior:** do not break match sharing/scoring, auth flows, routing, or existing match delete behavior except aligning admin identity.
- **Route:** admin portal is same app, protected, at `#/admin`.
- **RLS/least privilege:** admin bulk/user ops go through service-role Edge Functions; direct table access for non-admins remains restricted.

## Review Focus

- **Non-admin user opens `#/admin` or calls admin functions:** UI redirects/blocks; functions return 401/403 with safe error, never data.
- **Admin deletes a user who owns matches:** API returns a clear “blocked” result with blocking match IDs/count and UI does not proceed without reassign/cleanup; no partial destructive delete.
- **Admin email mismatch/config drift:** central constant/helper used by web and SQL; functions check the exact canonical email from JWT.
- **Auth/session expiry while using admin portal:** `functions.invoke`/UI shows actionable auth error and does not expose stale sensitive data.
- **Profile edits vs `user_metadata`:** edits persist to `profiles` (and sync selected metadata where implemented) so list/detail reflects changes after refresh.

## Task 1: Canonical admin identity, route, and admin guard (web + SQL alignment)

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/routes.ts`
- Modify: `web/src/routes.test.ts`
- Modify: `web/src/App.tsx`
- Modify: `supabase/schema.sql`
- Create: `web/src/admin.ts`

**Interfaces:**
- Consumes: existing `getSupabase` auth user/session, existing `Route` union/`parseHash`, existing `ApiRequestError` pattern.
- Produces: `export const CREATOR_ADMIN_EMAIL = 'adityanaik.12d@gmail.com'` and `export function isCreatorAdminEmail(email?: string | null): boolean` from `web/src/admin.ts`; `Route` includes `{ name: 'admin' }`; `parseHash('#/admin')` returns admin route; `App` renders `AdminPortalScreen` only for creator admin (or shows access denied/sign-in prompt); existing match delete checks in `api.ts` and `supabase/schema.sql` delete policy use the canonical email.

- [ ] **Step 1: Write failing route test for `#/admin`**

Add to `web/src/routes.test.ts`:

```ts
  it('parses #/admin', () => {
    expect(parseHash('#/admin')).toEqual({ name: 'admin' })
  })
```

- [ ] **Step 2: Run route test to verify it fails**

Run: `cd web && npx vitest run src/routes.test.ts -v`
Expected: FAIL (admin route not parsed / type mismatch).

- [ ] **Step 3: Add admin route parsing and type**

In `web/src/routes.ts`, add `| { name: 'admin' }` to `Route` and add:

```ts
  if (hash === '#/admin') return { name: 'admin' }
```

- [ ] **Step 4: Run route test to verify it passes**

Run: `cd web && npx vitest run src/routes.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Write failing admin helper test**

Create `web/src/admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CREATOR_ADMIN_EMAIL, isCreatorAdminEmail } from './admin'

describe('admin identity', () => {
  it('uses the canonical creator email', () => {
    expect(CREATOR_ADMIN_EMAIL).toBe('adityanaik.12d@gmail.com')
  })
  it('matches canonical email case-insensitively', () => {
    expect(isCreatorAdminEmail('AdityaNaik.12d@gmail.com')).toBe(true)
    expect(isCreatorAdminEmail('someone@example.com')).toBe(false)
    expect(isCreatorAdminEmail(null)).toBe(false)
  })
})
```

- [ ] **Step 6: Run admin helper test to verify it fails**

Run: `cd web && npx vitest run src/admin.test.ts -v`
Expected: FAIL (module missing).

- [ ] **Step 7: Implement admin helper**

Create `web/src/admin.ts`:

```ts
export const CREATOR_ADMIN_EMAIL = 'adityanaik.12d@gmail.com'

export function isCreatorAdminEmail(email?: string | null): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === CREATOR_ADMIN_EMAIL.toLowerCase()
}
```

- [ ] **Step 8: Align `api.ts` and `schema.sql` to canonical email**

In `web/src/api.ts`, import `isCreatorAdminEmail` (or compare via canonical constant) and replace both `adityanaik.12d@gmail.com`/mismatch checks (currently `deleteAllMyMatches` and `deleteMatches` check `adityanaik.12d@gmail.com`; ensure consistent). In `supabase/schema.sql`, confirm delete policy uses `adityanaik.12d@gmail.com` (it already does in current file; keep canonical).

- [ ] **Step 9: Add gated admin route rendering in `App.tsx`**

Add `AdminPortalScreen` import (placeholder screen created in Task 10) and render for `route.name === 'admin'`. Gate by fetching current user via `api.currentUser()`/`getSupabase().auth.getUser()` or existing app auth pattern: if unauthenticated show sign-in CTA; if not `isCreatorAdminEmail(user.email)` show “Access denied” (no admin data); else render `AdminPortalScreen`. Keep implementation minimal and non-leaky.

- [ ] **Step 10: Run targeted tests**

Run: `cd web && npx vitest run src/routes.test.ts src/admin.test.ts -v`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add web/src/admin.ts web/src/admin.test.ts web/src/api.ts web/src/routes.ts web/src/routes.test.ts web/src/App.tsx supabase/schema.sql
git commit -m "feat(admin): add canonical admin identity and guarded #/admin route"
```

## Task 2: Profiles + audit log schema (SQL migration)

**Files:**
- Create: `supabase/schema.admin.sql` (idempotent migration-style SQL, consistent with existing repo style)
- Modify: `supabase/schema.sql` (only if needed for cross-reference comments; keep behavior stable)

**Interfaces:**
- Consumes: `auth.users` (Supabase managed), existing `public.matches` ownership shape (`config->>'ownerId'`).
- Produces: `public.profiles` table, `public.admin_audit_log` table, updated_at trigger, indexes, RLS (owner read/update own profile; admin actions primarily via service-role Edge Functions), and a safe backfill from `auth.users.raw_user_meta_data` for name/mobile/role fields where present.

- [ ] **Step 1: Write migration SQL file**

Create `supabase/schema.admin.sql` with `create table if not exists`, RLS enable, policies, trigger function `set_updated_at()` (or reuse/create idempotently), and backfill:

```sql
-- Admin portal: profiles (1:1 auth.users) + audit log. Run after schema.sql.
-- Safe to re-run where IF NOT EXISTS / DROP POLICY IF EXISTS used.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  mobile text,
  role text,
  batting_hand text,
  bowling_style text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_name_idx on public.profiles (lower(name));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  using (auth.uid() = id or auth.email() = 'adityanaik.12d@gmail.com');
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id or auth.email() = 'adityanaik.12d@gmail.com')
  with check (auth.uid() = id or auth.email() = 'adityanaik.12d@gmail.com');
-- Inserts/privileged admin edits are performed by service-role Edge Functions.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
drop policy if exists "admin_audit_select_creator" on public.admin_audit_log;
create policy "admin_audit_select_creator" on public.admin_audit_log for select
  using (auth.email() = 'adityanaik.12d@gmail.com');
-- Inserts via service-role Edge Functions only.

-- Best-effort backfill (safe if auth schema readable in SQL editor context; skip if restricted).
-- Run manually if needed:
-- insert into public.profiles (id,email,name,mobile,role)
-- select id,email,raw_user_meta_data->>'name',coalesce(raw_user_meta_data->>'mobile',phone),raw_user_meta_data->>'role'
-- from auth.users
-- on conflict (id) do update set email=excluded.email, name=coalesce(public.profiles.name,excluded.name);
```

- [ ] **Step 2: Verify SQL syntax/intent manually**

Run: open `supabase/schema.admin.sql` and sanity-check identifiers/policies against spec. (No local Postgres test harness in repo; apply in Supabase SQL editor/staging.)
Expected: valid idempotent SQL matching spec.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.admin.sql
git commit -m "feat(admin): add profiles and audit log schema migration"
```

## Task 3: Edge Function shared helpers (Deno)

**Files:**
- Create: `supabase/functions/_shared/admin.ts`
- Create: `supabase/functions/_shared/cors.ts`

**Interfaces:**
- Consumes: request headers (`Authorization`, CORS preflight), `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars, user JWT.
- Produces: `corsHeaders`, `json(data,status)`, `error(message,status,code?)`, `requireCreatorAdmin(req)` returning `{ user, service }` (service = service-role client) or throwing/returning 401/403 response, `CANONICAL_ADMIN_EMAIL`.

- [ ] **Step 1: Create shared CORS helper**

`supabase/functions/_shared/cors.ts`:

```ts
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
}
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
export function err(message: string, status = 400, code = 'BAD_REQUEST'): Response {
  return json({ error: { message, code } }, status)
}
```

- [ ] **Step 2: Create shared admin/auth helper**

`supabase/functions/_shared/admin.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, err } from './cors.ts'

export const CANONICAL_ADMIN_EMAIL = 'adityanaik.12d@gmail.com'

export async function requireCreatorAdmin(req: Request) {
  if (req.method === 'OPTIONS') return { preflight: new Response('ok', { headers: corsHeaders }) }
  const auth = req.headers.get('Authorization')
  if (!auth) return { response: err('Missing authorization', 401, 'UNAUTHENTICATED') }
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return { response: err('Invalid session', 401, 'UNAUTHENTICATED') }
  if ((user.email ?? '').toLowerCase() !== CANONICAL_ADMIN_EMAIL.toLowerCase()) {
    return { response: err('Admin access required', 403, 'FORBIDDEN') }
  }
  const service = createClient(url, serviceKey)
  return { user, service }
}

export async function audit(service: any, entry: { actor_id: string; actor_email: string; action: string; target_user_id?: string | null; target_email?: string | null; details?: unknown }) {
  await service.from('admin_audit_log').insert({ ...entry, details: entry.details ?? {} })
}
```

- [ ] **Step 3: Manual verification checklist**

Run (after deploying/configuring functions locally or in project): call any admin function without auth → 401; with non-admin JWT → 403. (Supabase CLI local serve: `supabase functions serve` with env; or deploy and test.)
Expected: helper enforces admin gate.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/admin.ts
git commit -m "feat(admin): add Edge Function shared auth/admin helpers"
```

## Task 4: Edge Function `admin-list-users`

**Files:**
- Create: `supabase/functions/admin-list-users/index.ts`

**Interfaces:**
- Consumes: admin-verified request, optional `?q=` search, pagination (`?page=&limit=`).
- Produces: `{ users: Array<{id,email,name,mobile,role,batting_hand,bowling_style,location,created_at,last_sign_in_at,blocked?}>, page, limit }`.

- [ ] **Step 1: Implement function**

```ts
import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { service } = gate
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim().toLower()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50') || 50))
  const { data: { users }, error } = await service.auth.admin.listUsers({ page, perPage: limit })
  if (error) return err(error.message, 500, 'SUPABASE_ERROR')
  const ids = users.map(u => u.id)
  const { data: profiles } = ids.length ? await service.from('profiles').select('*').in('id', ids) : { data: [] as any[] }
  const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
  let rows = users.map(u => {
    const p: any = pmap.get(u.id) ?? {}
    return {
      id: u.id, email: u.email ?? p.email ?? '', name: p.name ?? u.user_metadata?.name ?? '',
      mobile: p.mobile ?? u.user_metadata?.mobile ?? u.phone ?? '', role: p.role ?? u.user_metadata?.role ?? '',
      batting_hand: p.batting_hand ?? '', bowling_style: p.bowling_style ?? '', location: p.location ?? '',
      created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
    }
  })
  if (q) rows = rows.filter(r => [r.email, r.name, r.mobile].join(' ').toLowerCase().includes(q))
  return json({ users: rows, page, limit })
})
```

- [ ] **Step 2: Verify**

Run deploy/serve and call as admin: `GET /functions/v1/admin-list-users` returns users array; as non-admin returns 403.
Expected: 200 with DTO for admin.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-list-users/index.ts
git commit -m "feat(admin): add admin-list-users Edge Function"
```

## Task 5: Edge Functions `admin-create-user` and `admin-reset-password`

**Files:**
- Create: `supabase/functions/admin-create-user/index.ts`
- Create: `supabase/functions/admin-reset-password/index.ts`

**Interfaces:**
- Consumes: admin-verified POST JSON.
- Produces: create returns `{ user }` DTO; reset returns `{ ok: true }`. Both audit.

- [ ] **Step 1: Implement `admin-create-user`**

```ts
import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'POST') return err('Method not allowed', 405)
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim()
  const password = body.password ? String(body.password) : undefined
  const profile = body.profile ?? {}
  if (!email) return err('email is required', 400, 'VALIDATION_ERROR')
  const opts: any = { email, email_confirm: true, user_metadata: { name: profile.name, mobile: profile.mobile, role: profile.role } }
  if (password) opts.password = password
  const { data, error } = password
    ? await service.auth.admin.createUser(opts)
    : await service.auth.admin.inviteUserByEmail(email, { data: opts.user_metadata })
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  const created = (data as any).user
  if (created?.id) {
    await service.from('profiles').upsert({ id: created.id, email, name: profile.name ?? null, mobile: profile.mobile ?? null, role: profile.role ?? null, batting_hand: profile.batting_hand ?? null, bowling_style: profile.bowling_style ?? null, location: profile.location ?? null })
    await audit(service, { actor_id: actor.id, actor_email: actor.email!, action: 'user.create', target_user_id: created.id, target_email: email, details: { invited: !password } })
  }
  return json({ user: { id: created?.id, email } })
})
```

- [ ] **Step 2: Implement `admin-reset-password`**

```ts
import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'POST') return err('Method not allowed', 405)
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim()
  if (!email) return err('email is required', 400, 'VALIDATION_ERROR')
  const { error } = await service.auth.resetPasswordForEmail(email)
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  await audit(service, { actor_id: actor.id, actor_email: actor.email!, action: 'user.reset_password', target_email: email, details: {} })
  return json({ ok: true })
})
```

- [ ] **Step 3: Verify**

Admin can create/invite and trigger reset; audit rows inserted. Non-admin 403.
Expected: 200 responses.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-create-user/index.ts supabase/functions/admin-reset-password/index.ts
git commit -m "feat(admin): add create-user and reset-password Edge Functions"
```

## Task 6: Edge Functions `admin-update-profile` and `admin-audit-log`

**Files:**
- Create: `supabase/functions/admin-update-profile/index.ts`
- Create: `supabase/functions/admin-audit-log/index.ts`

**Interfaces:**
- Produces: update returns `{ profile }`; audit-log returns `{ entries }`.

- [ ] **Step 1: Implement `admin-update-profile`**

```ts
import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'PUT' && req.method !== 'POST') return err('Method not allowed', 405)
  const body = await req.json().catch(() => ({}))
  const id = String(body.userId ?? body.id ?? '')
  if (!id) return err('userId is required', 400, 'VALIDATION_ERROR')
  const patch = { name: body.name ?? null, mobile: body.mobile ?? null, role: body.role ?? null, batting_hand: body.batting_hand ?? null, bowling_style: body.bowling_style ?? null, location: body.location ?? null, email: body.email ?? null }
  const { data, error } = await service.from('profiles').upsert({ id, ...patch }).select('*').single()
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  // best-effort sync selected metadata
  if (body.name || body.mobile || body.role) await service.auth.admin.updateUserById(id, { user_metadata: { name: body.name, mobile: body.mobile, role: body.role } })
  await audit(service, { actor_id: actor.id, actor_email: actor.email!, action: 'profile.update', target_user_id: id, target_email: body.email ?? null, details: { fields: Object.keys(patch) } })
  return json({ profile: data })
})
```

- [ ] **Step 2: Implement `admin-audit-log`**

```ts
import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { service } = gate
  const url = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '100') || 100))
  const { data, error } = await service.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) return err(error.message, 500, 'SUPABASE_ERROR')
  return json({ entries: data ?? [] })
})
```

- [ ] **Step 3: Verify and commit**

Run admin calls; confirm profile persists and audit entries appear.
```bash
git add supabase/functions/admin-update-profile/index.ts supabase/functions/admin-audit-log/index.ts
git commit -m "feat(admin): add update-profile and audit-log Edge Functions"
```

## Task 7: Edge Function `admin-delete-user` (ownership block + explicit confirm)

**Files:**
- Create: `supabase/functions/admin-delete-user/index.ts`

**Interfaces:**
- Consumes: `POST { userId, confirm?: boolean }`.
- Produces: if blocked `{ blocked: true, blocking: { matches: [...] } }` (409); if `confirm !== true` `{ requiresConfirm: true, blocking: ... }` (409/400 as chosen consistently) when risk exists or always require confirm; on success `{ deleted: true }` and audit.

- [ ] **Step 1: Implement with ownership check**

```ts
import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'POST') return err('Method not allowed', 405)
  const body = await req.json().catch(() => ({}))
  const userId = String(body.userId ?? '')
  const confirm = body.confirm === true
  if (!userId) return err('userId is required', 400, 'VALIDATION_ERROR')
  if (userId === actor.id) return err('Cannot delete the current admin account', 400, 'VALIDATION_ERROR')

  // Ownership check (v1): matches owned by user
  const { data: ownedMatches } = await service.from('matches').select('id, config').filter('config->>ownerId', 'eq', userId)
  const blocking = {
    matches: (ownedMatches ?? []).map((m: any) => ({ id: m.id, ownerId: m.config?.ownerId ?? userId })),
  }
  if ((blocking.matches?.length ?? 0) > 0) {
    return json({ blocked: true, code: 'OWNS_DATA', message: 'User owns app data; reassign or remove ownership before deleting.', blocking }, 409)
  }
  if (!confirm) return json({ requiresConfirm: true, message: 'Pass confirm:true to delete this user.' }, 409)

  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  await service.from('profiles').delete().eq('id', userId)
  await audit(service, { actor_id: actor.id, actor_email: actor.email!, action: 'user.delete', target_user_id: userId, details: {} })
  return json({ deleted: true })
})
```

- [ ] **Step 2: Verify**

Owner of match → 409 blocked; no-owned + confirm:false → requiresConfirm; confirm:true → deleted + audit. Non-admin 403.
Expected: conservative safe behavior.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-delete-user/index.ts
git commit -m "feat(admin): add ownership-checked admin-delete-user Edge Function"
```

## Task 8: Web admin API client

**Files:**
- Create: `web/src/adminApi.ts`
- Create: `web/src/adminApi.test.ts` (lightweight DTO/error mapping tests where pure; mock `functions.invoke` shape)

**Interfaces:**
- Consumes: `getSupabase().functions.invoke(name, { body, method/headers as supported })`, `ApiRequestError`/consistent error style.
- Produces: `adminListUsers(q?, page?, limit?)`, `adminCreateUser(payload)`, `adminResetPassword(email)`, `adminUpdateProfile(payload)`, `adminDeleteUser(userId, confirm)`, `adminAuditLog(limit?)` returning typed DTOs.

- [ ] **Step 1: Write failing test for response normalization (pure helper)**

Create `web/src/adminApi.test.ts` with a test for a small exported `unwrapFunctionResult`/error mapper helper (export if needed for testability) that maps `{ error }`/non-2xx payloads to `ApiRequestError`.

- [ ] **Step 2: Implement `adminApi.ts`**

Use `@supabase/supabase-js` `functions.invoke`:

```ts
import { getSupabase } from './supabase'
import { ApiRequestError } from './api'

async function invoke<T>(name: string, init?: { body?: unknown; method?: string; query?: Record<string,string> }): Promise<T> {
  let fn = name
  if (init?.query) fn += '?' + new URLSearchParams(init.query).toString()
  const { data, error } = await getSupabase().functions.invoke(fn, { body: init?.body, method: init?.method })
  if (error) throw new ApiRequestError((error as any).message ?? 'Admin request failed', (error as any).context?.status === 403 ? 'FORBIDDEN' : 'SUPABASE_ERROR')
  if (data?.error) throw new ApiRequestError(data.error.message ?? 'Admin request failed', data.error.code ?? 'SUPABASE_ERROR')
  return data as T
}

export const adminApi = {
  listUsers: (q?: string, page = 1, limit = 50) => invoke<any>('admin-list-users', { query: { q: q ?? '', page: String(page), limit: String(limit) } }),
  createUser: (payload: any) => invoke<any>('admin-create-user', { body: payload, method: 'POST' }),
  resetPassword: (email: string) => invoke<any>('admin-reset-password', { body: { email }, method: 'POST' }),
  updateProfile: (payload: any) => invoke<any>('admin-update-profile', { body: payload, method: 'POST' }),
  deleteUser: (userId: string, confirm = false) => invoke<any>('admin-delete-user', { body: { userId, confirm }, method: 'POST' }),
  auditLog: (limit = 100) => invoke<any>('admin-audit-log', { query: { limit: String(limit) } }),
}
```

Adjust error/status mapping to match actual `functions.invoke` error shape (verify in implementation; keep safe).

- [ ] **Step 3: Run tests**

Run: `cd web && npx vitest run src/adminApi.test.ts src/admin.test.ts src/routes.test.ts -v`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/adminApi.ts web/src/adminApi.test.ts
git commit -m "feat(admin): add web admin Edge Function client"
```

## Task 9: Admin Portal UI (`#/admin`)

**Files:**
- Create: `web/src/AdminPortalScreen.tsx`
- Modify: `web/src/App.tsx` (render real screen)
- Modify: `web/src/index.css` (minimal admin table/form styles reusing existing theme/`ms-*`/card patterns)

**Interfaces:**
- Consumes: `adminApi`, `isCreatorAdminEmail`/current user, existing `ThemeToggle`/layout patterns.
- Produces: users list + search, create user form, profile edit form, reset password action, delete with confirmation and blocked/ownership messaging, audit log view.

- [ ] **Step 1: Implement `AdminPortalScreen`**

Build a single-screen admin portal with tabs/sections: **Users**, **Create User**, **Audit Log**. Users section loads `adminApi.listUsers`, supports search, opens inline detail/edit for selected user, actions for Reset Password and Delete. Delete flow: first call `deleteUser(id,false)` to detect `requiresConfirm`/`blocked`; if blocked show blocking matches clearly; if requires confirm show explicit confirmation UI then call `deleteUser(id,true)`. Handle and display 401/403/409/validation errors safely. Match Stadium Emerald + glass style.

- [ ] **Step 2: Wire App route**

In `App.tsx`, ensure `route.name === 'admin'` renders gated `AdminPortalScreen` (Task 1 gate) and non-admin sees access denied.

- [ ] **Step 3: Manual/UI verification**

Run: `cd web && npm run dev` and sign in as `adityanaik.12d@gmail.com` → open `#/admin` (list loads via functions). Sign in as non-admin → access denied. Unauthenticated → sign-in prompt.
Expected: portal usable for creator only.

- [ ] **Step 4: Run build + targeted tests**

Run: `cd web && npm run build && npx vitest run src/routes.test.ts src/admin.test.ts src/adminApi.test.ts -v`
Expected: PASS/build success.

- [ ] **Step 5: Commit**

```bash
git add web/src/AdminPortalScreen.tsx web/src/App.tsx web/src/index.css
git commit -m "feat(admin): add creator-only admin portal UI"
```

## Task 10: Deployment, verification, and rollout docs

**Files:**
- Modify (optional): `docs/superpowers/specs/2026-11-07-admin-portal-design.md` (add implementation notes/links if helpful)
- Create (optional): `supabase/README-admin.md` (operator runbook: apply `schema.admin.sql`, set function secrets `SUPABASE_SERVICE_ROLE_KEY` is provided by Supabase env for functions as applicable, deploy functions, verify)

**Interfaces:**
- Produces: clear operator steps to make admin portal live.

- [ ] **Step 1: Document deploy steps**

Include: apply `supabase/schema.sql` alignment if needed and `supabase/schema.admin.sql` in Supabase SQL editor; deploy each function `supabase functions deploy <name>` (requires Supabase CLI/project link) or via dashboard; verify secrets; test as creator/non-admin; rebuild web/APK if distributing native.

- [ ] **Step 2: End-to-end verification checklist**

Run through spec acceptance: non-admin 403, create user + profile, edit profile persists, delete blocked for owned match, audit log records actions, no service-role key in `web/dist`.

Run: `cd web && npm run build && grep -R "service_role\|SERVICE_ROLE" dist || true` (expect no matches).
Expected: no service-role leakage.

- [ ] **Step 3: Commit**

```bash
git add supabase/README-admin.md docs/superpowers/specs/2026-11-07-admin-portal-design.md
git commit -m "docs(admin): add admin portal deploy and verification runbook"
```

## Self-Review

- [ ] **Spec coverage:** manage Auth users + profiles (list/create/edit/reset/delete) — Tasks 4-7,9; `#/admin` protected same app — Tasks 1,9; single creator admin `adityanaik.12d@gmail.com` aligned — Tasks 1,3,SQL; block delete if owns records + confirmation — Task 7,9; audit log — Tasks 2,3,6,9; service-role only server-side — Tasks 3-7,8. Gaps: profile `user_metadata` sync is best-effort (acceptable v1; noted).
- [ ] **Placeholder scan:** no TBD/TODO/“add validation” placeholders; Edge Function/web code provided; deploy steps explicit (CLI project link left as operator action where environment-specific, but commands included).
- [ ] **Type consistency:** `Route` includes `admin`; `adminApi` methods match function names/contracts; `isCreatorAdminEmail`/`CREATOR_ADMIN_EMAIL` exported consistently.
- [ ] **Review Focus addressed:** non-admin gate in Task 1/3/9; ownership block in Task 7/9; canonical email in Tasks 1-3; session expiry handled via invoke errors in Task 8/9; profile persistence to `profiles` in Tasks 2/6.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-07-admin-portal-implementation.md`. **Spec:** `docs/superpowers/specs/2026-11-07-admin-portal-design.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end. Runs well with a mid-tier session model, since the plan carries the design.

**For this plan I recommend Native**, because the tasks are sequential (schema/helpers/functions/client/UI), touch a small set of files in familiar patterns, and you’ll need to run Supabase SQL/function deployment in your own project environment anyway; a final whole-branch review is sufficient. Does the plan capture what you want, and which approach should we use?
