const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { validate, AppError } = require('../utils/http');
const { authenticate, signToken } = require('../middleware/auth');

const loginSchema = z.object({
  email: z.email('Format email tidak valid').trim().toLowerCase(),
  password: z.string().min(1, 'Password wajib diisi'),
});

router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.valid.body;
  const { rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new AppError(401, 'Email atau password salah');
  if (!user.is_active) throw new AppError(403, 'Akun Anda dinonaktifkan, hubungi admin');
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.put('/password', authenticate, validate({
  body: z.object({
    current_password: z.string().min(1, 'Password lama wajib diisi'),
    new_password: z.string().min(6, 'Password baru minimal 6 karakter'),
  }),
}), async (req, res) => {
  const { rows: [u] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(req.valid.body.current_password, u.password_hash))) throw new AppError(422, 'Password lama salah');
  await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await bcrypt.hash(req.valid.body.new_password, 10), req.user.id]);
  res.json({ message: 'Password berhasil diubah' });
});

module.exports = router;
