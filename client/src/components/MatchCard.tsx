import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
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

  const cardContent = (
    <>
      <View style={styles.header}>
        <Text style={[styles.name, dismissed && styles.dismissedText]} numberOfLines={1}>{displayName}</Text>
        {!dismissed && !result.isRead && <Badge count={1} />}
      </View>

      <View style={styles.details}>
        {result.ageYears && (
          <Text style={[styles.detail, dismissed && styles.dismissedText]}>Age {result.ageYears}</Text>
        )}
        {location && (
          <Text style={[styles.detail, dismissed && styles.dismissedText]}>{location}</Text>
        )}
        {result.dod && (
          <Text style={[styles.detail, dismissed && styles.dismissedText]}>DOD: {formatDate(result.dod)}</Text>
        )}
      </View>

      {result.status === 'confirmed' && (
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedText}>Confirmed</Text>
        </View>
      )}

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
    </>
  );

  if (dismissed) {
    return (
      <View style={[styles.card, styles.dismissedCard]}>
        {cardContent}
      </View>
    );
  }

  return (
    <Link href={href as any} asChild>
      <Pressable
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
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  unread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.green,
  },
  pressed: {
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  source: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  confirmedBadge: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
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
