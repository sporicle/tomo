import { AppText } from '@/components/app-text'
import { AppView } from '@/components/app-view'
import { AnimatedSprite } from '@/components/animated-sprite'
import { InteractivePenguin } from '@/components/interactive-penguin'
import { PixelHUD } from '@/components/pixel-hud'
import { PixelButton } from '@/components/pixel-button'
import { ellipsify } from '@/utils/ellipsify'
import React, { useState, useEffect, useCallback } from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import NfcManager, { NfcTech } from 'react-native-nfc-manager'
import Snackbar from 'react-native-snackbar'
import {
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

function formatLastFedShort(timestamp: number): string {
  if (timestamp === 0) return 'Never'
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Now'
  if (diffMins < 60) return `${diffMins}m`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

type ScreenState = 'scanning' | 'loading' | 'not_initialized' | 'hatching' | 'initialized'
type HatchPhase = 'idle' | 'final_idle' | 'hatch'

export default function TabTomoScreen() {
  const { publicKey } = useTomoProgram()
  const [screenState, setScreenState] = useState<ScreenState>('scanning')
  const [scannedUid, setScannedUid] = useState<string | null>(null)
  const [isProcessingHatch, setIsProcessingHatch] = useState(false)
  const [hatchPhase, setHatchPhase] = useState<HatchPhase>('idle')

  const tomoQuery = useTomoAccountQuery({ uid: scannedUid ?? '' })
  const initAndDelegate = useInitAndDelegate()
  const getCoin = useGetCoin()
  const feed = useFeed()

  const tomo = tomoQuery.data
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

  // Initialized state - show interactive penguin
  const hunger = tomo?.hunger ?? 0
  const lastFedTime = tomo?.lastFed?.toNumber() ?? 0

  return (
    <View style={penguinStyles.container}>
      {/* Penguin play area */}
      <InteractivePenguin style={penguinStyles.playArea} />

      {/* HUD overlay */}
      <SafeAreaView style={penguinStyles.hudContainer} pointerEvents="box-none">
        <PixelHUD
          coins={coins}
          hunger={hunger}
          lastFed={formatLastFedShort(lastFedTime)}
        />
      </SafeAreaView>

      {/* Bottom action bar */}
      <SafeAreaView edges={['bottom']} style={penguinStyles.actionBar}>
        <View style={penguinStyles.actionBarInner}>
          <View style={penguinStyles.buttonRow}>
            <View style={penguinStyles.buttonWrapper}>
              <PixelButton
                title="Get Coin"
                onPress={handleGetCoin}
                variant="primary"
                loading={getCoin.isPending}
              />
            </View>
            <View style={penguinStyles.buttonWrapper}>
              <PixelButton
                title={`Feed (10)`}
                onPress={handleFeed}
                variant="success"
                disabled={!canFeed}
                loading={feed.isPending}
              />
            </View>
          </View>
          <Pressable onPress={handleScanAgain} style={penguinStyles.scanAgain}>
            <AppText style={penguinStyles.scanAgainText}>Scan Another</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const penguinStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  playArea: {
    flex: 1,
  },
  hudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopWidth: 3,
    borderTopColor: '#4a4a6a',
  },
  actionBarInner: {
    padding: 12,
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
  scanAgain: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  scanAgainText: {
    color: '#81d4fa',
    fontFamily: 'SpaceMono',
    fontSize: 12,
  },
})
