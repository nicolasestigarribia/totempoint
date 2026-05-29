
-- Add new fields to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at trigger function (generic)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_set_updated_at ON public.businesses;
CREATE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow business admins to update their own business safe fields.
-- Column-level safety (no toggling active/slug) is enforced in app code;
-- at the DB level we block changing id/active/slug via a trigger.
CREATE OR REPLACE FUNCTION public.protect_business_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot change business id';
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Cannot change active flag';
  END IF;
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Cannot change slug';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_protect_fields ON public.businesses;
CREATE TRIGGER businesses_protect_fields
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.protect_business_fields();

-- Grant UPDATE to authenticated
GRANT UPDATE ON public.businesses TO authenticated;

DROP POLICY IF EXISTS "Admins can update own business" ON public.businesses;
CREATE POLICY "Admins can update own business"
ON public.businesses
FOR UPDATE
TO authenticated
USING (id = public.get_user_business_id(auth.uid()))
WITH CHECK (id = public.get_user_business_id(auth.uid()));

-- Remove the auto-profile-creation trigger so random signups don't get a profile.
-- Public signups will also be disabled via auth config; this is defense in depth.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
