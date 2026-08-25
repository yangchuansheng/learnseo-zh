# RoadmapCategoryPage Specification

## Overview

- **Target file:** `src/app/[...slug]/page.tsx`
- **Screenshot:** `docs/design-references/learningseo-io-071dae18/subpages/roadmap-category-desktop.png`
- **Interaction model:** shared click/scroll states; roadmap, video, FAQ and share controls

## DOM Structure

Captured category pages use the same `main#content` shell as detail pages. The page header contains breadcrumbs and a numbered `h1`; the article contains the category introduction and resource cards. The remaining children are `.video-gallery`, `.tips-wrapper.fullwidth`, `.faq`, `.related-wrapper.fullwidth` and `#roadmap`.

## Computed Styles

- Desktop main frame: 1224px centered below the 238px header.
- Category intro article: 768px content column with 20px top and 40px bottom padding and an 80px left offset.
- Resource cards use the source theme's white cards, purple borders and 3-column desktop grid.
- Source stylesheet and exact selectors are preserved in the prefixed local theme CSS.

## States & Behaviors

Roadmap, video, FAQ and tip controls use the same independent state behavior as `RoadmapDetailPage`. Internal links resolve to local pathname routes.

## Responsive Behavior

- **Desktop:** resource cards use the source multi-column grid and featured video band.
- **Tablet:** grids reduce columns according to the source stylesheet.
- **Mobile:** cards stack and all full-width bands remain inside the viewport.
