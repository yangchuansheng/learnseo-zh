# FaqSection

## Ownership

Implement `FaqSection.tsx` as a client component. Read all 12 exact questions and answer HTML blocks from `content.json`.

## References

- `faq-desktop.png`, `faq-mobile.png`
- `faq-first-open-desktop.png`

## Desktop contract

- Section: 1224px, 50px vertical margin.
- Heading: navy, 47.6px/47.6, weight 800, 40px bottom padding.
- Closed row: white, 16px radius, 77.5px high, 10px bottom gap.
- Question button: full width, blue, 18.7px/21.25, `28px 37px`, left-aligned.
- Answer: 15.3px/21.25, padding `0 3% 2%`; preserve source links.

## Mobile contract

- 20px gutters. Closed rows are about 45.5px with 8px radius.
- Question: 15.4px/17.5, padding `14px 35px 14px 14px`.
- Answer: 14px/17.5, padding `0 4% 2%`.

## Behavior and accessibility

- All items start closed and expand independently over about 400ms.
- Question buttons expose `aria-expanded` and `aria-controls`.
- Use a visible plus/minus indicator at the right edge.

