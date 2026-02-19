import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as matchService from '../services/matchService';

const router = Router();
router.use(authMiddleware);

router.get('/badge', async (req: Request, res: Response) => {
  try {
    const badge = await matchService.getNotificationBadge(req.userId!);
    res.json(badge);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
