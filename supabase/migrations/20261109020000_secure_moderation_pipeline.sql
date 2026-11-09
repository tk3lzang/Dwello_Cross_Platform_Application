-- Secure report, moderation, notification, and appeal operations.
-- Apply after the Dwello master schema and profile sync migrations.

DO $$
BEGIN
    IF to_regclass('public.listings') IS NULL
       OR to_regclass('public.reports') IS NULL
       OR to_regclass('public.appeals') IS NULL
       OR to_regclass('public.notifications') IS NULL
       OR to_regclass('public.profiles') IS NULL THEN
        RAISE EXCEPTION 'Apply the Dwello master schema before the moderation pipeline migration';
    END IF;
END;
$$;

-- Remove legacy policies before changing column types they may reference.
DO $$
DECLARE
    policy_row record;
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['reports', 'appeals', 'notifications']
    LOOP
        FOR policy_row IN
            SELECT p.policyname
            FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, table_name);
        END LOOP;
    END LOOP;
END;
$$;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_flagged_under_review boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS appeal_window_open boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS appeal_submitted boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS target_id text,
    ADD COLUMN IF NOT EXISTS action_url text;

-- Normalize legacy UUID-backed moderation identifiers to the text identifiers
-- used by the app and master schema. These tables intentionally have no FK to
-- listings because seed and offline listing identifiers are not UUIDs.
ALTER TABLE public.reports ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.reports ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.reports ALTER COLUMN listing_id TYPE text USING listing_id::text;
ALTER TABLE public.reports ALTER COLUMN reporter_id TYPE text USING reporter_id::text;

ALTER TABLE public.appeals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.appeals ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.appeals ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.appeals ALTER COLUMN report_id TYPE text USING report_id::text;
ALTER TABLE public.appeals ALTER COLUMN listing_id TYPE text USING listing_id::text;
ALTER TABLE public.appeals ALTER COLUMN host_id TYPE text USING host_id::text;

ALTER TABLE public.notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.notifications ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.notifications ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.notifications ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.notifications ALTER COLUMN target_id TYPE text USING target_id::text;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS listing_title text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS reporter_email text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS details text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS reviewed_by text,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.appeals
    ADD COLUMN IF NOT EXISTS listing_title text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS host_name text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS appeal_category text NOT NULL DEFAULT 'Other',
    ADD COLUMN IF NOT EXISTS proof_image_url text,
    ADD COLUMN IF NOT EXISTS admin_notes text,
    ADD COLUMN IF NOT EXISTS moderation_action_id text,
    ADD COLUMN IF NOT EXISTS review_action_id text,
    ADD COLUMN IF NOT EXISTS reviewed_by text,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS action_url text,
    ADD COLUMN IF NOT EXISTS report_id text,
    ADD COLUMN IF NOT EXISTS appeal_id text,
    ADD COLUMN IF NOT EXISTS moderation_action_id text;

UPDATE public.reports SET status = 'dismissed' WHERE status = 'reviewed';
UPDATE public.reports SET status = 'action_taken' WHERE status = 'actioned';

DO $$
DECLARE
    constraint_row record;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.reports'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.reports DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;

    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.appeals'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.appeals DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;

    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.notifications'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END;
$$;

ALTER TABLE public.reports
    ADD CONSTRAINT dwello_reports_status_check
    CHECK (status IN ('pending', 'dismissed', 'action_taken', 'under_appeal', 'appeal_approved', 'appeal_rejected'));

ALTER TABLE public.appeals
    ADD CONSTRAINT dwello_appeals_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.notifications
    ADD CONSTRAINT dwello_notifications_type_check
    CHECK (type IN ('report_received', 'listing_flagged', 'listing_removed', 'appeal_status', 'appeal_approved'));

CREATE TABLE IF NOT EXISTS public.dwello_moderators (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id text NOT NULL,
    listing_id text NOT NULL,
    owner_id text NOT NULL,
    moderator_id uuid NOT NULL REFERENCES auth.users(id),
    action text NOT NULL CHECK (action IN ('dismiss', 'flag_hide', 'appeal_approve', 'appeal_reject')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dwello_moderation_actions_report_idx
    ON public.moderation_actions (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dwello_moderation_actions_listing_idx
    ON public.moderation_actions (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dwello_appeals_action_idx
    ON public.appeals (moderation_action_id, status);
CREATE INDEX IF NOT EXISTS dwello_notifications_user_created_idx
    ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_dwello_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.dwello_moderators
           WHERE user_id = auth.uid()
       );
$$;

REVOKE ALL ON FUNCTION public.is_dwello_moderator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dwello_moderator() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_listing_report(
    p_listing_id text,
    p_reason text,
    p_details text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_report public.reports%ROWTYPE;
    v_listing_title text;
    v_reporter_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to report a listing';
    END IF;
    IF NULLIF(trim(p_listing_id), '') IS NULL OR p_reason IS NULL THEN
        RAISE EXCEPTION 'A listing and report reason are required';
    END IF;
    IF p_reason NOT IN (
        'Already Rented', 'Misleading Information', 'Wrong Price or Location',
        'Inappropriate Content', 'Scam / Fraud'
    ) THEN
        RAISE EXCEPTION 'Choose a valid report reason';
    END IF;
    IF length(COALESCE(p_details, '')) > 2000 THEN
        RAISE EXCEPTION 'Report details are too long';
    END IF;

    SELECT title INTO v_listing_title
    FROM public.listings
    WHERE id::text = p_listing_id
      AND COALESCE(is_hidden, false) = false;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The listing is unavailable or has already been hidden';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_listing_id, 0));
    SELECT * INTO v_report
    FROM public.reports
    WHERE listing_id = p_listing_id
      AND reporter_id = auth.uid()::text
      AND status IN ('pending', 'under_appeal')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RETURN to_jsonb(v_report);
    END IF;

    v_reporter_email := COALESCE(auth.jwt() ->> 'email', '');
    INSERT INTO public.reports (
        listing_id, listing_title, reporter_id, reporter_email, reason, details, status
    ) VALUES (
        p_listing_id, v_listing_title, auth.uid()::text, v_reporter_email,
        trim(p_reason), COALESCE(trim(p_details), ''), 'pending'
    )
    RETURNING * INTO v_report;

    INSERT INTO public.notifications (
        user_id, title, body, type, read, target_id, report_id
    ) VALUES (
        auth.uid()::text,
        'Report Received',
        'Your report for "' || v_listing_title || '" has been received and is under review.',
        'report_received',
        false,
        p_listing_id,
        v_report.id
    );

    RETURN to_jsonb(v_report);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_listing_report(
    p_report_id text,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_report public.reports%ROWTYPE;
    v_owner_id text;
    v_listing_title text;
    v_action_id text;
BEGIN
    IF NOT public.is_dwello_moderator() THEN
        RAISE EXCEPTION 'Moderator access is required';
    END IF;
    IF p_action IS NULL OR p_action NOT IN ('dismiss', 'flag_hide') THEN
        RAISE EXCEPTION 'Unsupported report action';
    END IF;

    SELECT * INTO v_report
    FROM public.reports
    WHERE id::text = p_report_id
    FOR UPDATE;
    IF NOT FOUND OR v_report.status <> 'pending' THEN
        RAISE EXCEPTION 'The report is missing or has already been reviewed';
    END IF;

    SELECT owner_id::text, title
      INTO v_owner_id, v_listing_title
      FROM public.listings
     WHERE id::text = v_report.listing_id
     FOR UPDATE;
    IF p_action = 'flag_hide' THEN
        IF NOT FOUND OR NULLIF(v_owner_id, '') IS NULL THEN
            RAISE EXCEPTION 'The listing has no valid owner';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id::text = v_owner_id) THEN
            RAISE EXCEPTION 'The listing owner profile could not be verified';
        END IF;
    END IF;

    INSERT INTO public.moderation_actions (
        report_id, listing_id, owner_id, moderator_id, action
    ) VALUES (
        v_report.id, v_report.listing_id, COALESCE(v_owner_id, ''), auth.uid(), p_action
    )
    RETURNING id INTO v_action_id;

    UPDATE public.reports
       SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'action_taken' END,
           reviewed_by = auth.uid()::text,
           reviewed_at = now()
     WHERE id::text = p_report_id
     RETURNING * INTO v_report;

    IF p_action = 'flag_hide' THEN
        UPDATE public.listings
           SET is_hidden = true,
               is_flagged_under_review = true,
               appeal_window_open = true,
               updated_at = now()
         WHERE id::text = v_report.listing_id;

        INSERT INTO public.notifications (
            user_id, title, body, type, read, target_id, action_url, report_id, moderation_action_id
        ) VALUES (
            v_owner_id,
            'Listing Moderation Notice',
            'Action taken: "' || v_listing_title || '" was hidden after review of a report. Open this notice to review the moderation outcome and submit an appeal if eligible.',
            'listing_flagged',
            false,
            v_report.listing_id,
            'dwello://appeal?listingId=' || v_report.listing_id || '&reportId=' || v_report.id,
            v_report.id,
            v_action_id
        );
    END IF;

    RETURN jsonb_build_object(
        'report', to_jsonb(v_report),
        'listing_id', v_report.listing_id,
        'owner_id', v_owner_id,
        'moderation_action_id', v_action_id,
        'action', p_action
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_appeal_eligibility(p_report_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'report_id', r.id,
        'listing_id', l.id::text,
        'listing_title', l.title,
        'moderation_action_id', ma.id,
        'eligible', true
    )
    INTO v_result
    FROM public.reports r
    JOIN public.listings l ON l.id::text = r.listing_id
    JOIN public.moderation_actions ma
      ON ma.report_id = r.id
     AND ma.action = 'flag_hide'
    WHERE r.id = p_report_id
      AND l.owner_id::text = auth.uid()::text
      AND COALESCE(l.is_hidden, false)
      AND r.status IN ('action_taken', 'under_appeal')
      AND NOT EXISTS (
          SELECT 1
          FROM public.appeals a
          WHERE a.moderation_action_id = ma.id
            AND a.status = 'pending'
      )
    ORDER BY ma.created_at DESC
    LIMIT 1;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_listing_appeal(
    p_report_id text,
    p_category text,
    p_reason text,
    p_proof_image_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_eligibility jsonb;
    v_appeal public.appeals%ROWTYPE;
    v_owner_name text;
    v_listing_title text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to submit an appeal';
    END IF;
    IF p_category IS NULL OR p_category NOT IN ('False Spam Report', 'Correct Ownership Proof Provided', 'Pricing Verified', 'Other') THEN
        RAISE EXCEPTION 'Choose a valid appeal category';
    END IF;
    IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'An explanation of at least five characters is required';
    END IF;
    IF length(p_reason) > 5000 THEN
        RAISE EXCEPTION 'The appeal explanation is too long';
    END IF;
    IF NULLIF(p_proof_image_path, '') IS NOT NULL
       AND split_part(p_proof_image_path, '/', 1) <> auth.uid()::text THEN
        RAISE EXCEPTION 'Evidence must belong to the authenticated user';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':appeal:' || p_report_id, 0));
    v_eligibility := public.get_appeal_eligibility(p_report_id);
    IF v_eligibility IS NULL OR v_eligibility ->> 'eligible' <> 'true' THEN
        SELECT * INTO v_appeal
        FROM public.appeals
        WHERE report_id = p_report_id
          AND status = 'pending'
          AND host_id = auth.uid()::text
        ORDER BY created_at DESC
        LIMIT 1;
        IF FOUND THEN
            RETURN to_jsonb(v_appeal);
        END IF;
        RAISE EXCEPTION 'This account is not eligible to appeal this moderation action';
    END IF;

    v_listing_title := v_eligibility ->> 'listing_title';
    SELECT full_name INTO v_owner_name
    FROM public.profiles
    WHERE id = auth.uid();

    INSERT INTO public.appeals (
        report_id, listing_id, listing_title, host_id, host_name,
        appeal_category, appeal_reason, proof_image_url, moderation_action_id, status
    ) VALUES (
        p_report_id,
        v_eligibility ->> 'listing_id',
        v_listing_title,
        auth.uid()::text,
        COALESCE(v_owner_name, ''),
        p_category,
        trim(p_reason),
        NULLIF(p_proof_image_path, ''),
        v_eligibility ->> 'moderation_action_id',
        'pending'
    )
    RETURNING * INTO v_appeal;

    UPDATE public.reports
       SET status = 'under_appeal'
     WHERE id = p_report_id;

    INSERT INTO public.notifications (
        user_id, title, body, type, read, target_id, report_id, appeal_id, moderation_action_id
    ) VALUES (
        auth.uid()::text,
        'Appeal Submitted',
        'Your appeal for "' || v_listing_title || '" has been submitted for review.',
        'appeal_status',
        false,
        v_appeal.listing_id,
        p_report_id,
        v_appeal.id,
        v_appeal.moderation_action_id
    );

    RETURN to_jsonb(v_appeal);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_listing_appeal(
    p_appeal_id text,
    p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_appeal public.appeals%ROWTYPE;
    v_owner_id text;
    v_listing_title text;
    v_action_id text;
BEGIN
    IF NOT public.is_dwello_moderator() THEN
        RAISE EXCEPTION 'Moderator access is required';
    END IF;
    IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Unsupported appeal decision';
    END IF;

    SELECT * INTO v_appeal
    FROM public.appeals
    WHERE id::text = p_appeal_id
    FOR UPDATE;
    IF NOT FOUND OR v_appeal.status <> 'pending' THEN
        RAISE EXCEPTION 'The appeal is missing or has already been reviewed';
    END IF;

    SELECT owner_id::text, title
      INTO v_owner_id, v_listing_title
      FROM public.listings
     WHERE id::text = v_appeal.listing_id
     FOR UPDATE;
    IF NOT FOUND OR v_owner_id <> v_appeal.host_id THEN
        RAISE EXCEPTION 'The appeal owner does not match the listing owner';
    END IF;

    INSERT INTO public.moderation_actions (
        report_id, listing_id, owner_id, moderator_id, action
    ) VALUES (
        v_appeal.report_id, v_appeal.listing_id, v_owner_id, auth.uid(),
        CASE WHEN p_decision = 'approved' THEN 'appeal_approve' ELSE 'appeal_reject' END
    )
    RETURNING id INTO v_action_id;

    UPDATE public.appeals
       SET status = p_decision,
           reviewed_by = auth.uid()::text,
           reviewed_at = now()
     WHERE id::text = p_appeal_id
     RETURNING * INTO v_appeal;

    IF p_decision = 'approved' THEN
        UPDATE public.listings
           SET is_hidden = false,
               is_flagged_under_review = false,
               appeal_window_open = false,
               updated_at = now()
         WHERE id::text = v_appeal.listing_id;
        UPDATE public.reports SET status = 'appeal_approved' WHERE id = v_appeal.report_id;
    ELSE
        UPDATE public.reports SET status = 'appeal_rejected' WHERE id = v_appeal.report_id;
    END IF;

    UPDATE public.appeals
       SET review_action_id = v_action_id
     WHERE id::text = p_appeal_id
     RETURNING * INTO v_appeal;

    INSERT INTO public.notifications (
        user_id, title, body, type, read, target_id, report_id, appeal_id, moderation_action_id
    ) VALUES (
        v_owner_id,
        CASE WHEN p_decision = 'approved' THEN 'Appeal Approved' ELSE 'Appeal Rejected' END,
        CASE
            WHEN p_decision = 'approved'
                THEN 'Your appeal for "' || v_listing_title || '" was approved. The listing is visible again.'
            ELSE 'Your appeal for "' || v_listing_title || '" was rejected. The listing remains hidden.'
        END,
        'appeal_status',
        false,
        v_appeal.listing_id,
        v_appeal.report_id,
        v_appeal.id,
        v_action_id
    );

    RETURN jsonb_build_object(
        'appeal', to_jsonb(v_appeal),
        'listing_id', v_appeal.listing_id,
        'owner_id', v_owner_id,
        'moderation_action_id', v_action_id,
        'decision', p_decision
    );
END;
$$;

-- Install secure RLS policies in place of legacy public policies.
DO $$
DECLARE
    policy_row record;
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'reports', 'appeals', 'notifications', 'moderation_actions', 'dwello_moderators'
    ]
    LOOP
        FOR policy_row IN
            SELECT p.policyname
            FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, table_name);
        END LOOP;
    END LOOP;
END;
$$;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dwello_moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY dwello_reports_moderator_read
    ON public.reports FOR SELECT TO authenticated
    USING (public.is_dwello_moderator());

CREATE POLICY dwello_appeals_owner_or_moderator_read
    ON public.appeals FOR SELECT TO authenticated
    USING (host_id = auth.uid()::text OR public.is_dwello_moderator());

CREATE POLICY dwello_notifications_owner_read
    ON public.notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);
CREATE POLICY dwello_notifications_owner_update
    ON public.notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY dwello_notifications_owner_delete
    ON public.notifications FOR DELETE TO authenticated
    USING (user_id = auth.uid()::text);

CREATE POLICY dwello_moderation_actions_owner_or_moderator_read
    ON public.moderation_actions FOR SELECT TO authenticated
    USING (owner_id = auth.uid()::text OR public.is_dwello_moderator());

REVOKE ALL ON public.reports, public.appeals, public.notifications,
    public.moderation_actions, public.dwello_moderators FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reports, public.appeals, public.notifications,
    public.moderation_actions TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;
GRANT DELETE ON public.notifications TO authenticated;

REVOKE ALL ON FUNCTION public.submit_listing_report(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_listing_report(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_appeal_eligibility(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_listing_appeal(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_listing_appeal(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_listing_report(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_listing_report(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_appeal_eligibility(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_listing_appeal(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_listing_appeal(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_listing_owner_moderation_bypass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND auth.uid()::text = OLD.owner_id
       AND NOT public.is_dwello_moderator()
       AND (
           NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
           OR NEW.is_flagged_under_review IS DISTINCT FROM OLD.is_flagged_under_review
           OR NEW.appeal_window_open IS DISTINCT FROM OLD.appeal_window_open
           OR NEW.appeal_submitted IS DISTINCT FROM OLD.appeal_submitted
       ) THEN
        RAISE EXCEPTION 'Only moderators can change listing moderation status';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_listing_owner_moderation_bypass ON public.listings;
CREATE TRIGGER prevent_listing_owner_moderation_bypass
    BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.prevent_listing_owner_moderation_bypass();

INSERT INTO storage.buckets (id, name, public)
VALUES ('appeal-evidence', 'appeal-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS dwello_appeal_evidence_owner_upload ON storage.objects;
CREATE POLICY dwello_appeal_evidence_owner_upload
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'appeal-evidence'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS dwello_appeal_evidence_owner_or_moderator_read ON storage.objects;
CREATE POLICY dwello_appeal_evidence_owner_or_moderator_read
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'appeal-evidence'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_dwello_moderator()
        )
    );

DROP POLICY IF EXISTS dwello_appeal_evidence_owner_delete ON storage.objects;
CREATE POLICY dwello_appeal_evidence_owner_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'appeal-evidence'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
