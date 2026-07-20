# FencingDraw development guide

## Project context

- Production: https://fencing-draw.vercel.app
- GitHub: `yasutakaaaa/fencing-draw` (default branch: `main`)
- Vercel: `yasutaka-fencing/fencing-draw`
- Supabase project ref: `hkdthcoygwqdimcblkdt`
- App stack: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Supabase

## Working rules

1. Start by reading `git status` and preserve unrelated or pre-existing user changes.
2. Keep secrets out of output and Git. Inspect environment-variable names only; never print values.
3. Use `.env.local` for local Supabase client configuration. Do not put a Supabase service-role key in any `VITE_` variable.
4. Run `npm run check` after code changes. Run the relevant Playwright tests for user-facing flow changes.
5. Do not apply Supabase migrations, push Git commits, or deploy production unless the user request authorizes that external change.
6. Before Vercel commands, confirm the existing `.vercel/repo.json` link targets `yasutaka-fencing/fencing-draw`.

## Architecture

- `src/store/useStore.ts`: application state, Supabase persistence, auth, and realtime coordination.
- `src/components/`: tournament administration and public viewer UI.
- `src/utils/`: pool assignment, ranking, bracket, CSV, and PDF logic.
- `supabase/`: ordered SQL migrations and RLS/RPC definitions.
- `e2e/`: Playwright flows; authenticated cases require local `TEST_EMAIL` and `TEST_PASSWORD`.

## Verification order

1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. For UI/data-flow work, start the dev server and verify browser console plus the relevant Supabase-backed flow.
5. For deployment work, inspect the Vercel deployment and verify the production URL after completion.

## Database changes

- Add a new numbered, append-only migration; do not rewrite an already-applied migration without explicit confirmation.
- Review RLS for authenticated, anonymous, and public access separately.
- Supabase anonymous sign-ins are enabled for edit-key participants. Anonymous users receive the `authenticated` role, so tournament writes must remain restricted to the owner or a matching `tournament_editors` row.
- Treat migrations and destructive account/data operations as production-impacting actions requiring an explicit final target check.
