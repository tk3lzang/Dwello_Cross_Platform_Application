-- ============================================================================
-- DWELLO MASTER DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Project: DWELLO-BHUTAN (Reference: sdmjjlaoefjzryweshwl)
-- Region: Southeast Asia (Singapore)
-- Target: PostgreSQL 15+ / Supabase
-- ============================================================================

-- Enable pgcrypto / uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (User Accounts & Lifestyle Preferences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    phone_number TEXT DEFAULT '',
    role TEXT DEFAULT 'Tenant',
    occupation TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    preferred_zone TEXT DEFAULT '',
    budget NUMERIC DEFAULT 0,
    gender TEXT DEFAULT '',
    habits TEXT[] DEFAULT '{}',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, phone_number, role, bio, avatar_url, occupation, preferred_zone, budget
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Automatic Profile Creation Trigger on Supabase Auth SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone_number, role, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'Tenant'),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. LISTINGS TABLE (Properties, Active/Archived/Hidden States)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.listings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Full Flat',
    description TEXT DEFAULT '',
    price NUMERIC NOT NULL DEFAULT 0,
    bhk_type TEXT NOT NULL DEFAULT '2BHK',
    municipal_region TEXT NOT NULL DEFAULT 'Thimphu',
    zone_area TEXT NOT NULL DEFAULT 'Other',
    full_address TEXT NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION NOT NULL DEFAULT 27.4712,
    longitude DOUBLE PRECISION NOT NULL DEFAULT 89.6339,
    images TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    roommate_preferences TEXT[] DEFAULT '{}',
    security_deposit NUMERIC DEFAULT 0,
    lease_period TEXT DEFAULT 'Flexible',
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    owner_phone TEXT NOT NULL DEFAULT '',
    owner_role TEXT DEFAULT 'Landlord / Host',
    owner_avatar TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rented', 'archived')),
    fair_market_price BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    report_count INTEGER DEFAULT 0,
    is_flagged_under_review BOOLEAN DEFAULT FALSE,
    appeal_window_open BOOLEAN DEFAULT FALSE,
    appeal_submitted BOOLEAN DEFAULT FALSE,
    appeal_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Listings Row Level Security (RLS)
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public listings viewable by everyone" ON public.listings;
CREATE POLICY "Public listings viewable by everyone"
    ON public.listings FOR SELECT
    USING (true);

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

DROP POLICY IF EXISTS "Owners can delete own listings" ON public.listings;
CREATE POLICY "Owners can delete own listings"
    ON public.listings FOR DELETE
    USING (auth.uid()::text = owner_id);

-- ============================================================================
-- 3. WISHLISTS TABLE (User-scoped Saved Listings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_listing_wishlist UNIQUE (user_id, listing_id)
);

-- Wishlists Row Level Security (RLS)
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wishlists" ON public.wishlists;
CREATE POLICY "Users can view own wishlists"
    ON public.wishlists FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own wishlists" ON public.wishlists;
CREATE POLICY "Users can insert own wishlists"
    ON public.wishlists FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own wishlists" ON public.wishlists;
CREATE POLICY "Users can delete own wishlists"
    ON public.wishlists FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 4. REPORTS TABLE (Listing Moderation & Community Flags)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    listing_id TEXT NOT NULL,
    listing_title TEXT DEFAULT '',
    reporter_id TEXT NOT NULL,
    reporter_email TEXT DEFAULT '',
    reason TEXT NOT NULL,
    details TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'action_taken', 'under_appeal', 'appeal_approved', 'reviewed', 'actioned')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Reports Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reports viewable by everyone" ON public.reports;
CREATE POLICY "Reports viewable by everyone"
    ON public.reports FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.reports;
CREATE POLICY "Authenticated users can submit reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Reports can be updated" ON public.reports;
CREATE POLICY "Reports can be updated"
    ON public.reports FOR UPDATE
    USING (true);

-- ============================================================================
-- 5. APPEALS TABLE (Host Counter-Evidence & Review)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.appeals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    listing_title TEXT DEFAULT '',
    host_id TEXT NOT NULL,
    host_name TEXT DEFAULT '',
    appeal_category TEXT DEFAULT 'General',
    appeal_reason TEXT NOT NULL,
    proof_image_url TEXT,
    admin_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Appeals Row Level Security (RLS)
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appeals are viewable" ON public.appeals;
CREATE POLICY "Appeals are viewable"
    ON public.appeals FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated hosts can submit appeals" ON public.appeals;
CREATE POLICY "Authenticated hosts can submit appeals"
    ON public.appeals FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Appeals can be updated" ON public.appeals;
CREATE POLICY "Appeals can be updated"
    ON public.appeals FOR UPDATE
    USING (true);

-- ============================================================================
-- 6. NOTIFICATIONS TABLE (Targeted User Moderation Alerts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('report_received', 'listing_flagged', 'listing_removed', 'appeal_status', 'appeal_approved')),
    read BOOLEAN DEFAULT FALSE NOT NULL,
    target_id TEXT,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notifications Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Notifications can be created" ON public.notifications;
CREATE POLICY "Notifications can be created"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON public.listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_region ON public.listings(municipal_region);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_listing_id ON public.reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_appeals_listing_id ON public.appeals(listing_id);
