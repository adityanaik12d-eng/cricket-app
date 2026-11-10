# Admin Portal — Operator Runbook

## Prerequisites
- Supabase project with `schema.sql` applied (matches).
- Admin portal spec: `docs/superpowers/specs/2026-11-07-admin-portal-design.md`
- Implementation plan: `docs/superpowers/plans/2026-11-07-admin-portal-implementation.md`

## 1. Apply schema migration
In Supabase Dashboard → SQL Editor → New query, paste and run:
- `supabase/schema.admin.sql`

## 2. Deploy Edge Functions
Using Supabase CLI (project linked) or Dashboard:
```bash
supabase functions deploy admin-list-users
supabase functions deploy admin-create-user
supabase functions deploy admin-reset-password
supabase functions deploy admin-update-profile
supabase functions deploy admin-delete-user
supabase functions deploy admin-audit-log
```
Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase for functions automatically.

## 3. Verify
- Sign in as `adityanaik.12d@gmail.com` → open `#/admin` → list users.
- Non-admin → access denied / functions return 403.
- Unauthenticated → sign-in prompt / functions return 401.
- Create a test user, edit profile, reset password, check audit log.
- Delete blocked if user owns matches; after cleanup, delete with confirm works.
- Check no service-role key in web bundle: `cd web && npm run build && grep -R "service_role\|SERVICE_ROLE" dist` (expect no matches).

## 4. Publish web
```bash
cd C:\Users\IT\cricket-app
vercel --prod --yes
```
Hard refresh https://cricket-scorer-gold.vercel.app

## 5. Android (optional)
```powershell
cd C:\Users\IT\cricket-app\web
$env:ANDROID_HOME="C:\Android\Sdk"; $env:ANDROID_SDK_ROOT="C:\Android\Sdk"
cd android; .\gradlew.bat assembleDebug
```
APK: `web\android\app\build\outputs\apk\debug\app-debug.apk`
