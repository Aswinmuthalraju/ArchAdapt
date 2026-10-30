-- ArchAdapt AI: run this ONCE in the Supabase SQL editor, after schema.sql. Safe to re-run.

-- 1. Sign-up must never fail because of the profile row. The old trigger could abort the whole
--    sign-up ("Database error saving new user"); this version cannot.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles for anyone who signed up while the trigger was missing or failing.
--    Without a profile row, saving a project fails (projects.user_id references profiles).
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, COALESCE(u.email, ''), COALESCE(u.raw_user_meta_data->>'full_name', split_part(COALESCE(u.email, ''), '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 3. Indexes for the queries the app makes.
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_project ON public.floor_plan_versions (project_id, version_number);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON public.design_conversations (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_site_inputs_project ON public.site_inputs (project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project ON public.design_requirements (project_id);
CREATE INDEX IF NOT EXISTS idx_preferences_project ON public.design_preferences (project_id);

-- 4. Site plans hold private land documents: make the bucket private and let each user touch only their own folder
--    (the app uploads to "<user id>/<timestamp>.<ext>").
UPDATE storage.buckets SET public = false WHERE id = 'site-plans';

DROP POLICY IF EXISTS "Users can upload site plans" ON storage.objects;
DROP POLICY IF EXISTS "Users can view site plans" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own site plans" ON storage.objects;
CREATE POLICY "Users manage own site plans" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'site-plans' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'site-plans' AND (storage.foldername(name))[1] = auth.uid()::text);
