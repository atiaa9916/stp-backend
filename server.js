// server.js
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

if (!process.env.MONGO_URI) {
  console.error('❌ خطأ: لم يتم العثور على MONGO_URI في ملف البيئة .env');
  process.exit(1);
}

const app  = require('./app');
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ تم الاتصال بـ MongoDB');

    const cn = mongoose.connection;
    const rawUrl = (cn.client && cn.client.s && cn.client.s.url) || process.env.MONGO_URI || '';
    const safeUrl = rawUrl.replace(/\/\/([^:@]*):([^@]*)@/, '//$1:***@');
    console.log('Mongo DB =', cn.name, safeUrl);

    const server = app.listen(PORT, () => {
      console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);

      // مهام الرحلات المجدولة
      const processScheduledTrips  = require('./utils/scheduledTripProcessor');
      if ((process.env.RUN_JOBS || 'true').toLowerCase() === 'true') {
        setInterval(processScheduledTrips, 60 * 1000);
      }
    });

    const shutdown = async (signal = 'SIGTERM') => {
      try {
        console.log(`🛑 ${signal} received. Shutting down...`);
        if (server && server.close) await new Promise((resolve) => server.close(resolve));
        await mongoose.connection.close();
        console.log('👋 Closed MongoDB connection. Bye!');
        process.exit(0);
      } catch (err) {
        console.error('❌ Shutdown error:', err);
        process.exit(1);
      }
    };

    process.once('SIGINT',  () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((err) => {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
    process.exit(1);
  });
