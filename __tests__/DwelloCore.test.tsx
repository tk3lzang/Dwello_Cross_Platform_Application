/**
 * Dwello Core Test Suite
 * [Dwello-Test Debug] Unit & Integration tests for core utilities.
 *
 * Coverage:
 *   1. Rent & Expense Splitter — accurate equal splits (single & multi-occupant)
 *   2. WhatsApp URI Formatting — Bhutanese number sanitization & +975 prefix
 *   3. Listing Validation — required field checks before submission
 */

import { calculateExpenseSplit, formatNu, generateWhatsAppSplitMessage } from '../utils/splitter';
import { formatWhatsAppPhone, openWhatsAppChat } from '../utils/linking';
import { validateBhutanPhone, validateEmail, validatePassword } from '../utils/validation';

// ---------------------------------------------------------------------------
// 1. RENT & EXPENSE SPLITTER TESTS
// ---------------------------------------------------------------------------

describe('[Dwello-Test Debug] Rent & Expense Splitter — calculateExpenseSplit', () => {
  test('single occupant: total bill equals per-person share', () => {
    console.log('[Dwello-Test Debug]: Test: single occupant split');
    const result = calculateExpenseSplit({
      baseRent: 10000,
      electricity: 1000,
      water: 500,
      wifi: 1500,
      maintenance: 0,
      roommateCount: 1,
      occupantNames: ['Karma'],
    });

    expect(result.totalBill).toBe(13000);
    expect(result.perPersonShare).toBe(13000);
    expect(result.individualBreakdowns).toHaveLength(1);
    expect(result.individualBreakdowns[0].occupantName).toBe('Karma');
    expect(result.individualBreakdowns[0].shareAmount).toBe(13000);
  });

  test('two occupants: each pays exactly half of total', () => {
    console.log('[Dwello-Test Debug]: Test: two-occupant equal split');
    const result = calculateExpenseSplit({
      baseRent: 10000,
      electricity: 1000,
      water: 500,
      wifi: 1500,
      maintenance: 0,
      roommateCount: 2,
      occupantNames: ['Karma', 'Sonam'],
    });

    expect(result.totalBill).toBe(13000);
    expect(result.perPersonShare).toBe(6500);
    expect(result.individualBreakdowns).toHaveLength(2);
    result.individualBreakdowns.forEach((breakdown) => {
      expect(breakdown.shareAmount).toBe(6500);
    });
  });

  test('three occupants: per-person share rounds to nearest whole Ngultrum', () => {
    console.log('[Dwello-Test Debug]: Test: three-occupant rounding');
    const result = calculateExpenseSplit({
      baseRent: 10000,
      electricity: 1000,
      water: 500,
      wifi: 1500,
      maintenance: 0,
      roommateCount: 3,
      occupantNames: ['Karma', 'Sonam', 'Dechen'],
    });

    expect(result.totalBill).toBe(13000);
    // 13000 / 3 = 4333.33 → rounds to 4333
    expect(result.perPersonShare).toBe(4333);
    // Remainder check: totalBill - perPersonShare * count
    const computedRemainder = +(result.totalBill - result.perPersonShare * 3).toFixed(2);
    expect(result.remainderCents).toBe(computedRemainder);
  });

  test('with maintenance included: total bill sums all components', () => {
    console.log('[Dwello-Test Debug]: Test: all utility components included');
    const result = calculateExpenseSplit({
      baseRent: 8000,
      electricity: 800,
      water: 300,
      wifi: 1200,
      maintenance: 500,
      roommateCount: 2,
      occupantNames: ['Karma', 'Sonam'],
    });

    expect(result.totalBill).toBe(10800);
    expect(result.perPersonShare).toBe(5400);
    expect(result.itemizedBreakdown.baseRent).toBe(8000);
    expect(result.itemizedBreakdown.electricity).toBe(800);
    expect(result.itemizedBreakdown.water).toBe(300);
    expect(result.itemizedBreakdown.wifi).toBe(1200);
    expect(result.itemizedBreakdown.maintenance).toBe(500);
  });

  test('zero utilities: per-person share equals base rent divided by occupants', () => {
    console.log('[Dwello-Test Debug]: Test: zero utilities — rent-only split');
    const result = calculateExpenseSplit({
      baseRent: 12000,
      electricity: 0,
      water: 0,
      wifi: 0,
      maintenance: 0,
      roommateCount: 4,
      occupantNames: ['A', 'B', 'C', 'D'],
    });

    expect(result.totalBill).toBe(12000);
    expect(result.perPersonShare).toBe(3000);
  });

  test('defensive: roommateCount=0 defaults to 1 (no division-by-zero)', () => {
    console.log('[Dwello-Test Debug]: Test: roommateCount=0 guard');
    const result = calculateExpenseSplit({
      baseRent: 5000,
      electricity: 0,
      water: 0,
      wifi: 0,
      maintenance: 0,
      roommateCount: 0,
      occupantNames: [],
    });

    expect(result.perPersonShare).toBe(5000);
    expect(result.individualBreakdowns).toHaveLength(1);
  });

  test('defensive: negative values are clamped to zero', () => {
    console.log('[Dwello-Test Debug]: Test: negative input clamping');
    const result = calculateExpenseSplit({
      baseRent: -100,
      electricity: -50,
      water: 500,
      wifi: 0,
      maintenance: 0,
      roommateCount: 1,
      occupantNames: ['Karma'],
    });

    // Negative values become 0, only water (500) counts
    expect(result.totalBill).toBe(500);
    expect(result.perPersonShare).toBe(500);
  });

  test('formatNu: formats numbers as Bhutanese Ngultrum', () => {
    console.log('[Dwello-Test Debug]: Test: formatNu currency formatter');
    expect(formatNu(13000)).toBe('Nu. 13,000');
    expect(formatNu(6500)).toBe('Nu. 6,500');
    expect(formatNu(0)).toBe('Nu. 0');
    expect(formatNu(100000)).toBe('Nu. 100,000');
    // Decimal rounding
    expect(formatNu(4333.67)).toBe('Nu. 4,334');
  });

  test('WhatsApp message contains occupant name and share amount', () => {
    console.log('[Dwello-Test Debug]: Test: generateWhatsAppSplitMessage content');
    const result = calculateExpenseSplit({
      baseRent: 10000,
      electricity: 1000,
      water: 500,
      wifi: 1500,
      maintenance: 0,
      roommateCount: 2,
      occupantNames: ['Karma', 'Sonam'],
    });

    const message = generateWhatsAppSplitMessage(result, 'Karma', 1, 2);
    expect(message).toContain('Karma');
    expect(message).toContain('Nu. 6,500'); // perPersonShare
    expect(message).toContain('Nu. 13,000'); // totalBill
    expect(message).toContain('1/2');
  });
});

// ---------------------------------------------------------------------------
// 2. WHATSAPP URI FORMATTING TESTS
// ---------------------------------------------------------------------------

describe('[Dwello-Test Debug] WhatsApp URI Formatting — formatWhatsAppPhone', () => {
  test('8-digit Bhutanese number gets +975 prefix (B-Mobile 17xxxxxx)', () => {
    console.log('[Dwello-Test Debug]: Test: B-Mobile 17xxxxxx → 97517xxxxxx');
    expect(formatWhatsAppPhone('17123456')).toBe('97517123456');
  });

  test('8-digit Bhutanese number gets +975 prefix (TashiCell 77xxxxxx)', () => {
    console.log('[Dwello-Test Debug]: Test: TashiCell 77xxxxxx → 97577xxxxxx');
    expect(formatWhatsAppPhone('77654321')).toBe('97577654321');
  });

  test('official helpline number (77924582) formats to 97577924582', () => {
    console.log('[Dwello-Test Debug]: Test: Official Helpline 77924582 → 97577924582');
    expect(formatWhatsAppPhone('77924582')).toBe('97577924582');
  });

  test('already-prefixed 11-digit number passes through unchanged', () => {
    console.log('[Dwello-Test Debug]: Test: already-prefixed 975 number unchanged');
    expect(formatWhatsAppPhone('97517123456')).toBe('97517123456');
  });

  test('strips non-numeric characters (spaces, dashes, parentheses)', () => {
    console.log('[Dwello-Test Debug]: Test: non-numeric character stripping');
    expect(formatWhatsAppPhone('17 123 456')).toBe('97517123456');
    expect(formatWhatsAppPhone('17-123-456')).toBe('97517123456');
    expect(formatWhatsAppPhone('(17) 123456')).toBe('97517123456');
  });

  test('empty or undefined input returns empty string', () => {
    console.log('[Dwello-Test Debug]: Test: empty/undefined phone handling');
    expect(formatWhatsAppPhone('')).toBe('');
    expect(formatWhatsAppPhone(undefined)).toBe('');
  });

  test('international number (non-8-digit) passes through digits-only', () => {
    console.log('[Dwello-Test Debug]: Test: international non-Bhutan number');
    expect(formatWhatsAppPhone('+1 555 123 4567')).toBe('15551234567');
  });
});

// ---------------------------------------------------------------------------
// 3. LISTING VALIDATION TESTS
// ---------------------------------------------------------------------------

describe('[Dwello-Test Debug] Listing Validation — validateBhutanPhone', () => {
  test('valid B-Mobile number (17xxxxxx) passes', () => {
    console.log('[Dwello-Test Debug]: Test: valid B-Mobile number');
    expect(validateBhutanPhone('17123456')).toBe(true);
    expect(validateBhutanPhone('17000000')).toBe(true);
    expect(validateBhutanPhone('17999999')).toBe(true);
  });

  test('valid TashiCell number (77xxxxxx) passes', () => {
    console.log('[Dwello-Test Debug]: Test: valid TashiCell number');
    expect(validateBhutanPhone('77654321')).toBe(true);
    expect(validateBhutanPhone('77000000')).toBe(true);
  });

  test('7-digit number fails (too short)', () => {
    console.log('[Dwello-Test Debug]: Test: 7-digit number rejects');
    expect(validateBhutanPhone('1712345')).toBe(false);
  });

  test('9-digit number fails (too long)', () => {
    console.log('[Dwello-Test Debug]: Test: 9-digit number rejects');
    expect(validateBhutanPhone('171234567')).toBe(false);
  });

  test('wrong prefix (27xxxxxx) fails', () => {
    console.log('[Dwello-Test Debug]: Test: wrong prefix rejects');
    expect(validateBhutanPhone('27123456')).toBe(false);
  });

  test('empty string fails', () => {
    console.log('[Dwello-Test Debug]: Test: empty string rejects');
    expect(validateBhutanPhone('')).toBe(false);
  });
});

describe('[Dwello-Test Debug] Listing Validation — validateEmail', () => {
  test('valid email addresses pass', () => {
    console.log('[Dwello-Test Debug]: Test: valid email validation');
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('karma.wangchuk@student.cst.edu.bt')).toBe(true);
  });

  test('malformed emails fail', () => {
    console.log('[Dwello-Test Debug]: Test: malformed email rejects');
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('missing@')).toBe(false);
    expect(validateEmail('@nodomain.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('[Dwello-Test Debug] Listing Validation — validatePassword', () => {
  test('password with 6+ characters passes', () => {
    console.log('[Dwello-Test Debug]: Test: valid password length');
    expect(validatePassword('123456')).toBe(true);
    expect(validatePassword('securepassword')).toBe(true);
  });

  test('password shorter than 6 characters fails', () => {
    console.log('[Dwello-Test Debug]: Test: short password rejects');
    expect(validatePassword('12345')).toBe(false);
    expect(validatePassword('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. LISTING SUBMISSION VALIDATION — Required Field Checks
// ---------------------------------------------------------------------------

describe('[Dwello-Test Debug] Listing Submission — Required Field Validation', () => {
  /**
   * Simulates the validation logic that should run before submitting a listing.
   * Required: title/rent amount > 0, municipalRegion non-empty, bhkType provided.
   */
  function validateListingSubmission(data: {
    price?: number;
    municipalRegion?: string;
    bhkType?: string;
    title?: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.price || data.price <= 0) {
      errors.push('Rent amount (Nu.) is required and must be greater than 0');
    }
    if (!data.municipalRegion || data.municipalRegion.trim().length === 0) {
      errors.push('Municipal zone / region is required');
    }
    if (!data.bhkType || data.bhkType.trim().length === 0) {
      errors.push('Bedroom count (BHK type) is required');
    }
    if (!data.title || data.title.trim().length < 3) {
      errors.push('Listing title is required (minimum 3 characters)');
    }

    return { valid: errors.length === 0, errors };
  }

  test('fully populated listing passes all required field checks', () => {
    console.log('[Dwello-Test Debug]: Test: fully valid listing submission');
    const result = validateListingSubmission({
      price: 15000,
      municipalRegion: 'Thimphu',
      bhkType: '2BHK',
      title: 'Cozy Flat in Babesa',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing rent amount triggers validation error', () => {
    console.log('[Dwello-Test Debug]: Test: missing rent amount rejects');
    const result = validateListingSubmission({
      price: 0,
      municipalRegion: 'Thimphu',
      bhkType: '1BHK',
      title: 'Test Listing',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Rent amount (Nu.) is required and must be greater than 0');
  });

  test('missing municipal zone triggers validation error', () => {
    console.log('[Dwello-Test Debug]: Test: missing municipal zone rejects');
    const result = validateListingSubmission({
      price: 10000,
      municipalRegion: '',
      bhkType: '1BHK',
      title: 'Test Listing',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Municipal zone / region is required');
  });

  test('missing bhkType triggers validation error', () => {
    console.log('[Dwello-Test Debug]: Test: missing bhkType rejects');
    const result = validateListingSubmission({
      price: 10000,
      municipalRegion: 'Paro',
      bhkType: '',
      title: 'Test Listing',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Bedroom count (BHK type) is required');
  });

  test('multiple missing fields returns all corresponding errors', () => {
    console.log('[Dwello-Test Debug]: Test: multiple missing fields — all errors reported');
    const result = validateListingSubmission({
      price: 0,
      municipalRegion: '',
      bhkType: '',
      title: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  test('rent amount of exactly Nu. 1 passes minimum threshold', () => {
    console.log('[Dwello-Test Debug]: Test: minimum acceptable rent = Nu. 1');
    const result = validateListingSubmission({
      price: 1,
      municipalRegion: 'Punakha',
      bhkType: 'Studio',
      title: 'Min Listing',
    });
    expect(result.valid).toBe(true);
  });
});
