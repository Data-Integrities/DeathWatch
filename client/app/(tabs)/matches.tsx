import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl, Pressable, Modal, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { Button } from '../../src/components/Button';
import { SearchCard } from '../../src/components/SearchCard';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { SearchDetailModal } from '../../src/components/SearchDetailModal';
import { EditSearchModal } from '../../src/components/EditSearchModal';
import { TrialSearchModal } from '../../src/components/TrialSearchModal';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import type { SearchQuery } from '../../src/types';

const TLD_TO_COUNTRY: Record<string, string> = {
  us: 'the US',
  ca: 'Canada',
  uk: 'the UK',
  au: 'Australia',
  nz: 'New Zealand',
};

const DEFAULT_COUNTRIES = ['the US', 'Canada', 'the UK', 'Australia', 'New Zealand'];

function getCountryList(email?: string): string[] {
  const countries = [...DEFAULT_COUNTRIES];
  if (!email) return countries;
  const tld = email.split('@')[1]?.split('.').pop()?.toLowerCase() || '';
  const userCountry = TLD_TO_COUNTRY[tld];
  if (userCountry) {
    const idx = countries.indexOf(userCountry);
    if (idx > 0) {
      countries.splice(idx, 1);
      countries.unshift(userCountry);
    }
  }
  return countries;
}

function searchGroup(s: SearchQuery): number {
  // 1. Has obituary results (not confirmed)
  if (!s.confirmed && s.matchCntTotal > 0) return 0;
  // 2. No results yet (Performing daily searches...)
  if (!s.confirmed) return 1;
  // 3. Confirmed (Right Person)
  return 2;
}

function alphaCompare(a: SearchQuery, b: SearchQuery): number {
  const lastCmp = (a.nameLast || '').localeCompare(b.nameLast || '');
  if (lastCmp !== 0) return lastCmp;
  return (a.nameFirst || '').localeCompare(b.nameFirst || '');
}

function sortSearches(searches: SearchQuery[]): SearchQuery[] {
  return [...searches].sort((a, b) => {
    const groupDiff = searchGroup(a) - searchGroup(b);
    if (groupDiff !== 0) return groupDiff;
    return alphaCompare(a, b);
  });
}

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const [searches, setSearches] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const { width } = useWindowDimensions();
  const subscribeTextStyle = width < 400 ? { fontSize: 14, fontWeight: '700' as const } : undefined;
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [detailSearchId, setDetailSearchId] = useState<string | null>(null);
  const [editSearchId, setEditSearchId] = useState<string | null>(null);
  const [trialVisible, setTrialVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<{ searches: SearchQuery[] }>('/api/searches');
      setSearches(sortSearches(res.searches));
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await api.delete(`/api/searches/${id}`);
      setSearches(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [deleteTarget]);

  if (loading) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  const hasSearches = searches.length > 0;
  const countries = getCountryList(user?.email);

  const renderHeader = () => (
    <View>
      {/* Action buttons — trial/subscription-aware */}
      <View style={styles.topButtons}>
        {user?.subscriptionActive ? (
          <Button
            title="New Search"
            onPress={() => router.push('/search/new')}
          />
        ) : (user?.trialSearchesUsed ?? 0) < (user?.trialSearchesMax ?? 3) ? (
          <>
            <Button
              title="Try for Free"
              onPress={() => setTrialVisible(true)}
              style={{ flex: 1 }}
            />
            <Button
              title="Subscribe to ObitNote obituary monitoring"
              variant="secondary"
              onPress={() => router.push('/subscribe' as any)}
              style={{ flex: 1 }}
              textStyle={{ ...subscribeTextStyle, textAlign: 'center' }}
            />
          </>
        ) : (
          <Button
            title="Subscribe to ObitNote obituary monitoring"
            onPress={() => router.push('/subscribe' as any)}
            textStyle={{ ...subscribeTextStyle, textAlign: 'center' }}
          />
        )}
      </View>

      <Pressable onPress={() => setAboutVisible(true)} style={styles.aboutLinkWrap}>
        <Text style={styles.aboutLink}>About ObitNote</Text>
      </Pressable>

      {/* Section title */}
      {hasSearches && (
        <Text style={styles.sectionTitle}>{(() => { const cnt = searches.filter(s => !s.confirmed).length; return cnt === 1 ? '1 Person searched for daily' : `${cnt} People searched for daily`; })()}{'\n'}<Text style={styles.sectionSubtitle}>Tap to open</Text></Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={searches}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.noSearchesText}>No people being monitored yet.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const displayName = [item.nameFirst, item.nameLast].filter(Boolean).join(' ');
          return (
            <SearchCard
              search={item}
              onPress={() => setDetailSearchId(item.id)}
              onEdit={!item.confirmed ? () => setEditSearchId(item.id) : undefined}
              onDelete={() => setDeleteTarget({ id: item.id, name: displayName })}
            />
          );
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Search"
        body={`Delete ${deleteTarget?.name}?  This will stop monitoring for this person.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <SearchDetailModal
        visible={!!detailSearchId}
        searchId={detailSearchId}
        onClose={(shouldRefresh) => {
          setDetailSearchId(null);
          if (shouldRefresh) loadData();
        }}
        onEdit={(id) => {
          setDetailSearchId(null);
          setEditSearchId(id);
        }}
      />

      <EditSearchModal
        visible={!!editSearchId}
        searchId={editSearchId}
        onClose={(shouldRefresh) => {
          setEditSearchId(null);
          if (shouldRefresh) loadData();
        }}
      />

      <TrialSearchModal
        visible={trialVisible}
        onClose={() => { setTrialVisible(false); loadData(); refreshUser(); }}
      />

      {/* About modal */}
      <Modal visible={aboutVisible} transparent animationType="fade" onRequestClose={() => setAboutVisible(false)}>
        <View style={styles.aboutOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAboutVisible(false)} />
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>About ObitNote</Text>
            <Text style={styles.aboutText}>
              <Text style={styles.brandText}>ObitNote</Text> is an <Text style={styles.boldText}>obituary monitor and alert service</Text>.
            </Text>
            <Text style={styles.aboutText}>
              Add people's names and <Text style={styles.brandText}>ObitNote</Text> will search for them every day.  When an obituary is found in {countries.map((country, i) => (<React.Fragment key={country}>{i > 0 && i < countries.length - 1 && ', '}{i === countries.length - 1 && ', or '}{country}</React.Fragment>))}, we'll <Text style={styles.boldText}>send you a text and email</Text>.
            </Text>
            <Text style={styles.aboutText}>
              <Text style={styles.brandText}>ObitNote</Text> is <Text style={styles.boldText}>not for finding old obituaries</Text>.  For older obituaries, you can use Google.
            </Text>
            <Button title="Close" variant="secondary" onPress={() => setAboutVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  scrollContent: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  boldText: {
    fontWeight: '700',
  },
  brandText: {
    fontWeight: '700',
    color: colors.brand,
  },
  aboutLinkWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  aboutLink: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  topButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg - 12,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
  },
  noSearchesText: {
    fontSize: fontSize.base,
    color: '#444444',
  },
  aboutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 420,
    width: '100%',
    ...shadows.modal,
  },
  aboutTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.md,
  },
  aboutText: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
});
