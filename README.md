# Manos Library

A modern library management system built with Next.js 14, Supabase, and DeepSeek. Manos Library provides an intuitive interface for browsing, borrowing, and managing books, enhanced with AI-powered recommendations and natural language search.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **AI:** DeepSeek Chat API for recommendations and natural language search
- **Book Data:** Open Library API (free, no key required)
- **State Management:** Zustand
- **Charts:** Recharts
- **Icons:** Lucide React
- **Date Utilities:** date-fns

## Features

- **Authentication** - Email/password sign up and login via Supabase Auth
- **Book Catalog** - Browse, search, and filter books with cover images from Open Library
- **Borrowing System** - Borrow and return books with due date tracking and overdue detection
- **Favorites** - Save books to your favorites list for quick access
- **AI Recommendations** - Get personalized book suggestions based on your reading history, favorites, and preferred genres
- **Natural Language Search** - Describe what you want to read in plain English and let AI find matches
- **User Profiles** - Customizable profiles with bio, avatar, birthday, and favorite genres
- **Social Connections** - Send and accept connection requests to build a reading network
- **Real-time Messaging** - Chat with connected users via Supabase Realtime
- **Support Tickets** - Submit and track support requests with priority levels
- **Admin Dashboard** - Manage books, users, and tickets with analytics charts and activity feeds
- **Reading History** - Track all past borrows and returns

## Prerequisites

- [Node.js](https://nodejs.org/) 18.x or later
- A [Supabase](https://supabase.com/) account and project
- A [DeepSeek API key](https://platform.deepseek.com)

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd manos
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials (see the Environment Variables table below).

### 4. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com/)
2. Navigate to the SQL Editor in your Supabase dashboard
3. Run the migration files in order:

```
supabase/migrations/001_schema.sql       -- Tables, types, and indexes
supabase/migrations/002_rls_policies.sql -- Row Level Security policies
supabase/migrations/003_functions.sql    -- Database functions and triggers
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (found in Project Settings > API) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key (found in Project Settings > API) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key for server-side operations | Yes |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI-powered recommendations and natural language search | Yes |

## Project Structure

```
manos/
├── src/
│   ├── app/
│   │   ├── (admin)/              # Admin routes (dashboard, books, users, tickets)
│   │   │   └── admin/
│   │   ├── (auth)/               # Authentication routes (login, signup)
│   │   ├── (dashboard)/          # User dashboard routes
│   │   │   ├── books/            # Book catalog and detail pages
│   │   │   ├── dashboard/        # User dashboard home
│   │   │   ├── discover/         # People discovery and AI recommendations
│   │   │   ├── favorites/        # Saved books
│   │   │   ├── history/          # Borrowing history
│   │   │   ├── messages/         # Real-time messaging
│   │   │   ├── profile/          # User profile management
│   │   │   └── tickets/          # Support tickets
│   │   ├── api/
│   │   │   └── ai/               # AI API routes
│   │   │       ├── recommendations/  # Book recommendation endpoint
│   │   │       └── search/           # Natural language search endpoint
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   ├── components/
│   │   ├── admin/                # Admin-specific components
│   │   ├── books/                # Book display components
│   │   ├── chat/                 # Messaging components
│   │   ├── layout/               # Header and sidebar
│   │   ├── profile/              # Profile components
│   │   └── ui/                   # Reusable UI primitives
│   ├── hooks/                    # Custom React hooks (useAuth, useChat)
│   ├── lib/
│   │   ├── api/                  # Open Library and AI API utilities
│   │   └── supabase/             # Supabase client, server, and middleware helpers
│   ├── services/                 # Data access layer (books, borrows, favorites, etc.)
│   ├── types/                    # TypeScript type definitions
│   └── middleware.ts             # Next.js middleware for auth protection
├── supabase/
│   └── migrations/               # SQL migration files
├── .env.local.example            # Environment variable template
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Database Schema

The application uses the following PostgreSQL tables managed by Supabase:

| Table | Description |
|---|---|
| `profiles` | User profiles extending Supabase Auth (name, avatar, bio, favorite genres, role) |
| `books` | Book catalog with title, author, genre, description, cover URL, and availability |
| `borrows` | Borrow records tracking user, book, borrow date, due date, return date, and status |
| `favorites` | User-book favorites (unique per user-book pair) |
| `messages` | Real-time messages between users with read status |
| `connections` | Social connections between users (pending, accepted, rejected) |
| `tickets` | Support tickets with subject, message, status, priority, and admin response |
| `activity_logs` | Audit trail of user actions with metadata |

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
# Library-Management-App
