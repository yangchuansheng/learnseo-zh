# ResourceBanner

## Ownership

Implement `ResourceBanner.tsx` from `content.json` and the downloaded Google Sheets icon.

## References

- `resource-banner-desktop.png`
- `resource-banner-mobile.png`

## Desktop contract

- Width 1100px inside the main frame; margin `40px 62px 80px`; minimum height 324.5px.
- Padding `55px 184px 55px 73px`; 16px radius; hidden overflow.
- Background: `linear-gradient(90deg, #2e73ea 77.26%, #22ddd2 117.47%)`.
- Icon: 71×66. Text column has 42px left padding.
- Title: white, 34px/38.25, weight 800. Body: white, 17px/22.95.
- CTA: white surface, blue 16px label, `14px 16px`, 4px radius; hover shadow `0 0 8px rgba(17,58,128,.35)`.

## Mobile contract

- Width 343px centered; about 288px tall; tighter padding with a 13.5px text indent.
- Icon moves to top-right at 20px and becomes 40×37.
- Title: 17.92px/21; body: 14px/18.9; CTA: 14px with 12px padding.

## Behavior

- CTA opens its exact Google Sheets copy URL in a new tab with safe rel attributes.
- No client JavaScript is required.

