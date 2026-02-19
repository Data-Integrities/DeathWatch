import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { colors, fontSize, spacing } from '../../src/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('jimjones1000@gmail.com');
  const [password, setPassword] = useState('obitnote1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/matches');
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>ObitNOTE</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />

      <Button
        title="Sign In"
        onPress={handleSignIn}
        loading={loading}
      />

      <View style={styles.links}>
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </Link>

        <Link href="/sign-up" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.green,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  error: {
    fontSize: fontSize.base,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  links: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  link: {
    fontSize: fontSize.base,
    color: colors.purple,
    fontWeight: '600',
  },
});
