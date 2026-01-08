import { Buffer } from 'buffer'
import { getRandomValues as expoCryptoGetRandomValues } from 'expo-crypto'

// Buffer polyfill - required for Anchor/borsh to decode accounts
global.Buffer = Buffer

// Crypto polyfill
class Crypto {
  getRandomValues = expoCryptoGetRandomValues
}

const webCrypto = typeof crypto !== 'undefined' ? crypto : new Crypto()

;(() => {
  if (typeof crypto === 'undefined') {
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      enumerable: true,
      get: () => webCrypto,
    })
  }
})()
