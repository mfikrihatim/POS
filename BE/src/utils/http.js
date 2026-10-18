const { ZodError } = require('zod');

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Validasi req.body / req.query / req.params dengan schema zod; hasil parse disimpan di req.valid
const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const key of ['params', 'query', 'body']) {
    if (schemas[key]) req.valid[key] = schemas[key].parse(req[key] ?? {});
  }
  next();
};

// Pagination standar: ?page=1&limit=10 -> { page, limit, offset }
function pageParams(query, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

// Whitelist kolom sort agar aman dari SQL injection
function sortClause(query, allowed, fallback) {
  const [field, dirRaw] = String(query.sort || '').split(':');
  const col = allowed[field];
  if (!col) return fallback;
  return `${col} ${dirRaw === 'desc' ? 'DESC' : 'ASC'}`;
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(422).json({ message: details[0]?.message || 'Data tidak valid', details });
  }
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 2 MB' : err.message;
    return res.status(422).json({ message: msg });
  }
  if (err.code === '23505') return res.status(409).json({ message: 'Data sudah ada (duplikat)', detail: err.detail });
  if (err.code === '23503') return res.status(409).json({ message: 'Data masih dipakai oleh data lain' });
  if (err.code === '23514') return res.status(422).json({ message: 'Data melanggar aturan (mis. stok tidak boleh minus)' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Terjadi kesalahan pada server' : err.message, details: err.details });
}

module.exports = { AppError, validate, pageParams, pageMeta, sortClause, errorHandler };
