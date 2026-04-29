# Design System

## Overview

Truck Harvester is a quiet Korean operations interface for dealership staff. The app uses a warm off-white canvas, centered workflow panels, thin beige borders, compact Korean copy, and one strong burnt-orange action color. The page is intentionally sparse: the value comes from turning messy copied listing text into readable chips, then moving confirmed listings into saved folders. Motion for the promo should feel orderly and reassuring, not flashy or technical.

## Colors

- **Warm App Background**: `#fcfaf7` — full-frame surface and breathing room.
- **Card Surface**: `#ffffff` — workflow panels, product screenshots, floating UI cards.
- **Primary Text**: `#33251f` — headlines and high-priority labels.
- **Muted Text**: `#7b6f64` — helper copy and secondary labels.
- **Primary Action**: `#d94b00` — CTA buttons, progress pulses, route lines.
- **Soft Accent**: `#e9a37d` — disabled buttons, glow, warm highlights.
- **Border**: `#ded2c5` — panel outlines, input strokes, connector lines.
- **Success**: `#24875a` — confirmed chips and saved-state marks.

## Typography

- **Primary UI**: system-ui, Apple SD Gothic Neo, sans-serif. Used for all Korean text; keep it practical and readable.
- **Display Weight**: 800-900 for short Korean claims at 72-112px.
- **Body Weight**: 400-500 at 24-34px for narration support text.
- **Mono Detail**: ui-monospace for listing URLs, generated folder names, and file paths.

## Elevation

Depth is restrained: 1px beige borders, soft low-opacity shadows, and warm glows behind active panels. Avoid heavy glass, dramatic black shadows, or saturated gradient backgrounds. Screenshots should be treated like physical product cards with slight perspective, soft shadow, and a slow camera move.

## Components

- **Address Paste Panel**: rounded white card with textarea, helper text, and orange submit button.
- **Onboarding Spotlight**: blurred background, orange outline around the active panel, floating tutorial card.
- **Folder Selector Panel**: compact panel with orange folder CTA and explanatory copy.
- **Prepared Listing Chips**: small labeled chips that shift from checking to ready/saved.
- **Progress Status Panel**: status list area for ready, failed, and saved listings.
- **Generated Folder Stack**: promo-only visualization of per-truck folders and image counts.

## Do's and Don'ts

### Do's

- Use the captured clean app screenshot generously.
- Keep user-facing text Korean-only and non-technical.
- Use orange as a precise action/progress signal, not a full background.
- Make messy input visibly become ordered chips and folders.
- Leave enough whitespace for the calm operations-tool tone.

### Don'ts

- Do not add external monitoring, stamping, or developer-focused copy.
- Do not make the promo feel like generic SaaS analytics.
- Do not use dark neon, purple gradients, or decorative blobs.
- Do not bury the actual product UI behind abstract graphics.
- Do not show more than one dominant text claim per beat.
