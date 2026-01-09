import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'
import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from '@solana/web3.js'
import { TomoProgram, IDL } from '@/idl'
import { AppConfig } from '@/constants/app-config'

const PROGRAM_ID = new PublicKey(AppConfig.tomoProgramId)
const DELEGATION_PROGRAM_ID = new PublicKey('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh')
const MAGIC_PROGRAM_ID = new PublicKey('Magic11111111111111111111111111111111111111')
const MAGIC_CONTEXT_ID = new PublicKey('MagicContext1111111111111111111111111111111')
const EPHEMERAL_ORACLE_QUEUE = new PublicKey('5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc')
const VRF_PROGRAM_ID = new PublicKey('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz')

export interface TomoAccount {
  owner: PublicKey
  uid: string
  hunger: number
  lastFed: BN
  coins: BN
  itemDrop: boolean
  inventory: number[]
}

export interface TomoAccountWithDelegation extends TomoAccount {
  isDelegated: boolean
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
   * Derive delegation buffer PDA
   */
  getDelegationBufferPDA(tomoPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('buffer'), tomoPDA.toBuffer()],
      PROGRAM_ID
    )
  }

  /**
   * Derive delegation record PDA
   */
  getDelegationRecordPDA(tomoPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('delegation'), tomoPDA.toBuffer()],
      DELEGATION_PROGRAM_ID
    )
  }

  /**
   * Derive delegation metadata PDA
   */
  getDelegationMetadataPDA(tomoPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('delegation-metadata'), tomoPDA.toBuffer()],
      DELEGATION_PROGRAM_ID
    )
  }

  /**
   * Build init transaction
   */
  async buildInitTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    // Derive crank_payer PDA
    const [crankPayer] = PublicKey.findProgramAddressSync(
      [Buffer.from('crank_payer'), tomoPDA.toBuffer()],
      PROGRAM_ID
    )

    const instruction = await this.program.methods
      .init(params.uid)
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
        crankPayer: crankPayer,
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
   * Build delegate transaction
   * This delegates the Tomo account to the MagicBlock ephemeral rollup
   */
  async buildDelegateTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    // Derive crank_payer PDA
    const [crankPayer] = PublicKey.findProgramAddressSync(
      [Buffer.from('crank_payer'), tomoPDA.toBuffer()],
      PROGRAM_ID
    )

    const instruction = await this.program.methods
      .delegate(params.uid)
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
        crankPayer: crankPayer,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build init + delegate transaction (combined in single tx)
   * This initializes a Tomo account and immediately delegates it
   */
  async buildInitAndDelegateTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    // Derive crank_payer PDA
    const [crankPayer] = PublicKey.findProgramAddressSync(
      [Buffer.from('crank_payer'), tomoPDA.toBuffer()],
      PROGRAM_ID
    )

    const initInstruction = await this.program.methods
      .init(params.uid)
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
        crankPayer: crankPayer,
      })
      .instruction()

    const delegateInstruction = await this.program.methods
      .delegate(params.uid)
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
        crankPayer: crankPayer,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(initInstruction)
    tx.add(delegateInstruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build undelegate transaction
   * This undelegates the Tomo account from the ephemeral rollup back to base layer
   * NOTE: This transaction should be sent to the EPHEMERAL ROLLUP, not the base layer
   */
  async buildUndelegateTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    const instruction = await this.program.methods
      .undelegate()
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build delete transaction
   * This closes the Tomo account and returns rent to the owner
   */
  async buildDeleteTx(params: {
    owner: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    const instruction = await this.program.methods
      .delete()
      .accounts({
        tomo: tomoPDA,
        owner: params.owner,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.owner

    return tx
  }

  /**
   * Build triggerItemDrop transaction
   * Sets item_drop to true if it's false
   */
  async buildTriggerItemDropTx(params: {
    payer: PublicKey
    uid: string
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    const instruction = await this.program.methods
      .triggerItemDrop()
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
   * Build openItemDrop transaction
   * Uses VRF to add a random item (1-5) to inventory
   * NOTE: This transaction should be sent to the EPHEMERAL ROLLUP
   */
  async buildOpenItemDropTx(params: {
    payer: PublicKey
    uid: string
    clientSeed?: number
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)
    const clientSeed = params.clientSeed ?? Math.floor(Math.random() * 256)

    const instruction = await this.program.methods
      .openItemDrop(clientSeed)
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build useItem transaction
   * Removes an item from the specified inventory slot
   */
  async buildUseItemTx(params: {
    payer: PublicKey
    uid: string
    index: number
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    const instruction = await this.program.methods
      .useItem(params.index)
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
   * Build randomEvent transaction
   * Uses VRF to generate a random event with 20% chance to trigger item drop
   * NOTE: This transaction should be sent to the EPHEMERAL ROLLUP
   */
  async buildRandomEventTx(params: {
    payer: PublicKey
    uid: string
    clientSeed?: number
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)
    const clientSeed = params.clientSeed ?? Math.floor(Math.random() * 256)

    const instruction = await this.program.methods
      .randomEvent(clientSeed)
      .accounts({
        payer: params.payer,
        tomo: tomoPDA,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Build startRandomEvents transaction
   * Schedules a crank to run randomEventCrank periodically
   * NOTE: This transaction should be sent to the EPHEMERAL ROLLUP
   */
  async buildStartRandomEventsTx(params: {
    payer: PublicKey
    uid: string
    taskId?: number
    intervalMs?: number
    iterations?: number
  }): Promise<Transaction> {
    const [tomoPDA] = this.getTomoPDA(params.uid)

    // Derive crank_payer PDA
    const [crankPayer] = PublicKey.findProgramAddressSync(
      [Buffer.from('crank_payer'), tomoPDA.toBuffer()],
      PROGRAM_ID
    )

    // Derive program_identity PDA
    const [programIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('identity')],
      PROGRAM_ID
    )

    const instruction = await this.program.methods
      .startRandomEvents({
        taskId: new BN(params.taskId ?? Date.now()),
        executionIntervalMillis: new BN(params.intervalMs ?? 1000),
        iterations: new BN(params.iterations ?? 10),
      })
      .accounts({
        magicProgram: MAGIC_PROGRAM_ID,
        payer: params.payer,
        tomo: tomoPDA,
        oracleQueue: EPHEMERAL_ORACLE_QUEUE,
        crankPayer: crankPayer,
        programIdentity: programIdentity,
        vrfProgram: VRF_PROGRAM_ID,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .instruction()

    const tx = new Transaction()
    tx.add(instruction)
    tx.feePayer = params.payer

    return tx
  }

  /**
   * Manually decode Tomo account data
   * Structure: discriminator (8) + owner (32) + uid string (4 + len) + hunger (1) + last_fed (8) + coins (8) + item_drop (1) + inventory (8)
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
    offset += 8

    // Item drop: bool (1 byte)
    const itemDrop = data[offset] !== 0
    offset += 1

    // Inventory: [u8; 8]
    const inventory: number[] = []
    for (let i = 0; i < 8; i++) {
      inventory.push(data[offset + i])
    }

    return {
      owner,
      uid,
      hunger,
      lastFed: new BN(lastFed.toString()),
      coins: new BN(coins.toString()),
      itemDrop,
      inventory,
    }
  }

  /**
   * Check if an account is delegated by checking its owner
   * When delegated, the account owner is DELEGATION_PROGRAM_ID
   * When not delegated, the account owner is PROGRAM_ID
   */
  checkIsDelegated(accountOwner: PublicKey): boolean {
    return accountOwner.equals(DELEGATION_PROGRAM_ID)
  }

  /**
   * Fetch Tomo account from blockchain with delegation status
   */
  async fetchTomo(uid: string): Promise<TomoAccountWithDelegation | null> {
    try {
      const [tomoPDA] = this.getTomoPDA(uid)
      console.log('Fetching Tomo account:', { uid, pda: tomoPDA.toString() })

      // Fetch raw account info
      const accountInfo = await this.connection.getAccountInfo(tomoPDA)
      if (!accountInfo) {
        console.log('Account not found')
        return null
      }

      // Check delegation status based on account owner
      const isDelegated = this.checkIsDelegated(accountInfo.owner)

      // Manually decode to work around Buffer polyfill issues in React Native
      const decoded = this.decodeTomoAccount(accountInfo.data)

      console.log('Fetched account:', { ...decoded, isDelegated })
      return {
        ...decoded,
        isDelegated,
      }
    } catch (error) {
      console.error('Error fetching Tomo:', error)
      // Account doesn't exist or other error
      return null
    }
  }

  /**
   * Fetch Tomo account by PDA with delegation status
   */
  async fetchTomoByPDA(pda: PublicKey): Promise<TomoAccountWithDelegation | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo) {
        return null
      }
      const isDelegated = this.checkIsDelegated(accountInfo.owner)
      const decoded = this.decodeTomoAccount(accountInfo.data)
      return {
        ...decoded,
        isDelegated,
      }
    } catch (error) {
      return null
    }
  }
}
