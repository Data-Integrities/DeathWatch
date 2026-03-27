import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, fontSize, spacing, shadows } from '../theme';

const MAIN_WIDTH = 600;

interface AppHeaderProps {
  minimal?: boolean;
  onHelp?: () => void;
  onSettings?: () => void;
}

export function AppHeader({ minimal, onHelp, onSettings }: AppHeaderProps = {}) {
  const { user, impersonating, stopImpersonating } = useAuth();
  const hasUnread = (user?.unreadReplyCount ?? 0) > 0;

  const handleStopImpersonating = () => {
    stopImpersonating();
    router.replace('/admin/users' as any);
  };

  return (
    <View>
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
              <Pressable onPress={onHelp || (() => router.replace('/help' as any))} accessibilityRole="button" accessibilityLabel="Help" style={styles.navItem}>
                <View>
                  <FontAwesome name="question-circle" size={20} color={colors.white} />
                  {hasUnread && <View style={styles.badgeDot} />}
                </View>
              </Pressable>
              <Pressable onPress={onSettings || (() => router.replace('/settings' as any))} accessibilityRole="button" accessibilityLabel="Settings" style={styles.navItem}>
                <Ionicons name="settings-sharp" size={20} color={colors.white} />
              </Pressable>
            </View>
          ) : onHelp ? (
            <Pressable onPress={onHelp} accessibilityRole="button" accessibilityLabel="Help" style={styles.navItem}>
              <View>
                <FontAwesome name="question-circle" size={20} color={colors.white} />
                {hasUnread && <View style={styles.badgeDot} />}
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
      {impersonating ? (
        <View style={styles.impersonationBar}>
          <Text style={styles.impersonationText}>
            Admin impersonating {impersonating}
          </Text>
          <Pressable onPress={handleStopImpersonating} style={styles.impersonationButton}>
            <Text style={styles.impersonationButtonText}>Return to Admin</Text>
          </Pressable>
        </View>
      ) : null}
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
  logoRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  logoText: {
    fontSize: fontSize.lg,
    fontWeight: '700' as const,
    color: colors.white,
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
  badgeDot: {
    position: 'absolute' as const,
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.green,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  impersonationBar: {
    backgroundColor: '#FFD600',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.md,
  },
  impersonationText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#333333',
  },
  impersonationButton: {
    backgroundColor: '#333333',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  impersonationButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
