import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface ToastProps {
  message: string;
  visible: boolean;
  onDone: () => void;
  duration?: number;
  icon?: boolean;
}

export function Toast({ message, visible, onDone, duration = 1000, icon = false }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onDone());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.content}>
        {icon && <FontAwesome name="check-circle" size={18} color={colors.white} style={styles.icon} />}
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    zIndex: 200,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});
