## 4. iPhone and Android looks (answer only, not built in this step)
Yes, this is possible. The app can tell whether it is on an iPhone or an Android phone and change its look to match:
- **iPhone:** Apple's system font, a frosted see-through tab bar with thin icons, and rounder corners.
- **Android:** the Roboto font, a solid tab bar where the selected tab sits in a coloured pill, and Android's own button styles.

Your Ink & Brass colours and accent colours would stay the same on both. Only the shapes, fonts and bars would change. Approving this plan does not build it. Once the layout above is done, ask for it and I'll build it as a separate step.

## Technical details
- Header in `src/routes/app.tsx`: on phones (`isMobile`), skip rendering the brand label, `h1`, the description `<p>` and the Menu button. Render a full-bleed strip with negative margins matching the container's safe-area padding, about 40px tall, `justify-end`, holding only the Quick Setup button.
- Desktop header is unchanged.
- Progress bar: change `max-lg:bottom-0` to `bottom-[calc(env(safe-area-inset-bottom)+3.5rem)]`, and its bottom padding to a fixed `pb-1.5` without the safe area. The tab bar is `z-50`, which is why it currently covers the bar.
- Spacing: remove the `h-[2.25rem]` spacer, the separate `h-14` spacer and the `main` safe-area padding. Add one spacer at the end of the content: `h-[calc(3.5rem+env(safe-area-inset-bottom))]`, plus about 3rem when the Housekeeping progress bar shows. Also reduce the container's mobile `py-6` bottom padding.
- Verify with Playwright at 393x852 as Housekeeping and as Reception: scroll to the bottom and check the gap, and confirm the progress bar is visible.
