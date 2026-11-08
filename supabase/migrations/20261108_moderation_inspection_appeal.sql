-- ============================================================================
-- DWELLO ADDITIVE SCHEMA: ADMIN INSPECTION & NOTIFICATION-DRIVEN APPEALS
-- Strictly Additive: No destructive table drops or column alterations.
-- ============================================================================

-- Ensure notifications table supports appeal action payload
alter table public.notifications 
add column if not exists target_id uuid,
add column if not exists action_url text;

-- Ensure appeals table supports justification details and media proof
alter table public.appeals 
add column if not exists proof_image_url text,
add column if not exists admin_notes text,
add column if not exists appeal_category text;
