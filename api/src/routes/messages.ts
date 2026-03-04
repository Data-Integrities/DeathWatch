import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createMessage, getUserMessages, markReplyRead } from '../services/messageService';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: Request, res: Response) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !subject.trim()) {
      res.status(400).json({ error: 'Subject is required' });
      return;
    }
    if (!body || !body.trim()) {
      res.status(400).json({ error: 'Message body is required' });
      return;
    }
    const result = await createMessage(req.userId!, subject.trim(), body.trim());
    res.status(201).json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const messages = await getUserMessages(req.userId!);
    res.json({ messages });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id/read-reply', async (req: Request, res: Response) => {
  try {
    await markReplyRead(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
