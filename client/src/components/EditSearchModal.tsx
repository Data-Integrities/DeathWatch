import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { api } from '../services/api/client';
import { TextField } from './TextField';
import { Button } from './Button';
import { StatePicker } from './StatePicker';
import { ConfirmDialog } from './ConfirmDialog';
import { Toast } from './Toast';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import type { SearchQuery } from '../types';

interface Props {
  visible: boolean;
  searchId: string | null;
  onClose: (shouldRefresh?: boolean) => void;
}

export function EditSearchModal({ visible, searchId, onClose }: Props) {
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
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (visible && searchId) {
      setError('');
      setToast('');
      setLoading(true);
      api.get<{ search: SearchQuery }>(`/api/searches/${searchId}`)
        .then(res => {
          setNameLast(res.search.nameLast || '');
          setNameFirst(res.search.nameFirst || '');
          setNameNickname(res.search.nameNickname || '');
          setNameMiddle(res.search.nameMiddle || '');
          setAgeApx(res.search.ageApx?.toString() || '');
          setCity(res.search.city || '');
          setState(res.search.state);
          setKeyWords(res.search.keyWords || '');
        })
        .catch((err: any) => setError(err.message || 'Failed to load search.'))
        .finally(() => setLoading(false));
    }
  }, [visible, searchId]);

  const handleSave = async () => {
    setError('');
    if (!nameLast.trim()) { setError('Last name is required.'); return; }
    if (!nameFirst.trim() && !nameNickname.trim()) { setError('Either first name or nickname is required.'); return; }
    if (!ageApx.trim()) { setError('Approximate age is required.'); return; }

    setSaving(true);
    try {
      await api.patch(`/api/searches/${searchId}`, {
        nameLast: nameLast.trim(),
        nameFirst: nameFirst.trim() || null,
        nameNickname: nameNickname.trim() || null,
        nameMiddle: nameMiddle.trim() || null,
        ageApx: ageApx ? parseInt(ageApx, 10) : null,
        city: city.trim() || null,
        state,
        keyWords: keyWords.trim() || null,
      });
      setToast('Saved');
      setTimeout(() => onClose(true), 1400);
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
      await api.delete(`/api/searches/${searchId}`);
      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete search.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose()}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose()} />
        <View style={styles.card}>
          <Toast message={toast} visible={!!toast} onDone={() => setToast('')} />
          {loading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollInner} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Edit Search</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TextField label="First Name" labelWidth={90} value={nameFirst} onChangeText={setNameFirst} autoCapitalize="words" />
              <TextField label="Last Name" labelWidth={90} value={nameLast} onChangeText={setNameLast} autoCapitalize="words" />
              <TextField label="Nickname" labelWidth={90} value={nameNickname} onChangeText={setNameNickname} autoCapitalize="words" />
              <TextField label="Middle" labelWidth={90} value={nameMiddle} onChangeText={setNameMiddle} autoCapitalize="words" />
              <TextField label="Approx Age" labelWidth={90} value={ageApx} onChangeText={v => setAgeApx(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
              <TextField label="City" labelWidth={90} value={city} onChangeText={setCity} autoCapitalize="words" />
              <StatePicker value={state} onChange={setState} city={city} onCityChange={setCity} labelWidth={90} openOnFocus />
              <TextField label="Keywords" labelWidth={90} value={keyWords} onChangeText={setKeyWords} />

              <View style={styles.buttonRow}>
                <Button title="Save" onPress={handleSave} loading={saving} style={styles.rowButton} />
                <Button title="Delete" onPress={() => setDeleteConfirm(true)} variant="danger" style={styles.rowButton} />
                <Button title="Cancel" onPress={() => onClose()} variant="secondary" style={styles.rowButton} />
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete Search"
        body={`Delete the search for ${[nameFirst, nameLast].filter(Boolean).join(' ')}?  This will stop monitoring for this person.`}
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
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.brand,
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rowButton: {
    flex: 1,
  },
});
