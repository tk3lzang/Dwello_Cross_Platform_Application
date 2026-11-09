/**
 * Database & Listings Service for Dwello
 * Bridges to centralized HybridDataService for resilient live Supabase synchronization
 * and immediate local persistence fallback.
 */

import { HybridDataService } from './hybridDataService';

export { HybridDataService };
export const DatabaseService = HybridDataService;
