-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('superadmin', 'business_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'superadmin'::public.app_role)
$$;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_superadmin(auth.uid()));

-- 2. Negocios: acceso del superadmin
CREATE POLICY "Superadmin can view all businesses"
ON public.businesses FOR SELECT TO authenticated
USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can insert businesses"
ON public.businesses FOR INSERT TO authenticated
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can update all businesses"
ON public.businesses FOR UPDATE TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- 3. Perfiles: el superadmin ve quién administra cada negocio
CREATE POLICY "Superadmin can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_superadmin(auth.uid()));

-- 4. El superadmin puede activar/desactivar negocios (el business_admin no)
CREATE OR REPLACE FUNCTION public.protect_business_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot change business id';
  END IF;
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Cannot change slug';
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active
     AND auth.uid() IS NOT NULL
     AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot change active flag';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Ya no se asigna automáticamente el negocio demo a usuarios nuevos
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;