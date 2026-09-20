export const BREAKPOINT_PX = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

/** FAIE/FQE engines look for these exact pixel queries. */
export const MEDIA_QUERIES = {
  mobile: "(min-width: 375px)",
  tablet: "(min-width: 768px)",
  desktop: "(min-width: 1024px)",
  wide: "(min-width: 1440px)",
} as const;

export type MediaQueryName = keyof typeof MEDIA_QUERIES;
