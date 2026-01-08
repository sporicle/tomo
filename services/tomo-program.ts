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
   * Manually decode Tomo account data
   * Structure: discriminator (8) + owner (32) + uid string (4 + len) + hunger (1) + last_fed (8) + coins (8)
   */
  private decodeTomoAccount(data: Uint8Array): TomoAccount {
    let offset = 8 // Skip discriminator

    // Owner: 32 bytes
    const ownerBytes = data.slice(offset, offset + 32)
    const owner = new PublicKey(ownerBytes)
    offset += 32

    // UID: String (4 byte length prefix + string bytes)
    const uidLen = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)
    offset += 4
    const uidBytes = data.slice(offset, offset + uidLen)
    const uid = new TextDecoder().decode(uidBytes)
    offset += uidLen

    // Hunger: u8
    const hunger = data[offset]
    offset += 1

    // Last fed: i64 (little endian)
    let lastFed = BigInt(0)
    for (let i = 0; i < 8; i++) {
      lastFed |= BigInt(data[offset + i]) << BigInt(i * 8)
    }
    offset += 8

    // Coins: u64 (little endian)
    let coins = BigInt(0)
    for (let i = 0; i < 8; i++) {
      coins |= BigInt(data[offset + i]) << BigInt(i * 8)
    }

    return {
      owner,
      uid,
      hunger,
      lastFed: new BN(lastFed.toString()),
      coins: new BN(coins.toString()),
    }
  }

  /**
   * Fetch Tomo account from blockchain
   */
  async fetchTomo(uid: string): Promise<TomoAccount | null> {
    try {
      const [tomoPDA] = this.getTomoPDA(uid)
      console.log('Fetching Tomo account:', { uid, pda: tomoPDA.toString() })

      // Fetch raw account info
      const accountInfo = await this.connection.getAccountInfo(tomoPDA)
      if (!accountInfo) {
        console.log('Account not found')
        return null
      }

      // Manually decode to work around Buffer polyfill issues in React Native
      const decoded = this.decodeTomoAccount(accountInfo.data)

      console.log('Fetched account:', decoded)
      return decoded
    } catch (error) {
      console.error('Error fetching Tomo:', error)
      // Account doesn't exist or other error
      return null
    }
  }

  /**
   * Fetch Tomo account by PDA
   */
  async fetchTomoByPDA(pda: PublicKey): Promise<TomoAccount | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo) {
        return null
      }
      return this.decodeTomoAccount(accountInfo.data)
    } catch (error) {
      return null
    }
  }
}
