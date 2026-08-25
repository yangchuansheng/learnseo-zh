# HeaderNavigation

## Ownership

Implement `HeaderNavigation.tsx`. It is a client component. Read navigation and social content from `content.json`.

## References

- `header-hero-desktop.png`, `header-hero-mobile.png`
- `header-menu-open-desktop.png`, `header-submenu-open-desktop.png`
- `header-menu-open-mobile.png`, `header-search-open-mobile.png`

## Desktop contract

- Container: centered 88% width, maximum 1267px; absolute at top with `80px 0 120px`; total 238px; z-index 100.
- Logo: `Learning` extra-bold + `SEO` regular + `.io` small; 29.75px line-height; navy.
- Right group: 288×38 search input, 10px gap, 110×38 menu button.
- Menu button: `#ededed`, 4px radius, 15.3px/600 uppercase with 2.125px tracking. Hover is white over 200ms.
- Once `scrollY > 100`: fixed, 58px tall, `#f2f2f2`, vertical padding 10px, subtle shadow.
- Open menu: 500px wide near the right edge, white, rounded 8px, about 582px tall, with navy heading and 13 primary rows.
- Parent rows expose nested links and preserve a visible back/close control.

## Mobile contract

- 20px side gutters, 78px total height, 21px logo.
- Search and menu controls are 38×38. Search field is hidden until its control opens a 306×38 form.
- Open menu spans the 350px inner width and starts below y≈66.

## Behavior and accessibility

- Use state for menu, search and active submenu. Add `aria-expanded`, labels, keyboard-operable buttons and Escape-to-close.
- Submit search to `https://learningseo.io/?s=<query>`.
- Use the original outbound URLs.

