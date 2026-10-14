-- ============================================================
-- 047_user_status_and_expiry.sql
-- Adds status ('active' | 'inactive') and expiry_date (TIMESTAMPTZ)
-- to profiles and accounts, guards them against client modification,
-- and defaults new signups to status = 'inactive'.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ DEFAULT NULL;

-- Keep existing accounts and admin active so they remain accessible
UPDATE public.profiles
SET status = 'active',
    expiry_date = NOW() + INTERVAL '10 years'
WHERE email = 'admin@gmail.com' OR account_role = 'owner';

UPDATE public.accounts
SET status = 'active',
    expiry_date = NOW() + INTERVAL '10 years'
WHERE status = 'inactive';

-- Update handle_new_user trigger to explicitly insert status = 'inactive' and expiry_date = NULL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id, status, expiry_date)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id, 'inactive', NULL)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role, status, expiry_date)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner', 'inactive', NULL);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Enforce privilege columns so authenticated users cannot self-activate
CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.account_role IS DISTINCT FROM OLD.account_role
      OR NEW.account_id IS DISTINCT FROM OLD.account_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.expiry_date IS DISTINCT FROM OLD.expiry_date)
     AND current_user = 'authenticated'
  THEN
    RAISE EXCEPTION
      'account_role, account_id, status, and expiry_date cannot be changed directly; contact administrator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
