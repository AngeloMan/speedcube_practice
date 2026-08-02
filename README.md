# SolveTheCube · Speedcubing Trainer

A dark-themed SPA for learning F2L / OLL / PLL and generating WCA scrambles.
React + Vite + Tailwind, with `cubing.js` driving the one interactive 3D cube.

```bash
npm install
npm run seed    # parse the SolveTheCube page -> src/data/*.json
npm run dev
npm test           # move-translation + cube simulator assertions
npm run test:viewer # drives local Chrome and checks the 3D cube really draws
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
random-state generator, with a 3D/2D preview and a spacebar shortcut.

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

| | |
| --- | --- |
| `W` `A` `S` `D` `X` | U · L · F · R · D |
| `C` `Z` | M · S slices |
| `I` `K` `J` `L` | rotate up · down · left (`y'`) · right (`y`) |
| `Shift` + key | prime |
| `Ctrl` + key | wide |
| `Ctrl` `Shift` + key | wide prime |

All of it is rebindable in Settings and persisted to `localStorage`. Keys are
read by physical position, so holding Shift or Ctrl never changes which action
fires.

> **`Ctrl+W` caveat.** Browsers reserve `Ctrl+W` for "close tab" and do not let a
> page intercept it, so the wide `u` turn cannot fire on that combination. The
> other Ctrl bindings work. Settings offers `Alt` as the wide modifier instead.

## Animation

`tempoScale` is set to `1000 / turnMs`, so the default 50 ms really is 50 ms per
quarter turn. Every new keystroke calls `jumpToEnd()` before appending its move:
whatever was animating completes instantly and the new turn starts from a settled
cube, so fast typing neither drops moves nor queues up lag.
