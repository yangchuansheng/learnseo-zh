# FooterSection

## Ownership

Implement `FooterSection.tsx`, including the newsletter band. Read navigation, legal, social and newsletter data from `content.json`.

## References

- `footer-desktop.png`
- `footer-mobile.png`

## Desktop contract

- Newsletter: full width, about 77.7px, `#efe5ff`, 20px padding, centered 18.7px text.
- Newsletter link is bold navy with a 2px dashed underline and 5px lower padding; render the paper-plane icon.
- Footer: full width, 476px, navy background, `60px 0 40px`.
- Inner frame: 1224px and 259px tall, flex layout.
- Logo column about 305px with 40px right padding; logo 25.5px.
- Sitemap about 604px; heading 17px; primary links in two 302px columns, 14.45px/300.
- Social column about 315px with 40px left padding. Render five circular branded labels/icons.
- Copyright is separated by a white top rule and preserves source copy/links.

## Mobile contract

- Newsletter is about 92px. Footer is about 700px with `40px 20px`.
- Inner content is one column, about 329px. Logo 21px.
- Sitemap starts 20px below the logo and uses one column; links 14px/300 with 12px row margins.
- Social block follows the sitemap. Copyright: 11.2px/15.4.

## Behavior and accessibility

- Keep every original outbound URL and safe external-link rel attributes.
- Social links have readable aria-labels. No client JavaScript is required.

