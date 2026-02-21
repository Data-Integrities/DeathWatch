import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
}

export function TextField({ label, error, helperText, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[
            styles.input,
            error ? styles.inputError : undefined,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          {...props}
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    width: 100,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minHeight: 40,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: 2,
    marginLeft: 100,
  },
  helper: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
    marginLeft: 100,
  },
});
