# Live Game Input Refactor

Framework to make mouse mods easier. Replaces big knarly mouse functions with small moddable ones.

I'm not entirely happy with the initial way functions fell apart; it might need to be redone someday.

## Function Summary

All new functions are collected in the `lgir` namespace object.

The file is sort of upside-down as pieces build into the complete handlers. From the bottom:

### Modal Response/Button Routing

Top level click handling. The first responder delegates based on mode, and then handles middle button pan if the mode did nothing. `lgir.holodeckModeMouseDown` is just like live game's `holodeckModeMouseDown`, except it's exposed for modification. Those functions have the top level per-mode handling: fab, default, and command (one per command)  Most of these functions decide what a left or right click means and call down to the next layer.

### Modifier Keys

Placed near the button assignment for easy of reference. The rest of the routines call this series of methods for most UI-controllable shift/ctrl/alt functions. Note that the traditional role of 'shift' has been broken out by mode, as well as being able to distinguish between 'append command to queue' and 'should exit current mode after issuing command'

### Button Functions

Modal routing primarily calls into this group.  Select, contextual action (standard right click), command, etc.

### Multi-Stage Command Parts

Extracted drag and formation as re-usable functions. Formation is probably still crashing (and thus the extraction is essentially untested), but this mod aims for parity with vanilla.

### Support Functions

Helpers used by the rest. Scale handing and common promise resolvers.

## Possible Bugs in Vanilla

- `fab_end` mode doesn't seem to be required
- Command confirmations may be shown at a different point than where the command was issued (ex: contextual(right) dragging move)
