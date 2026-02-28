import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { getRecentActivity, getUsersSummary } from '../services/activityService';

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

export default router;
