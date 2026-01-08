import React from 'react'
import { Pressable, View, Text, StyleSheet, ActivityIndicator } from 'react-native'

// Pixel art button colors
const BUTTON_COLORS = {
  primary: {
    main: '#4a90d9',
    highlight: '#6ab0f9',
    shadow: '#2a70b9',
    text: '#ffffff',
  },
  success: {
    main: '#5cb85c',
    highlight: '#7cd87c',
    shadow: '#3c983c',
    text: '#ffffff',
  },
  secondary: {
    main: '#6c757d',
    highlight: '#8c959d',
    shadow: '#4c555d',
    text: '#ffffff',
  },
  warning: {
    main: '#f0ad4e',
    highlight: '#ffcd6e',
    shadow: '#d08d2e',
    text: '#2a2a2a',
  },
}

type ButtonVariant = keyof typeof BUTTON_COLORS

interface PixelButtonProps {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  small?: boolean
}

export function PixelButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  small = false,
}: PixelButtonProps) {
  const colors = BUTTON_COLORS[variant]
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.container,
        small && styles.containerSmall,
        {
          backgroundColor: colors.shadow,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ translateY: pressed && !isDisabled ? 2 : 0 }],
        },
      ]}
    >
      {({ pressed }) => (
        <>
          {/* Top highlight edge */}
          <View
            style={[
              styles.highlight,
              small && styles.highlightSmall,
              {
                backgroundColor: pressed && !isDisabled ? colors.main : colors.highlight,
              },
            ]}
          />

          {/* Main button surface */}
          <View
            style={[
              styles.surface,
              small && styles.surfaceSmall,
              {
                backgroundColor: colors.main,
                marginTop: pressed && !isDisabled ? 0 : -2,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <View style={styles.content}>
                {icon}
                <Text
                  style={[
                    styles.text,
                    small && styles.textSmall,
                    { color: colors.text },
                  ]}
                >
                  {title}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom shadow edge */}
          <View
            style={[
              styles.shadow,
              small && styles.shadowSmall,
              {
                backgroundColor: colors.shadow,
                height: pressed && !isDisabled ? 2 : 4,
              },
            ]}
          />
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  containerSmall: {
    borderRadius: 4,
  },
  highlight: {
    height: 3,
    marginHorizontal: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  highlightSmall: {
    height: 2,
    marginHorizontal: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  surface: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surfaceSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 1,
  },
  shadow: {
    height: 4,
    marginHorizontal: 2,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  shadowSmall: {
    height: 3,
    marginHorizontal: 1,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textSmall: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
})
