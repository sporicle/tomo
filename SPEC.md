# Tomo Demo Feature Implementation Specification

## Overview

This spec outlines the implementation plan for connecting the `tomo-program` Anchor smart contract to the React Native frontend demo page. The goal is to create a test interface to verify the blockchain connection before building the full frontend.

## Tomo Program Details

**Program ID:** `GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM`

### State Account Structure (Tomo)

| Field | Type | Description |
|-------|------|-------------|
| `owner` | `Pubkey` | Public key of the account owner |
| `uid` | `String` | Unique identifier (max 32 chars) |
| `hunger` | `u8` | Hunger level (0-100, starts at 100) |
| `last_fed` | `i64` | Unix timestamp of last feeding |
| `coins` | `u64` | Accumulated coins for feeding |

### Instructions

1. **init(uid: String)** - Initialize a new Tomo
   - Creates PDA with seeds: `["tomo", uid]`
   - Sets hunger=100, coins=0
   - Requires: `tomo` (PDA), `payer` (signer), `system_program`

2. **get_coin()** - Award one coin
   - Increments coins by 1
   - Requires: `tomo` (writable)

3. **feed()** - Feed the Tomo (costs 10 coins)
   - Reduces coins by 10
   - Reduces hunger by 30 (saturating)
   - Updates last_fed timestamp
   - Error: `NotEnoughCoins` if coins < 10

---

## Files to Create

### 1. IDL Setup

#### `idl/tomo-program.json`
Copy the IDL from `tomo-program/target/idl/tomo_program.json`

#### `idl/tomo-program.ts`
TypeScript type definitions for the IDL (generated from JSON)

#### `idl/index.ts`
Export the IDL and types:
```typescript
import type { TomoProgram } from './tomo-program'
import IDL from './tomo-program.json'

export { TomoProgram, IDL }
```

### 2. Program Hook

#### `components/demo/use-tomo-program.tsx`

Core hook for interacting with the Tomo program:

```typescript
// Key responsibilities:
// 1. Create Anchor wallet from Mobile Wallet Adapter
// 2. Create Anchor Provider and Program instance
// 3. Derive Tomo PDA from uid
// 4. Build and execute transactions for each instruction
// 5. Query account state

// Functions to expose:
- getTomoPDA(uid: string): PublicKey
- initTomo(uid: string): Promise<string>  // returns signature
- getCoin(): Promise<string>
- feed(): Promise<string>
- fetchTomo(publicKey: PublicKey): Promise<TomoAccount | null>

// State to expose:
- program: Program<TomoProgram> | null
- isLoading: boolean
- error: Error | null
```

### 3. Demo Component

#### `components/demo/demo-feature-tomo.tsx`

UI component with:

**State Display Section:**
- Owner address (truncated)
- UID
- Hunger level (with visual indicator/progress bar)
- Coins balance
- Last fed timestamp (human readable)
- Tomo PDA address

**Action Buttons:**
- "Initialize Tomo" - calls init with a uid input
- "Get Coin" - calls get_coin
- "Feed" - calls feed (disabled if coins < 10)
- "Refresh State" - re-fetches account data

**Status Indicators:**
- Loading spinner during transactions
- Error messages
- Success notifications (via Snackbar)

---

## Configuration Changes

### 1. App Config Update

#### `constants/app-config.ts`

Add tomo program ID:
```typescript
export class AppConfig {
  // ... existing config

  // Tomo Program
  static tomoProgramId = 'GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM'
}
```

### 2. Demo Feature Integration

#### `components/demo/demo-feature.tsx`

Import and render the new Tomo component:
```typescript
import { DemoFeatureTomo } from './demo-feature-tomo'

export function DemoFeature() {
  // ... existing code
  return (
    <AppView>
      {/* ... existing content */}
      <DemoFeatureTomo />
    </AppView>
  )
}
```

---

## Implementation Steps

### Phase 1: IDL Setup
1. Create `idl/` directory in project root
2. Copy `tomo-program/target/idl/tomo_program.json` to `idl/tomo-program.json`
3. Create TypeScript type file `idl/tomo-program.ts` matching the IDL structure
4. Create `idl/index.ts` to export IDL and types

### Phase 2: Program Hook
1. Create `components/demo/use-tomo-program.tsx`
2. Implement Anchor wallet creation using `useMobileWallet()` pattern from AGENTS.md
3. Implement PDA derivation: `PublicKey.findProgramAddressSync([Buffer.from("tomo"), Buffer.from(uid)], programId)`
4. Implement transaction builders for each instruction
5. Implement account fetching with proper error handling
6. Add React Query integration for caching (include `endpoint` in query keys)

### Phase 3: Demo Component
1. Create `components/demo/demo-feature-tomo.tsx`
2. Build state display section with proper formatting
3. Build action buttons with loading states
4. Add input field for uid during initialization
5. Integrate Snackbar for notifications
6. Add visual hunger indicator (progress bar or similar)

### Phase 4: Integration
1. Update `constants/app-config.ts` with program ID
2. Update `components/demo/demo-feature.tsx` to include new component
3. Test on devnet with connected wallet

---

## Technical Considerations

### Anchor Version
Use `@coral-xyz/anchor@0.32.1` or later. Earlier versions (like 0.28.0) require Node.js polyfills in React Native.

### Anchor Wallet Pattern
From AGENTS.md:
```typescript
const { account, signTransaction, signAllTransactions } = useMobileWallet();

const anchorWallet = useMemo(() => ({
  signTransaction,
  signAllTransactions,
  get publicKey() { return account?.publicKey; }
} as anchor.Wallet), [account, signTransaction, signAllTransactions]);
```

### Provider Creation
```typescript
const provider = useMemo(() => {
  if (!anchorWallet) return null;
  return new AnchorProvider(connection, anchorWallet, {
    preflightCommitment: "confirmed",
    commitment: "processed",
  });
}, [anchorWallet, connection]);
```

### Query Key Pattern
Always include `endpoint` to prevent cache collisions when switching networks:
```typescript
queryKey: ['tomo', { endpoint: connection.rpcEndpoint, uid }]
```

### Transaction Flow
1. Build instruction via `program.methods.instruction().accounts({...}).instruction()`
2. Create Transaction with instruction
3. Get latest blockhash
4. Convert to VersionedTransaction
5. Sign and send via wallet adapter
6. Confirm transaction
7. Invalidate queries to refresh state

### Error Handling
- Handle wallet not connected state
- Handle program errors (NotEnoughCoins)
- Handle network errors
- Display user-friendly error messages

---

## UI Mockup

```
┌─────────────────────────────────────┐
│        Tomo Program Demo            │
├─────────────────────────────────────┤
│                                     │
│  UID Input: [________________]      │
│  [Initialize Tomo]                  │
│                                     │
├─────────────────────────────────────┤
│  Tomo State                         │
│  ─────────────────────────────────  │
│  PDA: 7xKJ...3mNp                   │
│  Owner: AbCd...XyZz                 │
│  UID: my-tomo-123                   │
│                                     │
│  Hunger: ████████░░ 80/100          │
│  Coins: 25                          │
│  Last Fed: 5 mins ago               │
│                                     │
├─────────────────────────────────────┤
│  Actions                            │
│  ─────────────────────────────────  │
│  [Get Coin]  [Feed (10 coins)]      │
│  [Refresh State]                    │
│                                     │
└─────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Wallet connects successfully
- [ ] Can derive PDA from uid
- [ ] Initialize creates new Tomo account
- [ ] State displays correctly after init
- [ ] Get Coin increments coins
- [ ] Feed decrements coins and hunger
- [ ] Feed fails with NotEnoughCoins error when coins < 10
- [ ] Refresh updates state from chain
- [ ] Error messages display correctly
- [ ] Loading states work during transactions
- [ ] Works on devnet cluster

---

## Dependencies

Required dependencies:
- `@coral-xyz/anchor`: ^0.32.1 (use 0.32.1+, earlier versions need Node.js polyfills)
- `@solana/web3.js`: ^1.98.4
- `@wallet-ui/react-native-web3js`: ^2.2.0
- `@tanstack/react-query`: ^5.85.5

---

## Metro Bundler Configuration

### metro.config.js

Basic configuration for JSON imports:

```javascript
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Enable JSON imports for IDL files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'json']

module.exports = config
```

### Restart Metro

After config changes:
```bash
npx expo start --clear
```
