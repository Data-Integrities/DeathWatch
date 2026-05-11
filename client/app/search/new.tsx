import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { StatePicker } from '../../src/components/StatePicker';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { BillingTallyModal } from '../../src/components/BillingTallyModal';
import { colors, fontSize, spacing } from '../../src/theme';
import type { SearchQueryCreate, SearchQuery, MatchResult } from '../../src/types';

export default function NewSearchScreen() {
  const { user } = useAuth();

  // Redirect non-subscribers to welcome page
  useEffect(() => {
    if (user && !user.subscriptionActive) {
      router.replace('/welcome');
    }
  }, [user]);
  const [nameLast, setNameLast] = useState('');
  const [nameFirst, setNameFirst] = useState('');
  const [nameNickname, setNameNickname] = useState('');
  const [nameMiddle, setNameMiddle] = useState('');
  const [nameMaiden, setNameMaiden] = useState('');
  const [ageApx, setAgeApx] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [keyWords, setKeyWords] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tallyVisible, setTallyVisible] = useState(false);
  const [uncommittedCount, setUncommittedCount] = useState(0);
  const isFirstBeyondFive = useRef(true);
  const [committing, setCommitting] = useState(false);

  const handleCreate = async () => {
    setError('');

    if (!nameLast.trim() && !nameMaiden.trim()) {
      setError('Last name or maiden name is required.');
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
        nameLast: nameLast.trim() || null,
        nameFirst: nameFirst.trim() || null,
        nameNickname: nameNickname.trim() || null,
        nameMiddle: nameMiddle.trim() || null,
        nameMaiden: nameMaiden.trim() || null,
        ageApx: ageApx ? parseInt(ageApx, 10) : null,
        city: city.trim() || null,
        state,
        keyWords: keyWords.trim() || null,
      };

      const res = await api.post<{ search: SearchQuery; results: MatchResult[]; uncommittedCount: number; billingRequired: boolean }>('/api/searches', body);

      if (res.billingRequired) {
        setUncommittedCount(res.uncommittedCount);
        setTallyVisible(true);
        // Reset form for potential next add
        setNameFirst(''); setNameLast(''); setNameNickname(''); setNameMiddle('');
        setNameMaiden(''); setAgeApx(''); setCity(''); setState(null); setKeyWords('');
      } else {
        const resultCount = res.results.length;
        if (resultCount > 0) {
          router.replace(`/matches/${res.search.id}`);
        } else {
          router.replace('/matches');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create search.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnother = () => {
    setTallyVisible(false);
    isFirstBeyondFive.current = false;
  };

  const handleDone = async () => {
    setCommitting(true);
    try {
      await api.post('/api/searches/commit', {});
      setTallyVisible(false);
      router.replace('/matches');
    } catch (err: any) {
      setError(err.message || 'Payment failed.  Your people are still being monitored.  Please try again.');
      setTallyVisible(false);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <AppHeader />
    <ScreenContainer>
      <LoadingOverlay visible={loading} message="Searching..." />

      <Text style={styles.title}>New Search</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        label="First Name"
        labelWidth={90}
        value={nameFirst}
        onChangeText={setNameFirst}
        autoCapitalize="words"
        autoComplete="off"
        autoFocus
      />

      <TextField
        label="Last Name"
        labelWidth={90}
        value={nameLast}
        onChangeText={setNameLast}
        autoCapitalize="words"
        autoComplete="off"
      />

      <TextField
        label="Maiden"
        labelWidth={90}
        value={nameMaiden}
        onChangeText={setNameMaiden}
        autoCapitalize="words"
        autoComplete="off"
        placeholder="If applicable"
      />

      <TextField
        label="Nickname"
        labelWidth={90}
        value={nameNickname}
        onChangeText={setNameNickname}
        autoCapitalize="words"
        autoComplete="off"
        placeholder="Optional"
      />

      <TextField
        label="Middle Name"
        labelWidth={90}
        value={nameMiddle}
        onChangeText={setNameMiddle}
        autoCapitalize="words"
        autoComplete="off"
        placeholder="Optional"
      />

      <TextField
        label="Approx Age"
        labelWidth={90}
        value={ageApx}
        onChangeText={v => setAgeApx(v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        autoComplete="off"
        placeholder="Best guess of age today"
      />

      <TextField
        label="Current City"
        labelWidth={90}
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
        autoComplete="off"
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
        autoComplete="off"
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
          onPress={handleCreate}
          disabled={loading}
          style={styles.submitButton}
        />
      </View>
    </ScreenContainer>

    <BillingTallyModal
      visible={tallyVisible}
      uncommittedCount={uncommittedCount}
      costPerPerson={4}
      isFirstTime={isFirstBeyondFive.current}
      onAddAnother={handleAddAnother}
      onDone={handleDone}
    />

    <LoadingOverlay visible={committing} message="Processing payment..." />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
});
