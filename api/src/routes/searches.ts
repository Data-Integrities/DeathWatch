import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import * as searchService from '../services/searchService';

const router = Router();
router.use(authMiddleware);

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const searchCreateSchema = z.object({
  nameLast: z.string().min(1, 'Last name is required'),
  nameFirst: z.string().nullable().default(null),
  nameNickname: z.string().nullable().default(null),
  nameMiddle: z.string().nullable().default(null),
  ageApx: z.number().int().min(0).max(150).nullable().default(null),
  city: z.string().nullable().default(null),
  state: z.string().length(2).refine(s => US_STATES.includes(s.toUpperCase()), 'Invalid state code').nullable().default(null),
  keyWords: z.string().nullable().default(null),
}).refine(d => d.nameFirst || d.nameNickname, {
  message: 'Either first name or nickname is required',
  path: ['nameFirst'],
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const searches = await searchService.listSearches(req.userId!);
    res.json({ searches });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = searchCreateSchema.parse(req.body);
    const result = await searchService.createSearch(req.userId!, data);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const search = await searchService.getSearch(req.userId!, req.params.id);
    res.json({ search });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const result = await searchService.updateSearch(req.userId!, req.params.id, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await searchService.deleteSearch(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
