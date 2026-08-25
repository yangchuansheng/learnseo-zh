# VideoGallery

## Ownership

Implement `VideoGallery.tsx` plus a local `VideoCard.tsx`. It is a client component because each of 18 cards can enter a playing state.

## References

- `video-gallery-desktop.png`, `video-gallery-mobile.png`
- `video-first-playing-desktop.png`

## Desktop contract

- Gallery: 1224px, 80px vertical margin, two 607px columns with 10px gap.
- Card: 16:9, cover thumbnail, relative, hidden overflow.
- Overlay: dark vertical gradient from roughly 50% to 60% black.
- Text block: left 42.5px, top about 148px, right padding 42.5px.
- Title: white 25.5px/29.75, weight 800. Description: white 17px/21.25.
- Play control: 80×80 white circle, top 24px/right 30px, with a navy triangle.

## Tablet and mobile contract

- One column at 1024px and below.
- Mobile card: full 390px viewport width, 219.375px height, 10px lower gap.
- Mobile title remains over the thumbnail at 21px/24.5.
- Description moves into a separate navy strip below each thumbnail, padding about `19.5px 27.3px`; first strip is roughly 162px tall.
- Mobile play control: 60×60 centered.

## Behavior and accessibility

- Play button sets only that card to playing and mounts its iframe across the full card.
- Append `autoplay=1` with `?` or `&` as appropriate. Keep iframe title and `allowFullScreen`.
- Buttons have descriptive labels. Thumbnails are local downloaded files.

