import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../theme';

interface BadgeProps {
  count: number;
}

export function Badge({ count }: BadgeProps) {
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : count.toString();

  return (
    <View style={styles.badge} accessibilityLabel={`${count} new`}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.badgeRed,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.badgeRedText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
