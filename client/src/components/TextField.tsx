import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  labelWidth?: number;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
  minLength?: number;
  passwordVisible?: boolean;
  onTogglePassword?: (visible: boolean) => void;
}

export function TextField({ label, labelWidth, error, helperText, showPasswordToggle, minLength, passwordVisible: externalVisible, onTogglePassword, style, secureTextEntry, value, ...props }: TextFieldProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const passwordVisible = externalVisible ?? internalVisible;
  const togglePassword = () => {
    const next = !passwordVisible;
    if (onTogglePassword) onTogglePassword(next);
    else setInternalVisible(next);
  };
  const isSecure = secureTextEntry && !passwordVisible;

  const meetsMinLength = minLength != null && value != null && value.length >= minLength;
  const hasValue = value != null && value.length > 0;
  const inputColor = minLength != null && hasValue
    ? (meetsMinLength ? colors.green : colors.error)
    : colors.textPrimary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.label, labelWidth ? { width: labelWidth } : undefined]}>{label}</Text>
        <View style={styles.inputWrap}>
          {!hasValue && props.placeholder && (
            <Text style={styles.customPlaceholder} pointerEvents="none">{props.placeholder}</Text>
          )}
          <TextInput
            style={[
              styles.input,
              { color: inputColor },
              error ? styles.inputError : undefined,
              showPasswordToggle ? { paddingRight: 40 } : undefined,
              style,
            ]}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={label}
            secureTextEntry={isSecure}
            value={value}
            {...(props.placeholder ? { ...props, placeholder: undefined } : props)}
          />
          {showPasswordToggle && (
            <Pressable
              onPress={togglePassword}
              style={styles.eyeButton}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            >
              <FontAwesome name={passwordVisible ? 'eye' : 'eye-slash'} size={18} color={'#444444'} />
            </Pressable>
          )}
        </View>
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
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    position: 'relative' as any,
    justifyContent: 'center',
  },
  customPlaceholder: {
    position: 'absolute',
    left: spacing.md,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    zIndex: 1,
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
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: 2,
  },
  helper: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginTop: 2,
  },
});
