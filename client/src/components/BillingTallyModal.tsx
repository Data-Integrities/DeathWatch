import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import { Button } from './Button';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface BillingTallyModalProps {
  visible: boolean;
  uncommittedCount: number;
  costPerPerson: number;
  isFirstTime: boolean;
  onAddAnother: () => void;
  onDone: () => void;
}

export function BillingTallyModal({
  visible,
  uncommittedCount,
  costPerPerson,
  isFirstTime,
  onAddAnother,
  onDone,
}: BillingTallyModalProps) {
  if (!visible || uncommittedCount <= 0) return null;

  const total = uncommittedCount * costPerPerson;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {isFirstTime && (
            <Text style={styles.intro}>
              Your plan includes 5 people.  Additional people are ${costPerPerson}/year each.
            </Text>
          )}

          <View style={styles.grid}>
            <View style={styles.row}>
              <Text style={styles.label}>New people added</Text>
              <Text style={styles.value}>{uncommittedCount}</Text>
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

          <View style={styles.buttons}>
            <Button
              title="Add Another"
              variant="secondary"
              onPress={onAddAnother}
              style={styles.button}
            />
            <Button
              title="Done"
              onPress={onDone}
              style={styles.button}
            />
          </View>
        </View>
      </View>
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
  intro: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  grid: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
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
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  button: {
    flex: 1,
  },
});
