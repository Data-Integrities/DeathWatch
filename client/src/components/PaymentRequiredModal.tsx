import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingOverlay } from './LoadingOverlay';
import { api } from '../services/api/client';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface UncommittedPerson {
  id: string;
  name: string;
}

interface PaymentRequiredModalProps {
  visible: boolean;
  people: UncommittedPerson[];
  costPerPerson: number;
  onComplete: () => void;
  onRemove: (id: string) => void;
  onDismiss?: () => void;
}

export function PaymentRequiredModal({
  visible,
  people,
  costPerPerson,
  onComplete,
  onRemove,
  onDismiss,
}: PaymentRequiredModalProps) {
  const [showPeople, setShowPeople] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UncommittedPerson | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');

  if (!visible || people.length === 0) return null;

  const total = people.length * costPerPerson;

  const handleDone = async () => {
    setCommitting(true);
    setError('');
    try {
      await api.post('/api/searches/commit', {});
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Payment failed.  Your people are still being monitored.  Please try again later.');
    } finally {
      setCommitting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    onRemove(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (showPeople) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            {onDismiss && (
              <Pressable onPress={onDismiss} style={styles.closeButton} accessibilityLabel="Close">
                <FontAwesome name="times" size={18} color="#444444" />
              </Pressable>
            )}
            <Text style={styles.title}>New People Added</Text>
            <ScrollView style={styles.peopleList}>
              {people.map(p => (
                <View key={p.id} style={styles.personRow}>
                  <Text style={styles.personName}>{p.name}</Text>
                  <Pressable onPress={() => setDeleteTarget(p)}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Button title="Back" variant="secondary" onPress={() => setShowPeople(false)} />
          </View>
        </View>

        <ConfirmDialog
          visible={!!deleteTarget}
          title="Remove Person"
          body={`Remove ${deleteTarget?.name}?  This will delete the search.`}
          confirmLabel="Remove"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
            {onDismiss && (
              <Pressable onPress={onDismiss} style={styles.closeButton} accessibilityLabel="Close">
                <FontAwesome name="times" size={18} color="#444444" />
              </Pressable>
            )}
            <Text style={styles.title}>Payment Required</Text>

          <View style={styles.grid}>
            <View style={styles.row}>
              <Text style={styles.label}>New people added</Text>
              <Text style={styles.value}>{people.length}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.label}>Annual cost each</Text>
              <Text style={styles.value}>${costPerPerson}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={[styles.label, styles.totalLabel]}>Total added cost</Text>
              <Text style={[styles.value, styles.totalValue]}>${total}/yr</Text>
            </View>
          </View>

          <Pressable onPress={() => setShowPeople(true)} style={styles.viewPeopleWrap}>
            <Text style={styles.viewPeopleLink}>View people</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Pay Now" onPress={handleDone} />
        </View>
      </View>

      <LoadingOverlay visible={committing} message="Processing payment..." />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 360,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  grid: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  label: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  value: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalLabel: {
    fontWeight: '700',
  },
  totalValue: {
    color: colors.brand,
    fontSize: 18,
  },
  viewPeopleWrap: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  viewPeopleLink: {
    fontSize: fontSize.base,
    color: colors.green,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  peopleList: {
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  personName: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  removeLink: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: '700',
  },
});
