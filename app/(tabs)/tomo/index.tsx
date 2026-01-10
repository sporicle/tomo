import { AppText } from '@/components/app-text'
import { AppView } from '@/components/app-view'
import { AnimatedSprite } from '@/components/animated-sprite'
import { InteractivePenguin } from '@/components/interactive-penguin'
import { PixelHUD } from '@/components/pixel-hud'
import { PixelButton } from '@/components/pixel-button'
import React, { useState, useEffect, useCallback } from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet, ImageBackground, Modal, Image, TextInput } from 'react-native'
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
  useTriggerItemDrop,
  useOpenItemDrop,
  useUseItem,
} from '@/components/demo/use-tomo-program'
import { useTomoSession } from '@/components/tomo-session-provider'
import { getWalletErrorMessage } from '@/utils/wallet-errors'

const EGG_SPRITE = require('@/assets/images/egg.png')
const BG_IMAGE = require('@/assets/images/bg.jpg')
const ITEMS_SPRITE = require('@/assets/images/items.png')
const UI_ICONS = require('@/assets/images/ui_icons.png')

// UI icon constants (64x64 sprites)
const UI_ICON_SIZE = 64
const UI_ICON_SCALE = 1

// Item sprite constants
const ITEM_SIZE = 64
const ITEM_SCALE = 0.7
const ITEM_SLOT_SIZE = 48

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

  const diffMins = Math.floor((Date.now() - timestamp * 1000) / 60000)

  if (diffMins < 1) return 'Now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
  return `${Math.floor(diffMins / 1440)}d`
}

type ScreenState = 'scanning' | 'loading' | 'not_initialized' | 'hatching' | 'initialized'
type HatchPhase = 'idle' | 'final_idle' | 'hatch'

export default function TabTomoScreen() {
  const { publicKey } = useTomoProgram()
  const { scannedUid, setScannedUid, clearSession } = useTomoSession()
  const [screenState, setScreenState] = useState<ScreenState>(() =>
    scannedUid ? 'loading' : 'scanning'
  )
  const [isProcessingHatch, setIsProcessingHatch] = useState(false)
  const [hatchPhase, setHatchPhase] = useState<HatchPhase>('idle')

  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showInventory, setShowInventory] = useState(false)

  const tomoQuery = useTomoAccountQuery({ uid: scannedUid ?? '' })
  const initAndDelegate = useInitAndDelegate()
  const getCoin = useGetCoin()
  const feed = useFeed()
  const triggerItemDrop = useTriggerItemDrop()
  const openItemDrop = useOpenItemDrop()
  const useItem = useUseItem()

  const tomo = tomoQuery.data
  const coins = tomo?.coins?.toNumber() ?? 0
  const canFeed = coins >= 10

  // Start NFC scanning
  const startNfcScan = useCallback(async () => {
    setScreenState('scanning')
    clearSession()
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
  }, [clearSession, setScannedUid])

  // Handle logout - clear session and go to scanning
  const handleLogout = useCallback(() => {
    setShowDebugPanel(false)
    clearSession()
    setScreenState('scanning')
    setHatchPhase('idle')
    // Start a new NFC scan
    NfcManager.start().catch(() => {})
    startNfcScan()
  }, [clearSession, startNfcScan])

  // Initialize NFC manager and start scanning when tab is focused (only if no session)
  useFocusEffect(
    useCallback(() => {
      NfcManager.start().catch(() => {})
      // Only start scanning if we don't have an existing session
      if (!scannedUid) {
        startNfcScan()
      }

      return () => {
        NfcManager.cancelTechnologyRequest().catch(() => {})
      }
    }, [scannedUid, startNfcScan])
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
      const errorMessage = getWalletErrorMessage(err)
      if (errorMessage) {
        console.error('Hatch error:', err)
        Snackbar.show({ text: errorMessage, duration: Snackbar.LENGTH_LONG })
      }
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

  const handleGetCoin = () => {
    if (!scannedUid) return
    // Fire and forget - toast handled automatically by mutation
    getCoin.mutateAsync(scannedUid).catch((err: any) => {
      const errorMessage = getWalletErrorMessage(err)
      if (errorMessage) {
        console.error('Get coin error:', err)
        Snackbar.show({ text: errorMessage, duration: Snackbar.LENGTH_SHORT })
      }
    })
  }

  const handleFeed = async () => {
    if (!scannedUid) return
    try {
      await feed.mutateAsync(scannedUid)
    } catch (err: any) {
      const errorMessage = getWalletErrorMessage(err)
      if (errorMessage) {
        console.error('Feed error:', err)
        Snackbar.show({ text: errorMessage, duration: Snackbar.LENGTH_SHORT })
      }
    }
  }

  const handleTriggerItemDrop = async () => {
    if (!scannedUid) return
    try {
      await triggerItemDrop.mutateAsync(scannedUid)
      setShowDebugPanel(false)
    } catch (err: any) {
      const errorMessage = getWalletErrorMessage(err)
      if (errorMessage) {
        console.error('Trigger item drop error:', err)
        Snackbar.show({ text: errorMessage, duration: Snackbar.LENGTH_SHORT })
      }
    }
  }

  const handleOpenChest = async () => {
    if (!scannedUid) return
    try {
      await openItemDrop.mutateAsync(scannedUid)
    } catch (err: any) {
      const errorMessage = getWalletErrorMessage(err)
      if (errorMessage) {
        console.error('Open item drop error:', err)
        Snackbar.show({ text: errorMessage, duration: Snackbar.LENGTH_SHORT })
      }
    }
  }

  const handleUseItem = async (index: number) => {
    if (!scannedUid) return
    const inventory = tomo?.inventory ?? []
    if (inventory[index] === 0) return // Empty slot
    try {
      await useItem.mutateAsync({ uid: scannedUid, index })
    } catch (err: any) {
      const errorMessage = getWalletErrorMessage(err)
      if (errorMessage) {
        console.error('Use item error:', err)
        Snackbar.show({ text: errorMessage, duration: Snackbar.LENGTH_SHORT })
      }
    }
  }

  // Manual UID input state
  const [manualUid, setManualUid] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)

  const handleManualUidSubmit = () => {
    if (manualUid.trim()) {
      setScannedUid(manualUid.trim())
      setScreenState('loading')
      setShowManualInput(false)
    }
  }

  // Scanning state - centered "scan to play..."
  if (screenState === 'scanning') {
    return (
      <AppView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <AnimatedEllipsis />
        </SafeAreaView>

        {/* Manual UID input at bottom */}
        <SafeAreaView edges={['bottom']} style={scanStyles.manualInputContainer}>
          {showManualInput ? (
            <View style={scanStyles.manualInputPanel}>
              <TextInput
                style={scanStyles.manualInput}
                placeholder="Enter UID"
                placeholderTextColor="#666"
                value={manualUid}
                onChangeText={setManualUid}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={scanStyles.manualInputButtons}>
                <Pressable
                  style={scanStyles.manualInputButton}
                  onPress={() => setShowManualInput(false)}
                >
                  <AppText style={scanStyles.manualInputButtonText}>Cancel</AppText>
                </Pressable>
                <Pressable
                  style={[scanStyles.manualInputButton, scanStyles.manualInputButtonPrimary]}
                  onPress={handleManualUidSubmit}
                >
                  <AppText style={scanStyles.manualInputButtonText}>Go</AppText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowManualInput(true)}>
              <AppText style={scanStyles.manualInputToggle}>Enter UID manually</AppText>
            </Pressable>
          )}
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

  // Not initialized state - show idle egg animation + hatch button
  if (screenState === 'not_initialized') {
    return (
      <AppView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <AnimatedSprite
            source={EGG_SPRITE}
            frameSize={64}
            scale={1}
            animation={EGG_ANIMATIONS.idle}
          />
          <PixelButton
            title="Hatch"
            onPress={handleHatch}
            variant="success"
            disabled={!publicKey}
            loading={isProcessingHatch}
          />
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
              scale={1}
              animation={{ ...EGG_ANIMATIONS.idle, loop: false }}
              onAnimationComplete={handleFinalIdleComplete}
            />
          ) : (
            <AnimatedSprite
              source={EGG_SPRITE}
              frameSize={64}
              scale={1}
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
  const inventory = tomo?.inventory ?? [0, 0, 0, 0, 0, 0, 0, 0]
  const itemDrop = tomo?.itemDrop ?? false

  return (
    <ImageBackground source={BG_IMAGE} style={penguinStyles.container} resizeMode="cover">
      {/* Penguin play area */}
      <InteractivePenguin
        style={penguinStyles.playArea}
        onTap={handleGetCoin}
        itemDrop={itemDrop}
        onChestTap={handleOpenChest}
      />

      {/* HUD overlay */}
      <View style={penguinStyles.hudContainer} pointerEvents="box-none">
        <PixelHUD
          coins={coins}
          hunger={hunger}
          lastFed={formatLastFedShort(lastFedTime)}
        />
      </View>

      {/* Inventory button - below HUD on left */}
      <SafeAreaView edges={['top']} style={penguinStyles.inventoryButtonContainer} pointerEvents="box-none">
        <Pressable
          onPress={() => setShowInventory(true)}
          style={penguinStyles.inventoryButton}
        >
          <View style={penguinStyles.uiIconContainer}>
            <Image
              source={UI_ICONS}
              style={{
                width: UI_ICON_SIZE * 10 * UI_ICON_SCALE,
                height: UI_ICON_SIZE * UI_ICON_SCALE,
                marginLeft: 0, // Frame 0 - inventory bag
              }}
            />
          </View>
        </Pressable>
      </SafeAreaView>

      {/* Settings button */}
      <SafeAreaView edges={['top']} style={penguinStyles.settingsButtonContainer} pointerEvents="box-none">
        <Pressable
          onPress={() => setShowDebugPanel(true)}
          style={penguinStyles.settingsButton}
        >
          <View style={penguinStyles.uiIconContainer}>
            <Image
              source={UI_ICONS}
              style={{
                width: UI_ICON_SIZE * 10 * UI_ICON_SCALE,
                height: UI_ICON_SIZE * UI_ICON_SCALE,
                marginLeft: -UI_ICON_SIZE * UI_ICON_SCALE * 1, // Frame 1 - settings wheel
              }}
            />
          </View>
        </Pressable>
      </SafeAreaView>

      {/* Debug Panel Modal */}
      <Modal
        visible={showDebugPanel}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDebugPanel(false)}
      >
        <Pressable
          style={penguinStyles.modalOverlay}
          onPress={() => setShowDebugPanel(false)}
        >
          <View style={penguinStyles.debugPanel}>
            <AppText type="subtitle" style={penguinStyles.debugTitle}>Debug</AppText>
            <PixelButton
              title="Trigger Item Drop"
              onPress={handleTriggerItemDrop}
              variant="primary"
              loading={triggerItemDrop.isPending}
            />
            <PixelButton
              title="Log Out"
              onPress={handleLogout}
              variant="secondary"
            />
          </View>
        </Pressable>
      </Modal>

      {/* Inventory Modal */}
      <Modal
        visible={showInventory}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInventory(false)}
      >
        <Pressable
          style={penguinStyles.modalOverlay}
          onPress={() => setShowInventory(false)}
        >
          <View style={penguinStyles.inventoryPanel} onStartShouldSetResponder={() => true}>
            <AppText type="subtitle" style={penguinStyles.inventoryTitle}>Inventory</AppText>
            <View style={penguinStyles.inventoryGrid}>
              {inventory.map((itemId, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleUseItem(index)}
                  disabled={itemId === 0 || useItem.isPending}
                  style={[
                    penguinStyles.inventorySlot,
                    itemId === 0 && penguinStyles.inventorySlotEmpty,
                  ]}
                >
                  {itemId > 0 && (
                    <View style={penguinStyles.inventoryItemContainer}>
                      <Image
                        source={ITEMS_SPRITE}
                        style={{
                          width: ITEM_SIZE * 10 * ITEM_SCALE,
                          height: ITEM_SIZE * ITEM_SCALE,
                          marginLeft: -ITEM_SIZE * ITEM_SCALE * itemId, // itemId 1-9 maps to frames 1-9
                        }}
                      />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <AppText style={penguinStyles.inventoryHint}>Tap an item to use it</AppText>
          </View>
        </Pressable>
      </Modal>

      {/* Bottom action bar */}
      <SafeAreaView edges={['bottom']} style={penguinStyles.actionBar}>
        <View style={penguinStyles.actionBarInner}>
          <PixelButton
            title={`Feed (10)`}
            onPress={handleFeed}
            variant="success"
            disabled={!canFeed}
            loading={feed.isPending}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  )
}

const penguinStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    overflow: 'visible',
  },
  playArea: {
    flex: 1,
  },
  hudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'visible',
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
  settingsButtonContainer: {
    position: 'absolute',
    top: 20,
    right: 0,
  },
  settingsButton: {
    padding: 8,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugPanel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    minWidth: 250,
    borderWidth: 3,
    borderColor: '#4a4a6a',
    gap: 16,
  },
  debugTitle: {
    textAlign: 'center',
    color: '#fff',
  },
  inventoryButtonContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
  },
  inventoryButton: {
    padding: 8,
    marginLeft: 8,
  },
  uiIconContainer: {
    width: UI_ICON_SIZE * UI_ICON_SCALE,
    height: UI_ICON_SIZE * UI_ICON_SCALE,
    overflow: 'hidden',
  },
  inventoryPanel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    borderWidth: 3,
    borderColor: '#4a4a6a',
    alignItems: 'center',
  },
  inventoryTitle: {
    textAlign: 'center',
    color: '#fff',
    marginBottom: 16,
  },
  inventoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: ITEM_SLOT_SIZE * 4 + 12 * 3, // 4 slots + 3 gaps
    gap: 12,
  },
  inventorySlot: {
    width: ITEM_SLOT_SIZE,
    height: ITEM_SLOT_SIZE,
    backgroundColor: '#2a2a3d',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#5a5a7a',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inventorySlotEmpty: {
    borderColor: '#3a3a4d',
    backgroundColor: '#1a1a2d',
  },
  inventoryItemContainer: {
    width: ITEM_SIZE * ITEM_SCALE,
    height: ITEM_SIZE * ITEM_SCALE,
    overflow: 'hidden',
  },
  inventoryHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 16,
  },
})

const scanStyles = StyleSheet.create({
  manualInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
  },
  manualInputToggle: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  manualInputPanel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: '#3a3a4d',
    width: '90%',
    maxWidth: 300,
  },
  manualInput: {
    backgroundColor: '#2a2a3d',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4a4a6a',
    marginBottom: 12,
  },
  manualInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  manualInputButton: {
    flex: 1,
    backgroundColor: '#3a3a4d',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  manualInputButtonPrimary: {
    backgroundColor: '#4a6a9a',
  },
  manualInputButtonText: {
    color: '#fff',
    fontSize: 14,
  },
})
