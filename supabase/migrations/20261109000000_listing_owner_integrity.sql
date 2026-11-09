ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.set_listing_owner_profile_fields()
RETURNS TRIGGER AS $$
DECLARE
    profile_name TEXT;
    profile_avatar TEXT;
BEGIN
    SELECT full_name, avatar_url
      INTO profile_name, profile_avatar
      FROM public.profiles
     WHERE id::text = NEW.owner_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing owner profile does not exist';
    END IF;

    NEW.owner_name := COALESCE(NULLIF(profile_name, ''), 'Dwello member');
    NEW.owner_avatar := COALESCE(profile_avatar, '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_listing_owner_profile_fields ON public.listings;
CREATE TRIGGER set_listing_owner_profile_fields
    BEFORE INSERT ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.set_listing_owner_profile_fields();

DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;
CREATE POLICY "Authenticated users can create listings"
    ON public.listings FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND owner_id = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners can update own listings" ON public.listings;
CREATE POLICY "Owners can update own listings"
    ON public.listings FOR UPDATE
    USING (auth.uid()::text = owner_id)
    WITH CHECK (auth.uid()::text = owner_id);
