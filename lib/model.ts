// Token Radar's model, radar-5: one snapshot of the protocol universe in, one ranked board out.
//
// The board's floor is the watchlist: every slug in it is ranked. Below the floor, the early
// radar adds pre-token protocols by TVL, up to EARLY_ROWS. A protocol is pre-token when its
// index entry records no token at all — no market cap, no CoinGecko id, no symbol. Protocols
// that already trade are kept apart and shown with their market caps; they are never mixed into
// the ranking, because a market price is a fact and an implied value is a model.
//
// Implied value is computed from the snapshot's own figures only:
//
//   multiple   the protocol's category multiple: the median market-cap / TVL of the
//              live-token protocols in that category, winsorised to [0.10, 0.45]. A category
//              with fewer than 3 live comparables falls back to the house multiple 0.25.
//              The multiple is recomputed from the sealed snapshot on every run, and the
//              dashboard prints how many live comparables each multiple rests on.
//   base       tvl_usd x multiple
//   growth     clamp(change_7d, -50, 100), in per cent; a falling protocol is marked down
//              harder than a rising one is marked up, because a token launch prices
//              momentum and a shrinking pool prices flight.
//   growthMult 1 + (growth / 100) x 0.6
//   maturity   0.6 + min(age_days, 1095) / 1095 x 0.4; age unknown counts as 365 days
//   chains     1 + 0.03 x min(chains - 1, 3): a protocol live on several chains has more
//              than one home to farm and more than one snapshot to be counted in, so each
//              extra chain is worth a small premium, capped at three.
//   quality    0.97 when the snapshot carries no seven-day change for the protocol, 1
//              otherwise: a row scored on missing data is worth slightly less than one
//              scored on a full record, and the dashboard says so on the row.
//   implied    max(1, round(base x growthMult x maturity x chains x quality))
//   range      the same product with the category multiple replaced by the winsorise
//              bounds, MULT_MIN and MULT_MAX: a point estimate hides how wide the
//              category's own pricing is, so every row also carries its low and high
//              implied value, and the dashboard shows the band on the row.
//
// A single flat multiple would let the biggest TVL in the cheapest category win by default.
// The snapshot itself says categories do not trade alike: before winsorising, the live-token
// medians run from about 0.03 (liquid staking) to about 0.34 (DEXs). Scoring each category at
// its own market's multiple keeps the ranking honest across categories. No protocol name is
// ever special-cased: the same function scores every row.
//
// What radar-3 changes over radar-2: the growth clamp is asymmetric (-50/+100 instead of
// -60/+120) with a heavier weight (0.6 instead of 0.5), so a protocol losing TVL fast is
// punished and a growing one is rewarded; a chain-diversity premium replaces the old
// single-chain assumption; the farm plan grows from 8 steps to 10, adding a points-program
// check and a second-chain repeat, the two steps farmers most often skip; and the dashboard
// now prints the live-comparable count behind every category multiple, so a multiple resting
// on 2 protocols is not mistaken for one resting on 20.
//
// What radar-5 changes over radar-4: every row now carries an implied-value range — the
// same product with the category multiple replaced by its winsorise bounds (0.10 and
// 0.45) — because a point estimate hides how wide the category's own pricing is; a
// category priced at 0.25 with bounds 0.10–0.45 is a much wider bet than one priced at
// 0.40. The dashboard shows the band on each row's detail dialog.
//
// What radar-4 changes over radar-3: the category multiple is now a TVL-weighted median
// instead of a plain median, so a category is priced by the protocols that hold its money
// rather than by its smallest names; a missing seven-day change costs the row 3% instead
// of being silently treated as zero growth; the farm plan grows from 10 steps to 12,
// adding an audit check and a snapshot-calendar reminder; and the dashboard gains a
// biggest-movers panel, so a farmer can see at a glance which ranked protocols are gaining
// TVL fastest and which are bleeding it.

/** One protocol entry, exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_bonus: number;
  chain_bonus_cap: number;
  data_quality_discount: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_bonus: 0.03,
  chain_bonus_cap: 0.09,
  data_quality_discount: 0.97,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-5';

/** The winsorising band for a category multiple, and how many live comparables earn one. */
export const MULT_MIN = 0.1;
export const MULT_MAX = 0.45;
export const MIN_COMPS = 3;

/** Early rows carried below the watchlist floor, by TVL. */
export const EARLY_ROWS = 300;

/** Live-token protocols the dashboard's Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One farm step: what to do, what it costs, how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    data_quality_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A board row in the dashboard's compact form; the page generates the farm plan itself. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  on_watchlist: boolean;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  data_quality_multiplier: number;
}

/** A live-token protocol: the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's summary for the dashboard: how many rows it has and its strongest protocol. */
export interface CategorySummary {
  category: string;
  rows: number;
  top_slug: string;
  top_name: string;
  top_implied_usd: number;
  median_implied_usd: number;
}

/** Everything the dashboard renders: the board, the live set, and the model that scored them. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  category_multiples: Record<string, number>;
  category_comps: Record<string, number>;
  categories: CategorySummary[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** The headline figures: watchlist size, board size, early rows, live protocols set aside. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** Why a snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function numOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Round to 4 decimal places, for the multipliers the board prints. */
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Whole days from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The middle value of a sorted list. */
function middle(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** A name ending in a release is a pool of another protocol (DefiLlama's version-marker rule). */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A protocol that records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** A protocol the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * Every category's multiple, from the snapshot's own live-token protocols: the TVL-weighted
 * median market-cap / TVL of that category's live protocols, winsorised to [MULT_MIN,
 * MULT_MAX], together with how many live comparables each multiple rests on. Weighting by
 * TVL means a category is priced by the protocols that hold its money: a plain median lets
 * a dozen tiny protocols outvote the one that holds 90% of the category's TVL. Entries
 * with no market cap — a dead or untracked token — are left out: they would drag every
 * category toward zero and say nothing about what a trading protocol there is worth. A
 * category with fewer than MIN_COMPS live comparables gets no entry here and falls back to
 * the house multiple. Multiples are rounded to 3 decimals so the board and the dashboard
 * print the same number.
 */
export function categoryStats(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { multiples: Map<string, number>; comps: Map<string, number> } {
  const byCat = new Map<string, { ratio: number; tvl: number }[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.category === null || p.category === 'CEX') continue;
    if (!(p.tvl_usd > 0) || !(p.mcap_usd > 0)) continue;
    const list = byCat.get(p.category) ?? [];
    list.push({ ratio: p.mcap_usd / p.tvl_usd, tvl: p.tvl_usd });
    byCat.set(p.category, list);
  }
  const multiples = new Map<string, number>();
  const comps = new Map<string, number>();
  for (const [cat, entries] of byCat) {
    comps.set(cat, entries.length);
    if (entries.length < MIN_COMPS) continue;
    entries.sort((a, b) => a.ratio - b.ratio);
    const total = entries.reduce((n, e) => n + e.tvl, 0);
    let acc = 0;
    let weighted = entries[entries.length - 1]!.ratio;
    for (const e of entries) {
      acc += e.tvl;
      if (acc >= total / 2) {
        weighted = e.ratio;
        break;
      }
    }
    const m = Math.min(MULT_MAX, Math.max(MULT_MIN, weighted));
    multiples.set(cat, Math.round(m * 1000) / 1000);
  }
  return { multiples, comps };
}

/** The plain median of a category's ratios, for the dashboard's comparison note. */
export function categoryMedianMultiple(snapshot: Snapshot): Map<string, number> {
  const byCat = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.category === null || p.category === 'CEX') continue;
    if (!(p.tvl_usd > 0) || !(p.mcap_usd > 0)) continue;
    const list = byCat.get(p.category) ?? [];
    list.push(p.mcap_usd / p.tvl_usd);
    byCat.set(p.category, list);
  }
  const out = new Map<string, number>();
  for (const [cat, ratios] of byCat) {
    if (ratios.length < MIN_COMPS) continue;
    ratios.sort((a, b) => a - b);
    out.set(cat, Math.round(Math.min(MULT_MAX, Math.max(MULT_MIN, middle(ratios))) * 1000) / 1000);
  }
  return out;
}

/** Every category's multiple, from the snapshot's own live-token protocols. */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): Map<string, number> {
  return categoryStats(snapshot, model).multiples;
}

/** The multiple one protocol is scored at: its category's, or the house multiple. */
export function multipleFor(p: SnapshotProtocol, multiples: Map<string, number>, model: ModelConstants = MODEL): number {
  if (p.category !== null) {
    const m = multiples.get(p.category);
    if (m !== undefined) return m;
  }
  return model.base_multiple;
}

/** The chain-diversity premium: 0.03 per extra chain, capped at 0.09 (three extra chains). */
export function chainMultiplier(protocol: SnapshotProtocol, model: ModelConstants = MODEL): number {
  const extra = Math.max(0, Math.min(protocol.chains.length - 1, 3));
  return 1 + Math.min(extra * model.chain_bonus, model.chain_bonus_cap);
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples?: Map<string, number>,
): { implied: number; low: number; high: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; qualityMult: number; age: number | null; multiple: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, numOr(protocol.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = chainMultiplier(protocol, model);
  const qualityMult = protocol.change_7d === null ? model.data_quality_discount : 1;
  const multiple = multiples === undefined ? model.base_multiple : multipleFor(protocol, multiples, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * chainMult * qualityMult));
  const low = Math.max(1, Math.round(protocol.tvl_usd * MULT_MIN * growthMult * maturityMult * chainMult * qualityMult));
  const high = Math.max(1, Math.round(protocol.tvl_usd * MULT_MAX * growthMult * maturityMult * chainMult * qualityMult));
  return { implied, low, high, growthPct, growthMult, maturityMult, chainMult, qualityMult, age, multiple };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** One step as a single string — action, then cost and time — inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: twelve steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, chains, TVL, age) — never from a hand-written list of names.
 * Four of the steps are the ones that lose farmers money when they are missing: verify the
 * protocol before any deposit, because a fake site or a paid claim is the usual trap; check
 * the protocol's audits, because an unaudited contract holding the farm's capital is the
 * risk no points program repays; check the points program before farming, because an action
 * the program does not count is wasted effort; and plan the exit before the token exists,
 * unwinding in tranches instead of one market sell. Multi-chain protocols get a repeat step
 * on their second chain, because a second chain is a second snapshot to be counted in.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Open ${p.name}'s own site and docs from its official links and check it has no token yet, no pre-sale and no paid claim; a site asking you to pay to claim is a fake.`,
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: `Check whether ${p.name}'s contracts have a public audit and how long its TVL has held above $${Math.round(p.tvl_usd / 1e6)}M; an unaudited contract or a TVL that appeared last week deserves a smaller position.`,
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Open ${p.name}'s points or rewards page and confirm the action you just took counts toward its program, and which actions earn the most points.`,
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    secondChain === null
      ? {
          text: `${p.name} runs on one chain today, so watch its own announcements for a second chain and repeat the qualifying action there when it launches.`,
          cost: 'nothing to watch',
          time: '5 minutes a week',
        }
      : {
          text: `Repeat the qualifying action on ${secondChain} as well, so the position is counted on two chains instead of one.`,
          cost: `about $${capital >= 150 ? 8 : 4} of gas for the second position`,
          time: '15 minutes',
        },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Plan the exit now: when the token launches, unwind in two or three tranches over a week instead of selling everything in one trade.`,
      cost: 'about $2 of gas per tranche',
      time: '10 minutes to set the plan',
    },
    {
      text: `Put a reminder in your calendar for the next snapshot date, so the position is still open and active when it is taken.`,
      cost: 'nothing',
      time: '2 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { multiples } = categoryStats(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug in it is ranked, even one the snapshot no longer
  // carries (it cannot, but coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor, by TVL, capped.
  // A chosen protocol stays chosen; the early rows add to the watchlist, never replace it.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, multiples);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    model: {
      base_multiple: s.multiple,
      growth_pct: s.growthPct,
      growth_multiplier: r4(s.growthMult),
      maturity_multiplier: r4(s.maturityMult),
      chain_multiplier: r4(s.chainMult),
      data_quality_multiplier: r4(s.qualityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    on_watchlist: watchlist.has(row.slug),
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    data_quality_multiplier: row.model.data_quality_multiplier,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
  };
}

/** Per-category summaries for the dashboard: rows per category and each one's strongest row. */
export function categorySummaries(board: BoardRow[]): CategorySummary[] {
  const byCat = new Map<string, BoardRow[]>();
  for (const r of board) {
    const key = r.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(r);
    byCat.set(key, list);
  }
  return [...byCat.entries()]
    .map(([category, rows]) => {
      const top = rows[0]!;
      const sorted = rows.map((r) => r.implied_value_usd).sort((a, b) => a - b);
      return {
        category,
        rows: rows.length,
        top_slug: top.slug,
        top_name: top.name,
        top_implied_usd: top.implied_value_usd,
        median_implied_usd: middle(sorted),
      };
    })
    .sort((a, b) => b.rows - a.rows || b.top_implied_usd - a.top_implied_usd)
    .slice(0, 8);
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { multiples, comps } = categoryStats(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    category_multiples: Object.fromEntries(multiples),
    category_comps: Object.fromEntries(comps),
    categories: categorySummaries(board),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null: coverage of the watchlist, ranks 1..n,
 * descending implied value, more than one distinct implied value, and 3..12 farm steps of
 * 20..600 characters with a positive integer implied value on every row.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
