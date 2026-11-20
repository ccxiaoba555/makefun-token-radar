# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ccxiaoba555/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ccxiaoba555/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token radar for pre-token protocols: it reads a sealed DefiLlama snapshot, ranks every
watchlist protocol by implied value, adds the early radar below the watchlist floor, and
renders a static dashboard with a per-protocol farm plan. Node 22, standard library only.

## The model (radar-5)

Implied value is computed from the snapshot's own figures only:

```
multiple   = TVL-weighted median live-token market-cap / TVL of the protocol's
             category, winsorised to [0.10, 0.45]; categories with fewer than 3
             live comparables fall back to the house multiple 0.25
growth     = clamp(change_7d, -50, 100), in per cent
quality    = 0.97 when the snapshot carries no seven-day change, else 1
implied    = round( tvl_usd x multiple x (1 + growth / 100 x 0.6)
             x (0.6 + min(age_days, 1095) / 1095 x 0.4)
             x (1 + min(chains - 1, 3) x 0.03) x quality )
```

Three judgements sit inside that one line, and the dashboard states all three:

1. **Categories do not trade alike.** A flat multiple would let the biggest TVL in the
   cheapest category win by default. In this snapshot the live-token medians run from about
   0.03 (liquid staking) to about 0.34 (DEXs) before winsorising, so each category is scored
   at its own market's multiple — a TVL-weighted median, so the protocols holding the
   category's money price it, not its smallest names — and the dashboard prints how many
   live comparables each multiple rests on, so a multiple built on 20 protocols is not
   mistaken for one built on 3.
2. **Momentum is asymmetric.** The growth clamp is -50/+100 with weight 0.6: a protocol
   losing TVL fast is marked down harder than a growing one is marked up, because a token
   launch prices momentum and a shrinking pool prices flight.
3. **Chains are a small premium, not a second protocol.** Each extra chain adds 0.03x,
   capped at 1.09x: a second chain is a second chance to be counted in a snapshot, not a
   second protocol to farm.

No protocol name is ever special-cased: the same function scores every row.

The board covers all 40 watchlist protocols plus 186 early rows below the $50M floor
(226 rows), each with a 12-step farm plan and an implied-value range (the same model at the category multiple's winsorise bounds, 0.10–0.45) derived from its category, chains, TVL and age —
including a verify-before-you-deposit step, an audit check, a points-program check, a
second-chain repeat for multi-chain protocols, and an exit plan in tranches. Live-token
protocols are set aside with their market caps shown, never mixed into the ranking. Every
detail dialog says in one sentence why its protocol ranks where it does, and recomputes
its implied value from the snapshot figures so a stale board cannot hide. A
biggest-movers panel shows the fastest gainers and losers in seven-day TVL change.

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
