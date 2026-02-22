import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import { Badge } from './Badge';
import type { MatchResult } from '../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

interface MatchCardProps {
  result: MatchResult;
  href?: string;
  dismissed?: boolean;
  onRestore?: () => void;
}

export function MatchCard({ result, href, dismissed, onRestore }: MatchCardProps) {
  const displayName = result.nameFull || [result.nameFirst, result.nameLast].filter(Boolean).join(' ') || 'Unknown';
  const locationParts = [result.city, result.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

  const detailParts = [
    result.ageYears ? `Age ${result.ageYears}` : null,
    location,
    result.dod ? `DOD: ${formatDate(result.dod)}` : null,
  ].filter(Boolean);

  const cardContent = (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={[styles.name, dismissed && styles.dismissedText]} numberOfLines={1}>{displayName}</Text>
        {detailParts.length > 0 && (
          <Text style={[styles.detail, dismissed && styles.dismissedText]} numberOfLines={1}>
            {detailParts.join('  ·  ')}
          </Text>
        )}
      </View>
      {result.status === 'confirmed' && (
        <Text style={styles.confirmedText}>Confirmed</Text>
      )}
      {!dismissed && !result.isRead && <Badge count={1} />}
      {dismissed && (
        <Pressable
          onPress={onRestore}
          accessibilityRole="button"
          accessibilityLabel={`Restore ${displayName}`}
          style={({ pressed }) => [styles.restoreButton, pressed && styles.restoreButtonPressed]}
        >
          <Text style={styles.restoreButtonText}>Restore</Text>
        </Pressable>
      )}
    </View>
  );

  if (dismissed) {
    return (
      <View style={[styles.card, styles.dismissedCard]}>
        {cardContent}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => href && router.push(href as any)}
      accessibilityRole="link"
      accessibilityLabel={`View obituary for ${displayName}`}
      style={({ pressed }) => [
        styles.card,
        !result.isRead && styles.unread,
        pressed && styles.pressed,
      ]}
    >
      {cardContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  unread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.green,
  },
  pressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  confirmedText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  dismissedCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.textMuted,
  },
  dismissedText: {
    color: colors.textMuted,
  },
  restoreButton: {
    backgroundColor: colors.greenLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  restoreButtonPressed: {
    opacity: 0.8,
  },
  restoreButtonText: {
    fontSize: fontSize.base,
    color: colors.white,
    fontWeight: '700',
  },
});
