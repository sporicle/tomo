import { useEffect, useCallback, useRef } from 'react'
import { View, ImageSourcePropType, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'

interface SpriteAnimation {
  row: number
  frames: number
  fps: number
  loop?: boolean
}

interface AnimatedSpriteProps {
  source: ImageSourcePropType
  frameSize?: number
  animation: SpriteAnimation
  scale?: number
  flipHorizontal?: boolean
  onAnimationComplete?: () => void
}

export function AnimatedSprite({
  source,
  frameSize = 64,
  animation,
  scale = 1,
  flipHorizontal = false,
  onAnimationComplete,
}: AnimatedSpriteProps) {
  const frameIndex = useSharedValue(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { row, frames, fps, loop = true } = animation

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    clearTimer()
    frameIndex.value = 0
    let currentFrame = 0

    const frameDuration = 1000 / fps

    intervalRef.current = setInterval(() => {
      currentFrame++

      if (currentFrame >= frames) {
        if (loop) {
          currentFrame = 0
          frameIndex.value = 0
        } else {
          clearTimer()
          if (onAnimationComplete) {
            onAnimationComplete()
          }
          return
        }
      }

      frameIndex.value = currentFrame
    }, frameDuration)

    return clearTimer
  }, [row, frames, fps, loop, frameIndex, clearTimer, onAnimationComplete])

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: -row * frameSize,
    left: -frameIndex.value * frameSize,
  }))

  const displaySize = frameSize * scale

  return (
    <View style={{ width: displaySize, height: displaySize }}>
      <View
        style={[
          styles.clipContainer,
          {
            width: frameSize,
            height: frameSize,
            transform: [{ scale }, { scaleX: flipHorizontal ? -1 : 1 }],
          },
        ]}
      >
        <Animated.Image source={source} style={animatedStyle} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  clipContainer: {
    overflow: 'hidden',
    transformOrigin: 'top left',
  },
})
