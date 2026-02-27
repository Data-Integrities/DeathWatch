import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';

function isReturningUser(): boolean {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem('obitnote_returning') !== null; } catch {}
  }
  return false;
}

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('jimjones1000@gmail.com');
  const [password, setPassword] = useState('obitnote1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const showIntro = !isReturningUser();

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
      const msg = err.message === 'Failed to fetch'
        ? 'Something wrong. Please contact support.'
        : err.message || 'Sign in failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ObitNOTE</Text>
          <Text style={styles.tm}>{'\u2122'}</Text>
        </View>
      </View>

      {showIntro && (
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is an obituary notification service.
          </Text>
          <Text style={styles.introText}>
            We alert you if an obituary for someone is published in the future.
          </Text>
          <Text style={styles.introText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is not for finding old obituaries. For older obituaries, use Google or another search engine.
          </Text>
          <Text style={[styles.introText, { marginBottom: 0 }]}>
            To begin, click <Text style={styles.boldText}>Create an Account</Text> or <Text style={styles.boldText}>Sign In</Text>.
          </Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        label="Email"
        labelWidth={70}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <TextField
        label="Password"
        labelWidth={70}
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
        style={styles.signIn}
      />

      <Button
        title="Create an Account"
        variant="secondary"
        onPress={() => router.push('/sign-up')}
        style={styles.createAccount}
      />

      <View style={styles.links}>
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </Link>
        <Text style={styles.linkSpacer}>{'     '}</Text>
        <Pressable onPress={() => setSupportVisible(true)}>
          <Text style={styles.link}>Contact support</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        visible={supportVisible}
        title="Contact Support"
        body="Please call us at (800) 588-1950"
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setSupportVisible(false)}
        onCancel={() => setSupportVisible(false)}
      />

      <Text style={styles.footer}>
        Copyright &copy; 2009-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tm: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.brand,
    marginTop: 5,
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
  introCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  introText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  brandText: {
    fontWeight: '700',
    color: colors.brand,
  },
  boldText: {
    fontWeight: '700',
  },
  signIn: {
    marginTop: spacing.md,
  },
  createAccount: {
    marginTop: spacing.sm,
  },
  links: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '600',
  },
  linkSpacer: {
    fontSize: fontSize.base,
  },
  footer: {
    marginTop: 'auto' as any,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
