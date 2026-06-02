# COMMUNITAS Energy Market — Project Notes

## Project goal
Frontend (Next.js Pages Router) for an on-chain energy bidding market. Buyers
post bids and sellers post asks per hourly delivery slot; the contract clears
matched orders. Multi-region: Portugal / Spain / Italy / Denmark each have a
separate `EnergyBiddingMarket` contract on Nova Cidade. The app also bridges
ETH from Arbitrum Sepolia (L2) → Nova Cidade (L3) via Arbitrum Orbit.

## Tech stack
- Next.js 16 (Pages Router) + React 19
- Wagmi v2 + Reown AppKit (formerly Web3Modal) for wallet UX
- viem 2.x + ethers (via `@arbitrum/sdk` for bridge deposits)
- Tailwind 4 + lucide-react + motion(framer)
- react-day-picker for date pickers

## Directory map
```
src/
  pages/        index.tsx, bridge.tsx, faucet.tsx (Pages Router; tab UI inside index)
  components/
    market/     BidBox, SellBox, CombinedOrdersBox, ClaimBox, TradeHistoryBox, dashboard/
    bridge/     BridgeBox, NetworkSelector, SubmitDepositButton, SubmitWithdrawalButton
    common/     ConnectAndSwitchNetworkButton, DateTimePicker, DateNavigationBar, RegionDropdownList
    ui/         Button, Card, SkeletonLine, TransactionModal, ErrorBoundary, ...
    nft/        NFT gallery / mint UI
  config/       chains.ts (Nova Cidade + Arb Sepolia), wagmi.ts, constants.ts
  context/      AppContext (region market address, providers, eth price)
  hooks/        useTradeData, useMarketToast, etc.
  utils/        dateHelpers, units (kWh ↔ watts), formatBalance, fetchUserCountry
abi/            EnergyBiddingMarket.json, CommunitasNFT.json
constants/      addresses.json (per-chain, per-region market addresses), outputInfo.json (Nova Cidade chain meta)
```

## Key commands
```bash
npm install                # install
npm run dev                # next dev server (localhost:3000)
npm run build              # next build
npm run start              # serve production build
npm run lint               # eslint
```

## Chains
- **Nova Cidade Chain (default)** — chainId `93735000855` / `0x15d30a9b17`, RPC `https://testnet.novaims.unl.pt/`, explorer `https://testnet.explorer.novaims.unl.pt/`. Hosts all `EnergyBiddingMarket` contracts.
- **Arbitrum Sepolia (parent)** — chainId `421614`, RPC from `NEXT_PUBLIC_INFURA_RPC` (Alchemy by default). Used as origin for the deposit flow into Nova Cidade.

## Faucet (`/faucet`)
- Page: `src/pages/faucet.tsx`. API: `src/pages/api/faucet.ts` (server-side, uses
  `FAUCET_PRIVATE_KEY` + `FAUCET_PASSWORD` from `.env`).
- **Dual-chain**: each request sends **two** transactions from the same faucet
  wallet (`0x7502e2fcD1416648e4F2392B8F274C7f1e5b1081`):
  - **0.01 ETH on Nova Cidade L3** (`FAUCET_AMOUNT_NOVA`) — covers all market tests.
  - **0.0015 ETH on Arbitrum Sepolia** (`FAUCET_AMOUNT_ARB`) — covers the two
    bridge-dependent tests (TC09.01 deposit + withdrawal claim). Sizing: 0.001 ETH
    bridged + ~0.0005 ETH gas headroom across both legs at live ~0.02 gwei base fee.
- Arb Sepolia send applies `maxFeePerGas = baseFee*5`, `maxPriorityFeePerGas = 0`
  to dodge the "max fee per gas less than block base fee" revert (same pattern as
  the bridge buttons).
- API response returns legacy `{hash, amount, explorer}` (Nova) plus
  `{novaCidade, arbitrumSepolia}` objects (each `{chain, amount, hash, explorer}`).
  The success view renders one tx block per chain, each with copy + explorer links.
- Min-balance guards: `MIN_BALANCE_NOVA = 0.02`, `MIN_BALANCE_ARB = 0.003`.
- Verified end-to-end 2026-06-02 (drove the page with the `playwright` Claude skill,
  both txs confirmed on-chain: Nova `0x94b768…c4a0`, Arb `0x9db393…f09d15`).

## Conventions
- Contract operates in **watts**; UI displays **kWh**. Conversion lives in `utils/units.ts` (`WATTS_PER_KWH = 1000`).
- Region selection in `RegionDropdownList` swaps `energyMarketAddress` via `AppContext`. Defaults to user's geo-detected country via `fetchUserCountry`, falling back to first available.
- Wagmi default chain is **Nova Cidade**, so after `Connect Wallet` the wallet auto-switches there. The `/bridge` page explicitly switches back to Arbitrum Sepolia for the deposit step.
- `SubmitDepositButton` uses `@arbitrum/sdk` `EthBridger.deposit({ amount, parentSigner })` — see "Known bugs" below.
- TransactionModal phases: `idle → pending → confirming → bridging → success | error`.

## Test cases
- TC09.01 — Connect wallet + Bridge funds Arbitrum → Nova Cidade
- TC09.02 — Place a bid on energy
- TC09.04 — Check bid result (Buyer Orders)
- TC09.06 — Claim refund (Buyer)
- TC09.08 — Cancel bid order
- TC09.10 — Dashboard / hourly energy data

## Known bugs found 2026-05-20 via Playwright + dappwright (MetaMask 13.17.0) automation against `https://wattswap.vercel.app/`

1. **Bridge deposit reverted: "max fee per gas less than block base fee" — FIXED in this repo (HIGH).**
   `SubmitDepositButton` called `EthBridger.deposit({ amount, parentSigner })`
   with no gas overrides. ethers v5's default formula (`maxFeePerGas =
   baseFee * 2 + maxPriorityFeePerGas`) routinely lands below the next
   block's baseFee on Arbitrum Sepolia because the L2's baseFee fluctuates
   within seconds (observed `maxFeePerGas=20002000` vs `baseFee=20006000` at
   the time of failure). Tx was rejected with `code -32603` and the
   TransactionModal showed "Transaction Failed — Something went wrong with
   your transaction".

   **Fix applied** to both `src/components/bridge/SubmitDepositButton.tsx` and
   `src/components/bridge/SubmitWithdrawalButton.tsx`: fetch the latest
   block's `baseFeePerGas` from the connected signer's provider, compute
   `maxFeePerGas = baseFee * 5` and `maxPriorityFeePerGas = 0` (Arbitrum
   sequencer ignores tips), and pass them via `overrides`.

   **Verified on-chain 2026-05-20** with a standalone script that runs the
   exact same code path: L1 tx `0xa1dbd4...5435` mined on Arb Sepolia, L1→L2
   message landed on Nova Cidade (`complete: true`), 0.001 ETH bridged
   successfully. Not an RPC staleness issue — three independent RPCs
   (Alchemy, sepolia-rollup.arbitrum.io, publicnode) all returned the same
   base fee.

2. **Hydration mismatch on every page load: React error #418 — FIXED (MEDIUM).**
   `src/components/common/DateTimePicker.tsx` initialised state with
   `useState({ from: getNextHour(1), to: getNextHour(1) })`. `getNextHour`
   calls `new Date()`, so SSR and CSR markup differed → React aborted
   hydration and re-rendered the tree client-side, also producing console
   noise. Fixed by adding a `mounted` flag that gates the picker's full JSX
   tree: SSR returns an empty fixed-height placeholder `<div>` and the real
   picker swaps in on the first client `useEffect` tick. State defaults
   remain numeric (no need to thread `undefined` through all the hour
   maths).

3. **Minor: two `<svg>` width/height "Unexpected end of attribute" console warnings (LOW — OPEN).**
   An SVG renders with an empty `width=""` / `height=""` during initial load.
   Grepping the codebase didn't surface a local component passing an empty
   string — every `<Image>` / `<svg>` callsite supplies a literal number or a
   defaulted prop. Likely originates from a third-party (react-day-picker
   nav icon or Reown AppKit `<w3m-modal>` shadow DOM) before its own data
   resolves. Cosmetic — does not affect rendering. Track down if it ever
   shows up as a real symptom.

## What's verified to work end-to-end
- Wallet connect via Reown AppKit → MetaMask (real popup approval).
- Auto network switch to Nova Cidade after connect.
- Manual network switch back to Arbitrum Sepolia on `/bridge` via the
  "Switch to Arbitrum" button (uses `wallet_addEthereumChain` +
  `wallet_switchEthereumChain`).
- **Bridge deposit Arb Sepolia → Nova Cidade** — with the gas-override fix
  applied, real on-chain deposit succeeds. L1 tx confirmed, L1→L2 retryable
  ticket auto-redeemed, child balance increases by the deposited amount.
- `Place Bid` flow on `Buy` tab — submits real on-chain bid tx to the
  region-specific `EnergyBiddingMarket` contract. Tested **Portugal**,
  **Spain**, **Denmark** — all three regions confirmed on-chain with the
  success modal "Bid placed successfully! / Bid Submitted!".
- `Cancel Bid` flow on `Orders` tab — places-bid-then-cancels round trip
  end-to-end verified for **Spain** and **Denmark**: click Active filter →
  expand a pending bid row → "Cancel Bid" button → confirm MM tx → row
  removed / status flipped.
- `Orders`, `Trades`, `Claim`, `NFTs`, `Dashboard` tabs all render without
  errors. The "Wrong Network" guard correctly forces a network switch when
  the wallet is on Arbitrum Sepolia.

## Playwright + MetaMask test harness (developer reference)

A persistent MM profile lives at `~/.cache/wattswap-test/`. Reuse it instead
of re-onboarding MetaMask every run — first connect goes from ~60–90s
(dappwright bootstrap) down to **~11s** (Chromium launches with the cached
profile, wagmi auto-reconnects from saved cookies).

```js
import { openMM, driveMM, shadowClick } from '/home/USER/.cache/wattswap-test/mm-launcher.mjs';

const { context, mmExtensionId, close } = await openMM();
const page = await context.newPage();
await page.goto('https://wattswap.vercel.app');     // already connected
await driveMM(context, 'tx-confirm');               // approves any open MM popup
await close();
```

Smoke test: `node ~/.cache/wattswap-test/smoke-launcher.mjs`. To rebuild the
cache (e.g. after a MetaMask upgrade): `node ~/.cache/wattswap-test/bootstrap-once.mjs`.
The cache imports the `FAUCET_PRIVATE_KEY` from this repo's `.env`.

For the underlying problems with `@tenkeylabs/dappwright` against MM 13.17
(why we built the launcher in the first place):

- `dappwright.bootstrap(...)` only triggers the MetaMask download when
  `process.env.TEST_PARALLEL_INDEX === '0'`. **Always export
  `TEST_PARALLEL_INDEX=0`** when running outside `@playwright/test`'s parallel
  runner, otherwise it sits forever printing "Waiting for primary worker to
  download metamask…".
- Force `DISPLAY=:1` (and `XAUTHORITY=/run/user/<UID>/gdm/Xauthority`) so
  Playwright launches the full `chromium-1223/chrome-linux64/chrome` rather
  than the headless-shell binary that can't load extensions.
- Drive the MM popup yourself: enumerate `context.pages()` looking for a
  `chrome-extension://…/notification.html` page and click `getByTestId('confirm-btn')`
  / `getByTestId('confirm-footer-button')` / `getByRole('button', { name: /^(connect|confirm|next|approve)$/i })`.
- `wallet.addNetwork` is flaky in MM 13.17 — skip it and let the dApp drive
  network registration via `wallet_addEthereumChain` prompts that you approve
  through the same popup-driver.

## Test wallet
The `.env` file contains `FAUCET_PRIVATE_KEY` for the address
`0x7502e2fcD1416648e4F2392B8F274C7f1e5b1081`. At time of testing it held
1.465 ETH on Arbitrum Sepolia and 1.141 ETH on Nova Cidade. **This is the
same key the live `/faucet` route uses to drip ETH to users** — automated
tests will deplete it.
