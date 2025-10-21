# modules/upscaler

Handles FrameGen injection for slot A and related controls.

Notes:

- Guarded by `maybeInject(view, 'A')` to avoid injecting into other slots.
