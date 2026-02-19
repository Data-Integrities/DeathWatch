import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  passwordConfirm: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
}).refine(d => d.password === d.passwordConfirm, {
  message: 'Passwords do not match',
  path: ['passwordConfirm'],
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data.email, data.password, data.firstName, data.lastName);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.forgotPassword(email);
    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const data = z.object({
      token: z.string().min(1),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      passwordConfirm: z.string(),
    }).refine(d => d.password === d.passwordConfirm, {
      message: 'Passwords do not match',
      path: ['passwordConfirm'],
    }).parse(req.body);
    await authService.resetPassword(data.token, data.password);
    res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = z.object({
      passwordCurrent: z.string().min(1),
      passwordNew: z.string().min(8, 'New password must be at least 8 characters'),
      passwordNewConfirm: z.string(),
    }).refine(d => d.passwordNew === d.passwordNewConfirm, {
      message: 'New passwords do not match',
      path: ['passwordNewConfirm'],
    }).parse(req.body);
    await authService.changePassword(req.userId!, data.passwordCurrent, data.passwordNew);
    res.json({ message: 'Password changed successfully.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ user });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
