import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Checkbox } from '../../src/components/Checkbox';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import { BUILD_VERSION } from '../../src/version';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(() => {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem('obitnote_email') || ''; } catch { return ''; }
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [unreadTicketId, setUnreadTicketId] = useState('');
  const isReturning = Platform.OS === 'web' && (() => {
    try { return localStorage.getItem('obitnote_returning') === '1'; } catch { return false; }
  })();

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await signIn(email, password, rememberMe);
      if (Platform.OS === 'web') {
        try {
          if (rememberMe) {
            localStorage.setItem('obitnote_email', email);
          } else {
            localStorage.removeItem('obitnote_email');
          }
        } catch {}
      }
      if (loggedInUser.unreadReplyCount > 0 && loggedInUser.unreadTicketIds?.length > 0) {
        setUnreadTicketId(loggedInUser.unreadTicketIds[0]);
        setShowReplyModal(true);
        return;
      }
      router.replace('/matches');
    } catch (err: any) {
      const isNetworkError = err.message === 'Failed to fetch' || err.message === 'Load failed';
      const msg = isNetworkError
        ? 'Something wrong.  Please contact support.'
        : err.message || 'Sign in failed.  Please try again.';
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

      {!isReturning && (
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is an <Text style={styles.boldText}>obituary notification service</Text>.
          </Text>
          <Text style={styles.introText}>
            <Text style={styles.boldText}>Add a person</Text>, and <Text style={styles.brandText}>ObitNOTE</Text> will <Text style={styles.boldText}>alert you</Text> later when an obituary for that person is published in the US, Canada, the UK, Australia, and New Zealand.
          </Text>
          <Text style={styles.introText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is <Text style={styles.boldText}>not for finding old obituaries</Text>.  For older obituaries, you can use Google.
          </Text>
          <Text style={[styles.introText, { marginBottom: 0 }]}>
            To begin, tap <Text style={styles.boldText}>Create an Account</Text> (or <Text style={styles.boldText}>Sign In</Text>).
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
        returnKeyType="next"
      />

      <TextField
        label="Password"
        labelWidth={70}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        showPasswordToggle
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={handleSignIn}
        returnKeyType="go"
      />

      <View>
        <Checkbox
          checked={rememberMe}
          onToggle={setRememberMe}
          label="Remember Me"
        />
        <Text style={styles.rememberHint}>(Do not use Remember Me on a public device.)</Text>
      </View>

      <Button
        title="Sign In"
        onPress={handleSignIn}
        loading={loading}
        style={styles.signIn}
      />

      <Text style={styles.orText}>OR</Text>

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
        visible={showReplyModal}
        title="Support Response"
        body="You have a support response.  Go to Help to read it."
        confirmLabel="Go to Help"
        cancelLabel="Later"
        onConfirm={() => { setShowReplyModal(false); router.replace(`/help?ticket=${unreadTicketId}` as any); }}
        onCancel={() => { setShowReplyModal(false); router.replace('/matches'); }}
      />

      <ConfirmDialog
        visible={supportVisible}
        title="Contact us"
        body={<>{"support@obitnote.com\n\nThank you "}<Image source={require('../../assets/smile.jpg')} style={{ width: 20, height: 20, top: 4 }} /></>}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setSupportVisible(false)}
        onCancel={() => setSupportVisible(false)}
      />

      <Text style={styles.footer}>
        Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.  {BUILD_VERSION}
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
    marginTop: 8,
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
    color: '#444444',
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
  rememberHint: {
    fontSize: fontSize.xs,
    color: '#444444',
    marginTop: 2,
    marginLeft: 24,
  },
  signIn: {
    marginTop: spacing.md,
  },
  orText: {
    textAlign: 'center',
    fontSize: 18,
    color: colors.green,
    fontWeight: '700',
    marginTop: spacing.sm,
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
    color: '#444444',
  },
});
