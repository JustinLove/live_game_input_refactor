I can reproduce the bug now
it is existent in original game as well as in lgir
When I am trying to produce a right click drag gesture in order to emit a line formation move command, it sometimes happens, that no line formation move command is emited. Instead, a direct move command is emitted and the command mode stays in "move", causing the next left click annoyingly also be interpreted as move command, rather than producing a new selection.
The problem occures, when a drag command takes a small enough time(!)
Its not about the drag distance. its only about a small enough time. maybe because its within one frame.
however, I am sure its a fixable bug in our javascript domain and not a problem in the core game engine, because a fast left mouse button drag gesture can also properly interpreted with correct start end end position


I am using fast left click gestures to select a bunch of units, and then multiple fast drag gestures on the map in order to move the units as a line formation
somtimes a drag gesture is ignored and treated as a click, but setDragging is set to true.
this leads to a move command on the next left click rather than removing just the selection
meaing, it stays in command mode

[13:25:42.625] INFO [JS/game] :79: delete doubleClickTime
[13:25:42.625] INFO [JS/game] :81: responders.startDragging
[13:25:43.641] INFO [JS/game] :302: 1
[13:25:43.641] INFO [JS/game] :59: setDragging: true
[13:25:43.657] INFO [JS/game] :86: mouseup: input.release 
[13:25:43.657] INFO [JS/game] :88: responders.end
[13:25:44.828] INFO [JS/game] :79: delete doubleClickTime
[13:25:44.828] INFO [JS/game] :81: responders.startDragging
[13:25:44.860] ERROR [JS/game] coui://ui/main/game/live_game/live_game.js:2192: Uncaught TypeError: Cannot read property '$div' of undefined
[13:25:44.922] INFO [JS/game] :86: mouseup: input.release 
[13:25:44.922] INFO [JS/game] :88: responders.end
[13:25:44.063] ERROR [JS/game] coui://ui/main/game/live_game/live_game.js:2192: Uncaught TypeError: Cannot read property '$div' of undefined
[13:25:44.125] INFO [JS/game] :79: delete doubleClickTime
[13:25:44.125] INFO [JS/game] :81: responders.startDragging
[13:25:44.141] INFO [JS/game] :302: 1
[13:25:44.141] INFO [JS/game] :59: setDragging: true
[13:25:44.141] INFO [JS/game] :86: mouseup: input.release 
[13:25:44.141] INFO [JS/game] :88: responders.end
[13:25:44.219] ERROR [JS/game] coui://ui/main/game/live_game/live_game.js:2192: Uncaught TypeError: Cannot read property '$div' of undefined
[13:25:44.375] INFO [JS/game] :79: delete doubleClickTime
[13:25:44.375] INFO [JS/game] :81: responders.startDragging
[13:25:44.375] INFO [JS/game] :86: mouseup: input.release 
[13:25:44.375] INFO [JS/game] :88: responders.end
[13:25:44.391] INFO [JS/game] :302: 1
[13:25:44.391] INFO [JS/game] :59: setDragging: true
[13:25:45.110] ERROR [JS/game] coui://ui/main/game/live_game/live_game.js:2192: Uncaught TypeError: Cannot read property '$div' of undefined
[13:25:45.625] INFO [JS/game] :86: mouseup: input.release 
[13:25:45.625] INFO [JS/game] :91: responders.click
[13:25:52.016] INFO [JS/uberbar] :915: updateUser vega40k available from PA
setDragging: true after responders.end is the problematic situation








the selelection gesture is a drag gesture and is not emitted in case of too fast selecting/clicking in a fast game
the lgir framework accidently recognizes a double click gesture

If its a drag gesture with 20px or more, its considered a valid drag gesture and therefore can not be part of a double click gesture.


Lets just performing a distance check on the mouseUp of a drag gesture. If its a drag gesture with 20px or more (diagonally), its considered a valid drag gesture and therefore cannot be part of a double click gesture.
