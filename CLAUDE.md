# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tomo is a React Native + Expo mobile app using Solana blockchain with the MagicBlock/Anchor framework. The app connects to a Solana smart contract (Anchor program) called `tomo-program`.

## Build & Development Commands

```bash
# Frontend (React Native/Expo)
npm install                 # Install dependencies
npm run dev                 # Start Expo dev server
npm run android             # Run on Android
npm run ios                 # Run on iOS
npm run build              # Type check + Android prebuild
npm run lint               # Lint with auto-fix
npm run fmt                # Format with Prettier

# Anchor Program (from tomo-program/ directory)
cd tomo-program
anchor build               # Build the program
anchor test                # Run tests (uses ts-mocha)
anchor deploy              # Deploy to configured cluster
```

## Architecture

### Solana Program (`tomo-program/`)
- Anchor 0.32.1 program with Rust source in `programs/tomo-program/src/lib.rs`
- Program ID: `GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM`
- `Anchor.toml` configures devnet deployment
- After building, IDL is output to `target/idl/tomo_program.json`
- **IMPORTANT:** After `anchor build`, copy the IDL to the frontend: `cp tomo-program/target/idl/tomo_program.json idl/tomo-program.json`

### Frontend Structure
- `app/` - Expo Router file-based routing
- `components/demo/` - Demo feature components and hooks
- `services/tomo-program.ts` - Program service for building transactions and fetching accounts
- `idl/` - Program IDL (JSON + TypeScript types)
- `hooks/use-transaction.ts` - Transaction execution via Mobile Wallet Adapter
- `constants/app-config.ts` - App configuration including program ID

### Key Integration Patterns

**Wallet Integration:**
- Use `useMobileWallet()` from `@wallet-ui/react-native-web3js`
- Execute transactions via `useTransaction()` hook

**Manual Account Decoding (Critical):**
Anchor's `program.account.xxx.fetch()` does not work in React Native due to Buffer polyfill issues. All account data is manually decoded in `services/tomo-program.ts` → `decodeTomoAccount()`. When modifying the program's account structure, you MUST update this decoder.

**IDL Type Generation:**
- IDL types in `idl/tomo-program.ts` must use camelCase (e.g., `getCoin` not `get_coin`, `systemProgram` not `system_program`)
- Anchor 0.32+ auto-resolves PDA accounts with arg-based seeds

**Query Keys:**
Always include `connection.rpcEndpoint` in React Query keys to prevent cache issues when switching networks:
```typescript
queryKey: ['tomo-account', { endpoint: connection.rpcEndpoint, uid }]
```

**Mutations:**
Pass dynamic values as parameters to `mutateAsync(value)`, not as hook parameters (React state updates are async).

## Common Gotchas

1. Always fetch fresh blockhash before creating transactions
2. Invalidate queries after mutations to keep UI in sync
3. Verify `account` exists before accessing `account.publicKey`
4. Account structure changes require updating both the Rust program AND `decodeTomoAccount()` in TypeScript
5. **After modifying the Anchor program, always sync the IDL:** run `anchor build` then copy `tomo-program/target/idl/tomo_program.json` to `idl/tomo-program.json`
