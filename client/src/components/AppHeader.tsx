import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, shadows } from '../theme';

const MAIN_WIDTH = 600;

interface AppHeaderProps {
  minimal?: boolean;
  onHelp?: () => void;
}

export function AppHeader({ minimal, onHelp }: AppHeaderProps = {}) {
  return (
    <View style={styles.headerBar}>
      <View style={styles.barContent}>
        <Pressable onPress={() => router.replace('/matches')} accessibilityRole="link" accessibilityLabel="Home">
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>ObitNOTE</Text>
            <Text style={styles.tm}>{'\u2122'}</Text>
          </View>
        </Pressable>
        {!minimal ? (
          <View style={styles.navRow}>
            <Pressable onPress={() => router.replace('/searches' as any)} accessibilityRole="link" style={styles.navItem}>
              <Text style={styles.navText}>Searches</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/matches')} accessibilityRole="link" style={styles.navItem}>
              <Text style={styles.navText}>Matches</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/help' as any)} accessibilityRole="link" accessibilityLabel="Help" style={styles.navItem}>
              <FontAwesome name="question-circle" size={20} color={colors.white} />
            </Pressable>
            <Pressable onPress={() => router.replace('/settings' as any)} accessibilityRole="link" accessibilityLabel="Settings" style={styles.navItem}>
              <Ionicons name="settings-sharp" size={20} color={colors.white} />
            </Pressable>
          </View>
        ) : onHelp ? (
          <Pressable onPress={onHelp} accessibilityRole="button" accessibilityLabel="Help" style={styles.navItem}>
            <FontAwesome name="question-circle" size={20} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.brand,
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
  logoRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  tm: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: colors.white,
    marginTop: 4,
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
