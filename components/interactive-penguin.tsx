import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  PanResponder,
  GestureResponderEvent,
  Image,
  Pressable,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { AnimatedSprite } from './animated-sprite'

const PENGUIN_SPRITE = require('@/assets/images/penguin.png')
const COIN_SPRITE = require('@/assets/images/coin.png')
const ITEMS_SPRITE = require('@/assets/images/items.png')

const PENGUIN_ANIMATIONS = {
  idle: { row: 0, frames: 16, fps: 4, loop: true },
  run: { row: 1, frames: 8, fps: 4, loop: true },
}

const SPRITE_SIZE = 64
const PENGUIN_SCALE = 1
const PENGUIN_DISPLAY_SIZE = SPRITE_SIZE * PENGUIN_SCALE
const FOLLOW_DISTANCE = 50 // Stop this far from finger
const MOVE_SPEED = 150 // pixels per second

// Coin animation constants
const COIN_SIZE = 64
const COIN_FRAMES = 10
const COIN_SCALE = 0.5
const COIN_DISPLAY_SIZE = COIN_SIZE * COIN_SCALE

// Debug mode - set to true to show hitboxes
const DEBUG_HITBOXES = false
const PRESSABLE_HITSLOP = 10
const MIN_DRAG_THRESHOLD = 30 // Must move this many pixels before drag starts

// Treasure chest constants (first frame of items spritesheet)
const CHEST_SIZE = 64
const CHEST_SCALE = 0.75
const CHEST_DISPLAY_SIZE = CHEST_SIZE * CHEST_SCALE

interface SpinningCoinProps {
  startX: number
  startY: number
  onComplete: () => void
}

function SpinningCoin({ startX, startY, onComplete }: SpinningCoinProps) {
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    // Animate coin rising and fading
    translateY.value = withTiming(-20, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    })
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(onComplete)()
        }
      })
    )

    // Spin through frames
    const frameInterval = setInterval(() => {
      setFrame((f) => (f + 1) % COIN_FRAMES)
    }, 50)

    return () => clearInterval(frameInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX - COIN_DISPLAY_SIZE / 2,
          top: startY - COIN_DISPLAY_SIZE,
          width: COIN_DISPLAY_SIZE,
          height: COIN_DISPLAY_SIZE,
          overflow: 'hidden',
        },
        animatedStyle,
      ]}
    >
      <Image
        source={COIN_SPRITE}
        style={{
          width: COIN_SIZE * COIN_FRAMES * COIN_SCALE,
          height: COIN_DISPLAY_SIZE,
          marginLeft: -frame * COIN_DISPLAY_SIZE,
        }}
      />
    </Animated.View>
  )
}

interface TreasureChestProps {
  x: number
  y: number
  onTap: () => void
}

function TreasureChest({ x, y, onTap }: TreasureChestProps) {
  const scale = useSharedValue(1)

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Bounce animation
    scale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withTiming(1, { duration: 100 })
    )
    onTap()
  }, [onTap, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - CHEST_DISPLAY_SIZE / 2,
          top: y - CHEST_DISPLAY_SIZE / 2,
          width: CHEST_DISPLAY_SIZE,
          height: CHEST_DISPLAY_SIZE,
          overflow: 'hidden',
        },
        animatedStyle,
      ]}
    >
      <Pressable onPress={handlePress}>
        <Image
          source={ITEMS_SPRITE}
          style={{
            width: CHEST_SIZE * 10 * CHEST_SCALE, // 10 frames in spritesheet
            height: CHEST_DISPLAY_SIZE,
            marginLeft: 0, // First frame is the chest
          }}
        />
      </Pressable>
    </Animated.View>
  )
}

interface InteractivePenguinProps {
  style?: object
  onTap?: () => void
  itemDrop?: boolean
  onChestTap?: () => void
}

export function InteractivePenguin({ style, onTap, itemDrop, onChestTap }: InteractivePenguinProps) {
  const [isMoving, setIsMoving] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [coins, setCoins] = useState<{ id: number; x: number; y: number }[]>([])
  const coinIdRef = useRef(0)
  const [chestPosition, setChestPosition] = useState<{ x: number; y: number } | null>(null)
  const chestSpawnedForDrop = useRef(false)

  // Penguin position (top-left of sprite)
  const positionX = useSharedValue(0)
  const positionY = useSharedValue(0)

  // Target position to move toward
  const targetX = useSharedValue(0)
  const targetY = useSharedValue(0)
  const hasTarget = useSharedValue(false)

  // Refs for PanResponder access
  const containerSizeRef = useRef(containerSize)
  containerSizeRef.current = containerSize
  const isMovingRef = useRef(false)
  const lastFrameTime = useSharedValue(0)

  // Drag threshold tracking
  const hasDragStarted = useRef(false)

  const spawnCoin = useCallback(() => {
    const penguinCenterX = positionX.value + PENGUIN_DISPLAY_SIZE / 2
    const penguinTopY = positionY.value
    const id = coinIdRef.current++
    setCoins((prev) => [...prev, { id, x: penguinCenterX, y: penguinTopY }])
  }, [positionX, positionY])

  const removeCoin = useCallback((id: number) => {
    setCoins((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handlePenguinTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    spawnCoin()
    onTap?.()
  }, [spawnCoin, onTap])

  // Spawn chest when itemDrop becomes true
  useEffect(() => {
    if (itemDrop && containerSize.width > 0 && containerSize.height > 0 && !chestSpawnedForDrop.current) {
      // Spawn in center-ish area (random within middle 40% of screen)
      const centerX = containerSize.width / 2
      const centerY = containerSize.height / 2
      const offsetX = (Math.random() - 0.5) * containerSize.width * 0.4
      const offsetY = (Math.random() - 0.5) * containerSize.height * 0.4
      setChestPosition({ x: centerX + offsetX, y: centerY + offsetY })
      chestSpawnedForDrop.current = true
    } else if (!itemDrop) {
      // Reset when itemDrop becomes false
      setChestPosition(null)
      chestSpawnedForDrop.current = false
    }
  }, [itemDrop, containerSize])

  const handleChestTap = useCallback(() => {
    onChestTap?.()
  }, [onChestTap])

  // Frame callback for consistent speed movement
  useFrameCallback((frameInfo) => {
    if (!hasTarget.value) {
      lastFrameTime.value = frameInfo.timestamp
      return
    }

    const deltaTime = lastFrameTime.value > 0 ? (frameInfo.timestamp - lastFrameTime.value) / 1000 : 0
    lastFrameTime.value = frameInfo.timestamp

    // Cap delta time to avoid huge jumps
    const dt = Math.min(deltaTime, 0.1)

    const dx = targetX.value - positionX.value
    const dy = targetY.value - positionY.value
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 1) {
      // Move toward target at constant speed
      const moveAmount = MOVE_SPEED * dt
      const ratio = Math.min(moveAmount / distance, 1)

      positionX.value = positionX.value + dx * ratio
      positionY.value = positionY.value + dy * ratio
    }
  })

  // Initialize position to center when container size is known
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      const centerX = (containerSize.width - PENGUIN_DISPLAY_SIZE) / 2
      const centerY = (containerSize.height - PENGUIN_DISPLAY_SIZE) / 2
      positionX.value = centerX
      positionY.value = centerY
      targetX.value = centerX
      targetY.value = centerY
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.width, containerSize.height])

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainerSize({ width, height })
  }, [])

  const setMovingState = (moving: boolean) => {
    setIsMoving(moving)
    isMovingRef.current = moving
    hasTarget.value = moving
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never capture initial touch - let Pressable have first chance
        onStartShouldSetPanResponder: () => false,

        // Only capture if movement exceeds threshold
        onMoveShouldSetPanResponder: (event: GestureResponderEvent, gestureState) => {
          const { dx, dy } = gestureState
          const dragDistance = Math.sqrt(dx * dx + dy * dy)
          return dragDistance >= MIN_DRAG_THRESHOLD
        },

        onPanResponderGrant: () => {
          // Drag threshold was exceeded, so we're now dragging
          hasDragStarted.current = true
        },

        onPanResponderMove: (event: GestureResponderEvent) => {
          const { locationX, locationY } = event.nativeEvent
          const size = containerSizeRef.current
          if (size.width === 0) return

          const penguinCenterX = positionX.value + PENGUIN_DISPLAY_SIZE / 2
          const penguinCenterY = positionY.value + PENGUIN_DISPLAY_SIZE / 2
          const dx = locationX - penguinCenterX
          const dy = locationY - penguinCenterY
          const distance = Math.sqrt(dx * dx + dy * dy)

          // Face toward the touch position
          if (Math.abs(dx) > 5) {
            setFacingLeft(dx < 0)
          }

          if (distance > FOLLOW_DISTANCE) {
            if (!isMovingRef.current) {
              setMovingState(true)
            }

            const angle = Math.atan2(dy, dx)
            const targetCenterX = locationX - Math.cos(angle) * FOLLOW_DISTANCE
            const targetCenterY = locationY - Math.sin(angle) * FOLLOW_DISTANCE

            targetX.value = Math.max(
              0,
              Math.min(targetCenterX - PENGUIN_DISPLAY_SIZE / 2, size.width - PENGUIN_DISPLAY_SIZE)
            )
            targetY.value = Math.max(
              0,
              Math.min(targetCenterY - PENGUIN_DISPLAY_SIZE / 2, size.height - PENGUIN_DISPLAY_SIZE)
            )
          } else {
            if (isMovingRef.current) {
              setMovingState(false)
            }
          }
        },

        onPanResponderRelease: () => {
          setMovingState(false)
          hasDragStarted.current = false
        },

        onPanResponderTerminate: () => {
          setMovingState(false)
          hasDragStarted.current = false
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: positionX.value }, { translateY: positionY.value }],
  }))

  const currentAnimation = isMoving ? PENGUIN_ANIMATIONS.run : PENGUIN_ANIMATIONS.idle
  const shouldFlip = isMoving && facingLeft

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} {...panResponder.panHandlers}>
      <Animated.View style={[styles.penguinContainer, animatedContainerStyle]}>
        {/* Debug: hitSlop area (green) */}
        {DEBUG_HITBOXES && (
          <View
            style={{
              position: 'absolute',
              top: -PRESSABLE_HITSLOP,
              left: -PRESSABLE_HITSLOP,
              width: PENGUIN_DISPLAY_SIZE + PRESSABLE_HITSLOP * 2,
              height: PENGUIN_DISPLAY_SIZE + PRESSABLE_HITSLOP * 2,
              borderWidth: 2,
              borderColor: 'green',
              backgroundColor: 'rgba(0, 255, 0, 0.1)',
            }}
            pointerEvents="none"
          />
        )}
        {/* Debug: sprite bounds (red) */}
        {DEBUG_HITBOXES && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: PENGUIN_DISPLAY_SIZE,
              height: PENGUIN_DISPLAY_SIZE,
              borderWidth: 2,
              borderColor: 'red',
            }}
            pointerEvents="none"
          />
        )}
        <Pressable
          onPress={handlePenguinTap}
          hitSlop={{
            top: PRESSABLE_HITSLOP,
            bottom: PRESSABLE_HITSLOP,
            left: PRESSABLE_HITSLOP,
            right: PRESSABLE_HITSLOP,
          }}
        >
          <AnimatedSprite
            source={PENGUIN_SPRITE}
            frameSize={SPRITE_SIZE}
            scale={PENGUIN_SCALE}
            animation={currentAnimation}
            flipHorizontal={shouldFlip}
          />
        </Pressable>
      </Animated.View>
      {coins.map((coin) => (
        <SpinningCoin
          key={coin.id}
          startX={coin.x}
          startY={coin.y}
          onComplete={() => removeCoin(coin.id)}
        />
      ))}
      {chestPosition && (
        <TreasureChest
          x={chestPosition.x}
          y={chestPosition.y}
          onTap={handleChestTap}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  penguinContainer: {
    position: 'absolute',
  },
})
