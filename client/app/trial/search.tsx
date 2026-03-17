import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { StatePicker } from '../../src/components/StatePicker';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { buildGoogleSearchUrl } from '../../src/utils/googleSearchUrl';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import type { SearchQueryCreate, MatchResult } from '../../src/types';
import { Linking } from 'react-native';

export default function TrialSearchScreen() {
  const { user, refreshUser } = useAuth();
  const { width } = useWindowDimensions();
  const subscribeTextStyle = width < 400 ? { fontSize: 14, fontWeight: '700' as const } : undefined;
  const [nameLast, setNameLast] = useState('');
  const [nameFirst, setNameFirst] = useState('');
  const [nameNickname, setNameNickname] = useState('');
  const [nameMiddle, setNameMiddle] = useState('');
  const [ageApx, setAgeApx] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [keyWords, setKeyWords] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [lastSearch, setLastSearch] = useState<SearchQueryCreate | null>(null);
  const [trialSearchId, setTrialSearchId] = useState<string | null>(null);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [verdictSent, setVerdictSent] = useState(false);
  const [rightPersonConfirm, setRightPersonConfirm] = useState(false);
  const [wrongPersonConfirm, setWrongPersonConfirm] = useState(false);
  const [trialUsed, setTrialUsed] = useState(user?.trialSearchesUsed ?? 0);
  const trialMax = user?.trialSearchesMax ?? 3;

  const trialExhausted = trialUsed >= trialMax;

  const displayName = lastSearch
    ? [lastSearch.nameFirst, lastSearch.nameLast].filter(Boolean).join(' ')
    : '';

  const resetForm = () => {
    setNameLast('');
    setNameFirst('');
    setNameNickname('');
    setNameMiddle('');
    setAgeApx('');
    setCity('');
    setState(null);
    setKeyWords('');
    setError('');
    setResults(null);
    setLastSearch(null);
    setTrialSearchId(null);
    setButtonsEnabled(false);
    setVerdictSent(false);
  };

  const handleSearch = async () => {
    setError('');

    if (!nameLast.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!nameFirst.trim() && !nameNickname.trim()) {
      setError('Either first name or nickname is required.');
      return;
    }
    if (!ageApx.trim()) {
      setError('Approximate age is required.');
      return;
    }

    setLoading(true);
    try {
      const body: SearchQueryCreate = {
        nameLast: nameLast.trim(),
        nameFirst: nameFirst.trim() || null,
        nameNickname: nameNickname.trim() || null,
        nameMiddle: nameMiddle.trim() || null,
        ageApx: ageApx ? parseInt(ageApx, 10) : null,
        city: city.trim() || null,
        state,
        keyWords: keyWords.trim() || null,
      };

      const res = await api.post<{ trialSearchId: string; results: MatchResult[]; trialSearchesUsed: number; trialSearchesMax: number }>('/api/trial/search', body);
      setLastSearch(body);
      setTrialSearchId(res.trialSearchId);
      setResults(res.results);
      setTrialUsed(res.trialSearchesUsed);
      setButtonsEnabled(false);
      setVerdictSent(false);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchGoogle = () => {
    if (!lastSearch) return;
    const url = buildGoogleSearchUrl(lastSearch as any);
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
    setTimeout(() => setButtonsEnabled(true), 200);
  };

  const handleRightPerson = async () => {
    setRightPersonConfirm(false);
    if (!trialSearchId) return;
    try {
      await api.post(`/api/trial/${trialSearchId}/verdict`, { verdict: 'right_person' });
      setVerdictSent(true);
    } catch (err) {
      console.error('Failed to record verdict:', err);
    }
  };

  const handleWrongPerson = async () => {
    setWrongPersonConfirm(false);
    if (!trialSearchId) return;
    try {
      await api.post(`/api/trial/${trialSearchId}/verdict`, { verdict: 'wrong_person' });
      setVerdictSent(true);
    } catch (err) {
      console.error('Failed to record verdict:', err);
    }
  };

  // Results view
  if (results !== null) {
    const remaining = trialMax - trialUsed;
    const hasResults = results.length > 0;
    return (
      <View style={{ flex: 1 }}>
        <AppHeader />
        <ScreenContainer style={styles.content}>
          <Text style={styles.title}>Trial Search Results</Text>

          {!hasResults ? (
            <Card style={styles.resultCard}>
              <Text style={styles.resultText}>
                No obituaries found for this person.  This could mean the person is still alive, or their obituary hasn't been indexed yet.
              </Text>
            </Card>
          ) : (
            <Card style={styles.resultCard}>
              {buttonsEnabled && !verdictSent && (
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

              {verdictSent && (
                <View style={styles.verdictSentSection}>
                  <Text style={styles.verdictSentText}>Thank you for your feedback.</Text>
                </View>
              )}

              <Text style={styles.resultTitle}>
                {results.length === 1 ? '1 possible obituary found' : `${results.length} possible obituaries found`}
              </Text>

              {buttonsEnabled ? (
                <Pressable
                  onPress={handleSearchGoogle}
                  accessibilityRole="button"
                  accessibilityLabel="Search Google again now"
                  style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.googleButtonText}>Search Google again now</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleSearchGoogle}
                  accessibilityRole="button"
                  accessibilityLabel="Search Google"
                  style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.googleButtonText}>Search Google</Text>
                </Pressable>
              )}
            </Card>
          )}

          <Text style={styles.resultNote}>
            This is a one-time trial search.  Subscribe to ObitNOTE and we'll search for your people daily and notify you when found.
          </Text>

          <View style={styles.resultButtons}>
            {remaining > 0 && (
              <Button
                title={`Search again (${remaining} remaining)`}
                variant="secondary"
                onPress={resetForm}
                style={styles.resultButton}
              />
            )}
            <Button
              title="Subscribe to ObitNOTE obituary monitoring"
              variant="primary"
              onPress={() => router.push('/subscribe' as any)}
              style={styles.resultButton}
              textStyle={subscribeTextStyle}
            />
            <Button
              title="Back to Home"
              variant="ghost"
              onPress={() => router.replace('/matches')}
              style={styles.resultButton}
            />
          </View>
        </ScreenContainer>

        <ConfirmDialog
          visible={rightPersonConfirm}
          title="Right Person"
          body={`You found the right person for ${displayName}?`}
          confirmLabel="Yes, Right Person"
          confirmVariant="primary"
          onConfirm={handleRightPerson}
          onCancel={() => setRightPersonConfirm(false)}
        />
        <ConfirmDialog
          visible={wrongPersonConfirm}
          title="Wrong Person"
          body={`None of the Google results matched ${displayName}?`}
          confirmLabel="Yes, Wrong Person"
          confirmVariant="danger"
          onConfirm={handleWrongPerson}
          onCancel={() => setWrongPersonConfirm(false)}
        />
      </View>
    );
  }

  // Trial exhausted view
  if (trialExhausted) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader />
        <ScreenContainer style={styles.content}>
          <Text style={styles.title}>Free Trial Complete</Text>
          <Card style={styles.resultCard}>
            <Text style={styles.resultText}>
              You've used all {trialMax} free trial searches.  Subscribe to start monitoring people daily and receive notifications when new obituaries are found.
            </Text>
          </Card>
          <View style={styles.resultButtons}>
            <Button
              title="Subscribe to ObitNOTE obituary monitoring"
              variant="primary"
              onPress={() => router.push('/subscribe' as any)}
              style={styles.resultButton}
              textStyle={subscribeTextStyle}
            />
            <Button
              title="Back to Home"
              variant="ghost"
              onPress={() => router.replace('/matches')}
              style={styles.resultButton}
            />
          </View>
        </ScreenContainer>
      </View>
    );
  }

  // Search form
  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <ScreenContainer>
        <LoadingOverlay visible={loading} message="Searching..." />

        <Text style={styles.title}>Free Trial Search</Text>
        <Text style={styles.hint}>Enter someone you know who has <Text style={styles.hintHighlight}>already passed away</Text>.</Text>
        <Text style={styles.counter}>Search {trialUsed + 1} of {trialMax} free tries</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextField
          label="First Name"
          labelWidth={90}
          value={nameFirst}
          onChangeText={setNameFirst}
          autoCapitalize="words"
          autoFocus
        />

        <TextField
          label="Last Name"
          labelWidth={90}
          value={nameLast}
          onChangeText={setNameLast}
          autoCapitalize="words"
        />

        <TextField
          label="Nickname"
          labelWidth={90}
          value={nameNickname}
          onChangeText={setNameNickname}
          autoCapitalize="words"
          placeholder="Optional"
        />

        <TextField
          label="Middle"
          labelWidth={90}
          value={nameMiddle}
          onChangeText={setNameMiddle}
          autoCapitalize="words"
          placeholder="Optional"
        />

        <TextField
          label="Approx Age"
          labelWidth={90}
          value={ageApx}
          onChangeText={v => setAgeApx(v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="Best guess of age today"
        />

        <TextField
          label="City"
          labelWidth={90}
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
          placeholder="Best guess or nearest larger city"
        />

        <StatePicker
          value={state}
          onChange={setState}
          city={city}
          onCityChange={setCity}
          labelWidth={90}
          openOnFocus
        />

        <TextField
          label="Keywords"
          labelWidth={90}
          value={keyWords}
          onChangeText={setKeyWords}
          placeholder="Optional (e.g. Air Force, teacher, etc.)"
        />

        <View style={styles.buttons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.cancelButton}
          />
          <Button
            title="Search Now"
            onPress={handleSearch}
            disabled={loading}
            style={styles.submitButton}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  hintHighlight: {
    backgroundColor: '#FFFF00',
  },
  counter: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.brand,
    marginTop: 5,
    marginBottom: spacing.md,
  },
  error: {
    fontSize: fontSize.base,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
    marginTop: spacing.md,
  },
  cancelButton: {
    paddingHorizontal: 20,
  },
  submitButton: {
    flex: 1,
  },
  resultCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  resultText: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
  },
  resultNote: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  resultButtons: {
    gap: spacing.sm,
  },
  resultButton: {
    width: '100%',
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
  verdictSentSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  verdictSentText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.success,
  },
});
