import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import { Badge } from './Badge';
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
      <View style={styles.cardRow}>
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{displayName}</Text>
            {search.matchCntNew > 0 && <Badge count={search.matchCntNew} />}
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

          {search.confirmed && (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedText}>Person Found</Text>
            </View>
          )}
        </View>

        {(onEdit || onDelete) && (
          <View style={styles.icons}>
            {onEdit && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); onEdit(); }}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${displayName}`}
                style={styles.iconButton}
              >
                <FontAwesome name="pencil" size={36} color={colors.green} />
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); onDelete(); }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${displayName}`}
                style={styles.iconButton}
              >
                <FontAwesome name="trash" size={36} color={colors.error} />
              </Pressable>
            )}
          </View>
        )}
      </View>
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.green,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
});
