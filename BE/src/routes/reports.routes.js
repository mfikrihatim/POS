const router = require('express').Router();
const { z } = require('zod');
const env = require('../config/env');
const { validate } = require('../utils/http');
const { authorize } = require('../middleware/auth');
const reports = require('../services/report.service');
const { sendMail } = require('../services/mail.service');
const { reportHtml } = require('../services/templates');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').optional();
const rangeSchema = z.object({ from: date, to: date }).refine((r) => !r.from || !r.to || r.from <= r.to, { message: 'Tanggal awal harus sebelum tanggal akhir', path: ['from'] });

router.use(authorize('admin'));

router.get('/sales', validate({ query: rangeSchema }), async (req, res) => {
  res.json(await reports.salesReport(req.valid.query));
});

router.get('/sales.csv', validate({ query: rangeSchema }), async (req, res) => {
  const { range, csv } = await reports.transactionsCsv(req.valid.query);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="laporan-penjualan-${range.from}_${range.to}.csv"`);
  res.send(csv);
});

router.post('/sales/email', validate({
  body: z.object({ email: z.email('Format email tidak valid').trim(), from: date, to: date }),
}), async (req, res) => {
  const { email, from, to } = req.valid.body;
  const report = await reports.salesReport({ from, to });
  const { csv } = await reports.transactionsCsv({ from, to });
  const result = await sendMail({
    to: email,
    subject: `Laporan Penjualan ${env.store.name} (${report.range.from} s/d ${report.range.to})`,
    html: reportHtml(report),
    attachments: [{ filename: `laporan-penjualan-${report.range.from}_${report.range.to}.csv`, content: csv }],
    type: 'report',
    reference: `${report.range.from}_${report.range.to}`,
  });
  if (result.status === 'failed') return res.status(502).json({ message: `Email gagal dikirim: ${result.error}` });
  res.json({ message: result.status === 'sent' ? 'Laporan terkirim ke email' : 'SMTP belum dikonfigurasi, laporan disimpan di server', email: result });
});

module.exports = router;
