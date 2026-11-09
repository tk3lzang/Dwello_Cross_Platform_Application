DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, phone_number, role, bio, avatar_url, occupation, preferred_zone, budget
FROM public.profiles;

REVOKE SELECT ON public.profiles FROM PUBLIC, anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Users upload their own profile avatars" ON storage.objects;
CREATE POLICY "Users upload their own profile avatars"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users update their own profile avatars" ON storage.objects;
CREATE POLICY "Users update their own profile avatars"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users delete their own profile avatars" ON storage.objects;
CREATE POLICY "Users delete their own profile avatars"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

NOTIFY pgrst, 'reload schema';
