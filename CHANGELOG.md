# Live Game Input Refactor

## 1.1.2

- Fix right click not begin recognized when a drag is long enough to generate a move event but not long enough for the game to register a drag gesture.

## 1.1.1

- Drag gesture precludes a following click from being counted as a double click (with the standard lgir double click detection)

## 1.1.0

- Change drag behavior to support base game line formations
- Add framework flag to modinfo

## 1.0.1

- Readme updates, forum url

## 1.0.0

- Namespace all new functions under lgir

## 0.1.2

- Updates from game:
  - Account for scaled ui
  - Command mode right click is action instead of cancel
  - Command mode no longer cares whether a command is targetable
  - Append/Exit are evaluated based on last event, not first

## 0.1.1

- Ensure contextual command sends a move even when a drag is detected
- Fix drag delay
- Place command confirmations at the same location as the action
