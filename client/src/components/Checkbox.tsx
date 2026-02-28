import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing } from '../theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: (value: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onToggle, label }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      style={styles.container}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <FontAwesome
        name={checked ? 'check-square' : 'square-o'}
        size={20}
        color={checked ? colors.green : '#444444'}
        style={styles.icon}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    top: 2,
  },
  label: {
    fontSize: fontSize.sm,
    color: '#444444',
  },
});
