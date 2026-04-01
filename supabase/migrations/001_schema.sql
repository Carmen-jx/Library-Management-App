-- Mini Library Management System - Database Schema
-- Migration 001: Tables, Types, and Indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE borrow_status AS ENUM ('borrowed', 'returned', 'overdue');
CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT,
  birthday DATE,
  favorite_genres TEXT[] DEFAULT '{}',
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  open_library_key TEXT UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT[] NOT NULL DEFAULT ARRAY['Fiction']::TEXT[],
  description TEXT,
  cover_url TEXT,
  metadata JSONB,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Borrows table
CREATE TABLE borrows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  returned_at TIMESTAMPTZ,
  status borrow_status NOT NULL DEFAULT 'borrowed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Favorites table
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Connections table
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status connection_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, receiver_id),
  CHECK (requester_id != receiver_id)
);

-- Tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cached AI recommendations per user
CREATE TABLE recommendation_cache (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_books_title ON books USING gin(to_tsvector('english', title));
CREATE INDEX idx_books_author ON books USING gin(to_tsvector('english', author));
CREATE INDEX idx_books_genre ON books USING gin(genre);
CREATE INDEX idx_books_available ON books(available);
CREATE INDEX idx_books_open_library_key ON books(open_library_key);

CREATE INDEX idx_borrows_user_id ON borrows(user_id);
CREATE INDEX idx_borrows_book_id ON borrows(book_id);
CREATE INDEX idx_borrows_status ON borrows(status);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_book_id ON favorites(book_id);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX idx_connections_requester_id ON connections(requester_id);
CREATE INDEX idx_connections_receiver_id ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(status);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_recommendation_cache_refreshed_at ON recommendation_cache(refreshed_at DESC);

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
