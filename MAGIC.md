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

---

## Cranks (Scheduled Tasks)

Cranks enable automatic, recurring transactions on Ephemeral Rollups without external infrastructure. They are ideal for game loops, periodic updates, and any recurring on-chain logic.

### Additional Dependencies for Cranks

```toml
# Cargo.toml (add to existing dependencies)
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
ephemeral-rollups-sdk = { version = "0.6.5", features = ["anchor", "disable-realloc"] }
magicblock-magic-program-api = { version = "0.3.1", default-features = false }
bincode = "^1.3"
sha2 = "0.10"
```

### Crank Imports

```rust
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};
```

### Crank Scheduling Arguments

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ScheduleCrankArgs {
    pub task_id: u64,                    // Unique task identifier (for cancellation)
    pub execution_interval_millis: u64,  // Milliseconds between executions
    pub iterations: u64,                 // Number of times to execute
}
```

### Schedule Crank Instruction

```rust
pub fn schedule_my_crank(
    ctx: Context<ScheduleCrank>,
    args: ScheduleCrankArgs,
) -> Result<()> {
    // 1. Build the instruction to be executed by the crank
    let crank_ix = Instruction {
        program_id: crate::ID,
        accounts: vec![AccountMeta::new(ctx.accounts.my_account.key(), false)],
        data: anchor_lang::InstructionData::data(&crate::instruction::MyCrankInstruction {}),
    };

    // 2. Serialize the ScheduleTask instruction
    let ix_data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
        task_id: args.task_id,
        execution_interval_millis: args.execution_interval_millis,
        iterations: args.iterations,
        instructions: vec![crank_ix],
    }))
    .map_err(|err| {
        msg!("ERROR: failed to serialize args {:?}", err);
        ProgramError::InvalidArgument
    })?;

    // 3. Create CPI instruction to Magic Program
    let schedule_ix = Instruction::new_with_bytes(
        MAGIC_PROGRAM_ID,
        &ix_data,
        vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new(ctx.accounts.my_account.key(), false),
        ],
    );

    // 4. Execute CPI to schedule the task
    invoke_signed(
        &schedule_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.my_account.to_account_info(),
        ],
        &[],
    )?;

    Ok(())
}
```

### Crank Account Context

```rust
#[derive(Accounts)]
pub struct ScheduleCrank<'info> {
    /// CHECK: Magic program for crank scheduling
    #[account()]
    pub magic_program: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Use AccountInfo to avoid Anchor re-serialization after CPI
    #[account(mut, seeds = [MY_SEED], bump)]
    pub my_account: AccountInfo<'info>,
    /// CHECK: Your program
    pub program: AccountInfo<'info>,
}
```

**Important**: Use `AccountInfo<'info>` (not `Account<'info, T>`) for accounts modified by CPI to avoid Anchor re-serialization issues.

### Client-Side Crank Scheduling

```typescript
import { MAGIC_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { BN } from "@coral-xyz/anchor";

// CRITICAL: Send to Ephemeral Rollup (not base layer)
const tx = await program.methods
  .scheduleMyCrank({
    taskId: new BN(1),              // Unique task ID
    executionIntervalMillis: new BN(100), // Run every 100ms
    iterations: new BN(10),         // Run 10 times
  })
  .accounts({
    magicProgram: MAGIC_PROGRAM_ID,
    payer: erProvider.wallet.publicKey,
    program: program.programId,
  })
  .transaction();

tx.feePayer = erProvider.wallet.publicKey;
tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
const signedTx = await erProvider.wallet.signTransaction(tx);

await erProvider.sendAndConfirm(signedTx, [], {
  skipPreflight: true,
  commitment: "confirmed",
});

// Wait for cranks to execute
await new Promise(resolve => setTimeout(resolve, 2000));
```

### Crank Lifecycle

1. **Initialize** account on base layer
2. **Delegate** account to Ephemeral Rollup
3. **Schedule** crank on ER (specifying iterations and interval)
4. **Wait** for cranks to execute automatically
5. **Undelegate** to commit final state back to Solana

---

## VRF (Verifiable Random Function)

VRF provides provably fair randomness for games, lotteries, and any application requiring verifiable randomness. MagicBlock's VRF works asynchronously with a request → callback pattern.

### Additional Dependencies for VRF

```toml
# Cargo.toml (add to existing dependencies)
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
ephemeral-rollups-sdk = { version = "0.6.5", features = ["anchor"] }
ephemeral-vrf-sdk = { version = "0.2.1", features = ["anchor"] }
```

### VRF Imports

```rust
use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
```

### Request Randomness Instruction

```rust
pub fn request_randomness(ctx: Context<RequestRandomnessCtx>, client_seed: u8) -> Result<()> {
    msg!("Requesting randomness...");

    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: ID,  // Your program ID
        callback_discriminator: instruction::ConsumeRandomness::DISCRIMINATOR.to_vec(),
        caller_seed: [client_seed; 32],  // Client-provided entropy
        accounts_metas: Some(vec![SerializableAccountMeta {
            pubkey: ctx.accounts.my_account.key(),
            is_signer: false,
            is_writable: true,
        }]),
        ..Default::default()
    });

    ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}
```

### Request Account Context

```rust
#[vrf]  // Required macro for VRF interactions
#[derive(Accounts)]
pub struct RequestRandomnessCtx<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [MY_SEED, payer.key().to_bytes().as_slice()], bump)]
    pub my_account: Account<'info, MyAccount>,
    /// CHECK: Oracle queue - use correct constant based on delegation status
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}
```

### VRF Oracle Queue Constants

| Constant | Use Case |
|----------|----------|
| `DEFAULT_QUEUE` | Non-delegated programs (base layer) |
| `DEFAULT_EPHEMERAL_QUEUE` | Delegated programs (ephemeral rollup) |

### Callback Instruction (Consume Randomness)

```rust
pub fn consume_randomness(
    ctx: Context<ConsumeRandomnessCtx>,
    randomness: [u8; 32],  // VRF provides 32 bytes of randomness
) -> Result<()> {
    let my_account = &mut ctx.accounts.my_account;

    // Convert to desired range using SDK helpers
    let random_value = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 1, 6);
    // Range is inclusive: 1-6 for dice roll

    msg!("Random value: {:?}", random_value);
    my_account.last_random = random_value;

    Ok(())
}
```

### Callback Account Context

```rust
#[derive(Accounts)]
pub struct ConsumeRandomnessCtx<'info> {
    /// SECURITY: Validates callback is from VRF program (not malicious actor)
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub my_account: Account<'info, MyAccount>,
}
```

**Critical Security**: The `vrf_program_identity` signer with address constraint ensures only the VRF program can call your callback. Without this, attackers could call your callback with fake randomness.

### VRF Helper Functions

```rust
// Available range conversion helpers
let u8_val = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, min, max);
let u16_val = ephemeral_vrf_sdk::rnd::random_u16_with_range(&randomness, min, max);
let u32_val = ephemeral_vrf_sdk::rnd::random_u32_with_range(&randomness, min, max);
// All ranges are inclusive
```

### Client-Side VRF Request

```typescript
// CRITICAL: Send VRF requests to Ephemeral Rollup
const tx = await ephemeralProgram.methods
  .requestRandomness(Math.floor(Math.random() * 256))  // client seed
  .accounts({
    payer: erProvider.wallet.publicKey,
    myAccount: myAccountPda,
    oracleQueue: EPHEMERAL_ORACLE_QUEUE, // From SDK constants
  })
  .rpc({ skipPreflight: true });

// Listen for account changes to detect callback completion
const subscriptionId = erConnection.onAccountChange(
  myAccountPda,
  (accountInfo) => {
    const decoded = program.coder.accounts.decode("myAccount", accountInfo.data);
    console.log("Random result:", decoded.lastRandom);
  },
  { commitment: "processed" }
);
```

### VRF Flow Diagram

```
Client                      Your Program                 VRF Oracle
  |                              |                            |
  |--request_randomness(seed)--->|                            |
  |                              |--create_request_randomness->|
  |<--tx signature---------------|                            |
  |                              |                            |
  |                              |<--consume_randomness([32])--|
  |                              |    (CPI callback)          |
  |                              |--update account----------->|
  |                              |                            |
  |<--onAccountChange event------|                            |
```

### VRF Best Practices

1. **Always validate VRF identity** in callback with address constraint
2. **Use client_seed** for additional entropy (pass different values per request)
3. **Use SDK helper functions** for range conversion (don't roll your own)
4. **Listen for account changes** to detect callback completion
5. **Delegate accounts first** before using VRF on ephemeral rollup
6. **Use correct oracle queue** constant based on delegation status

---

## Software Version Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Solana | 2.1.6 - 2.3.13 | Runtime |
| Rust | 1.82 - 1.85.0 | Program compilation |
| Anchor | 0.32.1 | Framework |
| Node | 22+ | Frontend/testing |

---

## Resources

- [MagicBlock Documentation](https://docs.magicblock.gg/)
- [MagicBlock Engine Examples](https://github.com/magicblock-labs/magicblock-engine-examples)
- [Crank Counter Example](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/crank-counter)
- [Roll Dice VRF Example](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/roll-dice)
- [Ephemeral Rollups SDK (Rust)](https://crates.io/crates/ephemeral-rollups-sdk)
- [Ephemeral VRF SDK (Rust)](https://crates.io/crates/ephemeral-vrf-sdk)
- [NPM Package](https://www.npmjs.com/package/@magicblock-labs/ephemeral-rollups-sdk)
