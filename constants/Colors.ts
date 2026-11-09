/**
 * Shared colors for the Dwello interface.
 */
export const DwelloColors = {
  primary: '#FF385C', // Signature coral action color
  primaryHover: '#E02447',
  primaryLight: '#FFF0F3',
  primaryBorder: '#FFE2E6',

  // Status and Badges
  rented: '#374151', // Dark charcoal badge for RENTED
  rentedBg: '#F3F4F6',
  fullFlat: '#FF385C',
  sharedRoom: '#FF5A5F',
  fairMarketText: '#047857',
  fairMarketBg: '#ECFDF5',
  fairMarketBorder: '#A7F3D0',

  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  background: '#F8F9FA',
  cardBackground: '#FFFFFF',
  divider: '#E5E7EB',
  border: '#E5E7EB',
  inputBackground: '#F9FAFB',

  // Typography
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textLight: '#F9FAFB',

  // Alerts and States
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // WhatsApp
  whatsappGreen: '#25D366',
  whatsappDark: '#128C7E',
};

export default {
  light: {
    text: DwelloColors.textPrimary,
    background: DwelloColors.background,
    tint: DwelloColors.primary,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: DwelloColors.primary,
    card: DwelloColors.cardBackground,
    border: DwelloColors.border,
  },
  dark: {
    text: '#F9FAFB',
    background: '#111827',
    tint: DwelloColors.primary,
    tabIconDefault: '#6B7280',
    tabIconSelected: DwelloColors.primary,
    card: '#1F2937',
    border: '#374151',
  },
};
