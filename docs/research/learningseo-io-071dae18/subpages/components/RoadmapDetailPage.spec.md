# RoadmapDetailPage Specification

## Overview

- **Target file:** `src/app/[...slug]/page.tsx` with `SubpageRuntime`
- **Screenshot:** `docs/design-references/learningseo-io-071dae18/subpages/roadmap-detail-desktop.png`
- **Interaction model:** shared header click/scroll states; click-driven roadmap, video, FAQ and share controls

## DOM Structure

The captured `main#content` HTML is sanitized and rendered inside `.learningseo-subpage`. Direct children are:

1. `header` with `.breadcrumbs` and a two-part `h1` (roadmap number/category link plus page title).
2. `article.page-content-children` containing the page intro, resource sections, tables, lists and inline links.
3. `.resources-wrapper` with source resource cards.
4. `.video-gallery` containing the featured YouTube card and play control.
5. `.tips-wrapper.fullwidth` with masonry tips and independent share pills.
6. `.faq` with independent accordion answers.
7. `.related-wrapper.fullwidth` with purple related-resource cards.

The shared React `#roadmap` follows the sanitized legacy content as a sibling section.

## Computed Styles

- Source CSS is generated at `src/components/sites/learningseo-io-071dae18/subpages/generated/subpage.css`, prefixed to `.learningseo-subpage`.
- Desktop content frame: 1224px wide, centered at x=108, beginning at y=238 below the 238px absolute header.
- Detail article column: 768px wide with 20px top and 40px bottom padding.
- Source typography uses Mukta 300/400/700/800 and the site colors `#000036`, `#a87be9`, `#2e73ea`, `#606060`, `#f2f2f2`.
- Responsive layout follows the source theme breakpoints at 1024px and 767px.

## States & Behaviors

- Roadmap items use the shared React disclosure component and identify the current stage and resource.
- Video cards replace the poster with a YouTube iframe and append `autoplay=1`.
- FAQ items toggle their answer container independently.
- Tip cards toggle a share popover with X, LinkedIn and Threads actions.
- Header state is provided by the shared `HeaderNavigation` component: absolute at the top, fixed 58px after scrollY 100.

## Assets

- Page media: `/sites/learningseo-io-071dae18/subpages/media/*`.
- Theme assets: `/sites/learningseo-io-071dae18/subpages/theme/*`.
- Shared logo/header/footer icons: existing site-scoped shared components.

## Responsive Behavior

- **Desktop (1440px):** centered 1224px frame, 768px article column, multi-column resources and videos.
- **Tablet (768px):** source CSS collapses resource and video columns while preserving the full-width bands.
- **Mobile (390px):** one-column content, stacked resource cards, full-width video cards and three-column tips masonry.
