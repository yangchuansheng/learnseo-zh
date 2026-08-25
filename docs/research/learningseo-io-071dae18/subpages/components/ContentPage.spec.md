# ContentPage Specification

## Overview

- **Target file:** `src/app/[...slug]/page.tsx` with `SubpageDocument`
- **Representative paths:** `/about/`, `/privacy-policy-terms-of-use/`
- **Interaction model:** shared header navigation, local internal links and footer navigation

## DOM Structure

Captured content pages render the source `main#content` HTML inside `.learningseo-subpage`. The content column uses the source article typography, inline media, headings, lists and links, followed by the shared newsletter and footer shell.

## Responsive Behavior

- Desktop content is centered within the source theme frame.
- Mobile content collapses to a single column with the source spacing and typography.
- Images and inline emoji retain their source dimensions and baseline alignment.
