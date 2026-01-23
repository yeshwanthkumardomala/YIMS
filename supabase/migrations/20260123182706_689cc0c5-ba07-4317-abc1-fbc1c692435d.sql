-- Phase 3a: Add new role enum values
-- These must be committed before use
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';