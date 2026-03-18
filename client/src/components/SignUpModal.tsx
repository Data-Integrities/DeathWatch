import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TextField } from './TextField';
import { Button } from './Button';
import { StatePicker } from './StatePicker';
import { CountryPicker } from './CountryPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { LegalModal } from './LegalModal';
import { colors, fontSize, spacing, borderRadius, shadows, heading } from '../theme';

// US and Canadian state/province codes from StatePicker
const US_CA_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]);

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SignUpModal({ visible, onClose }: Props) {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryDial, setCountryDial] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [phoneWarningVisible, setPhoneWarningVisible] = useState(false);
  const [legalType, setLegalType] = useState<'terms' | 'privacy' | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setState(null);
      setCountryCode(null);
      setCountryDial('+1');
      setPhoneNumber('');
      setPassword('');
      setPasswordConfirm('');
      setError('');
      setPwVisible(false);
      setRegistered(false);
    }
  }, [visible]);

  const isNonUsCanada = useMemo(() => {
    return state !== null && !US_CA_CODES.has(state);
  }, [state]);

  const dialCode = isNonUsCanada ? countryDial : '+1';

  const isFormValid = firstName.trim().length > 0
    && lastName.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && password.length >= 8
    && passwordConfirm.length > 0
    && password === passwordConfirm;

  const buildFullPhone = () => {
    const raw = phoneNumber.trim();
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    const digits = raw.replace(/[^0-9]/g, '');
    if (dialCode === '+1' && digits.startsWith('1') && digits.length === 11) {
      return `+${digits}`;
    }
    return `${dialCode}${digits}`;
  };

  const doSignUp = async () => {
    setLoading(true);
    try {
      const fullPhone = buildFullPhone() || undefined;
      await signUp(email, password, passwordConfirm, firstName, lastName, fullPhone);
      setRegistered(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed.  Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim()) { setError('Last name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!passwordConfirm) { setError('Please confirm your password.'); return; }
    if (password !== passwordConfirm) { setError('Passwords do not match.'); return; }

    if (!phoneNumber.trim()) {
      setPhoneWarningVisible(true);
      return;
    }
    await doSignUp();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Pressable onPress={onClose} style={styles.closeX} accessibilityRole="button" accessibilityLabel="Close">
            <FontAwesome name="times" size={28} color={colors.green} />
          </Pressable>
          <ScrollView style={styles.scrollInner} showsVerticalScrollIndicator={false}>
            {registered ? (
              <View style={styles.checkEmailWrap}>
                <Text style={styles.checkEmailTitle}>Check Your Email</Text>
                <Text style={styles.checkEmailSent}>We sent a verification email to</Text>
                <Text style={styles.checkEmailAddress}>{email}</Text>
                <Text style={styles.checkEmailNote}>
                  <Text style={styles.checkEmailBold}>Click the link in the email to verify your account.</Text>  You can still use ObitNOTE while you wait.
                  {'\n\n'}<Text style={styles.checkEmailBold}>Don't see it?</Text>  Check your spam folder.
                </Text>
                <Button
                  title="Continue to ObitNOTE"
                  variant="primary"
                  onPress={() => { onClose(); router.replace('/welcome'); }}
                  style={styles.continueButton}
                />
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Create Account</Text>

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

                <StatePicker
                  value={state}
                  onChange={(v) => {
                    setState(v);
                    if (v && US_CA_CODES.has(v)) {
                      setCountryCode(null);
                      setCountryDial('+1');
                    }
                  }}
                  labelWidth={90}
                  openOnFocus
                />

                {isNonUsCanada && (
                  <CountryPicker
                    value={countryCode}
                    onChange={(code, dial) => {
                      setCountryCode(code);
                      setCountryDial(dial);
                    }}
                    labelWidth={90}
                  />
                )}

                <TextField
                  label={`Mobile ${dialCode}`}
                  labelWidth={90}
                  value={phoneNumber}
                  onChangeText={(v) => setPhoneNumber(v.replace(/[^0-9+\-() ]/g, ''))}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  placeholder="Optional"
                />
                <Text style={styles.phoneHint}>Include country code for non-US numbers (e.g. +44)</Text>

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
                  label="Confirm"
                  labelWidth={90}
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  secureTextEntry
                  passwordVisible={pwVisible}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />

                <Text style={styles.consent}>
                  By clicking Create Account, you agree to our{' '}
                  <Text style={styles.consentLink} onPress={() => setLegalType('terms')}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.consentLink} onPress={() => setLegalType('privacy')}>Privacy Policy</Text>.
                </Text>

                <Button
                  title="Create Account"
                  variant={isFormValid ? 'primary' : 'primaryLight'}
                  onPress={handleSignUp}
                  loading={loading}
                  style={styles.createButton}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>

      <ConfirmDialog
        visible={phoneWarningVisible}
        title="No Phone Number"
        body="Without a mobile number, we can only send you notification emails when an obituary is found.  We will not be able to send you text messages.  Continue without a phone number?"
        confirmLabel="Continue"
        cancelLabel="Go Back"
        onConfirm={() => {
          setPhoneWarningVisible(false);
          doSignUp();
        }}
        onCancel={() => setPhoneWarningVisible(false)}
      />

      <LegalModal visible={!!legalType} type={legalType || 'terms'} onClose={() => setLegalType(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: '#f5f0fa',
    borderRadius: borderRadius.lg,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
    ...shadows.modal,
  },
  closeX: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    padding: 8,
  },
  scrollInner: {
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.md,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  phoneHint: {
    fontSize: 12,
    color: colors.textMuted,
    paddingLeft: 94,
    marginBottom: spacing.sm,
  },
  consent: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  consentLink: {
    color: colors.green,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  createButton: {
    marginTop: spacing.md,
  },
  checkEmailWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  checkEmailTitle: {
    ...heading,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  checkEmailSent: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
    textAlign: 'center',
    marginBottom: spacing.sm,
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
