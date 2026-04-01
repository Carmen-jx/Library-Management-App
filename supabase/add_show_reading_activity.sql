-- Add show_reading_activity column to profiles table
-- Run this in the Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS show_reading_activity boolean NOT NULL DEFAULT false;
