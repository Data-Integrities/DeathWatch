import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { StatePicker } from '../../src/components/StatePicker';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing } from '../../src/theme';
import type { SearchQuery } from '../../src/types';

export default function EditSearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [nameLast, setNameLast] = useState('');
  const [nameFirst, setNameFirst] = useState('');
  const [nameNickname, setNameNickname] = useState('');
  const [nameMiddle, setNameMiddle] = useState('');
  const [ageApx, setAgeApx] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [keyWords, setKeyWords] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    loadSearch();
  }, [id]);

  const loadSearch = async () => {
    try {
      const res = await api.get<{ search: SearchQuery }>(`/api/searches/${id}`);
      setSearch(res.search);
      setNameLast(res.search.nameLast || '');
      setNameFirst(res.search.nameFirst || '');
      setNameNickname(res.search.nameNickname || '');
      setNameMiddle(res.search.nameMiddle || '');
      setAgeApx(res.search.ageApx?.toString() || '');
      setCity(res.search.city || '');
      setState(res.search.state);
      setKeyWords(res.search.keyWords || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load search.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!nameLast.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!nameFirst.trim() && !nameNickname.trim()) {
      setError('Either first name or nickname is required.');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/searches/${id}`, {
        nameLast: nameLast.trim(),
        nameFirst: nameFirst.trim() || null,
        nameNickname: nameNickname.trim() || null,
        nameMiddle: nameMiddle.trim() || null,
        ageApx: ageApx ? parseInt(ageApx, 10) : null,
        city: city.trim() || null,
        state,
        keyWords: keyWords.trim() || null,
      });
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirm(false);
    setSaving(true);
    try {
      await api.delete(`/api/searches/${id}`);
      router.replace('/searches');
    } catch (err: any) {
      setError(err.message || 'Failed to delete search.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  if (search?.confirmed) {
    return (
      <ScreenContainer>
        <Button title="Home" variant="ghost" onPress={() => router.replace('/matches')} style={styles.homeButton} />
        <Text style={styles.title}>Search Complete</Text>
        <Text style={styles.subtitle}>
          This search has been confirmed — the person was found. No further edits are possible.
        </Text>
        <Button title="View Matches" onPress={() => router.push(`/matches/${id}`)} />
        <Button title="Back" onPress={() => router.back()} variant="ghost" style={styles.backButton} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Button title="Home" variant="ghost" onPress={() => router.replace('/matches')} style={styles.homeButton} />
      <Text style={styles.title}>Edit Search</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField label="First Name" value={nameFirst} onChangeText={setNameFirst} autoCapitalize="words" helperText="Required unless nickname is provided" />
      <TextField label="Last Name" value={nameLast} onChangeText={setNameLast} autoCapitalize="words" />
      <TextField label="Nickname" value={nameNickname} onChangeText={setNameNickname} autoCapitalize="words" helperText="Examples: Butch, Bud, Snake, Buster" />
      <TextField label="Middle Name or Initial" value={nameMiddle} onChangeText={setNameMiddle} autoCapitalize="words" />
      <TextField label="Approximate Age" value={ageApx} onChangeText={setAgeApx} keyboardType="numeric" helperText="Most people don't know the exact age. That's fine." />
      <TextField label="City" value={city} onChangeText={setCity} autoCapitalize="words" helperText="Last known city" />
      <StatePicker value={state} onChange={setState} />
      <TextField label="Keywords" value={keyWords} onChangeText={setKeyWords} helperText="Optional: comma-separated keywords" />

      <Button title="Save Changes" onPress={handleSave} loading={saving} style={styles.saveButton} />
      <Button title="View Matches" onPress={() => router.push(`/matches/${id}`)} variant="secondary" style={styles.matchesButton} />
      <Button title="Delete Search" onPress={() => setDeleteConfirm(true)} variant="danger" style={styles.deleteButton} />
      <Button title="Cancel" onPress={() => router.back()} variant="ghost" />

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete Search"
        body="Are you sure you want to delete this search? This will stop monitoring for this person."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  error: {
    fontSize: fontSize.base,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  homeButton: {
    alignSelf: 'flex-start' as const,
    marginBottom: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  matchesButton: {
    marginBottom: spacing.sm,
  },
  deleteButton: {
    marginBottom: spacing.sm,
  },
  backButton: {
    marginTop: spacing.sm,
  },
});
