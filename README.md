# Live Game Input Refactor

Replaces big knarly mouse functions with small moddable ones.

I'm not entirely happy with the initial way functions fell apart, so it may undergo drastic changes.

## Possible Bugs in Vanilla

- fab_end mode doesn't seem to be required
- Command confirmations may be shown at a different point than where the command was issued (ex: contextual(right) dragging move)
