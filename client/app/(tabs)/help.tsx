import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Image, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';

interface UserMessage {
  id: string;
  ticketId: string;
  subject: string;
  body: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  replyReadAt: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}/${dd}/${yy}`;
}

export default function HelpScreen() {
  const { user, refreshUser } = useAuth();
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const autoExpandedRef = useRef(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSentModal, setShowSentModal] = useState(false);
  const [sentTicketId, setSentTicketId] = useState('');
  const [showSubjectAlert, setShowSubjectAlert] = useState(false);
  const [subjectError, setSubjectError] = useState(false);

  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get<{ messages: UserMessage[] }>('/api/messages');
      setMessages(res.messages);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  // Auto-expand the message matching the ticket param (from post-login redirect)
  useEffect(() => {
    if (ticket && messages.length > 0 && !autoExpandedRef.current) {
      const msg = messages.find(m => m.ticketId === ticket);
      if (msg) {
        autoExpandedRef.current = true;
        handleExpand(msg);
      }
    }
  }, [ticket, messages]);

  const handleExpand = async (msg: UserMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(msg.id);
    if (msg.status === 'replied' && !msg.replyReadAt) {
      try {
        await api.patch(`/api/messages/${msg.id}/read-reply`);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, replyReadAt: new Date().toISOString() } : m));
        refreshUser();
      } catch {}
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      setShowSubjectAlert(true);
      setSubjectError(true);
      return;
    }
    if (!body.trim()) return;
    setError('');
    setLoading(true);
    try {
      const result = await api.post<{ id: string; ticketId: string }>('/api/messages', { subject: subject.trim(), body: body.trim() });
      setSubject('');
      setBody('');
      setSentTicketId(result.ticketId);
      setShowSentModal(true);
      fetchMessages();
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

  const hasUnreadReply = (msg: UserMessage) => msg.status === 'replied' && !msg.replyReadAt;

  return (
    <ScreenContainer>
      <ConfirmDialog
        visible={showSentModal}
        title="Message Sent"
        body={`Your message has been sent (#${sentTicketId}).  We will respond as soon as possible.`}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setShowSentModal(false)}
        onCancel={() => setShowSentModal(false)}
      />
      <ConfirmDialog
        visible={showSubjectAlert}
        title="Subject Required"
        body="Please add a subject to your message."
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setShowSubjectAlert(false)}
        onCancel={() => setShowSubjectAlert(false)}
      />
      <Button
        title="Back"
        variant="secondary"
        onPress={() => router.back()}
        style={styles.backButton}
      />

      {user && messages.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>Your Messages</Text>
          {messages.map(msg => (
            <View key={msg.id} style={styles.messageItem}>
              <Pressable onPress={() => handleExpand(msg)} style={styles.messageHeader}>
                <Text style={[styles.ticketText, hasUnreadReply(msg) && styles.unreadText]}>#{msg.ticketId}</Text>
                <Text style={[styles.subjectText, hasUnreadReply(msg) && styles.unreadText]} numberOfLines={1}>{msg.subject}</Text>
                <Text style={styles.dateText}>{formatDate(msg.createdAt)}</Text>
                {hasUnreadReply(msg) && <View style={styles.unreadDot} />}
              </Pressable>

              {expandedId === msg.id && (
                <View style={styles.messageDetail}>
                  <Text style={styles.detailLabel}>Your message:</Text>
                  <Text style={styles.detailBody}>{msg.body}</Text>

                  {msg.status === 'replied' && msg.adminReply ? (
                    <View style={styles.replyBlock}>
                      <Text style={styles.replyLabel}>Our response:</Text>
                      <Text style={styles.replyBody}>{msg.adminReply}{'\n\n'}ObitNOTE Support Team</Text>
                      {msg.repliedAt && (
                        <Text style={styles.replyDate}>{formatDate(msg.repliedAt)}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.awaitingText}>Awaiting response</Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {user && (
        <View style={styles.card}>
          <Text style={styles.heading}>Send us a message</Text>
          <Text style={styles.subtitle}>We'll respond as soon as possible. <Image source={require('../../assets/smile.jpg')} style={{ width: 20, height: 20, top: 4 }} /></Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextField
            label="Subject *"
            labelWidth={90}
            value={subject}
            onChangeText={(text) => { setSubject(text); setSubjectError(false); }}
            placeholder="Required"
            error={subjectError ? ' ' : undefined}
          />
          <Text style={styles.messageLabel}>Message</Text>
          <TextInput
            style={styles.messageInput}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
          />
          <Button
            title="Send"
            onPress={handleSend}
            disabled={!body.trim()}
            loading={loading}
            style={styles.sendButton}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  messageLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  messageInput: {
    minHeight: 120,
    fontSize: fontSize.base,
    color: '#444444',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    marginTop: spacing.md,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },

  // Your Messages section
  messageItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  ticketText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  subjectText: {
    fontSize: fontSize.sm,
    color: '#444444',
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  unreadText: {
    fontWeight: '700',
    color: '#444444',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  messageDetail: {
    paddingBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 4,
  },
  detailBody: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 22,
  },
  replyBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    paddingLeft: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
    backgroundColor: colors.successLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  replyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
    marginBottom: 4,
  },
  replyBody: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 22,
  },
  replyDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  awaitingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
