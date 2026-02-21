import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Entypo, Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, shadows } from '../theme';

const MAIN_WIDTH = 600;

export function AppHeader() {
  return (
    <View style={styles.headerBar}>
      <View style={styles.barContent}>
        <Pressable onPress={() => router.replace('/matches')} accessibilityRole="link" accessibilityLabel="Home">
          <Text style={styles.logoText}>ObitNOTE</Text>
        </Pressable>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.replace('/searches' as any)} accessibilityRole="link" style={styles.navItem}>
            <Text style={styles.navText}>Searches</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/matches')} accessibilityRole="link" style={styles.navItem}>
            <Text style={styles.navText}>Matches</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/help' as any)} accessibilityRole="link" accessibilityLabel="Help" style={styles.navItem}>
            <Entypo name="help" size={20} color={colors.white} />
          </Pressable>
          <Pressable onPress={() => router.replace('/settings' as any)} accessibilityRole="link" accessibilityLabel="Settings" style={styles.navItem}>
            <Ionicons name="settings-sharp" size={20} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingVertical: spacing.md,
    backgroundColor: '#663399',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' } as any : shadows.card),
  },
  barContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: '100%' as any,
    maxWidth: MAIN_WIDTH,
    alignSelf: 'center' as const,
    paddingHorizontal: spacing.md,
  },
  logoText: {
    fontSize: fontSize.lg,
    fontWeight: '700' as const,
    color: colors.white,
  },
  navRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  navItem: {
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  navText: {
    fontSize: fontSize.sm,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
