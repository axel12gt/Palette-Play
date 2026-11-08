/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

export type GameTheme = 'classic' | 'pastel' | 'neon' | 'dark';

export type ColorSwatch = {
  id: number;
  name: string;
  hex: string;
};

const colors = {
  light: {
    text: '#293c43',
    tint: '#447f78',
    background: '#f4efdf',
    foreground: '#293c43',
    card: '#fbf8ed',
    cardForeground: '#293c43',
    primary: '#447f78',
    primaryForeground: '#fffdf3',
    secondary: '#e9e0ca',
    secondaryForeground: '#293c43',
    muted: '#e9e0ca',
    mutedForeground: '#6e7d7b',
    accent: '#e88669',
    accentForeground: '#293c43',
    destructive: '#bd554b',
    destructiveForeground: '#ffffff',
    border: '#d9cfb8',
    input: '#d9cfb8',
  },
  dark: {
    text: '#edf0e6',
    tint: '#77b8a9',
    background: '#202a31',
    foreground: '#edf0e6',
    card: '#29363d',
    cardForeground: '#edf0e6',
    primary: '#77b8a9',
    primaryForeground: '#202a31',
    secondary: '#34434a',
    secondaryForeground: '#edf0e6',
    muted: '#29363d',
    mutedForeground: '#aab9b4',
    accent: '#ef9a7a',
    accentForeground: '#202a31',
    destructive: '#e98279',
    destructiveForeground: '#202a31',
    border: '#405057',
    input: '#405057',
  },
  radius: 16,
};

export const paletteByTheme: Record<GameTheme, ColorSwatch[]> = {
  classic: [
    { id: 1, name: 'Red', hex: '#ee5b60' },
    { id: 2, name: 'Blue', hex: '#4285e9' },
    { id: 3, name: 'Green', hex: '#49a878' },
    { id: 4, name: 'Yellow', hex: '#f2c84b' },
    { id: 5, name: 'Orange', hex: '#f28a44' },
    { id: 6, name: 'Purple', hex: '#9a6bd1' },
    { id: 7, name: 'Pink', hex: '#e679a8' },
    { id: 8, name: 'Teal', hex: '#39aeb2' },
    { id: 9, name: 'Grey', hex: '#78828f' },
  ],
  pastel: [
    { id: 1, name: 'Red', hex: '#ed858d' },
    { id: 2, name: 'Blue', hex: '#87aeea' },
    { id: 3, name: 'Green', hex: '#77bd98' },
    { id: 4, name: 'Yellow', hex: '#e9cb70' },
    { id: 5, name: 'Orange', hex: '#eea26e' },
    { id: 6, name: 'Purple', hex: '#a78bcc' },
    { id: 7, name: 'Pink', hex: '#df91b2' },
    { id: 8, name: 'Teal', hex: '#72b9ba' },
    { id: 9, name: 'Grey', hex: '#8f9ba9' },
  ],
  neon: [
    { id: 1, name: 'Red', hex: '#ff3158' },
    { id: 2, name: 'Blue', hex: '#19aaff' },
    { id: 3, name: 'Green', hex: '#37ed67' },
    { id: 4, name: 'Yellow', hex: '#f6eb27' },
    { id: 5, name: 'Orange', hex: '#ff821f' },
    { id: 6, name: 'Purple', hex: '#b34aff' },
    { id: 7, name: 'Pink', hex: '#ff48bd' },
    { id: 8, name: 'Teal', hex: '#00d9d2' },
    { id: 9, name: 'Grey', hex: '#d5e2f1' },
  ],
  dark: [
    { id: 1, name: 'Red', hex: '#ff777d' },
    { id: 2, name: 'Blue', hex: '#6caaff' },
    { id: 3, name: 'Green', hex: '#70d69c' },
    { id: 4, name: 'Yellow', hex: '#f3d46b' },
    { id: 5, name: 'Orange', hex: '#ffab69' },
    { id: 6, name: 'Purple', hex: '#bd93ee' },
    { id: 7, name: 'Pink', hex: '#f09bc0' },
    { id: 8, name: 'Teal', hex: '#67d0d0' },
    { id: 9, name: 'Grey', hex: '#aeb8c6' },
  ],
};

export const sceneThemes: Record<
  GameTheme,
  {
    background: string;
    card: string;
    text: string;
    muted: string;
    primary: string;
    accent: string;
    border: string;
    related: string;
    selected: string;
    danger: string;
  }
> = {
  classic: {
    background: '#f4efdf',
    card: '#fbf8ed',
    text: '#293c43',
    muted: '#6e7d7b',
    primary: '#447f78',
    accent: '#e88669',
    border: '#d9cfb8',
    related: '#e8eee2',
    selected: '#f1d5c7',
    danger: '#bd554b',
  },
  pastel: {
    background: '#f3eef7',
    card: '#fbf8fd',
    text: '#403a50',
    muted: '#81768c',
    primary: '#8b78a8',
    accent: '#d987a0',
    border: '#d9cde0',
    related: '#eee5f2',
    selected: '#f2dbe3',
    danger: '#bd5966',
  },
  neon: {
    background: '#f1f4df',
    card: '#f9fbe9',
    text: '#263b36',
    muted: '#657b69',
    primary: '#3d8d5c',
    accent: '#ef7760',
    border: '#cbd8b4',
    related: '#e1efc6',
    selected: '#f4e5b0',
    danger: '#c94e49',
  },
  dark: {
    background: '#202a31',
    card: '#29363d',
    text: '#edf0e6',
    muted: '#aab9b4',
    primary: '#77b8a9',
    accent: '#ef9a7a',
    border: '#405057',
    related: '#3b514e',
    selected: '#55443e',
    danger: '#e98279',
  },
};

export default colors;
