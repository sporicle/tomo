import { AppView } from '@/components/app-view'
import { AppText } from '@/components/app-text'
import { ActivityIndicator, TextInput, View } from 'react-native'
import React, { useState, useEffect } from 'react'
import { Button } from '@react-navigation/elements'
import { useThemeColor } from '@/hooks/use-theme-color'
import Snackbar from 'react-native-snackbar'
import { ellipsify } from '@/utils/ellipsify'
import { useEmbeddedWallet } from '@/hooks/use-embedded-wallet'
import {
  getTomoPDA,
  useTomoProgram,
  useTomoAccountQuery,
  useInitTomo,
  useInitAndDelegate,
  useGetCoin,
  useFeed,
  useDelegate,
  useUndelegate,
  useDeleteTomo,
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

function DelegationStatus({ isDelegated }: { isDelegated: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: isDelegated ? '#E3F2FD' : '#FFF3E0',
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: isDelegated ? '#2196F3' : '#FF9800',
        }}
      />
      <AppText style={{ color: isDelegated ? '#1565C0' : '#E65100', fontWeight: '600' }}>
        {isDelegated ? 'Delegated to Ephemeral Rollup' : 'On Base Layer (Solana)'}
      </AppText>
    </View>
  )
}

function SessionWalletStatus() {
  const { publicKey, hasWallet, isLoading } = useEmbeddedWallet()

  if (isLoading) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: '#F5F5F5',
        }}
      >
        <ActivityIndicator size="small" />
        <AppText style={{ color: '#666' }}>Loading session wallet...</AppText>
      </View>
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: hasWallet ? '#E8F5E9' : '#FFEBEE',
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: hasWallet ? '#4CAF50' : '#F44336',
        }}
      />
      <View style={{ flex: 1 }}>
        <AppText style={{ color: hasWallet ? '#2E7D32' : '#C62828', fontWeight: '600' }}>
          {hasWallet ? 'Session Wallet Active' : 'No Session Wallet'}
        </AppText>
        {hasWallet && publicKey && (
          <AppText style={{ color: '#666', fontSize: 12 }}>{ellipsify(publicKey.toString(), 8)}</AppText>
        )}
      </View>
    </View>
  )
}

interface DemoFeatureTomoProps {
  uid: string
  setUid: (uid: string) => void
}

export function DemoFeatureTomo({ uid, setUid }: DemoFeatureTomoProps) {
  const { publicKey } = useTomoProgram()
  const [activeUid, setActiveUid] = useState('')

  const backgroundColor = useThemeColor({ light: '#f0f0f0', dark: '#333333' }, 'background')
  const textColor = useThemeColor({ light: '#000000', dark: '#ffffff' }, 'text')
  const borderColor = useThemeColor({ light: '#cccccc', dark: '#555555' }, 'background')

  const tomoQuery = useTomoAccountQuery({ uid: activeUid })
  const initTomo = useInitTomo()
  const initAndDelegate = useInitAndDelegate()
  const getCoin = useGetCoin()
  const feed = useFeed()
  const delegate = useDelegate()
  const undelegate = useUndelegate()
  const deleteTomo = useDeleteTomo()

  const tomo = tomoQuery.data
  const pda = activeUid ? getTomoPDA(activeUid) : null

  const isLoading =
    initTomo.isPending ||
    initAndDelegate.isPending ||
    getCoin.isPending ||
    feed.isPending ||
    delegate.isPending ||
    undelegate.isPending ||
    deleteTomo.isPending
  const coins = tomo?.coins?.toNumber() ?? 0
  const canFeed = coins >= 10
  const isDelegated = tomo?.isDelegated ?? false

  const handleInit = () => {
    const uidValue = uid.trim()
    if (!uidValue) {
      Snackbar.show({ text: 'Please enter a UID', duration: Snackbar.LENGTH_SHORT })
      return
    }
    setActiveUid(uidValue)
    initTomo
      .mutateAsync(uidValue)
      .then((sig) => {
        Snackbar.show({ text: `Tomo initialized! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Init error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleInitAndDelegate = () => {
    const uidValue = uid.trim()
    if (!uidValue) {
      Snackbar.show({ text: 'Please enter a UID', duration: Snackbar.LENGTH_SHORT })
      return
    }
    setActiveUid(uidValue)
    initAndDelegate
      .mutateAsync(uidValue)
      .then((sig) => {
        Snackbar.show({ text: `Init + Delegate done! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Init+Delegate error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleGetCoin = () => {
    if (!activeUid) return
    getCoin
      .mutateAsync(activeUid)
      .then((sig) => {
        Snackbar.show({ text: `Got a coin! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Get coin error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleFeed = () => {
    if (!activeUid) return
    feed
      .mutateAsync(activeUid)
      .then((sig) => {
        Snackbar.show({ text: `Fed Tomo! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
      })
      .catch((err) => {
        console.error('Feed error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleDelegate = () => {
    if (!activeUid) return
    delegate
      .mutateAsync(activeUid)
      .then((sig) => {
        Snackbar.show({
          text: `Delegated to Ephemeral Rollup! ${ellipsify(sig, 8)}`,
          duration: Snackbar.LENGTH_SHORT,
        })
      })
      .catch((err) => {
        console.error('Delegate error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleUndelegate = () => {
    if (!activeUid) return
    undelegate
      .mutateAsync(activeUid)
      .then((sig) => {
        Snackbar.show({
          text: `Undelegated to Base Layer! ${ellipsify(sig, 8)}`,
          duration: Snackbar.LENGTH_SHORT,
        })
      })
      .catch((err) => {
        console.error('Undelegate error:', err)
        Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      })
  }

  const handleDelete = () => {
    if (!activeUid) return
    deleteTomo
      .mutateAsync(activeUid)
      .then((sig) => {
        Snackbar.show({
          text: `Tomo deleted! ${ellipsify(sig, 8)}`,
          duration: Snackbar.LENGTH_SHORT,
        })
        setActiveUid('')
      })
      .catch((err) => {
        console.error('Delete error:', err)
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
              Init
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={handleInitAndDelegate} disabled={isLoading || !uid.trim()} variant="filled">
              Init+Dlgt
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

          <DelegationStatus isDelegated={isDelegated} />
          <SessionWalletStatus />

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
          <View>
            <AppText type="defaultSemiBold">Actions</AppText>
            <AppText style={{ color: '#666', fontSize: 12 }}>Uses session wallet (no signature needed)</AppText>
          </View>
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

          <View style={{ marginTop: 8 }}>
            <AppText type="defaultSemiBold">Delegation</AppText>
            <AppText style={{ color: '#666', fontSize: 12 }}>Requires wallet signature</AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isLoading ? (
              <ActivityIndicator style={{ flex: 1 }} />
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Button onPress={handleDelegate} disabled={isDelegated} variant="tinted">
                    Delegate
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button onPress={handleUndelegate} disabled={!isDelegated} variant="filled">
                    Undelegate
                  </Button>
                </View>
              </>
            )}
          </View>

          <Button onPress={() => tomoQuery.refetch()} disabled={isLoading} variant="plain">
            Refresh State
          </Button>

          <View style={{ marginTop: 16 }}>
            <AppText type="defaultSemiBold" style={{ color: '#F44336' }}>Danger Zone</AppText>
            <AppText style={{ color: '#666', fontSize: 12 }}>Delete account and recover rent</AppText>
          </View>
          <View>
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <Button
                onPress={handleDelete}
                disabled={isDelegated}
                variant="filled"
                color="#F44336"
              >
                Delete Tomo
              </Button>
            )}
          </View>
          {isDelegated && (
            <AppText style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>
              Undelegate first to delete
            </AppText>
          )}
        </View>
      )}

      {(initTomo.isError ||
        initAndDelegate.isError ||
        getCoin.isError ||
        feed.isError ||
        delegate.isError ||
        undelegate.isError ||
        deleteTomo.isError) && (
        <AppText style={{ color: '#F44336', fontSize: 12, marginTop: 8 }}>
          {initTomo.error?.message ||
            initAndDelegate.error?.message ||
            getCoin.error?.message ||
            feed.error?.message ||
            delegate.error?.message ||
            undelegate.error?.message ||
            deleteTomo.error?.message}
        </AppText>
      )}
    </AppView>
  )
}
