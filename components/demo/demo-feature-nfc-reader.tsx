import { AppView } from '@/components/app-view'
import { AppText } from '@/components/app-text'
import { ActivityIndicator, View } from 'react-native'
import React, { useState, useEffect } from 'react'
import { Button } from '@react-navigation/elements'
import NfcManager, { NfcTech } from 'react-native-nfc-manager'

export function DemoFeatureNfcReader() {
  const [uid, setUid] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    NfcManager.start().catch(() => {})
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {})
    }
  }, [])

  async function readNfc() {
    setUid(null)
    setIsScanning(true)

    try {
      await NfcManager.requestTechnology(NfcTech.NfcA)
      const tag = await NfcManager.getTag()
      if (tag?.id) {
        setUid(tag.id)
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {})
      setIsScanning(false)
    }
  }

  return (
    <AppView>
      <AppText type="subtitle">NFC Reader</AppText>

      <View style={{ gap: 16 }}>
        {isScanning ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActivityIndicator />
            <AppText>Hold NFC tag near device...</AppText>
          </View>
        ) : (
          <Button onPress={readNfc} variant="filled">
            Scan NFC Tag
          </Button>
        )}

        {uid && (
          <View style={{ gap: 4 }}>
            <AppText>UID:</AppText>
            <AppText style={{ fontFamily: 'monospace' }}>{uid}</AppText>
          </View>
        )}
      </View>
    </AppView>
  )
}

