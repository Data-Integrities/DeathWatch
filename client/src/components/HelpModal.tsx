import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Text, TextInput, Image, Pressable, StyleSheet, Modal } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api/client';
import { Button } from './Button';
import { TextField } from './TextField';
import { ConfirmDialog } from './ConfirmDialog';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';

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

interface Props {
  visible: boolean;
  onClose: () => void;
  autoExpandTicket?: string;
}

export function HelpModal({ visible, onClose, autoExpandTicket }: Props) {
  const { user, refreshUser } = useAuth();
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
      // Sort by most recent first
      const sorted = res.messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(sorted);
    } catch {}
  }, []);

  useEffect(() => {
    if (visible && user) {
      autoExpandedRef.current = false;
      fetchMessages();
    }
  }, [visible, user]);

  // Auto-expand the message matching the ticket param
  useEffect(() => {
    if (autoExpandTicket && messages.length > 0 && !autoExpandedRef.current) {
      const msg = messages.find(m => m.ticketId === autoExpandTicket);
      if (msg) {
        autoExpandedRef.current = true;
        handleExpand(msg);
      }
    }
  }, [autoExpandTicket, messages]);

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

  const hasUnreadReply = (msg: UserMessage) => msg.status === 'replied' && !msg.replyReadAt;

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
            {/* Send message form — at top */}
            <Text style={styles.heading}>Send us a message</Text>
            <Text style={styles.subtitle}>We'll respond soon. <Image source={require('../../assets/smile.jpg')} style={{ width: 20, height: 20, top: 4 }} /></Text>

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
            <View style={styles.sendCloseRow}>
              <Button
                title="Send"
                onPress={handleSend}
                disabled={!body.trim()}
                loading={loading}
                style={styles.rowButton}
              />
              <Button title="Close" variant="secondary" onPress={onClose} style={styles.rowButton} />
            </View>

            {/* Your Messages — below, sorted most recent first */}
            {messages.length > 0 && (
              <View style={styles.messagesSection}>
                <Text style={styles.heading}>Your Messages</Text>
                <View style={styles.messagesList}>
                  {messages.map(msg => (
                    <View key={msg.id} style={styles.messageItem}>
                      <Pressable onPress={() => handleExpand(msg)} style={styles.messageHeader}>
                        {hasUnreadReply(msg) && (
                          <Text style={styles.newBadge}>New</Text>
                        )}
                        <Text style={[styles.ticketText, hasUnreadReply(msg) && styles.unreadTicket]}>#{msg.ticketId}</Text>
                        <Text style={[styles.subjectText, hasUnreadReply(msg) && styles.unreadSubject]} numberOfLines={1}>{msg.subject}</Text>
                        <Text style={styles.dateText}>{formatDate(msg.createdAt)}</Text>
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
              </View>
            )}

          </ScrollView>
        </View>
      </View>

      <ConfirmDialog
        visible={showSentModal}
        title="Message Sent"
        body={`Your message has been sent (#${sentTicketId}).  We will respond soon.`}
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
    ...shadows.modal,
  },
  scrollInner: {
    padding: spacing.lg,
  },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand,
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
    minHeight: 100,
    fontSize: fontSize.base,
    color: '#444444',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeX: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    padding: 8,
  },
  sendCloseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rowButton: {
    flex: 1,
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
  messagesSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  messagesList: {
    marginTop: spacing.xs,
  },
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
  newBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#444444',
    backgroundColor: '#FFFF00',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  ticketText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  unreadTicket: {
    fontWeight: '700',
    color: colors.green,
  },
  subjectText: {
    fontSize: fontSize.sm,
    color: '#444444',
    flex: 1,
  },
  unreadSubject: {
    fontWeight: '700',
    color: colors.green,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
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
