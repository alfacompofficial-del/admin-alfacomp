# AlfaComp Admin Panel

Secure admin dashboard for managing the **AlfaComp** store at [alfacomp.uz](https://alfacomp.uz).

## Features

- **Secure Login** — Constant-time credential comparison, SQLi/XSS detection, brute-force lockout after 20 failed attempts (30-min lockout)
- **Product Management** — Full CRUD, inline editing, drag-and-drop priority, image upload, stock toggle, CSV export
- **Analytics Dashboard** — Recharts bar charts, pie chart (stock status), category distribution, top products by views/likes
- **Visitor Telemetry** — IP logs, country/city data, unique visitors, today count

## Setup

```bash
npm install
cp .env.example .env
# Fill in your Supabase URL and Anon Key in .env
npm run dev
```

## Deployment

Deploy to Netlify, Vercel, or any static host. Set the environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Security

- Anti-SQLi regex pattern matching on all inputs
- XSS sanitization on feedback messages
- Brute-force protection: max 20 attempts, 30-minute lockout stored in `localStorage`
- Constant-time string comparison prevents timing attacks
- Credentials validated client-side (enhance with Supabase Row Level Security for production)

## Stack

- **React 18** + TypeScript
- **Vite** build tool
- **Tailwind CSS** v3
- **Supabase** (PostgreSQL backend)
- **Recharts** for analytics charts
- **Framer Motion** for animations
- **Sonner** for toast notifications

---

© AlfaComp — admin.alfacompp.uz
