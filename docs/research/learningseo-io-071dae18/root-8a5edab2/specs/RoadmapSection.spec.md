# RoadmapSection

## Ownership

Implement `RoadmapSection.tsx` plus a local `RoadmapItem.tsx`. Both may live in the page component directory. Read all 12 items from `content.json`.

## References

- `roadmap-desktop.png`, `roadmap-mobile.png`
- `roadmap-second-open-desktop.png`

## Desktop contract

- Section: 1224px at the reference, 85px vertical margin, rounded top and hidden overflow.
- Heading cap: 216px, padding `51px 85px 68px 102px`, bottom overlap -17px, gradient `0deg, #f0f0ff -32.47%, #fafaff 75.54%`.
- H2: 39.95px/39.95, weight 700. Intro: 17px/21.25, max 632px.
- Card: white, 8px radius, 12px gap, padding about `25.5px 42px`; title 18.7px/21.25 uppercase navy.
- Number: 35×35 purple circle, white 17px/800, offset -15px left. Toggle: 40×40 aligned top-right.
- Open body has 10px vertical text padding. Link grid uses 3 columns and 10px gaps.
- Chips: purple 1px border, 4px radius, `8px 12px`, 15.3px type. Hover fills purple with white text.

## Mobile contract

- Extend section 10px past each main gutter; margin 42px 0.
- Heading cap: 171px, padding `28px 28px 42px 56px`; H2 19.6px/21; intro 14px/17.5.
- Cards start 25px from the viewport edge, use `21px 34.5px 21px 28px`, 8px gaps, 15.4px/16.1 titles.
- Number is 30×30 and offset -13px. Links use 2 columns, 10px gap, 12.6px/14.7.

## Behavior and accessibility

- Independent open state; first item starts open. 400ms height/opacity motion.
- Toggling one item preserves all other item states.
- Buttons expose `aria-expanded` and `aria-controls`; title links remain separate anchors.

