import { AppView } from '@/components/app-view'
import { AppText } from '@/components/app-text'
import { DemoFeatureSignMessage } from './demo-feature-sign-message'
import { DemoFeatureNfcReader } from './demo-feature-nfc-reader'
import { DemoFeatureTomo } from './demo-feature-tomo'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { PublicKey } from '@solana/web3.js'
import * as React from 'react'

export function DemoFeature() {
  const { account } = useMobileWallet()
  return (
    <AppView>
      <AppText type="subtitle">Demo page</AppText>
      <AppText>Start building your features here.</AppText>
      <DemoFeatureTomo />
      <DemoFeatureNfcReader />
    </AppView>
  )
}
