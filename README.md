# Manos Library

Manos Library is a full-stack library management application built with Next.js (App Router), Supabase, and TypeScript. It supports member and admin workflows, AI-assisted discovery, social features, and real-time messaging.

## Live App

- Production URL: https://library-management-app-ruby.vercel.app

## Tester Accounts

Use these accounts to test quickly:

- User: jane@email.com / janeUser
- User: john@email.com / johnUser
- Admin: admin@email.com / adminadmin

## Core Features

- Authentication (email/password + Google OAuth via Supabase)
- Book browsing, search, and recommendation flows
- Borrowing, returning, favorites, and reading history
- Social connections and real-time messaging
- Support ticket system for users and admins
- Admin analytics and ticket management

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Realtime)
- OpenAI + DeepSeek integrations
- Recharts + Lucide React
- Vitest + Testing Library

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` (or `.env.local`) file with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
```

For production on Vercel, set `NEXT_PUBLIC_APP_URL` to:

```dotenv
NEXT_PUBLIC_APP_URL=https://library-management-app-ruby.vercel.app
```

### 3) Run Supabase migrations

Apply SQL files in `supabase/migrations` in order.

### 4) Start the app

```bash
npm run dev
```

Open http://localhost:3000.

## OAuth Redirect Setup (Important)

To avoid OAuth redirecting to the wrong domain:

- Add `https://library-management-app-ruby.vercel.app/auth/callback` in Supabase Auth redirect URLs.
- Keep `NEXT_PUBLIC_APP_URL` set correctly per environment.
- Ensure Google OAuth config is aligned with your Supabase callback setup.

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — lint check
- `npm run test` — run tests
- `npm run refresh:book-genres` — refresh book genre data

## High-Level Structure

- `src/app` — app router pages, route groups, and API routes
- `src/components` — UI and feature components
- `src/contexts` / `src/hooks` — auth and client state logic
- `src/services` / `src/lib` — data access, business logic, utilities
- `supabase/migrations` — database schema and policy migrations

## Notes

- This project currently targets Next.js `14.2.20`.
- Keep environment variables in Vercel in sync with local development values.
