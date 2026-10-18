const env = require('./config/env');
const app = require('./app');

app.listen(env.port, () => {
  console.log(`POS API berjalan di http://localhost:${env.port}`);
  console.log(`Midtrans: ${env.midtrans.enabled ? 'aktif (' + (env.midtrans.isProduction ? 'production' : 'sandbox') + ')' : 'MODE SIMULASI (key belum diisi)'}`);
  console.log(`Email   : ${env.smtp.enabled ? 'SMTP ' + env.smtp.host : 'disimpan ke BE/tmp/mails (SMTP belum diisi)'}`);
});
