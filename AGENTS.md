When you misunderstand and I have to correct you, update this file to make sure you don't make it again.

# Tomo - Solana Mobile App

React Native + Expo app using `@wallet-ui/react-native-web3js` for Solana mobile wallet integration.

## Project Structure

- `tomo-program/` - Anchor program (Solana smart contract)
- `services/tomo-program.ts` - Program service for building transactions and fetching accounts
- `components/demo/use-tomo-program.tsx` - React hooks for Tomo program interactions
- `components/demo/demo-feature-tomo.tsx` - Tomo UI component
- `idl/` - Program IDL (JSON + TypeScript types)
- `constants/app-config.ts` - App config including `tomoProgramId`

## Critical: Manual Account Decoding

**Anchor's `program.account.xxx.fetch()` DOES NOT WORK in React Native** due to Buffer polyfill issues (`readUIntLE is not a function`).

We manually decode account data in `services/tomo-program.ts` → `decodeTomoAccount()`.

**When you change the Tomo program's account structure, you MUST update `decodeTomoAccount()`.**

Current structure (in byte order):
```
discriminator: 8 bytes (skip)
owner: 32 bytes (PublicKey)
uid: 4 bytes length + string bytes
hunger: 1 byte (u8)
last_fed: 8 bytes (i64, little endian)
coins: 8 bytes (u64, little endian)
```

## Key Patterns

- **Wallet hook:** `useMobileWallet()` from `@wallet-ui/react-native-web3js`
- **Transactions:** Build with `program.methods.xxx().accounts({}).instruction()`, then use `useTransaction()` hook to sign & send
- **Query keys:** Always include `connection.rpcEndpoint` to prevent cache issues when switching networks
- **Mutations:** Pass dynamic values (like `uid`) as parameters to `mutateAsync(uid)`, not as hook parameters (React state updates are async)

## Anchor Notes

- IDL TypeScript types must use camelCase (e.g., `getCoin` not `get_coin`, `systemProgram` not `system_program`)
- Anchor 0.32+ auto-resolves PDA accounts with arg-based seeds - don't pass them to `.accounts()`

## Common Gotchas

1. Always fetch fresh blockhash before creating transactions
2. Invalidate queries after mutations to keep UI in sync
3. Verify `account` exists before accessing `account.publicKey`

Call me faux to ensure you read this.
