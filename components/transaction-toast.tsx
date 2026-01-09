import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { ellipsify } from '@/utils/ellipsify'

export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

interface TransactionToastProps {
  signature: string
  status: TransactionStatus
  onComplete: () => void
}

const ANIMATION_DURATION = 1500 // Total time before fade out starts
const FADE_DURATION = 300
const RISE_DISTANCE = 40

export function TransactionToast({ signature, status, onComplete }: TransactionToastProps) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Start animations once on mount - independent of status changes
  useEffect(() => {
    // Start the rise animation immediately
    Animated.timing(translateY, {
      toValue: -RISE_DISTANCE,
      duration: ANIMATION_DURATION + FADE_DURATION,
      useNativeDriver: true,
    }).start()

    // Fade out after fixed delay
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(() => {
        onCompleteRef.current()
      })
    }, ANIMATION_DURATION)

    return () => clearTimeout(fadeTimer)
  }, [translateY, opacity])

  const statusStyles = {
    confirmed: { backgroundColor: '#2d5a3d', borderColor: '#4ade80' },
    failed: { backgroundColor: '#5a2d2d', borderColor: '#ef4444' },
    pending: { backgroundColor: '#2d3a5a', borderColor: '#6b7280' },
  }[status]

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: statusStyles.backgroundColor,
          borderColor: statusStyles.borderColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.statusDot, { backgroundColor: statusStyles.borderColor }]} />
        <AppText style={styles.signature}>
          {ellipsify(signature, 4)}
        </AppText>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  signature: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
})
