import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';

export default function HelpScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>Help</Text>
      <View style={styles.card}>
        <Text style={styles.body}>This is where the excellent help will be.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  body: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 26,
  },
});
