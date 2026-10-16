## Technical details

- Scope everything to `html[data-platform="ios"]` inside the phone media query in `src/styles.css`. The Android rules stay as they are.
- `[data-mobile-tabbar]` on iOS:
  - Position: `left/right: 12px`, `bottom: max(10px, env(safe-area-inset-bottom))`.
  - Shape: `border-radius: 9999px` with a 1px translucent border.
  - Glass: `backdrop-filter: blur(24px) saturate(180%)`, a `color-mix` translucent fill, an inset top highlight and a drop shadow.
  - Remove the safe-area bottom padding.
- Selected tab: `[aria-current="page"]` gets a darker inner capsule, and its icon and label use `var(--color-sidebar-primary)`, which is the user's accent. The icon gets `fill: currentColor` at low opacity and `stroke-width: 2.2`.
- Bottom spacer div: add a `data-tabbar-spacer` attribute and increase its height on iOS by about 10px.
- Only write the standard `backdrop-filter`. The build adds browser prefixes automatically, and writing the prefixed version by hand can strip the effect in Chrome.
- Verify with Playwright at 393x852 using an iPhone user agent, on both the light and the dark theme.
