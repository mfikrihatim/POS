const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const db = require('../config/db');

const transporter = env.smtp.enabled
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : null;

const outbox = path.join(__dirname, '..', '..', 'tmp', 'mails');

/**
 * Kirim email. Jika SMTP belum dikonfigurasi, email disimpan sebagai file HTML
 * di BE/tmp/mails supaya fitur tetap bisa didemokan.
 */
async function sendMail({ to, subject, html, attachments, type, reference }) {
  let status = 'sent';
  let error = null;
  let file = null;
  try {
    if (transporter) {
      await transporter.sendMail({ from: env.smtp.from, to, subject, html, attachments });
    } else {
      status = 'saved';
      fs.mkdirSync(outbox, { recursive: true });
      file = path.join(outbox, `${Date.now()}-${type}-${String(reference || '').replace(/[^\w-]/g, '')}.html`);
      fs.writeFileSync(file, `<!-- To: ${to} | Subject: ${subject} -->\n${html}`);
    }
  } catch (err) {
    status = 'failed';
    error = err.message;
  }
  await db.query('INSERT INTO email_logs(type, recipient, subject, status, error, reference) VALUES ($1,$2,$3,$4,$5,$6)',
    [type, to, subject, status, error, reference || null]);
  return { status, error, file: file ? path.relative(path.join(__dirname, '..', '..'), file) : null };
}

module.exports = { sendMail };
