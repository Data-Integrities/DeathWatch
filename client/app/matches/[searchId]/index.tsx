import React, { useState, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, RefreshControl, Platform, Linking, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { AppHeader } from '../../../src/components/AppHeader';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { Button } from '../../../src/components/Button';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { Card } from '../../../src/components/Card';
import { buildGoogleSearchUrl } from '../../../src/utils/googleSearchUrl';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../../src/theme';
import type { MatchResult, SearchQuery } from '../../../src/types';

export default function SearchMatchesScreen() {
  const { searchId } = useLocalSearchParams<{ searchId: string }>();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [rightPersonConfirm, setRightPersonConfirm] = useState(false);
  const [wrongPersonConfirm, setWrongPersonConfirm] = useState(false);
  const [unconfirmVisible, setUnconfirmVisible] = useState(false);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  const activeResults = results.filter(r => r.status !== 'rejected');
  const hasMatches = activeResults.length > 0;

  // Display name from user's search input
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

  const handleSearchGoogle = useCallback(() => {
    if (!search) return;
    const url = buildGoogleSearchUrl(search);
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
    setTimeout(() => setButtonsEnabled(true), 200);
  }, [search]);

  const handleDelete = useCallback(async () => {
    setDeleteConfirm(false);
    try {
      await api.delete(`/api/searches/${searchId}`);
      router.replace('/matches');
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [searchId]);

  const handleRightPerson = useCallback(async () => {
    setRightPersonConfirm(false);
    try {
      const res = await api.post<{ search: SearchQuery }>(`/api/searches/${searchId}/confirm`);
      setSearch(res.search);
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
  }, [searchId]);

  const handleWrongPerson = useCallback(async () => {
    setWrongPersonConfirm(false);
    try {
      await api.post(`/api/searches/${searchId}/reject-all`);
      // Reload to get updated results
      loadResults();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  }, [searchId, loadResults]);

  const handleUnconfirm = useCallback(async () => {
    setUnconfirmVisible(false);
    try {
      const res = await api.post<{ search: SearchQuery }>(`/api/searches/${searchId}/unconfirm`);
      setSearch(res.search);
      setButtonsEnabled(false);
      loadResults();
    } catch (err) {
      console.error('Failed to unconfirm:', err);
    }
  }, [searchId, loadResults]);

  if (loading) {
    return <LoadingOverlay visible message="Loading results..." />;
  }

  if (!hasMatches && !search?.confirmed) {
    // No matches found — same empty state as before
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
      >
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

        {/* Confirmed state */}
        {search?.confirmed ? (
          <View style={styles.confirmedSection}>
            <View style={styles.confirmedBanner}>
              <FontAwesome name="check-circle" size={20} color={colors.success} style={{ marginRight: 8 }} />
              <Text style={styles.confirmedBannerText}>
                You marked this as Right Person.  Daily searches have stopped.
              </Text>
            </View>
            <Pressable
              onPress={() => setUnconfirmVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Undo confirmation"
              style={({ pressed }) => [styles.undoLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.undoLinkText}>Undo -- resume searching</Text>
            </Pressable>
          </View>
        ) : (
          /* Search Google card */
          <View style={styles.googleCard}>
            {buttonsEnabled && (
              <View style={styles.verdictSection}>
                <Text style={styles.verdictLabel}>Did you find the right person?</Text>
                <View style={styles.verdictButtons}>
                  <Pressable
                    onPress={() => setRightPersonConfirm(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Yes"
                    style={({ pressed }) => [styles.verdictBtn, styles.verdictBtnRight, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.verdictBtnRightText}>Yes</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setWrongPersonConfirm(true)}
                    accessibilityRole="button"
                    accessibilityLabel="No"
                    style={({ pressed }) => [styles.verdictBtn, styles.verdictBtnWrong, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.verdictBtnWrongText}>No</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {buttonsEnabled ? (
              <>
                <Text style={styles.googleCardContinue}>
                  We'll search again tomorrow and every day and notify you of any new results.
                </Text>
                <Pressable
                  onPress={handleSearchGoogle}
                  accessibilityRole="button"
                  accessibilityLabel="Search Google again now"
                  style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
                >
                  <FontAwesome name="search" size={16} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.googleButtonText}>Search Google again now</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.googleCardLabel}>
                  An obituary search match may have been found.
                </Text>
                <Text style={styles.googleCardHint}>
                  Tap Search Google, review results, then return here to say Right or Wrong Person was found.
                </Text>
                <Pressable
                  onPress={handleSearchGoogle}
                  accessibilityRole="button"
                  accessibilityLabel="Search Google"
                  style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
                >
                  <FontAwesome name="search" size={16} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.googleButtonText}>Search Google</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <Button title="Home" variant="secondary" onPress={() => router.replace('/matches')} />
        </View>

        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerText}>
            <Text style={styles.brandText}>ObitNOTE</Text> doesn't guarantee the accuracy of search results.  Search results are provided by Google.  Use of third-party websites is subject to their own terms and privacy policies.
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={rightPersonConfirm}
        title="Confirm: Right Person"
        body={`Confirm this is the right person?  Searching for ${displayName || 'this person'} will stop.`}
        confirmLabel="Yes, This Is Them"
        confirmVariant="primary"
        onConfirm={handleRightPerson}
        onCancel={() => setRightPersonConfirm(false)}
      />
      <ConfirmDialog
        visible={wrongPersonConfirm}
        title="Wrong Person"
        body={`None of the Google results matched ${displayName || 'this person'}?  We'll keep searching daily.`}
        confirmLabel="Yes, Wrong Person"
        confirmVariant="danger"
        onConfirm={handleWrongPerson}
        onCancel={() => setWrongPersonConfirm(false)}
      />
      <ConfirmDialog
        visible={unconfirmVisible}
        title="Undo Confirmation"
        body={`Searches will continue for ${fullDisplayName.trim()}.`}
        confirmLabel="Continue Searching"
        confirmVariant="primary"
        onConfirm={handleUnconfirm}
        onCancel={() => setUnconfirmVisible(false)}
      />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  scrollContent: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
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
  googleCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  googleCardContinue: {
    fontSize: 17,
    color: '#444444',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  googleCardLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  googleCardHint: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  googleButtonPressed: {
    opacity: 0.7,
  },
  googleButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.white,
  },
  verdictSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  verdictLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
    backgroundColor: '#FFFF00',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verdictButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  verdictBtn: {
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictBtnRight: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  verdictBtnRightText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.white,
  },
  verdictBtnWrong: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  verdictBtnWrongText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.white,
  },
  confirmedSection: {
    marginBottom: spacing.md,
  },
  confirmedBanner: {
    backgroundColor: '#f0f7f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c8',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmedBannerText: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 20,
    flex: 1,
  },
  undoLink: {
    marginTop: spacing.sm,
    padding: 4,
    alignSelf: 'flex-start',
  },
  undoLinkText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  disclaimerCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 17,
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
  brandText: {
    color: colors.brand,
    fontWeight: '700',
  },
});
