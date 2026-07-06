# Setup walkthrough

This gets you from zero to a working pet feed in about 15 minutes. You don't
need to know how to code — it's mostly clicking and pasting.

You'll create two free accounts (Supabase for the database, Vercel for hosting),
and — only if you want viewers to sign in with Twitch — one Twitch app. Then you
paste a few values into a form and you're done.

---

## What you're building

- A page where viewers submit pet photos (`/pet-feed/submit`).
- A queue where **you** approve them (`/admin/pet-pictures`).
- An OBS browser-source overlay that rotates the approved pets on stream
  (`/pet-feed/overlay`).

The photos live in the cloud (Supabase), **not on your PC**.

---

## Step 1 — Make a Supabase project (your database + photo storage)

1. Go to <https://supabase.com>, sign up (free), and click **New project**.
2. Give it a name and a database password (save the password somewhere; you
   won't need it for this app, but Supabase wants one). Pick the region closest
   to you. Click **Create new project** and wait ~2 minutes for it to finish.
3. In the left sidebar go to **Settings → API**. Keep this tab open — you'll
   copy three things from it in Step 4:
   - **Project URL**
   - **service_role** secret (under "Project API keys" — click *Reveal*. This is
     the secret one, **not** the `anon` key.)

### Run the database setup

4. In the left sidebar click **SQL Editor → New query**.
5. Open the file [`migrations/0001_pet-picture-feed.sql`](migrations/0001_pet-picture-feed.sql)
   from this project, copy **all** of it, paste it into the editor, and click
   **Run**. You should see "Success. No rows returned." That created the table
   and the photo storage bucket.

---

## Step 2 (optional) — Make a Twitch app

Skip this if you want **no-login** submissions (anyone can submit; you approve
everything). You can always add it later.

1. Go to <https://dev.twitch.tv/console/apps> and click **Register Your
   Application**.
2. Name: anything (e.g. "my pet feed"). Category: *Website Integration*.
3. **OAuth Redirect URLs**: you need your app's public URL here, which you'll
   only get after Step 3. For now put a placeholder like
   `https://example.com/api/auth/twitch-callback` — you'll come back and fix it.
4. Click **Create**, then **Manage** on the app. Copy the **Client ID**, and
   click **New Secret** to get the **Client Secret**. Keep these for Step 4.

---

## Step 3 — Deploy to Vercel (hosting)

1. Push this project to your own GitHub (or use the one-click button in the
   [README](README.md), which forks it for you).
2. Go to <https://vercel.com>, sign up with GitHub (free), and **Import** the
   repo.
3. Before clicking Deploy, expand **Environment Variables** and add the ones in
   Step 4. (If you used the one-click button, it prompts you for these
   automatically.)
4. Click **Deploy**. When it finishes, Vercel gives you a URL like
   `https://your-app.vercel.app` — that's your app.

---

## Step 4 — The environment variables

These are the settings the app reads. Add them in Vercel (**Project → Settings →
Environment Variables**), or locally in a `.env.local` file. See
[`.env.example`](.env.example) for the full annotated list. The essentials:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role secret |
| `SESSION_SECRET` | A long random string (≥ 32 chars). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_PASSWORD` | A password **you** pick — you'll type it to reach the queue |
| `PETFEED_LOGIN_MODE` | `twitch` or `none` |

If `PETFEED_LOGIN_MODE=twitch`, also add:

| Variable | Where it comes from |
|---|---|
| `TWITCH_CLIENT_ID` | Twitch app → Manage |
| `TWITCH_CLIENT_SECRET` | Twitch app → New Secret |
| `APP_PUBLIC_URL` | Your Vercel URL, e.g. `https://your-app.vercel.app` (no trailing slash) |

After your first deploy you know your real URL, so:
- Set `APP_PUBLIC_URL` to it and redeploy.
- Go back to your Twitch app and set the **OAuth Redirect URL** to
  `https://your-app.vercel.app/api/auth/twitch-callback` (replace the
  placeholder from Step 2).

---

## Step 5 — Add the overlay to OBS

1. Open your app at `https://your-app.vercel.app/admin/pet-pictures` and sign in
   with your `ADMIN_PASSWORD`.
2. At the top of that page there's a **"copy"** button with the overlay URL —
   click it.
3. In OBS: **Sources → + → Browser**. Paste the URL. Set **Width 1920, Height
   1080**. Untick "Shutdown source when not visible". Click OK.
4. The overlay is transparent — drop it on whatever scene you like.

---

## Step 6 — Test it end to end

1. Visit `/pet-feed/submit` and submit a pet photo.
2. In `/admin/pet-pictures`, your submission appears under **pending review**.
   Click **approve**.
3. Within a few seconds it appears in the OBS overlay (and on the public
   `/pet-feed` wall). Done.

---

## Troubleshooting

- **"the pet_pictures table isn't in the database yet"** — you skipped or
  mis-ran the SQL in Step 1. Re-run it; it's safe to run again.
- **Twitch login bounces with `state_mismatch` or an error** — your Twitch app's
  OAuth Redirect URL doesn't exactly match `<APP_PUBLIC_URL>/api/auth/twitch-callback`,
  or `APP_PUBLIC_URL` has a trailing slash. Fix both and redeploy.
- **Photos won't upload** — double-check `SUPABASE_SERVICE_ROLE_KEY` is the
  *service_role* secret, not the `anon` key, and that the SQL in Step 1 ran
  (it creates the storage bucket).
- **The admin login won't accept my password** — `ADMIN_PASSWORD` must be set in
  the environment; after changing it in Vercel you must redeploy.
