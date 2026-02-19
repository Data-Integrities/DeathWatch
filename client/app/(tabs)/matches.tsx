import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { router, Link } from 'expo-router';
import { api } from '../../src/services/api/client';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import type { MatchSummary } from '../../src/types';

export default function MatchesScreen() {
  const [summaries, setSummaries] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummaries = useCallback(async () => {
    try {
      const res = await api.get<{ summaries: MatchSummary[] }>('/api/matches');
      setSummaries(res.summaries);
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSummaries();
  }, [loadSummaries]);

  if (loading) {
    return <LoadingOverlay visible message="Loading matches..." />;
  }

  if (summaries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptySubtitle}>Create a search to start finding obituaries.</Text>
        <Button
          title="New Search"
          onPress={() => router.push('/search/new')}
          style={styles.emptyButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={summaries}
        keyExtractor={item => item.userQueryId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        renderItem={({ item }) => {
          const displayName = [item.nameFirst, item.nameLast].filter(Boolean).join(' ');
          return (
            <Link href={`/matches/${item.userQueryId}` as any} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${displayName}: ${item.matchCntTotal} matches, ${item.matchCntNew} new`}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.name}>{displayName}</Text>
                  {item.matchCntNew > 0 && <Badge count={item.matchCntNew} />}
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.detail}>
                    {item.matchCntTotal} match{item.matchCntTotal !== 1 ? 'es' : ''}
                  </Text>
                  {item.matchCntDismissed > 0 && (
                    <Text style={styles.dismissedCount}>
                      {item.matchCntDismissed} dismissed
                    </Text>
                  )}
                  {item.confirmed && (
                    <View style={styles.confirmedBadge}>
                      <Text style={styles.confirmedText}>Person Found</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
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
  cardHeader: {
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
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dismissedCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  confirmedBadge: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  confirmedText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 26,
  },
  emptyButton: {
    minWidth: 200,
  },
});
