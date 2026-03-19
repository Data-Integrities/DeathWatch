import React from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export function LegalModal({ visible, onClose, type }: Props) {
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
            {type === 'terms' ? <TermsContent /> : <PrivacyContent />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function TermsContent() {
  return (
    <>
      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.updated}>Last updated: March 18, 2026</Text>

      <Text style={styles.body}>
        These Terms of Service ("Terms") govern your use of ObitNOTE, operated by UltraSafe Data, LLC, a Florida limited liability company ("we", "us", "our").  By creating an account or using ObitNOTE, you agree to these Terms.
      </Text>

      <Text style={styles.heading}>1. Eligibility</Text>
      <Text style={styles.body}>
        You must be at least 18 years old to use ObitNOTE.  By creating an account, you confirm that you are 18 or older.
      </Text>

      <Text style={styles.heading}>2. What ObitNOTE Does</Text>
      <Text style={styles.body}>
        ObitNOTE is an obituary monitoring and notification service.  You add people's names and we search for their obituaries daily in the US, Canada, the UK, Australia, and New Zealand.  When we find a potential match, we notify you by email and, optionally, by text message.
      </Text>

      <Text style={styles.heading}>3. No Guarantee of Results</Text>
      <Text style={styles.body}>
        We do our best to find obituaries, but we cannot guarantee that we will find every obituary or that every result will be accurate.  We may miss obituaries.  Notifications may not reach you due to spam filters, carrier blocking, or other factors outside our control.  ObitNOTE is not a substitute for other methods of learning about someone's passing.
      </Text>

      <Text style={styles.heading}>4. Your Account</Text>
      <Text style={styles.body}>
        You are responsible for keeping your account credentials secure.  You must provide accurate information when creating your account.  You may not share your account with others or create multiple accounts.
      </Text>

      <Text style={styles.heading}>5. Free Trial</Text>
      <Text style={styles.body}>
        New accounts include a limited number of free trial searches.  Trial searches are one-time searches and are not monitored daily.  No payment is required for trial searches.
      </Text>

      <Text style={styles.heading}>6. Subscriptions and Billing</Text>
      <Text style={styles.body}>
        Paid subscriptions are billed annually through our payment partner, Paddle.com, who acts as the merchant of record.  Paddle handles all payment processing, tax collection, and invoicing.  By subscribing, you also agree to Paddle's terms of service.{'\n\n'}Subscription plans determine the maximum number of people you can monitor at one time.  You may cancel, upgrade, or downgrade your plan at any time.{'\n\n'}
        <Text style={styles.bold}>Auto-Renewal:</Text>  Subscriptions automatically renew each year at the then-current price.  We will send you a reminder email before each renewal.{'\n\n'}
        <Text style={styles.bold}>Upgrade:</Text>  You may upgrade to a higher plan at any time.  You will be charged a prorated amount for the remainder of your billing period.{'\n\n'}
        <Text style={styles.bold}>Downgrade:</Text>  You may downgrade to a lower plan at any time.  If you are currently monitoring more people than the new plan allows, you will need to remove searches before the downgrade takes effect.  A prorated credit will be applied to your next billing period.{'\n\n'}
        <Text style={styles.bold}>Cancellation:</Text>  You may cancel your subscription at any time through your account settings or by contacting us at support@obitnote.com.  Cancellation takes effect immediately and you will receive a prorated refund for the unused portion of your subscription.{'\n\n'}
        <Text style={styles.bold}>Refunds:</Text>  We want you to be happy with ObitNOTE.  If you are not satisfied, contact us at support@obitnote.com within 30 days of your payment for a full refund.  Refunds requested after 30 days will be prorated for the unused portion of your subscription.
      </Text>

      <Text style={styles.heading}>7. Acceptable Use</Text>
      <Text style={styles.body}>
        You may not use ObitNOTE for any unlawful purpose.  You may not use automated tools, bots, or scripts to access ObitNOTE.  You may not attempt to interfere with the service or access other users' accounts.  We reserve the right to suspend or terminate accounts that violate these terms.
      </Text>

      <Text style={styles.heading}>8. Intellectual Property</Text>
      <Text style={styles.body}>
        ObitNOTE and its content, features, and design are owned by UltraSafe Data, LLC.  You may not copy, modify, or distribute any part of the service without our written permission.
      </Text>

      <Text style={styles.heading}>9. Limitation of Liability</Text>
      <Text style={styles.body}>
        To the fullest extent permitted by law, UltraSafe Data, LLC is not liable for any indirect, incidental, special, or consequential damages arising from your use of ObitNOTE.  Our total liability for any claim related to the service is limited to the amount you paid us in the 12 months before the claim.{'\n\n'}We are not liable for missed obituaries, delayed or undelivered notifications, or any decisions you make based on information provided by the service.
      </Text>

      <Text style={styles.heading}>10. Termination</Text>
      <Text style={styles.body}>
        You may close your account at any time by contacting us.  We may suspend or terminate your account if you violate these Terms.  Upon termination, your data will be deleted in accordance with our Privacy Policy.
      </Text>

      <Text style={styles.heading}>11. Changes to These Terms</Text>
      <Text style={styles.body}>
        We may update these Terms from time to time.  If we make significant changes, we will notify you by email or through the app.  Your continued use of ObitNOTE after changes take effect means you accept the updated Terms.
      </Text>

      <Text style={styles.heading}>12. Governing Law</Text>
      <Text style={styles.body}>
        These Terms are governed by the laws of the State of Florida, United States, without regard to conflict of law principles.  Any legal action related to these Terms must be brought in the courts located in the State of Florida.
      </Text>

      <Text style={styles.heading}>13. Contact</Text>
      <Text style={styles.body}>
        If you have questions about these Terms, contact us at support@obitnote.com.
      </Text>

      <Text style={styles.footer}>
        Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
      </Text>
    </>
  );
}

export function PrivacyContent() {
  return (
    <>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: March 18, 2026</Text>

      <Text style={styles.body}>
        This Privacy Policy describes how UltraSafe Data, LLC, a Florida limited liability company ("we", "us", "our"), collects, uses, and protects your information when you use ObitNOTE.
      </Text>

      <Text style={styles.heading}>1. Information We Collect</Text>
      <Text style={styles.body}>
        <Text style={styles.bold}>Account information:</Text>  Your name, email address, and optionally your mobile phone number.{'\n\n'}
        <Text style={styles.bold}>Search information:</Text>  The names and details of people you ask us to monitor (name, city, state, approximate age, keywords).{'\n\n'}
        <Text style={styles.bold}>Usage information:</Text>  Login history, IP address, and approximate location (city, state, country) derived from your IP address when you sign in.{'\n\n'}
        <Text style={styles.bold}>Messages:</Text>  Messages you send to us through the in-app messaging feature.{'\n\n'}
        <Text style={styles.bold}>Payment information:</Text>  We do not collect or store your payment details.  All payment processing is handled by our payment partner, Paddle.com.
      </Text>

      <Text style={styles.heading}>2. How We Use Your Information</Text>
      <Text style={styles.body}>
        We use your information to:{'\n\n'}
        {'\u2022'}  Provide the ObitNOTE service — searching for obituaries and sending you notifications{'\n'}
        {'\u2022'}  Send you email and text message notifications when obituaries are found{'\n'}
        {'\u2022'}  Manage your account and respond to your messages{'\n'}
        {'\u2022'}  Improve the service and fix problems{'\n'}
        {'\u2022'}  Protect against fraud and abuse
      </Text>

      <Text style={styles.heading}>3. Third-Party Services</Text>
      <Text style={styles.body}>
        We share limited information with the following services to operate ObitNOTE:{'\n\n'}
        <Text style={styles.bold}>Paddle.com</Text> — processes payments and handles billing.  Paddle receives your email address and payment details when you subscribe.{'\n\n'}
        <Text style={styles.bold}>Sinch</Text> — delivers text message notifications.  Sinch receives your phone number when you opt in to SMS notifications.{'\n\n'}
        <Text style={styles.bold}>Zoho Mail</Text> — delivers email notifications and verification emails.  Zoho processes your email address.{'\n\n'}
        We do not sell, rent, or trade your personal information to anyone.  We do not share your information with advertisers.
      </Text>

      <Text style={styles.heading}>4. Data Retention</Text>
      <Text style={styles.body}>
        We retain your account information and search data for as long as your account is active.  If you close your account, we will delete your personal data within 30 days.  We may retain anonymized, non-personal data for analytical purposes.
      </Text>

      <Text style={styles.heading}>5. Data Security</Text>
      <Text style={styles.body}>
        We take reasonable measures to protect your information, including encrypted connections (HTTPS), hashed passwords, and restricted database access.  However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
      </Text>

      <Text style={styles.heading}>6. Your Rights</Text>
      <Text style={styles.body}>
        You may:{'\n\n'}
        {'\u2022'}  Access your personal information through your account settings{'\n'}
        {'\u2022'}  Update or correct your information at any time{'\n'}
        {'\u2022'}  Request deletion of your account and personal data by contacting us{'\n'}
        {'\u2022'}  Opt out of text message notifications in your account settings{'\n\n'}
        If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect and the right to request its deletion.  Contact us to exercise these rights.
      </Text>

      <Text style={styles.heading}>7. Cookies and Local Storage</Text>
      <Text style={styles.body}>
        ObitNOTE uses local storage in your browser to keep you signed in and to remember your preferences (such as your email address if you choose "Remember Me").  We do not use third-party tracking cookies or advertising cookies.
      </Text>

      <Text style={styles.heading}>8. Children's Privacy</Text>
      <Text style={styles.body}>
        ObitNOTE is not intended for anyone under the age of 18.  We do not knowingly collect information from children.  If we learn that we have collected information from someone under 18, we will delete it promptly.
      </Text>

      <Text style={styles.heading}>9. International Users</Text>
      <Text style={styles.body}>
        ObitNOTE is operated from the United States.  If you use the service from outside the US, your information will be transferred to and processed in the United States.  By using ObitNOTE, you consent to this transfer.
      </Text>

      <Text style={styles.heading}>10. Changes to This Policy</Text>
      <Text style={styles.body}>
        We may update this Privacy Policy from time to time.  If we make significant changes, we will notify you by email or through the app.  The "Last updated" date at the top of this page indicates when it was last revised.
      </Text>

      <Text style={styles.heading}>11. Contact</Text>
      <Text style={styles.body}>
        If you have questions about this Privacy Policy or your personal data, contact us at support@obitnote.com.
      </Text>

      <Text style={styles.footer}>
        Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
      </Text>
    </>
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
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.xs,
  },
  updated: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#444444',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  bold: {
    fontWeight: '700',
  },
  body: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
});

export const legalStyles = styles;
