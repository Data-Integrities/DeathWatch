import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl, Platform, Linking, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { AppHeader } from '../../../src/components/AppHeader';
import { MatchCard } from '../../../src/components/MatchCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { Button } from '../../../src/components/Button';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { Card } from '../../../src/components/Card';
import { colors, fontSize, spacing } from '../../../src/theme';
import type { MatchResult, SearchQuery } from '../../../src/types';

export default function SearchMatchesScreen() {
  const { searchId } = useLocalSearchParams<{ searchId: string }>();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [rightPersonId, setRightPersonId] = useState<string | null>(null);
  const [wrongPersonId, setWrongPersonId] = useState<string | null>(null);
  const [deleteResultId, setDeleteResultId] = useState<string | null>(null);
  const [unconfirmId, setUnconfirmId] = useState<string | null>(null);
  const [investigatedIds, setInvestigatedIds] = useState<Set<string>>(new Set());

  const activeResults = useMemo(() => results.filter(r => r.status !== 'rejected'), [results]);
  const dismissedResults = useMemo(() => results.filter(r => r.status === 'rejected'), [results]);
  const confirmedResult = useMemo(() => results.find(r => r.status === 'confirmed'), [results]);
  const uniqueDomains = useMemo(() => {
    const domains = new Set(activeResults.map(r => r.sourceDomain).filter(Boolean));
    return [...domains].map(d => d.charAt(0).toUpperCase() + d.slice(1));
  }, [activeResults]);

  // Display name from user's search input (not from snippet data)
  const displayName = search ? [search.nameFirst, search.nameLast].filter(Boolean).join(' ') : '';
  const nicknameDisplay = search?.nameNickname ? ` "${search.nameNickname}"` : '';
  const fullDisplayName = search?.nameFirst
    ? `${search.nameFirst}${search.nameMiddle ? ' ' + search.nameMiddle : ''}${nicknameDisplay} ${search?.nameLast || ''}`
    : displayName;

  const loadResults = useCallback(async () => {
    try {
      const [matchRes, searchRes] = await Promise.all([
        api.get<{ results: MatchResult[] }>(`/api/matches/${searchId}`),
        api.get<{ search: SearchQuery }>(`/api/searches/${searchId}`),
      ]);
      setResults(matchRes.results);
      setSearch(searchRes.search);

      // Mark all as read
      api.post(`/api/matches/${searchId}/mark-read`).catch(() => {});
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchId]);

  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [loadResults])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadResults();
  }, [loadResults]);

  const handleDelete = useCallback(async () => {
    setDeleteConfirm(false);
    try {
      await api.delete(`/api/searches/${searchId}`);
      router.replace('/matches');
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [searchId]);

  const handleRestore = useCallback(async (resultId: string) => {
    setRestoringId(resultId);
    try {
      await api.post(`/api/matches/${searchId}/${resultId}/restore`);
      setResults(prev => prev.map(r =>
        r.id === resultId ? { ...r, status: 'pending' as const } : r
      ));
    } catch (err) {
      console.error('Failed to restore result:', err);
    } finally {
      setRestoringId(null);
    }
  }, [searchId]);

  const handleRightPerson = useCallback(async () => {
    if (!rightPersonId) return;
    const id = rightPersonId;
    setRightPersonId(null);
    try {
      await api.post(`/api/matches/${searchId}/${id}/confirm`);
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'confirmed' as const } : r
      ));
      if (search) {
        setSearch({ ...search, confirmed: true });
      }
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
  }, [searchId, rightPersonId]);

  const handleWrongPerson = useCallback(async () => {
    if (!wrongPersonId) return;
    const id = wrongPersonId;
    setWrongPersonId(null);
    try {
      await api.post(`/api/matches/${searchId}/${id}/reject`);
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'rejected' as const } : r
      ));
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  }, [searchId, wrongPersonId]);

  const handleWrongPersonDirect = useCallback(async (id: string) => {
    try {
      await api.post(`/api/matches/${searchId}/${id}/reject`);
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'rejected' as const } : r
      ));
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  }, [searchId]);

  const handleInvestigate = useCallback((result: MatchResult) => {
    setInvestigatedIds(prev => new Set(prev).add(result.id));
    const url = `https://${result.sourceDomain}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
  }, []);

  const handleUnconfirm = useCallback(async () => {
    if (!unconfirmId) return;
    const id = unconfirmId;
    setUnconfirmId(null);
    try {
      await api.post(`/api/matches/${searchId}/${id}/unconfirm`);
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'pending' as const } : r
      ));
      if (search) {
        setSearch({ ...search, confirmed: false });
      }
    } catch (err) {
      console.error('Failed to unconfirm:', err);
    }
  }, [searchId, search, unconfirmId]);

  const handleDeleteResult = useCallback(async () => {
    if (!deleteResultId) return;
    const id = deleteResultId;
    setDeleteResultId(null);
    try {
      await api.delete(`/api/matches/${searchId}/${id}`);
      setResults(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete result:', err);
    }
  }, [searchId, deleteResultId]);

  if (loading) {
    return <LoadingOverlay visible message="Loading results..." />;
  }

  if (results.length === 0) {
    const details: { label: string; value: string }[] = [];
    if (search?.nameNickname) details.push({ label: 'Nickname', value: search.nameNickname });
    if (search?.nameMiddle) details.push({ label: 'Middle', value: search.nameMiddle });
    if (search?.ageApx) details.push({ label: 'Age', value: `around ${search.ageApx}` });
    if (search?.city) details.push({ label: 'City', value: search.city });
    if (search?.state) details.push({ label: 'State', value: search.state });
    if (search?.keyWords) details.push({ label: 'Keywords', value: search.keyWords });

    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.emptyContent}>
          <Card>
            <Text style={styles.emptyTitle}>No matches found for {displayName}</Text>
            {details.length > 0 && (
              <View style={styles.detailsList}>
                {details.map((d, i) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{d.label}</Text>
                    <Text style={styles.detailValue}>{d.value}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.emptySubtitle}>We'll keep searching.  You'll be notified when new matches are found.</Text>
          </Card>
          <View style={styles.emptyButtons}>
            <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.emptyButton} />
            <Button title="Edit Search" variant="secondary" onPress={() => router.push(`/search/${searchId}`)} style={styles.emptyButton} />
            <Button title="Delete" variant="danger" onPress={() => setDeleteConfirm(true)} style={styles.emptyButton} />
          </View>
        </View>
        <ConfirmDialog
          visible={deleteConfirm}
          title="Delete Search"
          body={`Are you sure you want to delete ${displayName}?  This will stop monitoring for this person.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <FlatList
        data={activeResults}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Your Search card */}
            <View style={styles.searchCard}>
              <View style={styles.searchCardHeader}>
                <Text style={styles.searchCardLabel}>Your Search</Text>
                {!search?.confirmed && (
                  <Pressable
                    onPress={() => router.push(`/search/${searchId}`)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit search"
                    style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.6 }]}
                  >
                    <FontAwesome name="pencil" size={24} color={colors.green} />
                    <Text style={styles.editButtonLabel}>Edit search</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.searchCardName}>{fullDisplayName.trim()}</Text>
              {search?.ageApx != null && (
                <Text style={styles.searchCardDetail}>Around {search.ageApx} years old</Text>
              )}
              {(search?.city || search?.state) && (
                <Text style={styles.searchCardDetail}>
                  {[search?.city, search?.state].filter(Boolean).join(', ')}
                </Text>
              )}
              {search?.keyWords && (
                <Text style={styles.searchCardDetail}>Keywords: {search.keyWords}</Text>
              )}
            </View>

            <Text style={styles.title}>{activeResults.length === 1 ? '1 Obituary' : `${activeResults.length} Obituaries`} possibly found</Text>
            <Button title="Home" variant="secondary" onPress={() => router.replace('/matches')} style={styles.headerButton} />
            {confirmedResult && activeResults.length > 1 && (
              <View style={styles.confirmedBanner}>
                <Text style={styles.confirmedBannerText}>
                  Because you confirmed {displayName}'s obituary from {confirmedResult.sourceDomain ? confirmedResult.sourceDomain.charAt(0).toUpperCase() + confirmedResult.sourceDomain.slice(1) : 'this site'} as the Right Person, daily searches have stopped and you don't need to review the remaining listings, unless you want to.
                </Text>
              </View>
            )}
            {!confirmedResult && activeResults.length > 0 && (
              <Text style={styles.headerHint}>
                {activeResults.length === 1 ? 'An obituary possibly exists at this site' : 'Obituaries possibly exist at these sites'}.  Tap More Info to search obituary site.
              </Text>
            )}
            {activeResults.length === 0 && (
              <Text style={styles.noResultsText}>No obituaries found today, but we'll search again tomorrow.</Text>
            )}
          </View>
        }
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        renderItem={({ item }) => {
          const investigated = investigatedIds.has(item.id);
          return (
            <MatchCard
              result={item}
              onMoreInfo={() => handleInvestigate(item)}
              onRight={investigated ? () => setRightPersonId(item.id) : undefined}
              onWrong={investigated ? () => handleWrongPersonDirect(item.id) : undefined}
              onUnconfirm={item.status === 'confirmed' ? () => setUnconfirmId(item.id) : undefined}
            />
          );
        }}
        ListFooterComponent={
          <>
            {uniqueDomains.length > 0 && (
              <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerText}>
                  ObitNOTE is not affiliated with the following {uniqueDomains.length === 1 ? 'company' : 'companies'} : {uniqueDomains.join(', ')}.  ObitNOTE does not guarantee the accuracy of search results.  Use of third-party websites is subject to their own terms and privacy policies.
                </Text>
              </View>
            )}
            {dismissedResults.length > 0 && (
              <View style={styles.dismissedSection}>
                <Text style={styles.dismissedHeader}>Dismissed Results</Text>
                <Text style={styles.dismissedSubtext}>
                  These were marked "Wrong Person."  Tap Restore to bring one back.  Dismissed results are removed after seven days.
                </Text>
                {dismissedResults.map(item => (
                  <MatchCard
                    key={item.id}
                    result={item}
                    dismissed
                    onRestore={() => handleRestore(item.id)}
                  />
                ))}
              </View>
            )}
          </>
        }
      />
      <ConfirmDialog
        visible={!!rightPersonId}
        title="Confirm: Right Person"
        body={`Confirm this is the right person?  Searching for ${displayName || 'this person'} will stop.`}
        confirmLabel="Yes, This Is Them"
        confirmVariant="primary"
        onConfirm={handleRightPerson}
        onCancel={() => setRightPersonId(null)}
      />
      <ConfirmDialog
        visible={!!wrongPersonId}
        title="Wrong Person"
        body="Mark as wrong person?  Result will be hidden, but you can undo later."
        confirmLabel="Yes, Wrong Person"
        confirmVariant="danger"
        onConfirm={handleWrongPerson}
        onCancel={() => setWrongPersonId(null)}
      />
      <ConfirmDialog
        visible={!!deleteResultId}
        title="Delete Result"
        body={`Delete this result for ${displayName || 'this person'}?  This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteResult}
        onCancel={() => setDeleteResultId(null)}
      />
      <ConfirmDialog
        visible={!!unconfirmId}
        title="Undo Confirmation"
        body={`Searches will continue for ${fullDisplayName.trim()}.`}
        confirmLabel="Continue Searching"
        confirmVariant="primary"
        onConfirm={handleUnconfirm}
        onCancel={() => setUnconfirmId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  list: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: spacing.md,
  },
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  searchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  searchCardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.purple,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  editButtonLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.green,
  },
  searchCardName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  searchCardDetail: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: 2,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    alignSelf: 'flex-start',
  },
  noResultsText: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: spacing.md,
    lineHeight: 26,
  },
  confirmedBanner: {
    backgroundColor: '#f0f7f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c8',
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  confirmedBannerText: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 20,
  },
  headerHint: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
    marginTop: spacing.sm,
  },
  disclaimerCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 17,
  },
  dismissedSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  dismissedHeader: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  dismissedSubtext: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginBottom: spacing.md,
  },
  emptyContent: {
    padding: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  detailsList: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    width: 90,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emptyButton: {
    alignSelf: 'flex-start',
  },
});
