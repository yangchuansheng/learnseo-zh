# HeroSection

## Ownership

Implement `HeroSection.tsx`. Read hero content from `content.json`; render `hero-animation.svg` through an object element so the embedded SVG animation remains active.

## References

- `header-hero-desktop.png`
- `header-hero-mobile.png`

## Desktop contract

- Main article starts at y=238 within a 1224px content frame and has 80px left padding.
- Title max-width 850px: 76.5px/89.25, weight 800, navy; marked words are purple.
- Version row: 15.98px/600 uppercase; 25px top margin and 50px bottom margin.
- Intro max-width 850px: 20.4px/28.9; paragraph spacing follows the source screenshot.
- Animation is positioned behind the right side, roughly 1106×938 at x≈818/y≈232 in the 1440px reference.

## Mobile contract

- Main uses 20px gutters. Title max-width 255px, 24.5px/32.9, with 25px top and 15px bottom margins.
- Version row is 12.6px with 15px/20px spacing.
- Intro becomes a `#ededed` card extending 10px past the main gutters, with 20px padding and 8px radius; first paragraph is 16.38px/24.64.
- Animation is approximately 429×585, positioned x≈98/y=-40 behind the hero.

## Content and behavior

- Preserve every source link and paragraph from `content.json`.
- Use source asset `/sites/learningseo-io-071dae18/root-8a5edab2/hero-animation.svg`.
- No client JavaScript is required.

