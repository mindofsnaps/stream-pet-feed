# stream-pet-feed

A self-hostable **pet picture feed for streamers**. Viewers submit pet photos
through a web page, you approve them in a queue, and approved pets rotate
through a transparent **OBS browser-source overlay** on stream.

The photos live in the cloud (Supabase Storage), **not on your streaming PC**.

It's **single-tenant** — one copy per channel — and entirely configured with
environment variables, so there's nothing to fork-and-edit in the code.

---

## What you get

- **`/pet-feed/submit`** — viewers submit a pet photo (auto-resized in the
  browser so phone photos upload fast).
- **`/admin/pet-pictures`** — your moderation queue: bulk approve / reject, hide
  pics from rotation, remove with undo. Password-protected.
- **`/pet-feed/overlay`** — a chrome-free, transparent OBS browser source that
  crossfades through approved pets. New approvals appear within seconds, no
  refresh needed.
- **`/pet-feed`** — a public "pet wall" gallery of the approved pets.

### Two ways to gate submissions

Set `PETFEED_LOGIN_MODE`:

- **`twitch`** — viewers sign in with Twitch and declare which currency they
  spent to unlock a submission (a gifted sub, bits, or channel points). You
  confirm the spend when you approve. Identity is captured, so the per-pet limit
  is enforced per viewer.
- **`none`** — no login at all. Anyone can submit; your approval queue is the
  only gate. The per-pet limit is tracked best-effort via a browser cookie.

---

## Deploy it (about 15 minutes)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mindofsnaps/stream-pet-feed&env=NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,SESSION_SECRET,ADMIN_PASSWORD,PETFEED_LOGIN_MODE&envDescription=Supabase%20keys%2C%20a%20random%20session%20secret%2C%20your%20admin%20password%2C%20and%20login%20mode%20(twitch%20or%20none).%20See%20SETUP.md.&envLink=https://github.com/mindofsnaps/stream-pet-feed/blob/main/SETUP.md)

The button clones the repo to your GitHub, deploys it on Vercel, and prompts you
for the environment variables. You still need a (free) Supabase project for the
database + photo storage.

**Full step-by-step, screenshots-level walkthrough: [SETUP.md](SETUP.md).**

The short version:

1. **Supabase** — make a free project, then paste
   [`migrations/0001_pet-picture-feed.sql`](migrations/0001_pet-picture-feed.sql)
   into its SQL editor and run it. Copy your Project URL + service_role key.
2. **Deploy** — click the button above (or import the repo into Vercel) and fill
   in the [environment variables](.env.example).
3. **(Twitch mode only)** — make a Twitch app and set its OAuth redirect to
   `<your-url>/api/auth/twitch-callback`.
4. **OBS** — copy the overlay URL from `/admin/pet-pictures` into a Browser
   Source at 1920×1080.

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in your values
npm run dev                  # http://localhost:3000
```

For local Twitch login, set `APP_PUBLIC_URL=http://localhost:3000` and add
`http://localhost:3000/api/auth/twitch-callback` as a redirect URL on your
Twitch app. In `none` mode you don't need any Twitch config.

---

## Configuration

Every knob is an environment variable — see [`.env.example`](.env.example) for
the annotated list. Highlights:

| Variable | Default | What it does |
|---|---|---|
| `PETFEED_LOGIN_MODE` | `twitch` | `twitch` or `none` |
| `PETFEED_CHANNEL_NAME` | `the stream` | your channel name in on-page copy |
| `PETFEED_GIFTED_SUBS` / `_BITS` / `_POINTS` | `1` / `2500` / `250000` | Twitch-mode unlock thresholds (display copy) |
| `PETFEED_MAX_PER_PET_30D` | `5` | max pics of the same pet per 30 days |
| `PETFEED_ROTATE_SECONDS` | `8` | seconds each photo is shown on the overlay |
| `PETFEED_CROSSFADE_MS` | `1200` | crossfade length between photos |

---

## How it's built

- **Next.js** (App Router) + **React** — one small app, no database ORM.
- **Supabase** — Postgres table `pet_pictures` (the whole lifecycle in one
  table) + a public Storage bucket for the photos. Row Level Security is on with
  no public policy; all access is server-side via the service-role key.
- **Uploads** go straight from the browser to Supabase via a one-time signed PUT
  URL, so large phone photos skip serverless body-size limits.
- **Admin** is a simple password gate (a signed, httpOnly cookie) — independent
  of the viewer login, so it works the same in both modes.

```
app/
  page.tsx                     landing
  pet-feed/page.tsx            public gallery
  pet-feed/submit/page.tsx     viewer submit
  pet-feed/overlay/route.ts    OBS browser source (bare HTML)
  api/pet-feed/route.ts        approved feed JSON (overlay polls this)
  api/auth/*                   Twitch OAuth (twitch mode)
  admin/login/                 password gate
  admin/pet-pictures/          moderation queue
lib/
  petfeed/                     config, types, storage, db reads, downscale
  actions/                     server actions (submit, moderate, admin auth)
  session.ts admin.ts anon.ts  identity + gating
migrations/0001_*.sql          database + storage setup
```

---

## Security notes

- The `pet_pictures` table has RLS enabled with no row policy: a leaked anon key
  reads nothing. The only public surface is the *approved* feed (image URL + pet
  name + caption — no submitter identity), served server-side.
- Set a strong, random `SESSION_SECRET` (≥ 32 chars) and a real `ADMIN_PASSWORD`
  in production. The app refuses to start in production without a real
  `SESSION_SECRET` rather than fall back to an insecure default.
- The submit action only ever trusts an image path it minted itself — it never
  stores a client-supplied URL.

---

## License

MIT — see [LICENSE](LICENSE).
