import { AppView } from '@/components/app-view'
import { AppText } from '@/components/app-text'
import { ActivityIndicator, TextInput, View } from 'react-native'
import React, { useState, useEffect } from 'react'
import { Button } from '@react-navigation/elements'
import { useThemeColor } from '@/hooks/use-theme-color'
import Snackbar from 'react-native-snackbar'
import { ellipsify } from '@/utils/ellipsify'
import {
  getTomoPDA,
  useTomoProgram,
  useTomoAccountQuery,
  useInitTomo,
  useGetCoin,
  useFeed,
} from './use-tomo-program'

function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return 'Never'
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function HungerBar({ hunger }: { hunger: number }) {
  const filledColor = hunger > 60 ? '#4CAF50' : hunger > 30 ? '#FFC107' : '#F44336'
  const backgroundColor = useThemeColor({ light: '#e0e0e0', dark: '#444444' }, 'background')

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          flex: 1,
          height: 16,
          backgroundColor,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${hunger}%`,
            height: '100%',
            backgroundColor: filledColor,
            borderRadius: 8,
          }}
        />
      </View>
      <AppText style={{ width: 60 }}>{hunger}/100</AppText>
    </View>
  )
}

export function DemoFeatureTomo() {
  const { publicKey } = useTomoProgram()
  const [uid, setUid] = useState('')
  const [activeUid, setActiveUid] = useState('')

  const backgroundColor = useThemeColor({ light: '#f0f0f0', dark: '#333333' }, 'background')
  const textColor = useThemeColor({ light: '#000000', dark: '#ffffff' }, 'text')
  const borderColor = useThemeColor({ light: '#cccccc', dark: '#555555' }, 'background')

  const tomoQuery = useTomoAccountQuery({ uid: activeUid })
  const initTomo = useInitTomo({ uid: activeUid })
  const getCoin = useGetCoin({ uid: activeUid })
  const feed = useFeed({ uid: activeUid })

  const tomo = tomoQuery.data
  const pda = activeUid ? getTomoPDA(activeUid) : null

  const isLoading = initTomo.isPending || getCoin.isPending || feed.isPending
  const coins = tomo?.coins?.toNumber() ?? 0
  const canFeed = coins >= 10

  const handleInit = () => {
    if (!uid.trim()) {
      Snackbar.show({ text: 'Please enter a UID', duration: Snackbar.LENGTH_SHORT })
      return
    }
    setActiveUid(uid.trim())
    initTomo
      .mutateAsync()
      .then((sig) => {
        Snackbar.show({ text: `Tomo initialized! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Init error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleGetCoin = () => {
    getCoin
      .mutateAsync()
      .then((sig) => {
        Snackbar.show({ text: `Got a coin! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Get coin error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleFeed = () => {
    feed
      .mutateAsync()
      .then((sig) => {
        Snackbar.show({ text: `Fed Tomo! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Feed error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleLookup = () => {
    if (!uid.trim()) {
      Snackbar.show({ text: 'Please enter a UID', duration: Snackbar.LENGTH_SHORT })
      return
    }
    setActiveUid(uid.trim())
  }

  useEffect(() => {
    if (activeUid) {
      tomoQuery.refetch()
    }
  }, [activeUid])

  if (!publicKey) {
    return (
      <AppView>
        <AppText type="subtitle">Tomo Program Demo</AppText>
        <AppText style={{ color: '#888' }}>Connect wallet to interact with Tomo program.</AppText>
      </AppView>
    )
  }

  return (
    <AppView>
      <AppText type="subtitle">Tomo Program Demo</AppText>

      <View style={{ gap: 12, marginVertical: 16 }}>
        <AppText>UID</AppText>
        <TextInput
          style={{
            backgroundColor,
            color: textColor,
            borderWidth: 1,
            borderColor,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
          value={uid}
          onChangeText={setUid}
          placeholder="Enter Tomo UID (max 32 chars)"
          placeholderTextColor="#888"
          maxLength={32}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button onPress={handleLookup} disabled={isLoading || !uid.trim()} variant="tinted">
              Lookup
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={handleInit} disabled={isLoading || !uid.trim()} variant="filled">
              Initialize
            </Button>
          </View>
        </View>
      </View>

      {tomoQuery.isLoading && <ActivityIndicator style={{ marginVertical: 16 }} />}

      {tomo && (
        <View
          style={{
            gap: 12,
            padding: 16,
            backgroundColor,
            borderRadius: 12,
            borderWidth: 1,
            borderColor,
            marginVertical: 8,
          }}
        >
          <AppText type="defaultSemiBold">Tomo State</AppText>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText style={{ color: '#888' }}>PDA:</AppText>
              <AppText>{pda ? ellipsify(pda.toString(), 8) : '-'}</AppText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText style={{ color: '#888' }}>Owner:</AppText>
              <AppText>{ellipsify(tomo.owner.toString(), 8)}</AppText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText style={{ color: '#888' }}>UID:</AppText>
              <AppText>{tomo.uid}</AppText>
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <AppText style={{ color: '#888' }}>Hunger:</AppText>
            <HungerBar hunger={tomo.hunger} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText style={{ color: '#888' }}>Coins:</AppText>
            <AppText>{coins}</AppText>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText style={{ color: '#888' }}>Last Fed:</AppText>
            <AppText>{formatTimestamp(tomo.lastFed.toNumber())}</AppText>
          </View>
        </View>
      )}

      {activeUid && !tomoQuery.isLoading && !tomo && (
        <View
          style={{
            padding: 16,
            backgroundColor,
            borderRadius: 12,
            borderWidth: 1,
            borderColor,
            marginVertical: 8,
          }}
        >
          <AppText style={{ textAlign: 'center', color: '#888' }}>
            No Tomo found for UID "{activeUid}". Click Initialize to create one.
          </AppText>
        </View>
      )}

      {tomo && (
        <View style={{ gap: 8, marginTop: 16 }}>
          <AppText type="defaultSemiBold">Actions</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isLoading ? (
              <ActivityIndicator style={{ flex: 1 }} />
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Button onPress={handleGetCoin} variant="tinted">
                    Get Coin
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button onPress={handleFeed} disabled={!canFeed} variant="filled">
                    Feed (10)
                  </Button>
                </View>
              </>
            )}
          </View>
          <Button onPress={() => tomoQuery.refetch()} disabled={isLoading} variant="plain">
            Refresh State
          </Button>
        </View>
      )}

      {(initTomo.isError || getCoin.isError || feed.isError) && (
        <AppText style={{ color: '#F44336', fontSize: 12, marginTop: 8 }}>
          {initTomo.error?.message || getCoin.error?.message || feed.error?.message}
        </AppText>
      )}
    </AppView>
  )
}
