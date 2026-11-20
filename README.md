# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ccxiaoba555/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ccxiaoba555/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token radar for pre-token protocols: it reads a sealed DefiLlama snapshot, ranks every
watchlist protocol by implied value, adds the early radar below the watchlist floor, and
renders a static dashboard with a per-protocol farm plan. Node 22, standard library only.

## The model (radar-2)

Implied value is computed from the snapshot's own figures only:

```
multiple   = median live-token market-cap / TVL of the protocol's category,
             winsorised to [0.10, 0.45]; categories with fewer than 3 live
             comparables fall back to the house multiple 0.25
implied    = round( tvl_usd x multiple x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
             x (0.6 + min(age_days, 1095) / 1095 x 0.4) )
```

A flat multiple would let the biggest TVL in the cheapest category win by default. In this
snapshot the live-token medians run from about 0.03 (liquid staking) to about 0.34 (DEXs)
before winsorising, so each category is scored at its own market's multiple. No protocol
name is ever special-cased: the same function scores every row.

The board covers all 40 watchlist protocols plus 186 early rows below the $50M floor
(226 rows), each with an 8-step farm plan derived from its category, chains, TVL and age —
including a verify-before-you-deposit step and an exit plan in tranches. Live-token
protocols are set aside with their market caps shown, never mixed into the ranking.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

That writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to
`out/`. Open `out/dashboard/index.html` in a browser (it reads `data.js`, no network).

## Files

- `main.ts` — entry point: reads the snapshot, writes the board, dashboard and dossier.
- `lib/model.ts` — the model: snapshot parsing, category multiples, ranking, farm plans.
- `dashboard/` — the static dashboard (index.html, app.css, app.js; no framework, no network).
- `screenshots/` — board, detail and filtered views of the dashboard.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=102db11r&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
