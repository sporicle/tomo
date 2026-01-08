import React from 'react'
import { View, StyleSheet, Text } from 'react-native'

// Pixel art color palette - warm retro tones
const COLORS = {
  panelBg: '#2a2a3d',
  panelBorder: '#4a4a6a',
  panelHighlight: '#5a5a7a',
  panelShadow: '#1a1a2d',
  textPrimary: '#f0e6d3',
  textSecondary: '#a0967d',
  coin: '#ffd93d',
  coinDark: '#c9a227',
  hungerFull: '#7cb342',
  hungerMid: '#fbc02d',
  hungerLow: '#e53935',
  hungerBg: '#3a3a4d',
  timeTint: '#81d4fa',
}

interface PixelHUDProps {
  coins: number
  hunger: number
  lastFed: string
}

// Pixel-art styled coin icon using views
function CoinIcon() {
  return (
    <View style={coinStyles.container}>
      <View style={coinStyles.outer}>
        <View style={coinStyles.inner}>
          <Text style={coinStyles.symbol}>$</Text>
        </View>
      </View>
    </View>
  )
}

const coinStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outer: {
    width: 18,
    height: 18,
    backgroundColor: COLORS.coinDark,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.coin,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.coinDark,
    marginTop: -1,
  },
})

// Pixel-art styled drumstick/food icon
function FoodIcon() {
  return (
    <View style={foodStyles.container}>
      <View style={foodStyles.bone} />
      <View style={foodStyles.meat} />
    </View>
  )
}

const foodStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bone: {
    position: 'absolute',
    width: 4,
    height: 12,
    backgroundColor: '#f5f5dc',
    borderRadius: 2,
    transform: [{ rotate: '-30deg' }],
    left: 3,
    top: 6,
  },
  meat: {
    position: 'absolute',
    width: 12,
    height: 10,
    backgroundColor: '#cd7f32',
    borderRadius: 5,
    right: 2,
    top: 2,
  },
})

// Pixel-art clock icon
function ClockIcon() {
  return (
    <View style={clockStyles.container}>
      <View style={clockStyles.face}>
        <View style={clockStyles.hourHand} />
        <View style={clockStyles.minuteHand} />
        <View style={clockStyles.center} />
      </View>
    </View>
  )
}

const clockStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  face: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.timeTint,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4fc3f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourHand: {
    position: 'absolute',
    width: 2,
    height: 5,
    backgroundColor: COLORS.panelShadow,
    top: 3,
  },
  minuteHand: {
    position: 'absolute',
    width: 2,
    height: 4,
    backgroundColor: COLORS.panelShadow,
    transform: [{ rotate: '90deg' }],
    left: 6,
  },
  center: {
    width: 3,
    height: 3,
    backgroundColor: COLORS.panelShadow,
    borderRadius: 1.5,
  },
})

// Pixel-style hunger bar
function HungerBar({ hunger }: { hunger: number }) {
  const fillColor = hunger > 60 ? COLORS.hungerFull : hunger > 30 ? COLORS.hungerMid : COLORS.hungerLow

  // Create segmented bar effect
  const segments = 10
  const filledSegments = Math.ceil((hunger / 100) * segments)

  return (
    <View style={hungerStyles.container}>
      <View style={hungerStyles.barContainer}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              hungerStyles.segment,
              {
                backgroundColor: i < filledSegments ? fillColor : COLORS.hungerBg,
              },
            ]}
          />
        ))}
      </View>
      <Text style={hungerStyles.text}>{hunger}</Text>
    </View>
  )
}

const hungerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  segment: {
    width: 6,
    height: 12,
    borderRadius: 1,
  },
  text: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    color: COLORS.textPrimary,
    minWidth: 24,
  },
})

// Pixel-art panel frame
function PixelPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[panelStyles.outer, style]}>
      <View style={panelStyles.highlight} />
      <View style={panelStyles.shadow} />
      <View style={panelStyles.inner}>{children}</View>
    </View>
  )
}

const panelStyles = StyleSheet.create({
  outer: {
    backgroundColor: COLORS.panelBorder,
    borderRadius: 4,
    padding: 5,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.panelHighlight,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  shadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.panelShadow,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  inner: {
    backgroundColor: COLORS.panelBg,
    borderRadius: 2,
    padding: 8,
  },
})

export function PixelHUD({ coins, hunger, lastFed }: PixelHUDProps) {
  return (
    <View style={styles.container}>
      {/* Coins display */}
      <PixelPanel>
        <View style={styles.statRow}>
          <CoinIcon />
          <Text style={styles.statValue}>{coins}</Text>
        </View>
      </PixelPanel>

      {/* Hunger display */}
      <PixelPanel>
        <View style={styles.statRow}>
          <FoodIcon />
          <HungerBar hunger={hunger} />
        </View>
      </PixelPanel>

      {/* Last fed display */}
      <PixelPanel>
        <View style={styles.statRow}>
          <ClockIcon />
          <Text style={styles.timeText}>{lastFed}</Text>
        </View>
      </PixelPanel>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  timeText: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    color: COLORS.textSecondary,
  },
})
