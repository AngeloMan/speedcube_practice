# SolveTheCube · Speedcubing Trainer

link: https://rubikalgo.vercel.app

A dark-themed SPA for learning F2L / OLL / PLL and generating WCA scrambles.
React + Vite + Tailwind, with `cubing.js` driving the one interactive 3D cube.

```bash
npm install
npm run seed    # parse the SolveTheCube page -> src/data/*.json
npm run dev
npm test             # cube simulator, move translation, timer math, render pass
npm run test:browser # drives local Chrome: rendering, solve mode, keyboard solving
```

`npm run build` re-runs the seed step automatically.

## Where the data comes from

`Algorithms _ SolveTheCube.html` in the project root is parsed by
[`scripts/parse-algs.mjs`](scripts/parse-algs.mjs) into `src/data/{f2l,oll,pll}.json`:
**119 cases** — 41 F2L in 6 subsections, 57 OLL in 13 shape groups, 21 PLL in 3
subsections — each with its title, case number, group, algorithm (both the
display form with its bracketing and a bare form for the player) and the
original thumbnail path.

### About the thumbnails

The saved page references its previews as
`./Algorithms _ SolveTheCube_files/<name>.webp`, but **that assets folder was
not included with the HTML file** — only the markup was. Rather than depend on
missing binaries or hotlink the original site, each preview is drawn as inline
SVG from a 27-character sticker string (the U, F and R faces in reading order).

That string is not guessed. SolveTheCube *names* its F2L thumbnails after
exactly this encoding — `xbxxyxxxrxxbxbxxbxwxxxrxxrx.webp` — so the seed script
reconstructs each case with its own cube simulator
([`src/lib/cube.js`](src/lib/cube.js)) and refuses to emit data unless all 41
F2L strings match the filenames byte for byte. OLL and PLL thumbnails are named
`oll_27.webp` / `pll_H.webp` and carry no state, so their diagrams come from the
same simulator, now validated. The original `.webp` path is still kept in the
JSON as `image` for reference.

The simulator itself is geometric: every facelet is a (position, normal) pair,
and a move is a rotation of one or more layers, so face turns, slices, wide
turns and cube rotations all come from one primitive. `npm test` checks it
against the usual identities (`r = R M'`, `x = r L'`, sexy move × 6 = solved…).

## How the pages work

**Algorithms** — the grid is pure SVG. No `<twisty-player>` is ever constructed
in a card, and the build confirms it: the entry chunk has no static imports and
contains no WebGL code at all. `cubing/twisty` sits behind a dynamic import that
only fires when the practice modal opens.

**Practice modal** — one `TwistyPlayer`, created in an effect and torn down on
unmount. `experimentalSetupAlg` is the inverse of the case algorithm, so the
cube opens already in the case. Masking uses `experimentalStickering`: `LS` for
F2L (it keeps the pair visible, unlike `F2L` which dims the whole last layer),
`OLL` and `PLL` for the others; all of them are selectable in the sidebar.

### Sizing the player — read before touching the CSS

Two things will silently blank the 3D cube, and both have bitten this file:

1. **Never set `display` on `twisty-player`.** cubing.js declares
   `:host { display: grid }` and its single shadow child carries `contain: size`
   with no height of its own — it is sized purely by being stretched as a grid
   item. An author rule outranks `:host`, so `display: block` (or `flex`) lays
   that wrapper out as if it had no contents, it collapses to 0px, and the
   renderer gets a zero-height canvas. Set `width`/`height`/`min-height` only.
2. **Never size the container with a percentage height against an auto-height
   parent.** `h-full` inside a `min-height`-only box resolves to `auto`, i.e. 0.
   The modal positions the viewer with `absolute inset-0` instead, which
   resolves against the parent's *used* box. This matters more than it looks:
   cubing gates all scene construction on an IntersectionObserver requiring
   `intersectionRect.height > 0`, so a zero-height mount doesn't just render
   blank — the player never builds anything at all.

A third trap lives in `vite.config.js`: cubing's scramble worker imports Vite's
`__vitePreload` helper out of the entry chunk, so parts of the main bundle are
evaluated *inside a Web Worker*. Anything DOM-flavoured there throws
`document is not defined` on every scramble. `modulePreload: false`,
`cssCodeSplit: false` and the `typeof document` guard in `src/main.jsx` are all
three required — the config comment says which does what.

The viewer additionally waits on a `ResizeObserver` until its container has a
real box before constructing the player, so mounting inside a modal that is
still animating in cannot lose the race. `npm run test:viewer` asserts the host
box, the canvas backing store and that the canvas has actually drawn (via
`experimentalScreenshot`, since a WebGL drawing buffer reads back blank once
composited), and `npm test` statically rejects a `display` rule on the host.

The 3D cube uses cubing.js's stock colour scheme (white U, green F) while the
static diagrams use SolveTheCube's (yellow U, blue F). The geometry matches; only
the palette differs. cubing's `colorScheme` option is light/dark UI theming, not
face colours, so aligning them would mean supplying a custom sprite.

**Scramble** — `randomScrambleForEvent` from `cubing/scramble`, the WCA's own
random-state generator, with a 3D/2D preview of the *scrambled* state. Idle,
space cuts the next scramble; in solve mode the timer claims it.

**Solve mode** — an opt-in timer beside the scramble, in one of two styles.

*Physical cube* is the classic behaviour: any key stops the clock, the scramble
is hidden mid-solve, and the cube's keybindings are muted so a cuber hammering
W/A/S/D on a real puzzle doesn't disturb the virtual one.

*Keyboard solve* inverts that. Movement keys stay live and drive the cube, and
the timer stops **when the cube is actually solved** — the page advances its own
permutation move by move (`src/lib/cube.js`) and tests every face for a single
colour, so a finish still counts when you end up rotated. Solving pops a banner
with the time, logs it to the session and cuts the next scramble. Escape
abandons an attempt without recording it.

**Undo** — `Ctrl+Z` plays the inverse of the last move, in the practice modal and
on the solver alike. It goes through the same flush-then-append path as a
keystroke, so holding it rewinds a solve smoothly. The undone move is popped
from the history rather than pushed onto it, and the inverse is never recorded,
so undo cannot undo itself. `Ctrl+Z` is checked before the keybindings, so it
wins over the wide-turn modifier on the `Z` key.

- Hold space (or press and hold the timer) to arm — it turns green; release to
  start; **any** key stops. After a stop, input is ignored until every key is
  released, so the keystroke that stopped the timer cannot arm the next solve.
- While running, the cube preview dims so the scramble can't be studied, a
  full-screen surface lets a tap anywhere stop the timer, and `timerActive` in
  the store switches the cube's keybindings off — a cuber hammering W/A/S/D on a
  real puzzle must not silently turn the virtual one. Idle, the bindings behave
  exactly as before.
- Optional 15 second WCA inspection: the first hold-and-release starts the
  countdown, the second starts the solve, and overrunning applies +2 after 15s
  or DNF after 17s automatically.
- Stopping logs the solve and cuts the next scramble immediately.
- The session panel shows best, mean, Ao5 and Ao12 by the WCA definition —
  fastest and slowest trimmed, one DNF absorbed by the trim, two making the
  whole average a DNF. Solves can be marked +2 or DNF, or deleted, and the
  session persists in `localStorage`.

The running readout drives its own animation frame and writes through a DOM ref,
so a live timer re-renders nothing around it.

**Notation** — every move is drawn statically: the cube *after* the turn, with
the pieces that moved kept bright and an arrow tracing one sticker from its old
position to its new one. Both are derived from the simulator, so the diagrams
cannot drift from the moves they document.

## Camera-relative controls

Keys are bound to what you see, not to fixed faces. The camera's orbit angles
are owned by the app (`experimentalDragInput` is off), snapped to a right-handed
frame of three faces, and every keystroke is translated through it:

| you press | with the cube at home | orbited 90° to the right |
| --- | --- | --- |
| `S` (front) | `F` | `R` |
| `D` (right) | `R` | `B` |
| `C` (middle slice) | `M` | `S` |
| `I` (rotate up) | `x` | `z'` |

Slices keep following their neighbour (`M` follows whatever is on your left) and
rotations follow their face, so the handedness is always right. This is verified
as a permutation identity — a screen-relative move must equal *rotate the cube
so that face is at the front, turn it, rotate back* — across six camera
positions and fourteen move types.

### Default keys

Most moves ship with a key each way, so priming rarely needs a modifier.

| | clockwise | counter-clockwise |
| --- | --- | --- |
| Up `U` | `E` | `T` |
| Left `L` | `A` | `Q` |
| Front `F` | `S` | `W` |
| Right `R` | `Y` | `H` |
| Down `D` | `B` | `X` |
| Back `B` | — | — |
| Middle `M` | — | `R` |
| Equator `E` | `G` | `D` |
| Standing `S` | — | `F` |
| Rotate up/down `x` | `K` | `I` |
| Rotate right/left `y` | `L` | `J` |
| Roll `z` | — | — |

| | |
| --- | --- |
| `Shift` + key | prime (inverts whatever the key is bound to) |
| `Ctrl` + key | wide |
| `Ctrl` `Shift` + key | wide prime |
| `Ctrl+Z` | undo the last move |

Turn duration defaults to 90 ms, hint facelets and camera-relative moves are on,
practice opens yellow-up/blue-front and the solver white-up/green-front.
`scripts/test-defaults.mjs` pins every one of these so they cannot drift, and
checks that no two actions claim the same key.

Changing the shipped schema bumps the persisted `version` in `src/store.js`; the
`migrate` there drops the saved copy of the old defaults so the new ones take
effect on next load. Solve history and session choices survive that; customised
keybindings do not.

Settings lays the bindings out as a matrix with a **clockwise and a
counter-clockwise key for every move** — all six faces, all three slices and all
three rotations. A prime turn with no key of its own falls back to Shift + its
clockwise key, and the cell shows that (`⇧W`) rather than "unset". Shift always
inverts whatever a key is bound to, so a key bound directly to `U'` gives `U`
with Shift held.

Everything persists to `localStorage`. Keys are read by physical position, so
holding Shift or Ctrl never changes which action fires.

## Colour orientation

cubing.js hard-codes its face colours — white up, green front — and offers no
colour-scheme API. To match SolveTheCube's diagrams (yellow up, blue front) the
practice viewer prefixes its setup with `x2`, which turns those faces into view.

That alone is not enough: `experimentalStickering` derives its masks from *piece
identity*, not from where a piece currently sits, so an `x2` also drags the
last-layer mask to the bottom of the cube — verified by rendering it. So
`src/lib/stickering.js` builds the mask itself against whichever layer is
actually on top, deriving layer membership from the puzzle definition at runtime
(which pieces does a `D` turn disturb?) rather than hard-coding index tables.

The practice viewer therefore opens yellow-up / blue-front, matching its own
thumbnails sticker for sticker, with masking intact. The solver keeps the WCA
standard, white-up / green-front. Both are switchable in Settings.

> **`Ctrl+W` caveat.** Browsers reserve `Ctrl+W` for "close tab" and do not let a
> page intercept it, so the wide `u` turn cannot fire on that combination. The
> other Ctrl bindings work. Settings offers `Alt` as the wide modifier instead.

## Animation

`tempoScale` is set to `1000 / turnMs`, so the default 50 ms really is 50 ms per
quarter turn. Every new keystroke calls `jumpToEnd()` before appending its move:
whatever was animating completes instantly and the new turn starts from a settled
cube, so fast typing neither drops moves nor queues up lag.
