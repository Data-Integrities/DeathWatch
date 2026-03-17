import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import type { SearchQuery } from '../types';

interface SearchCardProps {
  search: SearchQuery;
  onPress: () => void;
  onViewMatches?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function SearchCard({ search, onPress, onViewMatches, onEdit, onDelete }: SearchCardProps) {
  const displayName = [search.nameFirst, search.nameLast].filter(Boolean).join(' ');
  const locationParts = [search.city, search.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;
  const hasMatchBadge = !search.confirmed && search.matchCntTotal > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Search for ${displayName}`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      {(onEdit || onDelete) && (
        <View style={styles.icons}>
          {onEdit && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onEdit(); }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${displayName}`}
              style={[styles.iconButton, styles.editButton]}
            >
              <FontAwesome name="pencil" size={32} color={colors.green} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${displayName}`}
              style={styles.iconButton}
            >
              <FontAwesome name="trash" size={32} color={colors.error} />
            </Pressable>
          )}
        </View>
      )}

      <View style={(onEdit || onDelete) ? styles.contentWithIcons : undefined}>
        <View style={styles.nameRow}>
          {search.confirmed ? (
            <FontAwesome name="check" size={14} color={colors.green} />
          ) : (
            <FontAwesome name="search" size={14} color="#444444" />
          )}
          <Text style={styles.name}>{displayName}</Text>
        </View>

        <View style={styles.details}>
          {search.nameNickname && (
            <Text style={styles.detail}>Nickname: {search.nameNickname}</Text>
          )}
          {search.ageApx && (
            <Text style={styles.detail}>Age around {search.ageApx}</Text>
          )}
          {location && (
            <Text style={styles.detail}>{location}</Text>
          )}
        </View>

        {!hasMatchBadge && (
          search.confirmed ? (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedText}>You marked this as Right Person  <Text style={styles.confirmedStopped}>Daily searches stopped.</Text></Text>
            </View>
          ) : (
            <Text style={styles.matchSearching}>No obituaries found.  Performing daily searches.</Text>
          )
        )}
      </View>

      {hasMatchBadge && (
        <View style={styles.matchBadgeHighlight}>
          {search.matchCntNew > 0 ? (
            <Text style={styles.matchBadgeHighlightText}>Possible match found</Text>
          ) : (
            <Text style={styles.matchBadgeHighlightText}>Possible match found.  <Text style={styles.matchLink}>Please open.</Text></Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.9,
  },
  contentWithIcons: {
    paddingRight: 80,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.green,
  },
  icons: {
    position: 'absolute',
    right: spacing.md - 5,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  iconButton: {
    padding: 2,
    minWidth: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    marginLeft: 0,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginLeft: 22,
    marginRight: 1,
  },
  detail: {
    fontSize: fontSize.sm,
    color: '#444444',
    fontWeight: '700',
  },
  confirmedBadge: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  confirmedText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  confirmedStopped: {
    color: '#444444',
    fontWeight: '600',
  },
  matchBadgeHighlight: {
    backgroundColor: '#FFFF00',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginLeft: 16,
  },
  matchBadgeHighlightText: {
    fontSize: fontSize.sm,
    color: '#444444',
    fontWeight: '700',
  },
  matchSubdued: {
    fontSize: fontSize.sm,
    color: '#444444',
    fontWeight: '600',
    marginTop: spacing.sm,
    marginLeft: 22,
  },
  matchLink: {
    color: colors.green,
    fontWeight: '700',
  },
  matchSearching: {
    fontSize: fontSize.sm,
    color: '#444444',
    fontWeight: '600',
    marginTop: spacing.sm,
    marginLeft: 22,
  },
});
