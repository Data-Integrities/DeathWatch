import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { fontSize, spacing } from '../theme';

interface CopyrightFooterProps {
  style?: StyleProp<TextStyle>;
  suffix?: string;
}

export function CopyrightFooter({ style, suffix }: CopyrightFooterProps) {
  return (
    <Text style={[styles.footer, style]}>
      Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.{suffix ? `  ${suffix}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
});
