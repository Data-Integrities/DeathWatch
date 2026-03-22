import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Pressable, Modal } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Checkbox } from '../../src/components/Checkbox';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { SignUpModal } from '../../src/components/SignUpModal';
import { LegalModal } from '../../src/components/LegalModal';
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
  const [pricingVisible, setPricingVisible] = useState(false);
  const [signUpVisible, setSignUpVisible] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [legalType, setLegalType] = useState<'terms' | 'privacy' | null>(null);
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

      {/* TODO: restore !isReturning check */}
      {(
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is an <Text style={styles.boldText}>obituary monitor and alert service</Text>.
          </Text>
          <Text style={styles.introText}>
            Add people's names and <Text style={styles.brandText}>ObitNOTE</Text> will <Text style={styles.boldText}>send you a text and email</Text> when an obituary for any of them is published in the US, Canada, the UK, Australia, or New Zealand.
          </Text>
          <Text style={styles.introText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is <Text style={styles.boldText}>not for finding old obituaries</Text>.  For older obituaries, you can use Google.
          </Text>
          <Text style={[styles.introText, { marginBottom: 0 }]}>
            To begin, tap <Pressable onPress={() => setSignUpVisible(true)} style={styles.tryFreeLinkWrap}><Text style={styles.tryFreeLink}>Create account and try for free</Text></Pressable>.  <Pressable onPress={() => setPricingVisible(true)} style={styles.tryFreeLinkWrap}><Text style={styles.tryFreeLink}>See pricing</Text></Pressable>.
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
        <Text style={styles.rememberHint}>(Don't use Remember Me on a public device.)</Text>
      </View>

      <Button
        title="Sign In"
        onPress={handleSignIn}
        loading={loading}
        style={styles.signIn}
      />

      <Text style={styles.orText}>OR</Text>

      <Button
        title="Create account and try for free"
        variant="secondary"
        onPress={() => setSignUpVisible(true)}
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

      <Pressable onPress={() => setPricingVisible(true)} style={styles.pricingLinkWrap}>
        <Text style={styles.pricingLink}>See pricing</Text>
      </Pressable>

      <View style={styles.legalLinks}>
        <Pressable onPress={() => setLegalType('terms')}>
          <Text style={styles.legalLink}>Terms of Service</Text>
        </Pressable>
        <Text style={styles.linkSpacer}>{'     '}</Text>
        <Pressable onPress={() => setLegalType('privacy')}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
      </View>

      <LegalModal visible={!!legalType} type={legalType || 'terms'} onClose={() => setLegalType(null)} />

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

      <Modal visible={pricingVisible} transparent animationType="fade" onRequestClose={() => setPricingVisible(false)}>
        <View style={styles.tryFreeOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPricingVisible(false)} />
          <View style={styles.pricingCard}>
            <Pressable onPress={() => setPricingVisible(false)} style={styles.pricingCloseX} accessibilityRole="button" accessibilityLabel="Close">
              <FontAwesome name="times" size={28} color={colors.green} />
            </Pressable>
            <Text style={styles.pricingTitle}>Pricing</Text>
            <Text style={styles.pricingSubtitle}>Monitor people you care about</Text>

            <View style={styles.pricingTable}>
              <View style={styles.pricingHeaderRow}>
                <Text style={[styles.pricingHeaderCell, styles.pricingPlanCol]}>Plan</Text>
                <Text style={[styles.pricingHeaderCell, styles.pricingPriceCol]}>Per Year</Text>
                <Text style={[styles.pricingHeaderCell, styles.pricingPerCol]}>Per Person</Text>
              </View>
              {[
                { plan: 'Up to 10 people', price: '$20', per: '$2.00' },
                { plan: 'Up to 25 people', price: '$39', per: '$1.56' },
                { plan: 'Up to 50 people', price: '$69', per: '$1.38' },
                { plan: 'Up to 100 people', price: '$119', per: '$1.19' },
              ].map((row, i) => (
                <View key={i} style={[styles.pricingRow, i % 2 === 0 && styles.pricingRowAlt]}>
                  <Text style={[styles.pricingCell, styles.pricingPlanCol]}>{row.plan}</Text>
                  <Text style={[styles.pricingCell, styles.pricingPriceCol, styles.pricingPriceText]}>{row.price}</Text>
                  <Text style={[styles.pricingCell, styles.pricingPerCol]}>{row.per}</Text>
                </View>
              ))}
              <View style={[styles.pricingRow, styles.pricingRowAlt]}>
                <Text style={[styles.pricingCell, styles.pricingPlanCol]}>Over 100</Text>
                <Text style={[styles.pricingCell, styles.pricingContactCol]}>email support@obitnote.com</Text>
              </View>
            </View>

            <Text style={styles.pricingNote}>3 free trial searches before any payment is required.  Cancel, upgrade, or downgrade anytime.</Text>
          </View>
        </View>
      </Modal>

      <SignUpModal visible={signUpVisible} onClose={() => setSignUpVisible(false)} />

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
    marginTop: spacing.md,
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
  tryFreeLinkWrap: {
    display: 'inline' as any,
  },
  tryFreeLink: {
    fontWeight: '700',
    color: colors.green,
    fontSize: fontSize.base,
    lineHeight: 26,
    textDecorationLine: 'underline' as const,
  },
  tryFreeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pricingLinkWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  pricingLink: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '600',
  },
  legalLinks: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalLink: {
    fontSize: fontSize.xs,
    color: colors.green,
    fontWeight: '600',
  },
  pricingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 420,
    width: '100%',
    ...shadows.modal,
  },
  pricingCloseX: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    padding: 8,
  },
  pricingTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand,
    textAlign: 'center',
    marginBottom: 4,
  },
  pricingSubtitle: {
    fontSize: fontSize.sm,
    color: '#444444',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pricingTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  pricingHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pricingHeaderCell: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pricingRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pricingRowAlt: {
    backgroundColor: '#F8F5FC',
  },
  pricingCell: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#555555',
  },
  pricingPlanCol: {
    flex: 3,
  },
  pricingPriceCol: {
    flex: 2,
    textAlign: 'center',
  },
  pricingPriceText: {
    fontWeight: '700',
    color: colors.brand,
  },
  pricingPerCol: {
    flex: 2,
    textAlign: 'right',
  },
  pricingContactCol: {
    flex: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#555555',
    textAlign: 'center',
  },
  pricingNote: {
    fontSize: fontSize.sm,
    color: '#444444',
    textAlign: 'center',
    marginBottom: spacing.md,
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
