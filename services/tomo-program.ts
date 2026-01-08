import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { TomoProgram, IDL } from '@/idl'
import { AppConfig } from '@/constants/app-config'

const PROGRAM_ID = new PublicKey(AppConfig.tomoProgramId)

export interface TomoAccount {
  owner: PublicKey
  uid: string
  hunger: number
  lastFed: BN
  coins: BN
}

export class TomoProgramService {
  private program: Program<TomoProgram>
  private connection: Connection

  constructor(connection: Connection) {
    this.connection = connection

    // Create read-only provider for queries
    const provider = new AnchorProvider(
      connection,
      {} as any, // Wallet not needed for read-only operations
      { commitment: 'confirmed' }
    )

    this.program = new Program<TomoProgram>(
      IDL as TomoProgram,
      provider
    )
  }

  /**
   * Derive Tomo PDA
   * Seeds: ["tomo", uid]
   */
  getTomoPDA(uid: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('tomo'), Buffer.from(uid)],
      PROGRAM_ID
    )
  }

  /**
   * Build init transaction
   */
  async buildInitTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    // In Anchor 0.32+, accounts with PDA seeds from args and fixed addresses are auto-resolved
    const instruction = await this.program.methods
      .init(params.uid)
      .accounts({
        payer: params.payer,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build getCoin transaction
   */
  async buildGetCoinTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    const instruction = await this.program.methods
      .getCoin()
      .accounts({
        tomo: tomoPDA,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build feed transaction
   */
  async buildFeedTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    const instruction = await this.program.methods
      .feed()
      .accounts({
        tomo: tomoPDA,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Fetch Tomo account from blockchain
   */
  async fetchTomo(uid: string): Promise<TomoAccount | null> {
    try {
      const [tomoPDA] = this.getTomoPDA(uid)
      const account = await this.program.account.tomo.fetch(tomoPDA)
      return {
        owner: account.owner,
        uid: account.uid,
        hunger: account.hunger,
        lastFed: account.lastFed,
        coins: account.coins,
      }
    } catch (error) {
      // Account doesn't exist
      return null
    }
  }

  /**
   * Fetch Tomo account by PDA
   */
  async fetchTomoByPDA(pda: PublicKey): Promise<TomoAccount | null> {
    try {
      const account = await this.program.account.tomo.fetch(pda)
      return {
        owner: account.owner,
        uid: account.uid,
        hunger: account.hunger,
        lastFed: account.lastFed,
        coins: account.coins,
      }
    } catch (error) {
      return null
    }
  }
}
