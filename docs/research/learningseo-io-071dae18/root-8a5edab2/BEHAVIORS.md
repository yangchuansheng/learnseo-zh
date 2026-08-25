# Interaction Inventory

All behaviors were exercised on the live source with Playwright before implementation.

## Header

- At `scrollY <= 100`, the desktop header is absolute and 238px tall.
- At `scrollY >= 101`, it becomes fixed, 58px tall, `#f2f2f2`, with `0 1px 10px rgba(0,0,0,.07)`.
- Menu button toggles the navigation panel. Desktop panel is about 500×582; mobile panel is 350×511.
- A parent menu row opens its nested list while the panel moves to the second-level state.
- Desktop search input is always visible. Mobile search button toggles a 306×38 search form.
- Menu button hover changes its background from `#ededed` to white over 200ms.

## Roadmap

- Twelve cards expand independently; multiple cards can remain open.
- The first card starts open.
- Toggle motion lasts about 400ms.
- Link chips invert to purple background and white text on hover over 100ms.

## Videos

- Eighteen play buttons replace the card content with their YouTube iframe.
- Playback URL uses the source embed URL plus `autoplay=1`.
- The first playable state is recorded in `video-first-playing-desktop.png`.

## FAQ

- Twelve questions expand independently and start closed.
- Answer motion lasts about 400ms.

## Tips

- Every share pill toggles a 120×92 white popover containing X, LinkedIn and Threads actions.
- Popovers are independent and close when their pill is pressed again.

## Navigation and links

- 324 anchors were exercised through a capture-phase navigation sweep; 259 destinations were unique.
- External links keep their original destinations. Search submits to the source site's query URL.
- Source page has no scroll reveal, smooth-scroll controller or scroll snapping.

