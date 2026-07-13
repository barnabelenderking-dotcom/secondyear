# Second Year — website

Marketing site + tutor directory + enquiry/application forms for secondyear.co.uk.
Built with Vite + React. Talks to a live Supabase backend (project `second-year`).

## Run locally
```
npm install
npm run dev        # http://localhost:5173
```

## Build
```
npm run build      # outputs to dist/
```

## What's wired
- **Directory** — fetches approved+verified tutors live from Supabase.
- **Enquiry form** — POSTs to the `submit-enquiry` edge function (honeypot,
  rate limit, validation, auto-ack email).
- **Tutor application** — the `/#apply` route; POSTs to
  `submit-tutor-application`. New tutors land as `pending` + unverified and are
  invisible until approved in the Supabase dashboard.

## Config
Supabase URL + publishable key are in `src/App.jsx` (`SB_URL`, `SB_KEY`).
The publishable key is safe to ship publicly — RLS is the security boundary.

## Deploy (Vercel, recommended)
1. Push this folder to a GitHub repo.
2. vercel.com → New Project → import the repo.
3. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output dir `dist`. Deploy.
4. Project → Settings → Domains → add `secondyear.co.uk` and `www.secondyear.co.uk`.
   Vercel shows you the DNS records to add at Namecheap.

The `vercel.json` rewrite makes the `#apply` route survive refreshes.

## The tutor share link
Send prospective tutors: `https://secondyear.co.uk/#apply`
