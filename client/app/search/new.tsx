import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { StatePicker } from '../../src/components/StatePicker';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { colors, fontSize, spacing } from '../../src/theme';
import type { SearchQueryCreate, SearchQuery, MatchResult } from '../../src/types';

export default function NewSearchScreen() {
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

  const handleCreate = async () => {
    setError('');

    if (!nameLast.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!nameFirst.trim() && !nameNickname.trim()) {
      setError('Either first name or nickname is required.');
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

      const res = await api.post<{ search: SearchQuery; results: MatchResult[] }>('/api/searches', body);
      const resultCount = res.results.length;

      // Navigate to the matches for this search
      if (resultCount > 0) {
        router.replace(`/matches/${res.search.id}`);
      } else {
        router.replace('/searches');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create search.');
    } finally {
      setLoading(false);
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
        label="Apx Age"
        labelWidth={90}
        value={ageApx}
        onChangeText={setAgeApx}
        keyboardType="numeric"
        placeholder="Best guess of current age"
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
          onPress={handleCreate}
          disabled={loading}
          style={styles.submitButton}
        />
      </View>
    </ScreenContainer>
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
