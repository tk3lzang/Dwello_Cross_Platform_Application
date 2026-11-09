import { PropertyListing } from '@/types/listing';
import { listingFromDatabase, listingToDatabase } from '@/services/listingMapper';

const listing: PropertyListing = {
  id: 'listing-1',
  title: 'Two-bedroom flat',
  category: 'Full Flat',
  description: 'Near town',
  price: 15000,
  bhkType: '2BHK',
  municipalRegion: 'Thimphu',
  zoneArea: 'Babesa',
  fullAddress: 'Babesa, Thimphu',
  latitude: 27.4,
  longitude: 89.6,
  images: [],
  amenities: [],
  ownerId: '4d44a17d-9b5b-4bdb-93a7-b05e47749f6f',
  ownerName: 'Tashi Wangchuk',
  contactName: 'Tashi',
  ownerPhone: '17123456',
  ownerRole: 'Landlord / Host',
  status: 'active',
  createdAt: '2026-11-09T00:00:00.000Z',
  updatedAt: '2026-11-09T00:00:00.000Z',
};

describe('Listing ownership data mapping', () => {
  test('maps Supabase owner fields to their matching application fields', () => {
    const mapped = listingFromDatabase({
      id: listing.id,
      title: listing.title,
      category: listing.category,
      price: listing.price,
      bhk_type: listing.bhkType,
      municipal_region: listing.municipalRegion,
      zone_area: listing.zoneArea,
      full_address: listing.fullAddress,
      latitude: listing.latitude,
      longitude: listing.longitude,
      images: [],
      amenities: [],
      owner_id: listing.ownerId,
      owner_name: listing.ownerName,
      contact_name: listing.contactName,
      owner_phone: listing.ownerPhone,
      owner_role: listing.ownerRole,
      status: listing.status,
      created_at: listing.createdAt,
      updated_at: listing.updatedAt,
    });

    expect(mapped.ownerId).toBe(listing.ownerId);
    expect(mapped.ownerName).toBe(listing.ownerName);
    expect(mapped.contactName).toBe(listing.contactName);
    expect(mapped.ownerPhone).toBe(listing.ownerPhone);
  });

  test('serializes the authenticated owner ID and contact name for Supabase', () => {
    const row = listingToDatabase(listing);

    expect(row.owner_id).toBe(listing.ownerId);
    expect(row.owner_name).toBe(listing.ownerName);
    expect(row.contact_name).toBe(listing.contactName);
    expect(row.owner_phone).toBe(listing.ownerPhone);
  });

  test('preserves ownership when normalizing a cached camelCase listing', () => {
    const mapped = listingFromDatabase(listing as unknown as Record<string, unknown>);

    expect(mapped.ownerId).toBe(listing.ownerId);
    expect(mapped.ownerName).toBe(listing.ownerName);
  });

  test('keeps listings from two accounts associated with their own profile IDs', () => {
    const secondListing = {
      ...listing,
      id: 'listing-2',
      ownerId: '6a36cd43-6dd7-4a75-b190-dc1e0a72ff34',
      ownerName: 'Pema Choden',
    };

    const mapped = [listing, secondListing].map((item) =>
      listingFromDatabase(listingToDatabase(item))
    );

    expect(mapped.map((item) => [item.ownerId, item.ownerName])).toEqual([
      [listing.ownerId, listing.ownerName],
      [secondListing.ownerId, secondListing.ownerName],
    ]);
  });
});
