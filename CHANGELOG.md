# Live Game Input Refactor

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
