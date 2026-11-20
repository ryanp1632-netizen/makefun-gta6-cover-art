// Font registry for the lettering. The @font-face rules live in style.css (relative paths into app/fonts/);
// waitForFonts() makes sure every face is decoded before the first canvas draw.

export const TITLE_FONTS = {
  anton: { family: 'GM Anton', label: 'Anton (tall condensed)', capScale: 1 },
  saira: { family: 'GM Saira Black', label: 'Saira Condensed Black', capScale: 1 },
};

export const SCRIPT_FONTS = {
  yellowtail: { family: 'GM Yellowtail', label: 'Yellowtail (neon script)' },
  pacifico: { family: 'GM Pacifico', label: 'Pacifico (round script)' },
};

export const UI_FONT = 'GM Barlow Condensed';

const ALL_FAMILIES = [
  ...Object.values(TITLE_FONTS).map((f) => f.family),
  ...Object.values(SCRIPT_FONTS).map((f) => f.family),
  UI_FONT,
];

export async function waitForFonts() {
  await Promise.all(ALL_FAMILIES.map((family) => document.fonts.load(`64px "${family}"`, 'AaZz09')));
  await document.fonts.ready;
}

export function fontString(size, family, weight = '') {
  return `${weight ? weight + ' ' : ''}${Math.max(1, size).toFixed(2)}px "${family}"`;
}
