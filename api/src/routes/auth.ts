import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../db/pool';
import { normalizePhone } from '../utils/phone';

const router = Router();

const APP_URL = process.env.APP_URL || 'http://localhost:8081';

const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  passwordConfirm: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
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
    if (data.phoneNumber && !normalizePhone(data.phoneNumber)) {
      res.status(400).json({ error: 'Invalid phone number.  Please check the number and try again.' });
      return;
    }
    const result = await authService.register(data.email, data.password, data.firstName, data.lastName, data.phoneNumber);
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
    const result = await authService.login(data.email, data.password, req.ip);
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

router.post('/change-email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = z.object({
      emailNew: z.string().email('Valid email is required'),
      passwordCurrent: z.string().min(1),
    }).parse(req.body);
    await authService.changeEmail(req.userId!, data.emailNew, data.passwordCurrent);
    res.json({ message: 'Email changed successfully. A verification email has been sent to your new address.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = z.object({
      skipMatchesInfoCard: z.boolean().optional(),
      smsOptIn: z.boolean().optional(),
      phoneNumber: z.string().nullable().optional(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
    }).parse(req.body);

    if (data.skipMatchesInfoCard !== undefined) {
      await authService.updatePreference(req.userId!, 'skip_matches_info_card', data.skipMatchesInfoCard);
    }
    if (data.smsOptIn !== undefined) {
      await authService.updatePreference(req.userId!, 'sms_opt_in', data.smsOptIn);
    }
    if (data.phoneNumber !== undefined) {
      if (data.phoneNumber && !normalizePhone(data.phoneNumber)) {
        res.status(400).json({ error: 'Invalid phone number.  Please check the number and try again.' });
        return;
      }
      await authService.updatePhone(req.userId!, data.phoneNumber);
    }
    if (data.firstName !== undefined || data.lastName !== undefined) {
      // Need both names — fetch current if one is missing
      let fn = data.firstName;
      let ln = data.lastName;
      if (!fn || !ln) {
        const { rows } = await pool.query('SELECT first_name, last_name FROM dw_user WHERE login_id = $1', [req.userId!]);
        if (rows.length > 0) {
          fn = fn || rows[0].first_name;
          ln = ln || rows[0].last_name;
        }
      }
      if (fn && ln) {
        await authService.updateName(req.userId!, fn, ln);
      }
    }

    res.json({ message: 'Preferences updated.' });
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

router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.redirect(`${APP_URL}/verify-email?status=error&message=${encodeURIComponent('Missing verification token.')}`);
      return;
    }
    await authService.verifyEmail(token);
    res.redirect(`${APP_URL}/verify-email?status=success&message=${encodeURIComponent('Your email has been verified!')}`);
  } catch (err: any) {
    const message = err.message || 'Verification failed.';
    res.redirect(`${APP_URL}/verify-email?status=error&message=${encodeURIComponent(message)}`);
  }
});

router.post('/resend-verification', authMiddleware, async (req: Request, res: Response) => {
  try {
    await authService.resendVerification(req.userId!);
    res.json({ message: 'Verification email sent.' });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
