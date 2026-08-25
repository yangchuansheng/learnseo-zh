# TipsSection

## Ownership

Implement `TipsSection.tsx` plus a local `TipCard.tsx`. The share popover needs client state. Read 40 tips from `content.json`.

## References

- `tips-desktop.png`, `tips-mobile.png`
- `tip-share-open-desktop.png`

## Desktop contract

- Full-bleed wrapper: 1440px at reference, lavender background, 100px vertical padding, decorative `tips.png` at top-right.
- Inner width: 1224px. Intro paragraph max-width 740px, 17px/28.9.
- Masonry: 3 columns, about 388px each, 20px gutter. CSS columns are acceptable.
- Card: white, 16px radius, `24px 24px 50px`, 20px bottom spacing.
- Quote: 15.3px/21.25. Author: navy with 10px top margin.
- Share pill: navy, white text, 50px radius, `6px 10px 6px 6px`, 20px icon.
- Popover: 120×92, white, 10px radius, shadow, three stacked actions with 5px gaps.

## Tablet and mobile contract

- Tablet uses 2 masonry columns. Mobile uses 1 column.
- Mobile wrapper is full 390px, padding 60px 0, decorative image at 60% size.
- Mobile inner width about 344px. Intro: 14px/23.8. Card quote: 12.6px/17.5.

## Behavior and accessibility

- Each share pill toggles its own popover. Actions use original X and Threads URLs; LinkedIn uses a standard share URL for the current tip anchor.
- Buttons expose `aria-expanded`; action links have readable labels and open safely.

