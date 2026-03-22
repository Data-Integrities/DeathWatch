import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, Platform, Linking, Pressable, Modal } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { api } from '../services/api/client';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingOverlay } from './LoadingOverlay';
import { buildGoogleSearchUrl } from '../utils/googleSearchUrl';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import type { MatchResult, SearchQuery } from '../types';

interface Props {
  visible: boolean;
  searchId: string | null;
  onClose: (shouldRefresh?: boolean) => void;
  onEdit?: (searchId: string) => void;
}

export function SearchDetailModal({ visible, searchId, onClose, onEdit }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [rightPersonConfirm, setRightPersonConfirm] = useState(false);
  const [wrongPersonConfirm, setWrongPersonConfirm] = useState(false);
  const [unconfirmVisible, setUnconfirmVisible] = useState(false);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  const activeResults = results.filter(r => r.status !== 'rejected');
  const hasMatches = activeResults.length > 0;

  const displayName = search ? [search.nameFirst, search.nameLast].filter(Boolean).join(' ') : '';
  const nicknameDisplay = search?.nameNickname ? ` "${search.nameNickname}"` : '';
  const fullDisplayName = search?.nameFirst
    ? `${search.nameFirst}${search.nameMiddle ? ' ' + search.nameMiddle : ''}${nicknameDisplay} ${search?.nameLast || ''}`
    : displayName;

  const loadResults = useCallback(async () => {
    if (!searchId) return;
    setLoading(true);
    try {
      const [matchRes, searchRes] = await Promise.all([
        api.get<{ results: MatchResult[] }>(`/api/matches/${searchId}`),
        api.get<{ search: SearchQuery }>(`/api/searches/${searchId}`),
      ]);
      setResults(matchRes.results);
      setSearch(searchRes.search);
      api.post(`/api/matches/${searchId}/mark-read`).catch(() => {});
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
    }
  }, [searchId]);

  useEffect(() => {
    if (visible && searchId) {
      setButtonsEnabled(false);
      loadResults();
    }
  }, [visible, searchId, loadResults]);

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
      onClose(true);
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [searchId, onClose]);

  const handleRightPerson = useCallback(async () => {
    setRightPersonConfirm(false);
    try {
      const res = await api.post<{ search: SearchQuery }>(`/api/searches/${searchId}/confirm`);
      setSearch(res.search);
      onClose(true);
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
  }, [searchId, onClose]);

  const handleWrongPerson = useCallback(async () => {
    setWrongPersonConfirm(false);
    try {
      await api.post(`/api/searches/${searchId}/reject-all`);
      loadResults();
      onClose(true);
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  }, [searchId, loadResults, onClose]);

  const handleUnconfirm = useCallback(async () => {
    setUnconfirmVisible(false);
    try {
      const res = await api.post<{ search: SearchQuery }>(`/api/searches/${searchId}/unconfirm`);
      setSearch(res.search);
      setButtonsEnabled(false);
      loadResults();
      onClose(true);
    } catch (err) {
      console.error('Failed to unconfirm:', err);
    }
  }, [searchId, loadResults, onClose]);

  if (!visible) return null;

  const details: { label: string; value: string }[] = [];
  if (search?.nameNickname) details.push({ label: 'Nickname', value: search.nameNickname });
  if (search?.nameMiddle) details.push({ label: 'Middle', value: search.nameMiddle });
  if (search?.ageApx) details.push({ label: 'Age', value: `around ${search.ageApx}` });
  if (search?.city) details.push({ label: 'City', value: search.city });
  if (search?.state) details.push({ label: 'State', value: search.state });
  if (search?.keyWords) details.push({ label: 'Keywords', value: search.keyWords });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose()}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose()} />
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : !hasMatches && !search?.confirmed ? (
            /* No matches state */
            <ScrollView style={styles.scrollInner} showsVerticalScrollIndicator={false}>
              <Text style={styles.searchCardLabel}>Your Search</Text>
              <Text style={styles.searchCardName}>{fullDisplayName.trim()}</Text>
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
              <Text style={styles.emptySubtitle}>No matches found.  We'll keep searching.  You'll be notified when new matches are found.</Text>
              <View style={styles.actionRow}>
                <Button title="Edit Search" variant="secondary" onPress={() => onEdit ? onEdit(searchId!) : onClose()} style={styles.actionBtn} />
                <Button title="Delete" variant="danger" onPress={() => setDeleteConfirm(true)} style={styles.actionBtn} />
              </View>
              <Button title="Close" variant="secondary" onPress={() => onClose()} style={styles.closeBtn} />
            </ScrollView>
          ) : (
            /* Has matches or confirmed */
            <ScrollView style={styles.scrollInner} showsVerticalScrollIndicator={false}>
              {/* Your Search card */}
              <View style={styles.searchSection}>
                <View style={styles.searchCardHeader}>
                  <Text style={styles.searchCardLabel}>Your Search</Text>
                  {!search?.confirmed && (
                    <Pressable
                      onPress={() => onEdit ? onEdit(searchId!) : onClose()}
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
                /* Google search + verdict */
                <View style={styles.googleSection}>
                  {buttonsEnabled && (
                    <View style={styles.verdictSection}>
                      <Text style={styles.verdictLabel}>Did you find the right person?</Text>
                      <View style={styles.verdictButtons}>
                        <Pressable
                          onPress={() => setRightPersonConfirm(true)}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.verdictBtn, styles.verdictBtnRight, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={styles.verdictBtnRightText}>Yes</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setWrongPersonConfirm(true)}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.verdictBtn, styles.verdictBtnWrong, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={styles.verdictBtnWrongText}>No</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {buttonsEnabled ? (
                    <>
                      <Text style={styles.googleContinue}>
                        We'll search again tomorrow and every day and notify you of any new results.
                      </Text>
                      <Pressable
                        onPress={handleSearchGoogle}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.7 }]}
                      >
                        <FontAwesome name="search" size={16} color={colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.googleButtonText}>Search Google again now</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.googleLabel}>
                        An obituary search match may have been found.
                      </Text>
                      <Text style={styles.googleHint}>
                        Tap Search Google, review results, then return here to say Right or Wrong Person was found.
                      </Text>
                      <Pressable
                        onPress={handleSearchGoogle}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.7 }]}
                      >
                        <FontAwesome name="search" size={16} color={colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.googleButtonText}>Search Google</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              <Button title="Close" variant="secondary" onPress={() => onClose()} style={styles.closeBtn} />

              <View style={styles.disclaimerWrap}>
                <Text style={styles.disclaimerText}>
                  <Text style={styles.brandText}>ObitNOTE</Text> doesn't guarantee the accuracy of search results.  Search results are provided by Google.  Use of third-party websites is subject to their own terms and privacy policies.
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
    ...shadows.modal,
  },
  scrollInner: {
    padding: spacing.lg,
  },
  loadingWrap: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.base,
    color: '#444444',
  },
  searchSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    marginBottom: spacing.sm,
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
    color: '#444444',
    marginBottom: 4,
  },
  searchCardDetail: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: 2,
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
    color: '#444444',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#444444',
    flex: 1,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: {
    alignSelf: 'flex-start',
  },
  closeBtn: {
    marginTop: spacing.sm,
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
  googleSection: {
    marginBottom: spacing.md,
  },
  googleLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  googleHint: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  googleContinue: {
    fontSize: 17,
    color: '#444444',
    marginBottom: spacing.md,
    lineHeight: 22,
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
  googleButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.white,
  },
  verdictSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  disclaimerWrap: {
    marginTop: spacing.sm,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 17,
  },
  brandText: {
    color: colors.brand,
    fontWeight: '700',
  },
});
