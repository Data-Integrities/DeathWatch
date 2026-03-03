import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import type { MatchResult } from '../types';

function formatDate(iso: string): string {
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

interface MatchCardProps {
  result: MatchResult;
  href?: string;
  dismissed?: boolean;
  onRestore?: () => void;
  onDelete?: () => void;
  onMoreInfo?: () => void;
  onRight?: () => void;
  onWrong?: () => void;
}

export function MatchCard({ result, href, dismissed, onRestore, onDelete, onMoreInfo, onRight, onWrong }: MatchCardProps) {
  const displayName = result.nameFull || [result.nameFirst, result.nameLast].filter(Boolean).join(' ') || 'Unknown';
  const locationParts = [result.city, result.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

  const detailParts = [
    result.ageYears ? `Age ${result.ageYears}` : null,
    location,
    result.dod ? `Died: ${formatDate(result.dod)}` : null,
  ].filter(Boolean);

  const cardContent = (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={[styles.name, dismissed && styles.dismissedText]} numberOfLines={2}>{displayName}</Text>
        {detailParts.length > 0 && (
          <Text style={[styles.detail, dismissed && styles.dismissedText]} numberOfLines={1}>
            {detailParts.join('  ·  ')}
          </Text>
        )}
      </View>
      {result.status === 'confirmed' && (
        <Text style={styles.confirmedText}>Confirmed</Text>
      )}
      {!dismissed && (onMoreInfo || onRight || onWrong) && (
        <View style={styles.actionButtons}>
          {onMoreInfo && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onMoreInfo(); }}
              accessibilityRole="button"
              accessibilityLabel={`More info for ${displayName}`}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnInfo, pressed && styles.actionBtnPressed]}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnInfoText]}>More{'\n'}Info</Text>
            </Pressable>
          )}
          {onRight && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onRight(); }}
              accessibilityRole="button"
              accessibilityLabel={`Right person for ${displayName}`}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnRight, pressed && styles.actionBtnPressed]}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnRightText]}>Right{'\n'}Person</Text>
            </Pressable>
          )}
          {onWrong && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onWrong(); }}
              accessibilityRole="button"
              accessibilityLabel={`Wrong person for ${displayName}`}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnWrong, pressed && styles.actionBtnPressed]}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnWrongText]}>Wrong{'\n'}Person</Text>
            </Pressable>
          )}
        </View>
      )}
      {!dismissed && onDelete && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onDelete(); }}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${displayName}`}
          style={styles.deleteButton}
        >
          <FontAwesome name="trash" size={32} color={colors.error} />
        </Pressable>
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
    color: colors.green,
  },
  detail: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
    marginTop: 2,
  },
  confirmedText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionBtnInfo: {
    borderColor: colors.green,
    backgroundColor: colors.white,
  },
  actionBtnInfoText: {
    color: colors.green,
  },
  actionBtnRight: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  actionBtnRightText: {
    color: colors.white,
  },
  actionBtnWrong: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  actionBtnWrongText: {
    color: colors.white,
  },
  deleteButton: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -5,
    marginLeft: -5,
  },
  dismissedCard: {
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
