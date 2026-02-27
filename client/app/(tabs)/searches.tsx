import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SearchCard } from '../../src/components/SearchCard';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { Button } from '../../src/components/Button';
import { colors, fontSize, spacing } from '../../src/theme';
import type { SearchQuery } from '../../src/types';

export default function SearchesScreen() {
  const [searches, setSearches] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/searches/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadSearches();
    } catch (err) {
      console.error('Failed to delete search:', err);
      setDeleteTarget(null);
    }
  };

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
        <Text style={styles.title}>Searches</Text>
        <View style={styles.headerButtons}>
          <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.headerButton} />
          <Button title="Home" variant="secondary" onPress={() => router.replace('/matches')} style={styles.headerButton} />
          <Button title="New Search" onPress={() => router.push('/search/new')} style={styles.headerButton} />
        </View>
      </View>
      <FlatList
        data={searches}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        renderItem={({ item }) => {
          const displayName = [item.nameFirst, item.nameLast].filter(Boolean).join(' ');
          return (
            <SearchCard
              search={item}
              onPress={() => router.push(`/matches/${item.id}`)}
              onEdit={() => router.push(`/search/${item.id}`)}
              onDelete={() => setDeleteTarget({ id: item.id, name: displayName })}
            />
          );
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Search"
        body={`Are you sure you want to delete ${deleteTarget?.name}? This will stop monitoring for this person.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  headerActions: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerButton: {
    alignSelf: 'flex-start',
  },
  list: {
    paddingHorizontal: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
});
