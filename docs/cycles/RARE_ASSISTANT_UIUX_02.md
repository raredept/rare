# RARE-ASSISTANT-UIUX-02 — premium storefront redesign of the Assistente Virtual

- Base: `main@c069d25e0215514dc9c2d8ae28a66b5fb3a6fa00` (unchanged at start)
- Branch: `cycle/rare-assistant-uiux-02`
- Scope: **public widget only, presentation only**. No merge, no deploy, production untouched.

## What changed (visual)

1. **Launcher** — black pill with a fine light border and a soft shadow; enters with fade + sideways
   slide + slight scale. Desktop shows `DÚVIDAS?`; phones keep the 48 px round icon. Hover inverts to
   white, nudges the icon and opens the label tracking; press scales to 0.96; focus ring is visible on
   any background. A small white point on the icon marks the assistant (presentation only).
2. **Panel** — 400 px on desktop, near full width on phones (8 px side margins), adaptive height
   (min/max with `dvh`, `vh` fallback), safe areas on left, right, bottom and top room. Radius 20 px,
   layered shadow.
3. **Header** — the store's own chrome RARE wordmark (CSS background of `/brand/rare-logo.png`, no
   `<img>`), the Admin display name as the dialog title, and `● Online · respostas automáticas`
   (assistant availability, never an operator status). Round close button with an inverted hover.
4. **Welcome** — the Admin's welcome is set as an editorial opening: its first short line or sentence
   becomes the headline (`Oi!`) and the rest the body. Nothing is added, so a greeting is never doubled;
   a message without a short opening is shown whole.
5. **Suggestions** — full-width rows between hairlines with an arrow chip (hover: chip fills black and
   moves; row shifts; `:active` feedback on phones). The button is named by the question alone.
6. **Conversation** — user: right, black, white text; assistant: left, neutral 100. 16 px radius (not a
   chat-app tail). `VOCÊ` / `RARE` labels only on the first message of each author. Long URLs and words
   wrap (`overflow-wrap: anywhere`).
7. **Typing** — three dots in an assistant bubble + "Buscando a resposta…".
8. **Errors** — quiet note (left rule, neutral background); the functional texts are unchanged.
9. **Support CTA** — `FALAR COM A EQUIPE →` pill, same destination and same safety rule.
10. **Composer** — pill field with an inner round send button (disabled: light grey); focus ring on the
    whole field; hover lifts 1 px, press scales 0.96.
11. **Motion** — open: opacity + scale from the bottom edge, content rises inside the panel (260 ms,
    ease-out); close: 160 ms, the dialog stays `inert` and non-clickable during the exit, then
    `hidden` as before. Motion never takes the panel or the launcher below their resting edge, so
    neither covers the cookie banner or the PDP buy bar even mid-animation.
12. **Reduced motion** — short opacity fades only; no translate, scale or looping animation.
13. **Loading skeleton** — same frame as the panel (black header, quiet blocks, composer bar).

## What did not change

`/api/assistant`, matching/threshold/keywords, FAQ data, Prisma/migrations, RBAC/SYSTEM_ADMIN, Admin
CRUD, rate limit, same-origin, analytics, cookies, storage, fallback and CTA logic, hidden routes,
bottom-obstacle measurement, lazy chunk, `role=dialog` non-modal with `aria-labelledby`, `role=log`
`aria-live=polite`, Esc / focus to input on open / focus back to the launcher on close.

The panel had one real bug fixed by the redesign: at 320 px a long word or URL made the conversation
scroll sideways (BEFORE evidence `long-answer-320.png`, recorded by the new spec).

## Tests

- Unit (`assistant-widget.test.tsx`): 26 checks — previous ones kept (touch targets updated to the new
  44/48/52 px controls), plus motion state, welcome split, suggestion naming, no `<img>`/`<script>` in
  the panel, disabled send, reduced-motion CSS, keyframes without vertical travel, safe areas + dvh.
- Lab (`tests/e2e/assistant-ui.spec.ts`, production build, `--https`): open/close with the close button
  and Esc + focus return, closing state inert then hidden, reduced motion, suggestions, send disabled,
  author labels, support link, axe on the panel, widths 320/360/375/390/430/768/1024/1280/1440 at two
  phone heights (panel inside the viewport, launcher offsets, input reachable), cookie banner (every
  opening frame sampled above it), PDP buy bar at 320/390, typing state, 500-char question and
  2,000-char answer at 320 px, network error. `QA_ASSISTANT_UI_PHASE=before` captures the evidence on
  the old build.
- Existing `assistant.spec.ts` (RBAC, CRUD, answers, fallback, XSS, no storage/analytics, keyboard,
  axe, widths, cookie banner, checkout hidden, reduced motion, disable, rate limit) unchanged.

| Run | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| `assistant-ui.spec.ts` | 7/7 | 7/7 | 7/7 |
| `assistant.spec.ts` | 12/12 | 12/12 | 12/12 |
| `prelaunch-consent-analytics.spec.ts` (cookies) | 5/5 | — | — |

Typecheck, lint, unit suite (2,622 passed), build, `npm audit --omit=dev` (0) and `release:guard`
(7 OK, 1 known warning: legacy `vercel.json` cron) all pass.

## Bundle

- Launcher (main bundle): +341 B source; no new dependency (Lucide icons already in use).
- Panel lazy chunk: 3.5 KB gzip.
- Assistant CSS in the global stylesheet: 0.45 KB → 3.3 KB gzip (motion, states, tokens).

## Notes

- iOS safe areas: every fixed edge uses `max(…, env(safe-area-inset-*))`. The site does not set
  `viewport-fit=cover`, so Safari keeps the page inside the safe area and the insets resolve to 0; the
  rules already cover a future `cover`. Not checked on a physical iPhone in this cycle.
- Evidence (outside Git): `output/assistant-uiux-02/before/` and `output/assistant-uiux-02/after-<engine>/`.
