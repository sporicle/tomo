import { Keypair, PublicKey } from '@solana/web3.js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Base64 } from 'js-base64'

const STORAGE_KEY = '@tomo:embedded_wallet'

interface StoredWallet {
  secretKey: string // base64 encoded
  publicKey: string // base58 encoded
  createdAt: number
}

/**
 * Service for managing a local embedded wallet keypair.
 * Used for signing gasless transactions on the ephemeral rollup.
 */
export class EmbeddedWalletService {
  /**
   * Get existing wallet or create a new one if none exists.
   */
  static async getOrCreate(): Promise<Keypair> {
    const existing = await this.get()
    if (existing) {
      return existing
    }
    return this.create()
  }

  /**
   * Get existing wallet from storage.
   * Returns null if no wallet exists.
   */
  static async get(): Promise<Keypair | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return null
      }

      const data: StoredWallet = JSON.parse(stored)
      const secretKeyBytes = Base64.toUint8Array(data.secretKey)
      return Keypair.fromSecretKey(secretKeyBytes)
    } catch (error) {
      console.error('Error retrieving embedded wallet:', error)
      return null
    }
  }

  /**
   * Create a new wallet and store it.
   */
  static async create(): Promise<Keypair> {
    const keypair = Keypair.generate()
    await this.store(keypair)
    return keypair
  }

  /**
   * Store a keypair to AsyncStorage.
   */
  private static async store(keypair: Keypair): Promise<void> {
    const data: StoredWallet = {
      secretKey: Base64.fromUint8Array(keypair.secretKey),
      publicKey: keypair.publicKey.toBase58(),
      createdAt: Date.now(),
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  /**
   * Clear the stored wallet.
   */
  static async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY)
  }

  /**
   * Get just the public key without loading the full keypair.
   * Useful for display purposes.
   */
  static async getPublicKey(): Promise<PublicKey | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return null
      }

      const data: StoredWallet = JSON.parse(stored)
      return new PublicKey(data.publicKey)
    } catch (error) {
      console.error('Error retrieving embedded wallet public key:', error)
      return null
    }
  }

  /**
   * Check if a wallet exists in storage.
   */
  static async exists(): Promise<boolean> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    return stored !== null
  }
}
