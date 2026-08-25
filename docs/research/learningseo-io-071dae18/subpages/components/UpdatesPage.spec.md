# UpdatesPage Specification

## Overview

- **Target file:** `src/app/[...slug]/page.tsx` with `SubpageDocument`
- **Representative path:** `/updates/`
- **Interaction model:** shared header navigation, newsletter form presentation and footer navigation

## DOM Structure

The captured updates page keeps the source `main#content` wrapper and centered subscription content. The page ends with the shared newsletter strip, sitemap, social links and copyright footer rendered by `SubpageFooter`.

## Responsive Behavior

- Desktop uses the source centered content frame and footer columns.
- Mobile stacks the subscription content and footer groups while preserving the source spacing and colors.
