import { AppText } from '@/components/app-text'
import { AppView } from '@/components/app-view'
import { AnimatedSprite } from '@/components/animated-sprite'
import { useThemeColor } from '@/hooks/use-theme-color'
import { ellipsify } from '@/utils/ellipsify'
import React, { useState, useEffect, useCallback } from 'react'
import { View, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import NfcManager, { NfcTech } from 'react-native-nfc-manager'
import Snackbar from 'react-native-snackbar'
import {
  getTomoPDA,
  useTomoProgram,
  useTomoAccountQuery,
  useInitAndDelegate,
  useGetCoin,
  useFeed,
} from '@/components/demo/use-tomo-program'

const EGG_SPRITE = require('@/assets/images/egg.png')

const EGG_ANIMATIONS = {
  idle: { row: 0, frames: 5, fps: 6, loop: true },
  hatch: { row: 1, frames: 12, fps: 8, loop: false },
}

function AnimatedEllipsis() {
  const [dots, setDots] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev % 3) + 1)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const dotString = '.'.repeat(dots)
  return (
    <AppText type="title" style={{ textAlign: 'center' }}>
      scan to play{dotString.padEnd(3, ' ')}
    </AppText>
  )
}

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

type ScreenState = 'scanning' | 'loading' | 'not_initialized' | 'hatching' | 'initialized'
type HatchPhase = 'idle' | 'final_idle' | 'hatch'

export default function TabTomoScreen() {
  const { publicKey } = useTomoProgram()
  const [screenState, setScreenState] = useState<ScreenState>('scanning')
  const [scannedUid, setScannedUid] = useState<string | null>(null)
  const [isProcessingHatch, setIsProcessingHatch] = useState(false)
  const [hatchPhase, setHatchPhase] = useState<HatchPhase>('idle')

  const backgroundColor = useThemeColor({ light: '#f0f0f0', dark: '#333333' }, 'background')
  const borderColor = useThemeColor({ light: '#cccccc', dark: '#555555' }, 'background')

  const tomoQuery = useTomoAccountQuery({ uid: scannedUid ?? '' })
  const initAndDelegate = useInitAndDelegate()
  const getCoin = useGetCoin()
  const feed = useFeed()

  const tomo = tomoQuery.data
  const pda = scannedUid ? getTomoPDA(scannedUid) : null
  const coins = tomo?.coins?.toNumber() ?? 0
  const canFeed = coins >= 10

  // Start NFC scanning
  const startNfcScan = useCallback(async () => {
    setScreenState('scanning')
    setScannedUid(null)
    setHatchPhase('idle')

    try {
      await NfcManager.requestTechnology(NfcTech.NfcA)
      const tag = await NfcManager.getTag()
      if (tag?.id) {
        setScannedUid(tag.id)
        setScreenState('loading')
      }
    } catch (err) {
      console.log('NFC scan cancelled or failed:', err)
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {})
    }
  }, [])

  // Initialize NFC manager and start scanning when tab is focused
  useFocusEffect(
    useCallback(() => {
      NfcManager.start().catch(() => {})
      startNfcScan()

      return () => {
        NfcManager.cancelTechnologyRequest().catch(() => {})
      }
    }, [startNfcScan])
  )

  // Update screen state based on query results
  useEffect(() => {
    if (!scannedUid) return
    if (screenState === 'hatching') return // Don't interrupt hatching animation

    if (tomoQuery.isLoading) {
      setScreenState('loading')
    } else if (tomoQuery.data) {
      setScreenState('initialized')
    } else if (!tomoQuery.isLoading && !tomoQuery.data) {
      setScreenState('not_initialized')
    }
  }, [scannedUid, tomoQuery.isLoading, tomoQuery.data, screenState])

  const handleHatch = async () => {
    if (!scannedUid || !publicKey || isProcessingHatch) return

    setIsProcessingHatch(true)
    try {
      await initAndDelegate.mutateAsync(scannedUid)
      // Transaction succeeded - start hatching animation sequence
      setScreenState('hatching')
      setHatchPhase('final_idle')
    } catch (err: any) {
      console.error('Hatch error:', err)
      Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
      setIsProcessingHatch(false)
    }
  }

  const handleFinalIdleComplete = useCallback(() => {
    setHatchPhase('hatch')
  }, [])

  const handleHatchComplete = useCallback(() => {
    setIsProcessingHatch(false)
    setScreenState('initialized')
    Snackbar.show({ text: 'Hatched!', duration: Snackbar.LENGTH_SHORT })
  }, [])

  const handleGetCoin = async () => {
    if (!scannedUid) return
    try {
      const sig = await getCoin.mutateAsync(scannedUid)
      Snackbar.show({ text: `Got a coin! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
    } catch (err: any) {
      console.error('Get coin error:', err)
      Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
    }
  }

  const handleFeed = async () => {
    if (!scannedUid) return
    try {
      const sig = await feed.mutateAsync(scannedUid)
      Snackbar.show({ text: `Fed Tomo! ${ellipsify(sig, 8)}`, duration: Snackbar.LENGTH_SHORT })
    } catch (err: any) {
      console.error('Feed error:', err)
      Snackbar.show({ text: `Error: ${err.message}`, duration: Snackbar.LENGTH_LONG })
    }
  }

  const handleScanAgain = () => {
    startNfcScan()
  }

  // Scanning state - centered "scan to play..."
  if (screenState === 'scanning') {
    return (
      <AppView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <AnimatedEllipsis />
        </SafeAreaView>
      </AppView>
    )
  }

  // Loading state - checking if account exists
  if (screenState === 'loading') {
    return (
      <AppView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" />
          <AppText>Looking up tomo...</AppText>
        </SafeAreaView>
      </AppView>
    )
  }

  // Not initialized state - show idle egg animation + "tap to hatch"
  if (screenState === 'not_initialized') {
    return (
      <AppView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          {isProcessingHatch ? (
            <>
              <AnimatedSprite
                source={EGG_SPRITE}
                frameSize={64}
                scale={2}
                animation={EGG_ANIMATIONS.idle}
              />
              <ActivityIndicator size="small" />
            </>
          ) : (
            <Pressable onPress={handleHatch} disabled={!publicKey}>
              <View style={{ alignItems: 'center', gap: 16 }}>
                <AnimatedSprite
                  source={EGG_SPRITE}
                  frameSize={64}
                  scale={2}
                  animation={EGG_ANIMATIONS.idle}
                />
                <AppText style={{ color: publicKey ? undefined : '#888' }}>tap to hatch</AppText>
              </View>
            </Pressable>
          )}
          {!publicKey && (
            <AppText style={{ color: '#888', textAlign: 'center' }}>
              Connect wallet to hatch
            </AppText>
          )}
        </SafeAreaView>
      </AppView>
    )
  }

  // Hatching state - play final idle cycle then hatch animation
  if (screenState === 'hatching') {
    return (
      <AppView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          {hatchPhase === 'final_idle' ? (
            <AnimatedSprite
              source={EGG_SPRITE}
              frameSize={64}
              scale={2}
              animation={{ ...EGG_ANIMATIONS.idle, loop: false }}
              onAnimationComplete={handleFinalIdleComplete}
            />
          ) : (
            <AnimatedSprite
              source={EGG_SPRITE}
              frameSize={64}
              scale={2}
              animation={EGG_ANIMATIONS.hatch}
              onAnimationComplete={handleHatchComplete}
            />
          )}
        </SafeAreaView>
      </AppView>
    )
  }

  // Initialized state - show tomo data
  return (
    <AppView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <View style={{ flex: 1, gap: 16 }}>
          {/* Tomo State Card */}
          <View
            style={{
              gap: 12,
              padding: 16,
              backgroundColor,
              borderRadius: 12,
              borderWidth: 1,
              borderColor,
            }}
          >
            <AppText type="subtitle">Tomo</AppText>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ color: '#888' }}>UID:</AppText>
                <AppText style={{ fontFamily: 'monospace' }}>{scannedUid}</AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ color: '#888' }}>PDA:</AppText>
                <AppText>{pda ? ellipsify(pda.toString(), 8) : '-'}</AppText>
              </View>
              {tomo && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText style={{ color: '#888' }}>Owner:</AppText>
                    <AppText>{ellipsify(tomo.owner.toString(), 8)}</AppText>
                  </View>
                </>
              )}
            </View>

            {tomo && (
              <>
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
              </>
            )}
          </View>

          {/* Actions */}
          {tomo && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={handleGetCoin}
                disabled={getCoin.isPending}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  backgroundColor: getCoin.isPending ? '#ccc' : '#2196F3',
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                {getCoin.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <AppText style={{ color: '#fff', fontWeight: '600' }}>Get Coin</AppText>
                )}
              </Pressable>

              <Pressable
                onPress={handleFeed}
                disabled={!canFeed || feed.isPending}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  backgroundColor: !canFeed || feed.isPending ? '#ccc' : '#4CAF50',
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                {feed.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <AppText style={{ color: '#fff', fontWeight: '600' }}>Feed (10)</AppText>
                )}
              </Pressable>
            </View>
          )}

          {/* Scan Again */}
          <Pressable
            onPress={handleScanAgain}
            style={{
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <AppText style={{ color: '#2196F3' }}>Scan Another</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </AppView>
  )
}
