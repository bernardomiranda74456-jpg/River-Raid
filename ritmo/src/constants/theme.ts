/**
 * Identidade do Ritmo: azul-petróleo como base, verde-lima como destaque.
 */
import { Platform } from 'react-native';

export const Brand = {
  petrol: '#0F4C5C',
  petrolDark: '#0A3440',
  petrolDeep: '#06252E',
  lime: '#C8F542',
  limeDark: '#9BC51F',
  limeText: '#2E4A00',
} as const;

export const Colors = {
  light: {
    text: '#0B1F26',
    textSecondary: '#5A6B70',
    textMuted: '#8A989D',
    background: '#F3F7F8',
    card: '#FFFFFF',
    backgroundElement: '#E6EEF0',
    backgroundSelected: '#D5E3E6',
    border: '#D9E3E6',
    primary: Brand.petrol,
    onPrimary: '#FFFFFF',
    accent: Brand.lime,
    onAccent: Brand.limeText,
    danger: '#C0392B',
    success: '#1E8E5A',
    tabBar: Brand.petrolDeep,
    tabInactive: '#8FB3BC',
  },
  dark: {
    text: '#EEF4F5',
    textSecondary: '#A9BBC0',
    textMuted: '#7D8F94',
    background: '#06191F',
    card: '#0C2A33',
    backgroundElement: '#123844',
    backgroundSelected: '#1A4855',
    border: '#1C4653',
    primary: '#2B8FA6',
    onPrimary: '#FFFFFF',
    accent: Brand.lime,
    onAccent: Brand.limeText,
    danger: '#E8604F',
    success: '#3DBB7F',
    tabBar: '#04141A',
    tabInactive: '#6F9AA4',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = { [K in keyof (typeof Colors)['light']]: string };

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const MaxContentWidth = 720;
