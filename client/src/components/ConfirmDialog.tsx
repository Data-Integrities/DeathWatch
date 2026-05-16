import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, fontSize, spacing, borderRadius, shadows, minTouchTarget } from '../theme';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: React.ReactNode;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.bodyScroll}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button
              title={confirmLabel}
              variant={confirmVariant}
              onPress={onConfirm}
              style={styles.actionButton}
            />
            {cancelLabel ? (
              <Button
                title={cancelLabel}
                variant="secondary"
                onPress={onCancel}
                style={styles.actionButton}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
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
    padding: spacing.lg,
    maxWidth: 400,
    maxHeight: '90%',
    width: '100%',
    ...shadows.modal,
  },
  bodyScroll: {
    flexShrink: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: 120,
    flexGrow: 1,
  },
});
