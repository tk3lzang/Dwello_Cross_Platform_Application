/**
 * Native Linking, Rich Deep-Linking & Store Redirection Utilities for Dwello Mobile
 * Supports WhatsApp intent schemas (whatsapp://send), native phone dialer (tel:),
 * rich structured property share payloads, and App Store / Google Play Store redirection fallbacks.
 */

import { Linking, Platform, Share } from 'react-native';

export const APP_STORE_URL = 'https://apps.apple.com/app/dwello-bhutan/id02240180';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cst.dwello';
export const UNIVERSAL_WEB_BASE = 'https://dwello.app';

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
 * Opens WhatsApp conversation with a pre-filled text message.
 * Formats Bhutan country code (+975) for 8-digit numbers.
 *
 * @param phone 8-digit Bhutan phone number or international number
 * @param text Message to send
 */
export async function openWhatsAppChat(phone?: string, text?: string): Promise<boolean> {
  console.log('[Dwello-Linking Debug]: Attempting to open WhatsApp. Phone:', phone);

  let formattedPhone = '';
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 8) {
      formattedPhone = `975${cleanPhone}`;
    } else {
      formattedPhone = cleanPhone;
    }
  }

  const encodedText = text ? encodeURIComponent(text) : '';
  const nativeUrl = formattedPhone
    ? `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  const webUrl = formattedPhone
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  try {
    const supported = await Linking.canOpenURL(nativeUrl);
    console.log('[Dwello-Linking Debug]: WhatsApp app installed check:', supported);

    if (supported) {
      await Linking.openURL(nativeUrl);
      return true;
    } else {
      console.log('[Dwello-Linking Debug]: WhatsApp native URL not directly supported, falling back to web URL');
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    console.error('[Dwello-Error Catch]: Failed to launch WhatsApp intent:', error);
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (fallbackError) {
      console.error('[Dwello-Error Catch]: Fallback WhatsApp web URL failed:', fallbackError);
      return false;
    }
  }
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
