import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import { Badge } from './Badge';
import type { SearchQuery } from '../types';

interface SearchCardProps {
  search: SearchQuery;
  onPress: () => void;
  onViewMatches?: () => void;
}

export function SearchCard({ search, onPress, onViewMatches }: SearchCardProps) {
  const displayName = [search.nameFirst, search.nameLast].filter(Boolean).join(' ');
  const locationParts = [search.city, search.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

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
      <View style={styles.header}>
        <Text style={styles.name}>{displayName}</Text>
        {search.matchCntNew > 0 && <Badge count={search.matchCntNew} />}
      </View>

      <View style={styles.details}>
        {search.nameNickname && (
          <Text style={styles.detail}>Nickname: {search.nameNickname}</Text>
        )}
        {search.ageApx && (
          <Text style={styles.detail}>Age ~{search.ageApx}</Text>
        )}
        {location && (
          <Text style={styles.detail}>{location}</Text>
        )}
      </View>

      {search.confirmed && (
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedText}>Person Found</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
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
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
});
