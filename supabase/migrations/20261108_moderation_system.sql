-- ============================================================================
-- DWELLO ADDITIVE MODERATION, APPEALS & NOTIFICATIONS SCHEMA
-- Strictly Additive: No destructive table drops or column alterations.
-- ============================================================================

-- 1. Add is_hidden column to listings if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'listings' AND column_name = 'is_hidden'
    ) THEN
        ALTER TABLE public.listings ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    reporter_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'action_taken', 'under_appeal', 'appeal_approved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL,
    listing_id UUID NOT NULL,
    host_id UUID NOT NULL,
    appeal_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('report_received', 'listing_flagged', 'appeal_status')),
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & add policies if needed
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on reports" ON public.reports FOR UPDATE USING (true);

CREATE POLICY "Allow public read on appeals" ON public.appeals FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on appeals" ON public.appeals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on appeals" ON public.appeals FOR UPDATE USING (true);

CREATE POLICY "Allow users to read own notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow system insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update own notifications" ON public.notifications FOR UPDATE USING (true);
