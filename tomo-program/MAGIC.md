# MAGIC.md

This file provides guidance for working with MagicBlock Ephemeral Rollups in Anchor/Solana programs.

## Overview

MagicBlock Ephemeral Rollups (ER) enable high-performance, low-latency transactions by temporarily delegating Solana account ownership to an ephemeral rollup. This is ideal for gaming, real-time applications, and any use case requiring fast transaction throughput.

**Key Concept**: Delegation transfers account ownership from your program to the delegation program, allowing the ephemeral rollup to process transactions. Undelegation commits the final state back to Solana's base layer.

## Architecture

```
┌─────────────────┐     delegate      ┌─────────────────────┐
│   Base Layer    │ ───────────────►  │  Ephemeral Rollup   │
│    (Solana)     │                   │    (MagicBlock)     │
│                 │  ◄───────────────  │                     │
└─────────────────┘    undelegate     └─────────────────────┘
     ~400ms                                  ~10-50ms
```

## Rust Program Setup

### 1. Add Dependencies

```toml
# Cargo.toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
ephemeral-rollups-sdk = { version = "0.6.5", features = ["anchor", "disable-realloc"] }
```

### 2. Import SDK Components

```rust
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};
```

### 3. Add Program Macros

```rust
#[ephemeral]  // REQUIRED: Add before #[program]
#[program]
pub mod my_program {
    // ...
}
```

### 4. Implement Delegate Instruction

```rust
pub fn delegate(ctx: Context<DelegateInput>, uid: String) -> Result<()> {
    // Method name is `delegate_<field_name>` based on the account field
    ctx.accounts.delegate_my_account(
        &ctx.accounts.payer,
        &[b"seed", uid.as_bytes()],  // PDA seeds
        DelegateConfig::default(),
    )?;
    Ok(())
}

#[delegate]  // Adds delegation accounts automatically
#[derive(Accounts)]
#[instruction(uid: String)]
pub struct DelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The PDA to delegate
    #[account(mut, del, seeds = [b"seed", uid.as_bytes()], bump)]
    pub my_account: AccountInfo<'info>,  // Use AccountInfo with `del` constraint
}
```

### 5. Implement Undelegate Instruction

```rust
pub fn undelegate(ctx: Context<Undelegate>) -> Result<()> {
    commit_and_undelegate_accounts(
        &ctx.accounts.payer,
        vec![&ctx.accounts.my_account.to_account_info()],
        &ctx.accounts.magic_context,
        &ctx.accounts.magic_program,
    )?;
    Ok(())
}

#[commit]  // Adds magic_context and magic_program automatically
#[derive(Accounts)]
pub struct Undelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub my_account: Account<'info, MyAccount>,
}
```

### 6. Optional: Commit Without Undelegating

```rust
pub fn commit(ctx: Context<CommitState>) -> Result<()> {
    commit_accounts(
        &ctx.accounts.payer,
        vec![&ctx.accounts.my_account.to_account_info()],
        &ctx.accounts.magic_context,
        &ctx.accounts.magic_program,
    )?;
    Ok(())
}
```

## TypeScript Frontend Setup

### 1. Add Dependencies

```json
{
  "dependencies": {
    "@coral-xyz/anchor": "^0.32.1",
    "@magicblock-labs/ephemeral-rollups-sdk": "^0.6.5"
  }
}
```

### 2. Import SDK

```typescript
import {
  DELEGATION_PROGRAM_ID,
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";
```

### 3. Set Up Dual Connections

```typescript
// Base layer connection (Solana devnet/mainnet)
const baseConnection = new Connection("https://api.devnet.solana.com");

// Ephemeral rollup connection
const erConnection = new Connection(
  process.env.EPHEMERAL_PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
  {
    wsEndpoint: process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/",
  }
);
```

### 4. Check Delegation Status

```typescript
function checkIsDelegated(accountOwner: PublicKey): boolean {
  return accountOwner.equals(DELEGATION_PROGRAM_ID);
}

// Usage
const accountInfo = await connection.getAccountInfo(pda);
const isDelegated = checkIsDelegated(accountInfo.owner);
```

### 5. Build Delegate Transaction (Base Layer)

```typescript
async function buildDelegateTx(payer: PublicKey, uid: string): Promise<Transaction> {
  const instruction = await program.methods
    .delegate(uid)
    .accounts({ payer })
    .instruction();

  const tx = new Transaction().add(instruction);
  tx.feePayer = payer;
  return tx;
}

// Send to BASE LAYER
const txHash = await baseProvider.sendAndConfirm(tx, [], {
  skipPreflight: true,
  commitment: "confirmed",
});
```

### 6. Execute on Delegated Account (Ephemeral Rollup)

```typescript
// Build transaction normally
let tx = await program.methods
  .myInstruction()
  .accounts({ myAccount: pda })
  .transaction();

// CRITICAL: Use ephemeral rollup connection
tx.feePayer = erProvider.wallet.publicKey;
tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
tx = await erProvider.wallet.signTransaction(tx);

const txHash = await erProvider.sendAndConfirm(tx, [], {
  skipPreflight: true,
});
```

### 7. Build Undelegate Transaction (Ephemeral Rollup)

```typescript
async function buildUndelegateTx(payer: PublicKey, pda: PublicKey): Promise<Transaction> {
  const instruction = await program.methods
    .undelegate()
    .accounts({
      payer,
      myAccount: pda,
      magicProgram: new PublicKey("Magic11111111111111111111111111111111111111"),
      magicContext: new PublicKey("MagicContext1111111111111111111111111111111"),
    })
    .instruction();

  const tx = new Transaction().add(instruction);
  tx.feePayer = payer;
  return tx;
}

// Send to EPHEMERAL ROLLUP
const txHash = await erProvider.sendAndConfirm(tx, [], { skipPreflight: true });

// Wait for commitment on base layer
const commitTxHash = await GetCommitmentSignature(txHash, erConnection);
```

## Testing Patterns

### Test Setup

```typescript
describe("my-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.myProgram as Program<MyProgram>;

  // Ephemeral rollup provider
  const providerER = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
      { wsEndpoint: process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/" }
    ),
    anchor.Wallet.local()
  );

  // Helper for localnet validator identity
  function getRemainingAccounts(): AccountMeta[] {
    const endpoint = providerER.connection.rpcEndpoint;
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
      return [{
        pubkey: new PublicKey("mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"),
        isSigner: false,
        isWritable: false,
      }];
    }
    return [];
  }
});
```

### Test Delegation Flow

```typescript
it("delegates account", async () => {
  const tx = await program.methods
    .delegate(uid)
    .accounts({ payer: provider.wallet.publicKey })
    .remainingAccounts(getRemainingAccounts())
    .transaction();

  await provider.sendAndConfirm(tx, [], {
    skipPreflight: true,
    commitment: "confirmed",
  });

  // Verify delegation
  await new Promise(resolve => setTimeout(resolve, 2000));
  const accountInfo = await provider.connection.getAccountInfo(pda);
  expect(accountInfo.owner.toString()).to.equal(DELEGATION_PROGRAM_ID.toString());
});
```

### Test Operations on Delegated Account

```typescript
it("operates on delegated account", async () => {
  let tx = await program.methods
    .myInstruction()
    .accounts({ myAccount: pda })
    .transaction();

  // Use ephemeral rollup
  tx.feePayer = providerER.wallet.publicKey;
  tx.recentBlockhash = (await providerER.connection.getLatestBlockhash()).blockhash;
  tx = await providerER.wallet.signTransaction(tx);

  await providerER.sendAndConfirm(tx, [], { skipPreflight: true });
});
```

### Test Undelegation

```typescript
it("undelegates account", async () => {
  let tx = await program.methods
    .undelegate()
    .accounts({ payer: providerER.wallet.publicKey, myAccount: pda })
    .transaction();

  tx.feePayer = providerER.wallet.publicKey;
  tx.recentBlockhash = (await providerER.connection.getLatestBlockhash()).blockhash;
  tx = await providerER.wallet.signTransaction(tx);

  await providerER.sendAndConfirm(tx, [], { skipPreflight: true });

  // Wait for state propagation
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Verify undelegation
  const accountInfo = await provider.connection.getAccountInfo(pda);
  expect(accountInfo.owner.toString()).to.equal(program.programId.toString());
});
```

## Environment Variables

```bash
# Ephemeral rollup endpoints
EPHEMERAL_PROVIDER_ENDPOINT=https://devnet.magicblock.app/
EPHEMERAL_WS_ENDPOINT=wss://devnet.magicblock.app/

# Alternative: Magic Router (auto-routing)
ROUTER_ENDPOINT=https://devnet-router.magicblock.app/
WS_ROUTER_ENDPOINT=wss://devnet-router.magicblock.app/
```

## Key Program IDs

```typescript
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");

// Localnet validator identity (for testing)
const LOCALNET_VALIDATOR = new PublicKey("mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev");
```

## Best Practices

### Do's

1. **Always use `skipPreflight: true`** - Faster transactions, ER handles validation
2. **Use dual connections** - Base layer for delegate, ER for operations/undelegate
3. **Verify delegation status** - Check `accountInfo.owner.equals(DELEGATION_PROGRAM_ID)`
4. **Wait for state propagation** - Add delays after delegate/undelegate in tests
5. **Use `GetCommitmentSignature`** - Verify commits reached base layer
6. **Track timing** - Log durations to monitor performance
7. **Generate unique IDs** - Use timestamps or UUIDs to avoid test conflicts

### Don'ts

1. **Don't send delegate tx to ER** - Delegation always goes to base layer
2. **Don't send operations to base layer** - Delegated account ops go to ER
3. **Don't forget the `#[ephemeral]` macro** - Required on program module
4. **Don't use `Account<>` in delegate context** - Use `AccountInfo` with `del` constraint
5. **Don't skip the `#[commit]` macro** - Required for undelegate context

## Common Gotchas

### 1. Method Name Convention
The delegate method is auto-generated as `delegate_<field_name>`:
```rust
pub my_account: AccountInfo<'info>,  // => ctx.accounts.delegate_my_account()
```

### 2. PDA Seeds Must Match
Seeds in delegate instruction must exactly match account definition:
```rust
// Account definition
#[account(mut, del, seeds = [b"tomo", uid.as_bytes()], bump)]
pub tomo: AccountInfo<'info>,

// Delegate call - seeds must match
ctx.accounts.delegate_tomo(&payer, &[b"tomo", uid.as_bytes()], config)?;
```

### 3. Localnet Requires Validator Identity
For localnet testing, add validator to remainingAccounts:
```typescript
const remainingAccounts = endpoint.includes("localhost")
  ? [{ pubkey: LOCALNET_VALIDATOR, isSigner: false, isWritable: false }]
  : [];
```

### 4. Account Owner Changes on Delegation
```
Not delegated: account.owner == YOUR_PROGRAM_ID
Delegated:     account.owner == DELEGATION_PROGRAM_ID
```

### 5. React Native Buffer Issues
Anchor's `program.account.xxx.fetch()` may fail in React Native. Manually decode:
```typescript
const accountInfo = await connection.getAccountInfo(pda);
const isDelegated = accountInfo.owner.equals(DELEGATION_PROGRAM_ID);
const data = manuallyDecodeAccount(accountInfo.data);
```

## Transaction Flow Summary

| Action | Send To | Provider |
|--------|---------|----------|
| Initialize account | Base Layer | `provider` |
| Delegate | Base Layer | `provider` |
| Operations on delegated | Ephemeral Rollup | `providerER` |
| Commit (keep delegated) | Ephemeral Rollup | `providerER` |
| Undelegate | Ephemeral Rollup | `providerER` |
| Operations after undelegate | Base Layer | `provider` |

## Resources

- [MagicBlock Documentation](https://docs.magicblock.gg/)
- [MagicBlock Engine Examples](https://github.com/magicblock-labs/magicblock-engine-examples)
- [Ephemeral Rollups SDK](https://crates.io/crates/ephemeral-rollups-sdk)
- [NPM Package](https://www.npmjs.com/package/@magicblock-labs/ephemeral-rollups-sdk)
