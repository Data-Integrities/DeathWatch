import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';

/**
 * Middleware that requires the authenticated user to be an admin.
 * Must be used AFTER authMiddleware (req.userId must already be set).
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { rows } = await pool.query(
      'SELECT is_admin FROM dw_user WHERE login_id = $1',
      [req.userId]
    );
    if (rows.length === 0 || !rows[0].is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch {
    res.status(403).json({ error: 'Admin access required' });
  }
}
