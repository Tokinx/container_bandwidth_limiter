import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const hashedPassword = bcrypt.hashSync(config.admin.password, 10);

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (username !== config.admin.username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, hashedPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: '7d' });

    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/verify', authMiddleware, (req: Request, res: Response) => {
  res.json({ valid: true });
});

router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
