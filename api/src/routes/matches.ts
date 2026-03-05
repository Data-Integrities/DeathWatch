import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as matchService from '../services/matchService';
import * as searchService from '../services/searchService';
import { logActivity, buildFingerprint } from '../services/activityService';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const summaries = await matchService.getSummaries(req.userId!);
    res.json({ summaries });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:searchId', async (req: Request, res: Response) => {
  try {
    const results = await matchService.getResultsForSearch(req.userId!, req.params.searchId);
    try {
      const search = await searchService.getSearch(req.userId!, req.params.searchId);
      logActivity(req.userId!, 'Match', buildFingerprint(search));
    } catch { /* non-blocking */ }
    res.json({ results });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:searchId', async (req: Request, res: Response) => {
  try {
    const deleted = await matchService.deleteResultsForSearch(req.userId!, req.params.searchId);
    res.json({ deleted });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:searchId/:resultId', async (req: Request, res: Response) => {
  try {
    await matchService.deleteResult(req.userId!, req.params.searchId, req.params.resultId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:searchId/:resultId', async (req: Request, res: Response) => {
  try {
    const result = await matchService.getResult(req.userId!, req.params.searchId, req.params.resultId);
    res.json({ result });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:searchId/:resultId/confirm', async (req: Request, res: Response) => {
  try {
    const search = await matchService.confirmResult(req.userId!, req.params.searchId, req.params.resultId);
    res.json({ search });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:searchId/:resultId/unconfirm', async (req: Request, res: Response) => {
  try {
    const search = await matchService.unconfirmResult(req.userId!, req.params.searchId, req.params.resultId);
    res.json({ search });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:searchId/:resultId/reject', async (req: Request, res: Response) => {
  try {
    await matchService.rejectResult(req.userId!, req.params.searchId, req.params.resultId, req.body.reason);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:searchId/:resultId/restore', async (req: Request, res: Response) => {
  try {
    await matchService.restoreResult(req.userId!, req.params.searchId, req.params.resultId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:searchId/mark-read', async (req: Request, res: Response) => {
  try {
    const updated = await matchService.markRead(req.userId!, req.params.searchId);
    res.json({ updated });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
