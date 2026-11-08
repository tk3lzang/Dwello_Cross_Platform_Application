/**
 * Core Listing & Roommate Data Types for Dwello Mobile
 */

export type ListingCategory = 'Full Flat' | 'Shared Room';

export type BHKType = '1BHK' | '2BHK' | '3BHK' | 'Studio' | 'Single Room' | 'Shared Room';

export type MunicipalRegion = 'Thimphu' | 'Phuentsholing' | 'Paro' | 'Punakha' | 'Other';

export type ListingStatus = 'active' | 'rented' | 'archived';

export interface PropertyListing {
  id: string;
  title: string;
  category: ListingCategory;
  description: string;
  price: number; // Nu. per month
  bhkType: BHKType;
  municipalRegion: MunicipalRegion;
  zoneArea: string; // e.g. "Babesa", "Motithang", "Rinchending"
  fullAddress: string;
  latitude: number;
  longitude: number;
  images: string[];
  amenities: string[]; // e.g. ['Water Included', 'Parking', 'WiFi', 'Furnished']
  roommatePreferences?: string[]; // e.g. ['Student Friendly', 'Female Only', 'Quiet / Study Environment']
  securityDeposit?: number;
  leasePeriod?: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string; // 8 digits starting with 17 or 77
  ownerRole?: 'Landlord / Host' | 'Primary Tenant' | 'Student' | 'Roommate';
  ownerAvatar?: string;
  status: ListingStatus;
  fairMarketPrice?: boolean;
  is_hidden?: boolean;
  createdAt: string;
  updatedAt: string;
  reportCount?: number;
  isFlaggedUnderReview?: boolean;
  appealWindowOpen?: boolean;
  appealSubmitted?: boolean;
  appealNotes?: string;
}

export interface ListingFilterState {
  category?: ListingCategory | 'All';
  searchQuery: string;
  municipalRegion?: string;
  zoneArea?: string;
  maxRent: number; // e.g. Nu. 2,000 to 100,000
  bhkType?: string; // '1BHK' | '2BHK' | '3BHK' | 'Any'
  amenities: string[];
  roommatePreferences: string[];
  sortBy: 'Newest' | 'Best Value' | 'Price: Low to High' | 'Price: High to Low';
}

export interface ExpenseSplitState {
  baseRent: number;
  electricity: number;
  water: number;
  wifi: number;
  maintenance: number;
  roommateCount: number;
  occupantNames: string[];
}

export interface ReportListingPayload {
  id?: string;
  listingId: string;
  listingTitle: string;
  reason: 'Already Rented' | 'Misleading Information' | 'Wrong Price or Location' | 'Inappropriate Content' | 'Scam / Fraud';
  notes?: string;
  reportedByEmail?: string;
  status: 'pending' | 'reviewed' | 'actioned';
  createdAt?: string;
  ownerId?: string;
  appealNotes?: string;
  appealStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
}

