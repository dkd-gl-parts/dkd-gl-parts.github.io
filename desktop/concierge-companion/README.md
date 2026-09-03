# D-CATS Concierge Admin Pilot

This is the system-administrator-only Windows pilot for a genuinely transparent,
frameless, always-on-top D-CATS concierge window. It is intentionally not linked
from the public D-CATS web UI and does not connect to D-CATS data or OpenAI.

## Internal pilot

1. Run `npm ci` in this directory.
2. Run `npm start` for development, or `npm run dist:portable` for the unsigned
   portable Windows executable.
3. Drag the character itself to move the window.
4. Right-click the character or use the notification-area icon to select the
   character, motion, size, click-through behavior, or Exit.

Active mode moves the transparent character window around the current Windows
desktop. Horizontal only and Vertical only constrain that movement to one axis.
The walking row changes when horizontal movement reverses, so the character
faces the direction of travel. Each movement leg is followed by a visible stop,
then the concierge rotates through an escort invitation, handshake invitation,
and bashful smile before moving again. Stay put stops automatic window movement.

The transparent portion is visually transparent. Enable **透明部分のクリックを下へ通す**
when the underlying application must also receive mouse input. Disable it from
the notification-area icon before dragging the character again.

## Release boundary and cost

- Additional runtime/API fee for this transparent shell: JPY 0.
- Electron is MIT licensed.
- This pilot is unsigned and may show a Windows SmartScreen warning.
- Do not distribute it to non-administrators or add a public download/launch UI.
- Before public distribution, add reviewed D-CATS authentication and code signing.
  Code-signing certificate purchase is not authorized by this pilot.
