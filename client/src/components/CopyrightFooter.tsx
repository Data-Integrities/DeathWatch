import React from 'react';
import { Text, Pressable, Linking, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { fontSize, spacing } from '../theme';

interface CopyrightFooterProps {
  style?: StyleProp<TextStyle>;
  suffix?: string;
}

export function CopyrightFooter({ style, suffix }: CopyrightFooterProps) {
  return (
    <Text style={[styles.footer, style]}>
      Copyright &copy; 2025-{new Date().getFullYear()}{' '}
      <Pressable onPress={() => Linking.openURL('https://ultrasafedata.com')} style={styles.linkWrap}>
        <Text style={styles.link}>UltraSafe Data, LLC</Text>
      </Pressable>
      {' '}(US).{'\n'}All rights reserved.{suffix ? `  ${suffix}` : ''}
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
  linkWrap: {
    display: 'inline' as any,
  },
  link: {
    fontSize: fontSize.sm,
    color: '#444444',
    textDecorationLine: 'underline' as const,
  },
});
