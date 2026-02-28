import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing, heading } from '../../src/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [registered, setRegistered] = useState(false);

  const isFormValid = firstName.trim().length > 0
    && lastName.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && password.length >= 8
    && passwordConfirm.length > 0
    && password === passwordConfirm;

  const handleSignUp = async () => {
    setError('');
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!passwordConfirm) {
      setError('Please confirm your password.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, passwordConfirm, firstName, lastName);
      setRegistered(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader minimal />
        <ScreenContainer style={styles.content}>
          <View style={styles.checkEmailCard}>
            <Text style={styles.checkEmailTitle}>Check Your Email</Text>
            <Text style={styles.checkEmailSent}>
              We sent a verification email to
            </Text>
            <Text style={styles.checkEmailAddress}>{email}</Text>
            <Text style={styles.checkEmailNote}>
              <Text style={styles.checkEmailBold}>Click the link in the email to verify your account.</Text>  You can still use ObitNOTE while you wait.
              {'\n\n'}<Text style={styles.checkEmailBold}>Don't see it?</Text>  Check your spam folder.
            </Text>
            <Button
              title="Continue to ObitNOTE"
              variant="primary"
              onPress={() => router.replace('/matches')}
              style={styles.continueButton}
            />
          </View>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <AppHeader minimal onHelp={() => setSupportVisible(true)} />
    <ScreenContainer style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Create account</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        label="First Name"
        labelWidth={90}
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
      />

      <TextField
        label="Last Name"
        labelWidth={90}
        value={lastName}
        onChangeText={setLastName}
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
      />

      <TextField
        label="Email"
        labelWidth={90}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <TextField
        label="Password"
        labelWidth={90}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        showPasswordToggle
        passwordVisible={pwVisible}
        onTogglePassword={setPwVisible}
        minLength={8}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <TextField
        label="Confirm Password"
        labelWidth={90}
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        secureTextEntry
        passwordVisible={pwVisible}
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <View style={styles.buttons}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          style={styles.cancelButton}
        />
        <Button
          title="Create Account"
          variant={isFormValid ? 'primary' : 'primaryLight'}
          onPress={handleSignUp}
          loading={loading}
          style={styles.button}
        />
      </View>

      <View style={styles.linksRow}>
        <Text style={styles.linkLabel}>Already have an account?</Text>
        <Pressable onPress={() => router.push('/sign-in')}>
          <Text style={styles.signInLink}>Sign in.</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...heading,
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
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    paddingHorizontal: 20,
  },
  linksRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  linkLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.green,
  },
  signInLink: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.green,
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 'auto' as any,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
  checkEmailCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  checkEmailTitle: {
    ...heading,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  checkEmailBody: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  checkEmailSent: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  checkEmailAddress: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  checkEmailNote: {
    fontSize: fontSize.sm,
    color: '#444444',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  checkEmailBold: {
    fontWeight: '700',
  },
  continueButton: {
    minWidth: 200,
  },
});
