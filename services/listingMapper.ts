import { PropertyListing } from '@/types/listing';

type ListingRow = Record<string, unknown>;

const value = (row: ListingRow, snakeCase: string, camelCase: string): unknown =>
  row[snakeCase] ?? row[camelCase];

const stringValue = (input: unknown, fallback = ''): string =>
  typeof input === 'string' ? input : fallback;

const numberValue = (input: unknown, fallback = 0): number =>
  typeof input === 'number' ? input : fallback;

const stringArray = (input: unknown): string[] =>
  Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [];

export function listingFromDatabase(row: ListingRow): PropertyListing {
  return {
    id: stringValue(row.id),
    title: stringValue(row.title),
    category: row.category === 'Shared Room' ? 'Shared Room' : 'Full Flat',
    description: stringValue(row.description),
    price: numberValue(row.price),
    bhkType: stringValue(value(row, 'bhk_type', 'bhkType'), '2BHK') as PropertyListing['bhkType'],
    municipalRegion: stringValue(value(row, 'municipal_region', 'municipalRegion'), 'Thimphu'),
    zoneArea: stringValue(value(row, 'zone_area', 'zoneArea'), 'Other'),
    fullAddress: stringValue(value(row, 'full_address', 'fullAddress')),
    latitude: numberValue(row.latitude),
    longitude: numberValue(row.longitude),
    images: stringArray(row.images),
    amenities: stringArray(row.amenities),
    roommatePreferences: stringArray(value(row, 'roommate_preferences', 'roommatePreferences')),
    securityDeposit: numberValue(value(row, 'security_deposit', 'securityDeposit')),
    leasePeriod: stringValue(value(row, 'lease_period', 'leasePeriod')) || undefined,
    ownerId: stringValue(value(row, 'owner_id', 'ownerId')),
    ownerName: stringValue(value(row, 'owner_name', 'ownerName')),
    contactName: stringValue(value(row, 'contact_name', 'contactName')) || undefined,
    ownerPhone: stringValue(value(row, 'owner_phone', 'ownerPhone')),
    ownerRole: stringValue(value(row, 'owner_role', 'ownerRole')) as PropertyListing['ownerRole'],
    ownerAvatar: stringValue(value(row, 'owner_avatar', 'ownerAvatar')) || undefined,
    status: row.status === 'rented' || row.status === 'archived' ? row.status : 'active',
    fairMarketPrice: Boolean(value(row, 'fair_market_price', 'fairMarketPrice')),
    is_hidden: Boolean(value(row, 'is_hidden', 'is_hidden')),
    is_archived: Boolean(value(row, 'is_archived', 'is_archived')),
    createdAt: stringValue(value(row, 'created_at', 'createdAt')),
    updatedAt: stringValue(value(row, 'updated_at', 'updatedAt')),
    reportCount: numberValue(value(row, 'report_count', 'reportCount')),
    isFlaggedUnderReview: Boolean(value(row, 'is_flagged_under_review', 'isFlaggedUnderReview')),
    appealWindowOpen: Boolean(value(row, 'appeal_window_open', 'appealWindowOpen')),
    appealSubmitted: Boolean(value(row, 'appeal_submitted', 'appealSubmitted')),
    appealNotes: stringValue(value(row, 'appeal_notes', 'appealNotes')),
  };
}

export function listingToDatabase(listing: PropertyListing): ListingRow {
  return {
    id: listing.id,
    title: listing.title,
    category: listing.category,
    description: listing.description,
    price: listing.price,
    bhk_type: listing.bhkType,
    municipal_region: listing.municipalRegion,
    zone_area: listing.zoneArea,
    full_address: listing.fullAddress,
    latitude: listing.latitude,
    longitude: listing.longitude,
    images: listing.images,
    amenities: listing.amenities,
    roommate_preferences: listing.roommatePreferences || [],
    security_deposit: listing.securityDeposit ?? 0,
    lease_period: listing.leasePeriod || 'Flexible',
    owner_id: listing.ownerId,
    owner_name: listing.ownerName,
    contact_name: listing.contactName || '',
    owner_phone: listing.ownerPhone,
    owner_role: listing.ownerRole || 'Landlord / Host',
    owner_avatar: listing.ownerAvatar || '',
    status: listing.status,
    fair_market_price: listing.fairMarketPrice ?? false,
    is_hidden: listing.is_hidden ?? false,
    is_archived: listing.is_archived ?? false,
    report_count: listing.reportCount ?? 0,
    is_flagged_under_review: listing.isFlaggedUnderReview ?? false,
    appeal_window_open: listing.appealWindowOpen ?? false,
    appeal_submitted: listing.appealSubmitted ?? false,
    appeal_notes: listing.appealNotes || '',
    created_at: listing.createdAt,
    updated_at: listing.updatedAt,
  };
}
