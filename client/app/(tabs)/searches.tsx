import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SearchCard } from '../../src/components/SearchCard';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { Button } from '../../src/components/Button';
import { colors, spacing } from '../../src/theme';
import type { SearchQuery } from '../../src/types';

export default function SearchesScreen() {
  const [searches, setSearches] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSearches = useCallback(async () => {
    try {
      const res = await api.get<{ searches: SearchQuery[] }>('/api/searches');
      setSearches(res.searches);
    } catch (err) {
      console.error('Failed to load searches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSearches();
  }, [loadSearches]);

  if (loading) {
    return <LoadingOverlay visible message="Loading searches..." />;
  }

  if (searches.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          title="No searches yet"
          subtitle="Create your first search to start monitoring obituaries."
          actionLabel="New Search"
          onAction={() => router.push('/search/new')}
        />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerActions}>
        <Button
          title="New Search"
          onPress={() => router.push('/search/new')}
        />
      </View>
      <FlatList
        data={searches}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        renderItem={({ item }) => (
          <SearchCard
            search={item}
            onPress={() => router.push(`/search/${item.id}`)}
            onViewMatches={() => router.push(`/matches/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerActions: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  list: {
    paddingHorizontal: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
});
