import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TomoProgram } from "../target/types/tomo_program";
import { expect } from "chai";

describe("tomo-program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.tomoProgram as Program<TomoProgram>;
  const provider = anchor.AnchorProvider.env();

  const uid = "04:A3:2B:1C:5D:6E:7F";

  const [tomoPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tomo"), Buffer.from(uid)],
    program.programId
  );

  it("initializes a tomo", async () => {
    await program.methods.init(uid).rpc();

    const tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.uid).to.equal(uid);
    expect(tomo.hunger).to.equal(100);
    expect(tomo.coins.toNumber()).to.equal(0);
  });

  it("gets coins", async () => {
    await program.methods.getCoin().accounts({ tomo: tomoPda }).rpc();

    const tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(1);
  });

  it("gets 10 more coins", async () => {
    for (let i = 0; i < 10; i++) {
      await program.methods.getCoin().accounts({ tomo: tomoPda }).rpc();
    }

    const tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(11);
  });

  it("feeds the tomo", async () => {
    await program.methods.feed().accounts({ tomo: tomoPda }).rpc();

    const tomo = await program.account.tomo.fetch(tomoPda);
    expect(tomo.coins.toNumber()).to.equal(1);
    expect(tomo.hunger).to.equal(70);
  });

  it("fails to feed without enough coins", async () => {
    try {
      await program.methods.feed().accounts({ tomo: tomoPda }).rpc();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.include("NotEnoughCoins");
    }
  });
});
