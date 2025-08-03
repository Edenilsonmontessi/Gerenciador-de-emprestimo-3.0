-- Migration: Add unique client code to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS code serial UNIQUE;
