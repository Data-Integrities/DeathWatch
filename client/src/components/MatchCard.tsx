import React, { useRef, useEffect } from 'react';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import type { MatchResult } from '../types';

function formatDomain(domain: string): string {
  // Capitalize first letter of domain for display
  if (!domain) return 'Unknown source';
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

interface MatchCardProps {
  result: MatchResult;
  href?: string;
  dismissed?: boolean;
  onRestore?: () => void;
  onMoreInfo?: () => void;
  onRight?: () => void;
  onWrong?: () => void;
  onDelete?: () => void;
  onUnconfirm?: () => void;
}

export function MatchCard({ result, href, dismissed, onRestore, onMoreInfo, onRight, onWrong, onDelete, onUnconfirm }: MatchCardProps) {
  const domainLabel = formatDomain(result.sourceDomain);
  const domainRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && domainRef.current) {
      const el = domainRef.current as HTMLElement;
      let timer: ReturnType<typeof setTimeout>;
      const show = () => { timer = setTimeout(() => { el.title = result.sourceDomain || ''; }, 150); };
      const hide = () => { clearTimeout(timer); el.title = ''; };
      el.addEventListener('mouseenter', show);
      el.addEventListener('mouseleave', hide);
      return () => { clearTimeout(timer); el.removeEventListener('mouseenter', show); el.removeEventListener('mouseleave', hide); };
    }
  }, [result.sourceDomain]);

  const cardContent = (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text ref={domainRef} style={[styles.domain, dismissed && styles.dismissedText]} numberOfLines={1}>
          {domainLabel}
        </Text>
      </View>
      {result.status === 'confirmed' && (
        <View style={styles.confirmedRow}>
          <Text style={styles.confirmedText}>Confirmed as Right Person</Text>
          {onUnconfirm && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onUnconfirm(); }}
              accessibilityRole="button"
              accessibilityLabel="Undo confirmation"
              style={({ pressed }) => [styles.undoButton, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}
      {!dismissed && (onMoreInfo || onDelete || onRight || onWrong) && (
        <View style={styles.actionButtons}>
          {onMoreInfo && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onMoreInfo(); }}
              accessibilityRole="button"
              accessibilityLabel="More info"
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnInfo, pressed && styles.actionBtnPressed]}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnInfoText]}>More{'\n'}Info</Text>
            </Pressable>
          )}
          {onRight && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onRight(); }}
              accessibilityRole="button"
              accessibilityLabel="Right person"
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnRight, pressed && styles.actionBtnPressed]}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnRightText]}>Right{'\n'}Person</Text>
            </Pressable>
          )}
          {onWrong && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onWrong(); }}
              accessibilityRole="button"
              accessibilityLabel="Wrong person"
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnWrong, pressed && styles.actionBtnPressed]}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnWrongText]}>Wrong{'\n'}Person</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
              accessibilityRole="button"
              accessibilityLabel="Delete result"
              style={styles.deleteButton}
            >
              <FontAwesome name="trash" size={32} color={colors.error} />
            </Pressable>
          )}
        </View>
      )}
      {dismissed && (
        <Pressable
          onPress={onRestore}
          accessibilityRole="button"
          accessibilityLabel="Restore result"
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
      onPress={() => onMoreInfo ? onMoreInfo() : (href && router.push(href as any))}
      accessibilityRole="link"
      accessibilityLabel={`Detection from ${domainLabel}`}
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
  domain: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.green,
  },
  fingerprint: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: '#444444',
    marginTop: 2,
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmedText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  undoButton: {
    padding: 4,
  },
  undoButtonText: {
    fontSize: fontSize.sm,
    color: colors.error,
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
    padding: 4,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
