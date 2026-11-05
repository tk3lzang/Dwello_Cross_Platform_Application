/**
 * Validation utilities for Dwello Mobile Application.
 * Includes strict validation for Bhutanese telecom numbers (TashiCell & B-Mobile).
 */

/**
 * Validates Bhutanese 8-digit phone numbers.
 * Must start with 17 (B-Mobile) or 77 (TashiCell) followed by 6 digits.
 * Example valid: "17123456", "77654321"
 *
 * @param phone Raw phone number string
 * @returns boolean indicating validity
 */
export function validateBhutanPhone(phone: string): boolean {
  console.log('[Dwello-Auth Debug]: Validating Bhutan phone number:', phone);
  // Clean whitespace and dashes
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Matches exactly 8 digits starting with 17 or 77
  const bhutanRegex = /^(17|77)\d{6}$/;
  const isValid = bhutanRegex.test(cleaned);
  console.log(`[Dwello-Auth Debug]: Phone "${phone}" validation result:`, isValid);
  return isValid;
}

/**
 * Validates standard email address structure.
 *
 * @param email Email address string
 * @returns boolean
 */
export function validateEmail(email: string): boolean {
  console.log('[Dwello-Auth Debug]: Validating email address:', email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email.trim());
  return isValid;
}

/**
 * Validates password strength (minimum 6 characters).
 *
 * @param password Password string
 * @returns boolean
 */
export function validatePassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6;
}

