/**
 * Native Linking, Rich Deep-Linking & Store Redirection Utilities for Dwello Mobile
 * Supports WhatsApp intent schemas (whatsapp://send), native phone dialer (tel:),
 * rich structured property share payloads, and App Store / Google Play Store redirection fallbacks.
 */

import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export const APP_STORE_URL = 'https://apps.apple.com/app/dwello-bhutan/id02240180';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cst.dwello';
export const UNIVERSAL_WEB_BASE = 'https://dwello.app';
export const OFFICIAL_DWELLO_HELPLINE = '77924582';
export const OFFICIAL_DWELLO_WHATSAPP_NUMBER = '97577924582';
export const OFFICIAL_DWELLO_WHATSAPP_URI = 'whatsapp://send?phone=97577924582';

export interface RichListingSharePayload {
  id: string;
  title: string;
  price: number;
  zoneArea: string;
  municipalRegion: string;
  imageUrl?: string;
}

/**
 * Triggers rich listing share with structured text and direct deep-link URI / web fallback.
 *
 * @param listing Listing metadata to format
 */
export async function shareRichListing(listing: RichListingSharePayload): Promise<boolean> {
  const formattedRent = Math.round(listing.price).toLocaleString('en-US');
  const webLink = `${UNIVERSAL_WEB_BASE}/listing/${listing.id}`;
  const customSchemeLink = `dwello://listing/${listing.id}`;

  const message = [
    `🏠 Check out this property on Dwello!`,
    `📍 Title: ${listing.title}`,
    `💰 Price: Nu. ${formattedRent}/mo`,
    `📍 Location: ${listing.zoneArea}, ${listing.municipalRegion}`,
    ``,
    `View this listing in Dwello: ${webLink}`,
    `(If you don't have Dwello installed, you will be prompted to download it from the App Store or Google Play Store).`,
  ].join('\n');

  console.log('[Dwello-DeepLink Debug]: Constructing rich share payload for:', listing.title);
  try {
    const result = await Share.share(
      {
        title: `Dwello: ${listing.title}`,
        message,
        url: Platform.OS === 'ios' ? webLink : undefined,
      },
      {
        dialogTitle: `Share "${listing.title}" via`,
      }
    );
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[Dwello-Error Catch]: Rich share sheet failed:', error);
    return false;
  }
}

/**
 * Opens the appropriate platform store page if the app is missing.
 */
export async function openStorePage(): Promise<void> {
  const target = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  console.log('[Dwello-DeepLink Debug]: Redirecting user to store download:', target);
  try {
    await Linking.openURL(target);
  } catch (error) {
    console.error('[Dwello-Error Catch]: Failed to open store download page:', error);
  }
}

/**
 * Formats a phone number for direct WhatsApp deep-linking.
 * Handles Bhutan 8-digit mobile numbers (+975 17xxxxxx / 77xxxxxx) and international formats.
 */
export function formatWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 8) {
    return `975${digits}`;
  }
  return digits;
}

/**
 * Opens WhatsApp conversation directly targeted at a phone number with a pre-filled text message.
 * Employs direct URI scheme `whatsapp://send?phone=[number]&text=[encoded_message]` to skip manual contact picker.
 *
 * @param phone 8-digit Bhutan phone number or international number
 * @param text Message to send
 */
export async function openWhatsAppChat(phone?: string, text?: string): Promise<boolean> {
  const formattedPhone = formatWhatsAppPhone(phone);
  console.log(`[Dwello-WhatsApp Debug]: Launching WhatsApp direct chat for phone: "${formattedPhone || 'general'}"`);

  const encodedText = text ? encodeURIComponent(text) : '';
  const nativeUrl = formattedPhone
    ? `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  const webUrl = formattedPhone
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  try {
    const supported = await Linking.canOpenURL(nativeUrl);
    console.log('[Dwello-WhatsApp Debug]: WhatsApp native URL support check:', supported);

    if (supported) {
      await Linking.openURL(nativeUrl);
      return true;
    } else {
      console.log('[Dwello-WhatsApp Debug]: Native WhatsApp app not found, falling back to web URL');
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    console.error('[Dwello-WhatsApp Debug]: Failed to launch WhatsApp direct link:', error);
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (fallbackError) {
      console.error('[Dwello-WhatsApp Debug]: WhatsApp web fallback also failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Quick-link to launch official Dwello WhatsApp customer care chat: whatsapp://send?phone=97577924582
 */
export async function openOfficialSupportWhatsApp(customText?: string): Promise<boolean> {
  const message = customText || 'Hello Dwello Support, I need assistance regarding a property listing on the app.';
  return openWhatsAppChat(OFFICIAL_DWELLO_HELPLINE, message);
}

export interface WhatsAppSendResult {
  success: boolean;
  copiedToClipboard: boolean;
  smsAvailable: boolean;
  error?: string;
}

/**
 * Direct WhatsApp sharing with graceful clipboard & SMS fallback.
 * If number is missing, not registered, or intent fails, copies message to clipboard
 * and optionally opens native SMS app.
 */
export async function sendWhatsAppWithFallback(
  phone: string | undefined,
  text: string
): Promise<WhatsAppSendResult> {
  console.log('[Dwello-WhatsApp Debug]: Initiating direct share with fallback checks...');

  const formattedPhone = formatWhatsAppPhone(phone);

  if (!formattedPhone) {
    console.warn('[Dwello-WhatsApp Debug]: No valid phone provided, copying message to clipboard.');
    try {
      await Clipboard.setStringAsync(text);
      return { success: false, copiedToClipboard: true, smsAvailable: false, error: 'Number not on WhatsApp — message copied to clipboard' };
    } catch {
      return { success: false, copiedToClipboard: false, smsAvailable: false, error: 'Clipboard copy failed' };
    }
  }

  const success = await openWhatsAppChat(phone, text);

  if (!success) {
    console.warn('[Dwello-WhatsApp Debug]: WhatsApp launch failed. Copying message to clipboard & preparing SMS fallback.');
    try {
      await Clipboard.setStringAsync(text);
      const encoded = encodeURIComponent(text);
      const smsUrl = Platform.OS === 'ios' ? `sms:${formattedPhone}&body=${encoded}` : `sms:${formattedPhone}?body=${encoded}`;
      const canSms = await Linking.canOpenURL(smsUrl).catch(() => false);

      return {
        success: false,
        copiedToClipboard: true,
        smsAvailable: canSms,
        error: 'Number not on WhatsApp — message copied to clipboard',
      };
    } catch (e: any) {
      return { success: false, copiedToClipboard: false, smsAvailable: false, error: e.message };
    }
  }

  return { success: true, copiedToClipboard: false, smsAvailable: false };
}

/**
 * Opens the native device dialer with the phone number populated.
 *
 * @param phone 8-digit Bhutan phone number
 */
export async function callPhoneNumber(phone: string): Promise<boolean> {
  console.log('[Dwello-Linking Debug]: Opening native dialer for phone:', phone);
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  const url = `tel:${cleanPhone}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      console.warn('[Dwello-Linking Debug]: Device does not support tel: URL scheme');
      return false;
    }
  } catch (error) {
    console.error('[Dwello-Error Catch]: Error invoking phone dialer:', error);
    return false;
  }
}

/**
 * Legacy share helper calling shareRichListing
 */
export async function shareListingNative(title: string, message: string): Promise<boolean> {
  console.log('[Dwello-Linking Debug]: Invoking shareListingNative for:', title);
  try {
    const result = await Share.share({
      title: `Dwello: ${title}`,
      message: `${title}\n\n${message}\n\nhttps://dwello.app`,
    });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[Dwello-Error Catch]: Share sheet failed:', error);
    return false;
  }
}
