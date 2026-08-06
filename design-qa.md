# D-CATS authentication brand lockup design QA

## Source and implementation

- Source visual truth: `outputs/dcats-brand-lockup-before.png`
- Revised desktop capture: `outputs/dcats-brand-lockup-after.png`
- Revised mobile capture: `outputs/dcats-brand-lockup-mobile.png`
- Revised password-reset capture: `outputs/dcats-brand-lockup-forgot-mobile-after.png`
- Local implementation URL: `http://127.0.0.1:4175/`

## Viewports, pixels, and state

- Desktop source and implementation: 640 x 720 pixels at a 640 x 720 CSS viewport and browser density 1.
- Mobile implementation: 390 x 844 pixels at a 390 x 844 CSS viewport and browser density 1.
- State: unauthenticated Japanese login screen, followed by the password-reset entry screen.
- No density normalization was required because captures used matching CSS and pixel dimensions.

## Comparison evidence

- Full-view comparison: the source stacked a 72 px icon above a 30 px wordmark, creating two competing focal points. The revision combines a 54 px icon and 30 px wordmark in one horizontal lockup with a 12 px gap.
- Focused brand region: the revised lockup measures 192.3 x 54 CSS px on mobile; the icon is 54 x 54 and the wordmark is 126.3 x 30, vertically centered.
- Typography: the existing system font and 800 weight are retained; letter spacing was reduced from 0.10 em to 0.08 em for a tighter wordmark.
- Spacing: the icon, wordmark, subtitle, and version now read as one compact brand block while the rest of the login-card rhythm remains unchanged.
- Colors: the navy, white, DAIKO red, and existing semantic tokens are unchanged.
- Asset quality: the existing raster D-CATS mark is reused without stretching, replacement, or reconstruction.
- Copy: D-CATS, subtitle, version, and authentication copy are unchanged.

## Findings and comparison history

- Earlier P2: the vertically stacked icon and wordmark appeared as separate brand elements and made the card top-heavy.
  - Fix: introduced a shared horizontal `.login-brand-lockup`, reduced the mark to 54 px on login and 48 px on reset-related cards, and aligned it with the wordmark.
  - Post-fix evidence: `outputs/dcats-brand-lockup-after.png` and `outputs/dcats-brand-lockup-mobile.png`.
- Earlier P2: the password-reset card extended past the 390 px mobile viewport.
  - Fix: changed `.reg-card` to `width: calc(100% - 40px)` with centered margins.
  - Post-fix evidence: `outputs/dcats-brand-lockup-forgot-mobile-after.png`; measured card bounds are x=20 through x=370 with no horizontal overflow.
- P0: none.
- P1: none.
- P2 after fixes: none.
- Primary interaction tested: opened password-reset entry and returned to login.
- Console check: no warning or error entries.

## Final result

passed
