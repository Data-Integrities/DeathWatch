import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { getRecentActivity, getUsersSummary } from '../services/activityService';
import { getMessages, replyToMessage, markMessageRead, getUnrepliedMessageCount } from '../services/messageService';
import { sendReplyNotification } from '../services/emailService';
import { sendReplySms } from '../services/smsService';

const router = Router();
router.use(authMiddleware);
router.use(adminAuth);

router.get('/activity', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = (req.query.startDate as string) || yesterday.toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || today.toISOString().slice(0, 10);
    const activity = await getRecentActivity(startDate, endDate);
    res.json({ activity });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await getUsersSummary();
    res.json({ users });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/messages/unreplied-count', async (_req: Request, res: Response) => {
  try {
    const count = await getUnrepliedMessageCount();
    res.json({ count });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/messages', async (_req: Request, res: Response) => {
  try {
    const messages = await getMessages();
    res.json({ messages });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/messages/:id/reply', async (req: Request, res: Response) => {
  try {
    const { replyText } = req.body;
    if (!replyText || !replyText.trim()) {
      res.status(400).json({ error: 'Reply text is required' });
      return;
    }
    const result = await replyToMessage(req.params.id, req.userId!, replyText.trim());
    await sendReplyNotification(result.senderEmail, result.senderFirstName, result.ticketId);
    if (result.senderSmsOptIn && result.senderPhone) {
      await sendReplySms(result.senderPhone);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/messages/:id/read', async (req: Request, res: Response) => {
  try {
    await markMessageRead(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
