import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TomoProgram } from "../target/types/tomo_program";
import { expect } from "chai";
import {
  DELEGATION_PROGRAM_ID,
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";

/**
 * Tomo Program Tests
 *
 * These tests cover:
 * 1. Basic functionality (init, getCoin, feed)
 * 2. Delegation to MagicBlock ephemeral rollup
 * 3. Operations on delegated accounts
 * 4. Undelegation back to base layer
 *
 * Best practices from MagicBlock examples:
 * - Use dual connections (base layer + ephemeral rollup)
 * - Verify delegation status by checking account owner
 * - Use skipPreflight for faster transactions
 * - Track timing for performance monitoring
 */

describe("tomo-program", () => {
  // Base layer connection (Solana devnet/localnet)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.tomoProgram as Program<TomoProgram>;

  // Ephemeral rollup connection
  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
        "https://devnet.magicblock.app/",
      {
        wsEndpoint:
          process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );

  console.log("Base Layer Connection:", provider.connection.rpcEndpoint);
  console.log(
    "Ephemeral Rollup Connection:",
    providerEphemeralRollup.connection.rpcEndpoint
  );

  // Test UID - using a unique identifier for the test run
  const uid = `test-${Date.now().toString(36)}`;

  const [tomoPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tomo1"), Buffer.from(uid)],
    program.programId
  );

  console.log("Test UID:", uid);
  console.log("Tomo PDA:", tomoPda.toString());

  /**
   * Helper to check if account is delegated
   * When delegated, account owner is DELEGATION_PROGRAM_ID
   * When not delegated, account owner is the program ID
   */
  async function checkIsDelegated(
    connection: anchor.web3.Connection
  ): Promise<boolean> {
    const accountInfo = await connection.getAccountInfo(tomoPda);
    if (!accountInfo) return false;
    return accountInfo.owner.equals(DELEGATION_PROGRAM_ID);
  }

  /**
   * Helper to get remaining accounts for delegation
   * For localnet, we need to specify the validator identity
   */
  function getDelegateRemainingAccounts(): anchor.web3.AccountMeta[] {
    const endpoint = providerEphemeralRollup.connection.rpcEndpoint;
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
      return [
        {
          pubkey: new anchor.web3.PublicKey(
            "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"
          ),
          isSigner: false,
          isWritable: false,
        },
      ];
    }
    return [];
  }

  // ============================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================

  describe("Basic Functionality", () => {
    it("initializes a tomo", async () => {
      const start = Date.now();

      await program.methods.init(uid).rpc();

      const tomo = await program.account.tomo.fetch(tomoPda);
      expect(tomo.uid).to.equal(uid);
      expect(tomo.hunger).to.equal(100);
      expect(tomo.coins.toNumber()).to.equal(0);

      const duration = Date.now() - start;
      console.log(`${duration}ms - Initialize tomo`);
    });

    it("gets coins", async () => {
      const start = Date.now();

      await program.methods.getCoin().accounts({ tomo: tomoPda }).rpc();

      const tomo = await program.account.tomo.fetch(tomoPda);
      expect(tomo.coins.toNumber()).to.equal(1);

      const duration = Date.now() - start;
      console.log(`${duration}ms - Get coin`);
    });

    it("gets 10 more coins", async () => {
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        await program.methods.getCoin().accounts({ tomo: tomoPda }).rpc();
      }

      const tomo = await program.account.tomo.fetch(tomoPda);
      expect(tomo.coins.toNumber()).to.equal(11);

      const duration = Date.now() - start;
      console.log(`${duration}ms - Get 10 coins`);
    });

    it("feeds the tomo", async () => {
      const start = Date.now();

      await program.methods.feed().accounts({ tomo: tomoPda }).rpc();

      const tomo = await program.account.tomo.fetch(tomoPda);
      expect(tomo.coins.toNumber()).to.equal(1);
      expect(tomo.hunger).to.equal(70);

      const duration = Date.now() - start;
      console.log(`${duration}ms - Feed tomo`);
    });

    it("fails to feed without enough coins", async () => {
      try {
        await program.methods.feed().accounts({ tomo: tomoPda }).rpc();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.message).to.include("NotEnoughCoins");
      }
    });

    it("verifies account is NOT delegated initially", async () => {
      const isDelegated = await checkIsDelegated(provider.connection);
      expect(isDelegated).to.be.false;

      const accountInfo = await provider.connection.getAccountInfo(tomoPda);
      expect(accountInfo.owner.toString()).to.equal(program.programId.toString());
      console.log("Account owner (not delegated):", accountInfo.owner.toString());
    });
  });

  // ============================================================
  // DELEGATION TESTS
  // ============================================================

  describe("Delegation Flow", () => {
    it("delegates tomo to ephemeral rollup", async () => {
      const start = Date.now();

      // Build delegate transaction
      const remainingAccounts = getDelegateRemainingAccounts();

      const tx = await program.methods
        .delegate(uid)
        .accounts({
          payer: provider.wallet.publicKey,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      // Send to BASE LAYER (delegation always goes to base layer)
      const txHash = await provider.sendAndConfirm(
        tx,
        [],
        {
          skipPreflight: true,
          commitment: "confirmed",
        }
      );

      const duration = Date.now() - start;
      console.log(`${duration}ms (Base Layer) Delegate txHash: ${txHash}`);
    });

    it("verifies account IS delegated after delegation", async () => {
      // Wait a moment for state to propagate
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const isDelegated = await checkIsDelegated(provider.connection);
      expect(isDelegated).to.be.true;

      const accountInfo = await provider.connection.getAccountInfo(tomoPda);
      expect(accountInfo.owner.toString()).to.equal(
        DELEGATION_PROGRAM_ID.toString()
      );
      console.log("Account owner (delegated):", accountInfo.owner.toString());
      console.log("Delegation Program ID:", DELEGATION_PROGRAM_ID.toString());
    });

    it("can fetch account data from ephemeral rollup", async () => {
      // When delegated, we should be able to read from ephemeral rollup
      const accountInfo = await providerEphemeralRollup.connection.getAccountInfo(
        tomoPda
      );

      // Account should exist on ephemeral rollup
      expect(accountInfo).to.not.be.null;
      console.log(
        "Account found on ephemeral rollup, data length:",
        accountInfo.data.length
      );
    });
  });

  // ============================================================
  // OPERATIONS ON DELEGATED ACCOUNT
  // ============================================================

  describe("Operations on Delegated Account", () => {
    it("gets coin on delegated account (via ephemeral rollup)", async () => {
      const start = Date.now();

      // Build transaction using program
      let tx = await program.methods
        .getCoin()
        .accounts({
          tomo: tomoPda,
        })
        .transaction();

      // CRITICAL: Send to EPHEMERAL ROLLUP for delegated accounts
      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);

      const txHash = await providerEphemeralRollup.sendAndConfirm(tx, [], {
        skipPreflight: true,
      });

      const duration = Date.now() - start;
      console.log(`${duration}ms (Ephemeral Rollup) Get coin txHash: ${txHash}`);
    });

    it("gets multiple coins on delegated account", async () => {
      const start = Date.now();

      // Get 10 more coins on ephemeral rollup
      for (let i = 0; i < 10; i++) {
        let tx = await program.methods
          .getCoin()
          .accounts({
            tomo: tomoPda,
          })
          .transaction();

        tx.feePayer = providerEphemeralRollup.wallet.publicKey;
        tx.recentBlockhash = (
          await providerEphemeralRollup.connection.getLatestBlockhash()
        ).blockhash;
        tx = await providerEphemeralRollup.wallet.signTransaction(tx);

        await providerEphemeralRollup.sendAndConfirm(tx, [], {
          skipPreflight: true,
        });
      }

      const duration = Date.now() - start;
      console.log(
        `${duration}ms (Ephemeral Rollup) Get 10 coins (avg ${Math.round(duration / 10)}ms each)`
      );
    });

    it("feeds tomo on delegated account", async () => {
      const start = Date.now();

      let tx = await program.methods
        .feed()
        .accounts({
          tomo: tomoPda,
        })
        .transaction();

      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);

      const txHash = await providerEphemeralRollup.sendAndConfirm(tx, [], {
        skipPreflight: true,
      });

      const duration = Date.now() - start;
      console.log(`${duration}ms (Ephemeral Rollup) Feed txHash: ${txHash}`);
    });
  });

  // ============================================================
  // UNDELEGATION TESTS
  // ============================================================

  describe("Undelegation Flow", () => {
    it("undelegates tomo from ephemeral rollup", async () => {
      const start = Date.now();

      // Build undelegate transaction
      let tx = await program.methods
        .undelegate()
        .accounts({
          payer: providerEphemeralRollup.wallet.publicKey,
          tomo: tomoPda,
        })
        .transaction();

      // Send to EPHEMERAL ROLLUP (undelegate is called on ER)
      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);

      const txHash = await providerEphemeralRollup.sendAndConfirm(tx, [], {
        skipPreflight: true,
      });

      const erDuration = Date.now() - start;
      console.log(
        `${erDuration}ms (Ephemeral Rollup) Undelegate txHash: ${txHash}`
      );

      // Wait for commitment to propagate to base layer
      const commitStart = Date.now();
      try {
        const commitTxHash = await GetCommitmentSignature(
          txHash,
          providerEphemeralRollup.connection
        );
        const commitDuration = Date.now() - commitStart;
        console.log(
          `${commitDuration}ms (Base Layer) Commitment txHash: ${commitTxHash}`
        );
      } catch (err) {
        console.log("Note: GetCommitmentSignature may timeout on devnet, continuing...");
      }
    });

    it("verifies account is NOT delegated after undelegation", async () => {
      // Wait for state to propagate
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const isDelegated = await checkIsDelegated(provider.connection);
      expect(isDelegated).to.be.false;

      const accountInfo = await provider.connection.getAccountInfo(tomoPda);
      expect(accountInfo.owner.toString()).to.equal(program.programId.toString());
      console.log(
        "Account owner (after undelegation):",
        accountInfo.owner.toString()
      );
    });

    it("can operate on base layer after undelegation", async () => {
      const start = Date.now();

      // Should be able to use base layer again
      await program.methods.getCoin().accounts({ tomo: tomoPda }).rpc();

      const duration = Date.now() - start;
      console.log(`${duration}ms (Base Layer) Get coin after undelegation`);
    });
  });
});

// ============================================================
// SEPARATE TEST SUITE FOR SECOND DELEGATION CYCLE
// ============================================================

describe("tomo-program - Re-delegation Cycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.tomoProgram as Program<TomoProgram>;

  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
        "https://devnet.magicblock.app/",
      {
        wsEndpoint:
          process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );

  // New UID for this test suite
  const uid = `redel-${Date.now().toString(36)}`;

  const [tomoPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tomo1"), Buffer.from(uid)],
    program.programId
  );

  function getDelegateRemainingAccounts(): anchor.web3.AccountMeta[] {
    const endpoint = providerEphemeralRollup.connection.rpcEndpoint;
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
      return [
        {
          pubkey: new anchor.web3.PublicKey(
            "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"
          ),
          isSigner: false,
          isWritable: false,
        },
      ];
    }
    return [];
  }

  it("creates, delegates, operates, undelegates, and re-delegates", async () => {
    console.log("\n--- Re-delegation Cycle Test ---");
    console.log("UID:", uid);

    // 1. Initialize
    console.log("\n1. Initializing...");
    await program.methods.init(uid).rpc();
    let tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(0);
    console.log("   Initialized with 0 coins");

    // 2. Get some coins on base layer
    console.log("\n2. Getting coins on base layer...");
    for (let i = 0; i < 5; i++) {
      await program.methods.getCoin().accounts({ tomo: tomoPda }).rpc();
    }
    tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(5);
    console.log("   Got 5 coins, total:", tomo.coins.toNumber());

    // 3. First delegation
    console.log("\n3. First delegation...");
    const remainingAccounts = getDelegateRemainingAccounts();
    let tx = await program.methods
      .delegate(uid)
      .accounts({ payer: provider.wallet.publicKey })
      .remainingAccounts(remainingAccounts)
      .transaction();
    await provider.sendAndConfirm(tx, [], {
      skipPreflight: true,
      commitment: "confirmed",
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    let accountInfo = await provider.connection.getAccountInfo(tomoPda);
    expect(accountInfo.owner.toString()).to.equal(
      DELEGATION_PROGRAM_ID.toString()
    );
    console.log("   Delegated successfully");

    // 4. Get coins on ephemeral rollup
    console.log("\n4. Getting coins on ephemeral rollup...");
    for (let i = 0; i < 5; i++) {
      let tx = await program.methods
        .getCoin()
        .accounts({ tomo: tomoPda })
        .transaction();
      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);
      await providerEphemeralRollup.sendAndConfirm(tx, [], {
        skipPreflight: true,
      });
    }
    console.log("   Got 5 more coins on ER");

    // 5. First undelegation
    console.log("\n5. First undelegation...");
    tx = await program.methods
      .undelegate()
      .accounts({
        payer: providerEphemeralRollup.wallet.publicKey,
        tomo: tomoPda,
      })
      .transaction();
    tx.feePayer = providerEphemeralRollup.wallet.publicKey;
    tx.recentBlockhash = (
      await providerEphemeralRollup.connection.getLatestBlockhash()
    ).blockhash;
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    await providerEphemeralRollup.sendAndConfirm(tx, [], {
      skipPreflight: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 5000));
    accountInfo = await provider.connection.getAccountInfo(tomoPda);
    expect(accountInfo.owner.toString()).to.equal(program.programId.toString());
    console.log("   Undelegated successfully");

    // 6. Verify state persisted
    console.log("\n6. Verifying state persisted...");
    tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(10); // 5 base + 5 ER
    console.log("   State verified, coins:", tomo.coins.toNumber());

    // 7. Re-delegate
    console.log("\n7. Re-delegating...");
    tx = await program.methods
      .delegate(uid)
      .accounts({ payer: provider.wallet.publicKey })
      .remainingAccounts(remainingAccounts)
      .transaction();
    await provider.sendAndConfirm(tx, [], {
      skipPreflight: true,
      commitment: "confirmed",
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    accountInfo = await provider.connection.getAccountInfo(tomoPda);
    expect(accountInfo.owner.toString()).to.equal(
      DELEGATION_PROGRAM_ID.toString()
    );
    console.log("   Re-delegated successfully");

    // 8. Feed on ephemeral rollup
    console.log("\n8. Feeding on ephemeral rollup...");
    tx = await program.methods
      .feed()
      .accounts({ tomo: tomoPda })
      .transaction();
    tx.feePayer = providerEphemeralRollup.wallet.publicKey;
    tx.recentBlockhash = (
      await providerEphemeralRollup.connection.getLatestBlockhash()
    ).blockhash;
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    await providerEphemeralRollup.sendAndConfirm(tx, [], {
      skipPreflight: true,
    });
    console.log("   Fed tomo on ER");

    // 9. Final undelegation
    console.log("\n9. Final undelegation...");
    tx = await program.methods
      .undelegate()
      .accounts({
        payer: providerEphemeralRollup.wallet.publicKey,
        tomo: tomoPda,
      })
      .transaction();
    tx.feePayer = providerEphemeralRollup.wallet.publicKey;
    tx.recentBlockhash = (
      await providerEphemeralRollup.connection.getLatestBlockhash()
    ).blockhash;
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    await providerEphemeralRollup.sendAndConfirm(tx, [], {
      skipPreflight: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 10. Final state verification
    console.log("\n10. Final state verification...");
    tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(0); // 10 - 10 (feed cost)
    expect(tomo.hunger).to.equal(70); // 100 - 30
    console.log("   Final coins:", tomo.coins.toNumber());
    console.log("   Final hunger:", tomo.hunger);
    console.log("\n--- Re-delegation Cycle Complete ---\n");
  });
});

// ============================================================
// TEST SUITE FOR INIT + DELEGATE WITH CRANK_PAYER
// ============================================================

describe("tomo-program - Init + Delegate with CrankPayer", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.tomoProgram as Program<TomoProgram>;

  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
        "https://devnet.magicblock.app/",
      {
        wsEndpoint:
          process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );

  // New UID for this test suite
  const uid = `crank-${Date.now().toString(36)}`;

  const [tomoPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tomo1"), Buffer.from(uid)],
    program.programId
  );

  const [crankPayerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("crank_payer"), tomoPda.toBuffer()],
    program.programId
  );

  console.log("\n--- Init + Delegate with CrankPayer Test ---");
  console.log("UID:", uid);
  console.log("Tomo PDA:", tomoPda.toString());
  console.log("CrankPayer PDA:", crankPayerPda.toString());

  function getDelegateRemainingAccounts(): anchor.web3.AccountMeta[] {
    const endpoint = providerEphemeralRollup.connection.rpcEndpoint;
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
      return [
        {
          pubkey: new anchor.web3.PublicKey(
            "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"
          ),
          isSigner: false,
          isWritable: false,
        },
      ];
    }
    return [];
  }

  it("initializes tomo and crank_payer", async () => {
    console.log("\n1. Initializing tomo and crank_payer...");

    try {
      const tx = await program.methods
        .init(uid)
        .accounts({
          payer: provider.wallet.publicKey,
          tomo: tomoPda,
          crankPayer: crankPayerPda,
        })
        .rpc();

      console.log("   Init txHash:", tx);

      // Verify tomo account
      const tomo = await program.account.tomo.fetch(tomoPda);
      expect(tomo.uid).to.equal(uid);
      console.log("   Tomo initialized successfully");

      // Verify crank_payer account exists
      const crankPayerInfo = await provider.connection.getAccountInfo(crankPayerPda);
      expect(crankPayerInfo).to.not.be.null;
      console.log("   CrankPayer initialized successfully, data length:", crankPayerInfo.data.length);

    } catch (err) {
      console.error("   Init failed:", err);
      throw err;
    }
  });

  it("delegates tomo and crank_payer", async () => {
    console.log("\n2. Delegating tomo and crank_payer...");

    const remainingAccounts = getDelegateRemainingAccounts();

    try {
      // First, let's see what accounts the delegate instruction expects
      const instruction = await program.methods
        .delegate(uid)
        .accounts({
          payer: provider.wallet.publicKey,
          tomo: tomoPda,
          crankPayer: crankPayerPda,
        })
        .remainingAccounts(remainingAccounts)
        .instruction();

      console.log("   Instruction accounts:");
      instruction.keys.forEach((key, i) => {
        console.log(`     ${i}: ${key.pubkey.toString()} (writable: ${key.isWritable}, signer: ${key.isSigner})`);
      });

      const tx = new anchor.web3.Transaction().add(instruction);
      tx.feePayer = provider.wallet.publicKey;
      tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;

      // Try to simulate first
      console.log("\n   Simulating transaction...");
      try {
        const simulation = await provider.connection.simulateTransaction(tx);
        if (simulation.value.err) {
          console.error("   Simulation error:", simulation.value.err);
          console.error("   Logs:", simulation.value.logs);
        } else {
          console.log("   Simulation successful!");
          console.log("   Logs:", simulation.value.logs);
        }
      } catch (simErr) {
        console.error("   Simulation threw:", simErr);
      }

      // Now try to send
      console.log("\n   Sending transaction...");
      const txHash = await provider.sendAndConfirm(tx, [], {
        skipPreflight: true,
        commitment: "confirmed",
      });

      console.log("   Delegate txHash:", txHash);

      // Wait and verify delegation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const tomoInfo = await provider.connection.getAccountInfo(tomoPda);
      console.log("   Tomo owner after delegation:", tomoInfo?.owner.toString());

      const crankPayerInfo = await provider.connection.getAccountInfo(crankPayerPda);
      console.log("   CrankPayer owner after delegation:", crankPayerInfo?.owner.toString());

    } catch (err) {
      console.error("   Delegate failed:", err);
      if (err.logs) {
        console.error("   Logs:", err.logs);
      }
      throw err;
    }
  });
});
