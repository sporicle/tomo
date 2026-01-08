import { WalletUiDropdown } from '@/components/solana/wallet-ui-dropdown'
import { Stack } from 'expo-router'
import React from 'react'

export default function TomoLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Tomo',
        headerRight: () => <WalletUiDropdown />,
        headerTransparent: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  )
}
