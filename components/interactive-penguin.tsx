import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { View, StyleSheet, LayoutChangeEvent, PanResponder, GestureResponderEvent } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
} from 'react-native-reanimated'
import { AnimatedSprite } from './animated-sprite'

const PENGUIN_SPRITE = require('@/assets/images/penguin.png')

const PENGUIN_ANIMATIONS = {
  idle: { row: 0, frames: 16, fps: 4, loop: true },
  run: { row: 1, frames: 8, fps: 4, loop: true },
}

const SPRITE_SIZE = 64
const PENGUIN_SCALE = 1
const PENGUIN_DISPLAY_SIZE = SPRITE_SIZE * PENGUIN_SCALE
const FOLLOW_DISTANCE = 50 // Stop this far from finger
const MOVE_SPEED = 150 // pixels per second

interface InteractivePenguinProps {
  style?: object
}

export function InteractivePenguin({ style }: InteractivePenguinProps) {
  const [isMoving, setIsMoving] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

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
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (event: GestureResponderEvent) => {
          const { locationX, locationY } = event.nativeEvent
          const size = containerSizeRef.current
          if (size.width === 0) return

          // Calculate distance from penguin center to touch
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
            // Calculate target position: stop FOLLOW_DISTANCE away from finger
            const angle = Math.atan2(dy, dx)
            const targetCenterX = locationX - Math.cos(angle) * FOLLOW_DISTANCE
            const targetCenterY = locationY - Math.sin(angle) * FOLLOW_DISTANCE

            // Convert center to top-left and clamp to bounds
            targetX.value = Math.max(
              0,
              Math.min(targetCenterX - PENGUIN_DISPLAY_SIZE / 2, size.width - PENGUIN_DISPLAY_SIZE)
            )
            targetY.value = Math.max(
              0,
              Math.min(targetCenterY - PENGUIN_DISPLAY_SIZE / 2, size.height - PENGUIN_DISPLAY_SIZE)
            )

            setMovingState(true)
          }
        },

        onPanResponderMove: (event: GestureResponderEvent) => {
          const { locationX, locationY } = event.nativeEvent
          const size = containerSizeRef.current
          if (size.width === 0) return

          // Calculate distance from penguin center to touch
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

            // Calculate target position: stop FOLLOW_DISTANCE away from finger
            const angle = Math.atan2(dy, dx)
            const targetCenterX = locationX - Math.cos(angle) * FOLLOW_DISTANCE
            const targetCenterY = locationY - Math.sin(angle) * FOLLOW_DISTANCE

            // Convert center to top-left and clamp to bounds
            targetX.value = Math.max(
              0,
              Math.min(targetCenterX - PENGUIN_DISPLAY_SIZE / 2, size.width - PENGUIN_DISPLAY_SIZE)
            )
            targetY.value = Math.max(
              0,
              Math.min(targetCenterY - PENGUIN_DISPLAY_SIZE / 2, size.height - PENGUIN_DISPLAY_SIZE)
            )
          } else {
            // Within follow distance, stop
            if (isMovingRef.current) {
              setMovingState(false)
            }
          }
        },

        onPanResponderRelease: () => {
          setMovingState(false)
        },

        onPanResponderTerminate: () => {
          setMovingState(false)
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
        <AnimatedSprite
          source={PENGUIN_SPRITE}
          frameSize={SPRITE_SIZE}
          scale={PENGUIN_SCALE}
          animation={currentAnimation}
          flipHorizontal={shouldFlip}
        />
      </Animated.View>
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
