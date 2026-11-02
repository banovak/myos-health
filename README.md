# My OS: Health

A private health record you own: one timeline of everything, your own body photo as the way in. It **records and displays**. It never interprets: no scores, no advice, no diagnosis.

Part of the [My OS](https://softlaunched.io) family. The **My OS: Health** flow on Soft Launched walks you through setting it up, and its intake skill has Claude read your old paperwork and fill the record in for you.

## Levels

| Level | Data lives | Setup |
|---|---|---|
| 1 · This computer | This browser (IndexedDB). Nothing leaves the machine. | Copy `config.example.js` to `config.js` (`storage: 'local'`), open `index.html`. |
| 2 · Synced | Your own Supabase project, `health` schema + private `health-media` bucket. | Apply `supabase/migrations/*`, add `health` to exposed schemas, set `storage: 'supabase'` + URL + publishable key, host the folder (Cloudflare Pages). |

Moving between levels: **Export backup** in one, **Import backup** in the other.

## Files

- `index.html`, `app.css`, `app.js`: the app. No build step.
- `store/local.js`, `store/supabase.js`: storage adapters. Same app state shape in both; Supabase saves only changed rows.
- `config.js`: which level this copy runs at. The Supabase key here must be the **publishable** key, never a secret key.
- `supabase/migrations/`: the `health` schema, owner-only RLS on every table, private storage bucket. Apply them all, in filename order.
- `manifest.webmanifest`, `icons/`: so it saves to a phone's home screen as an app.

## On your phone

Host the folder (Cloudflare Pages takes a drag and drop; any static host works), open the address in Safari or Chrome, sign in, and add it to your home screen. It opens full screen with the same bottom menu, sheets and ⋯ menu as the My OS phone app. The native app (iPhone) adds Apple Health, reminders as notifications and the camera guide: see the `myos-app` repo.

Tabs: Dashboard, History (List · Month · Timeline), Appointments, Concerns (with Illnesses), Lifestyle, Plan, Charts, Reports, Photos, Summary.

## Security model

- Every table: `owner = auth.uid()` for all operations; `anon` has no access to the schema.
- Photos and files: private bucket, each user can only touch objects under their own user-id folder; the app reads them through short-lived signed URLs.
- After creating your account, **turn off new sign-ups** in Supabase (Authentication → Sign In / Providers → Allow new users to sign up).
- No other part of My OS (the Assistant included) can read this data.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). Free to read, build and use for yourself, a household, or a noncommercial organization. Selling it, or publishing it as an app or service, needs permission.
