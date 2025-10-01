require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const { ObjectId } = mongoose.Types;
    const uidArg = process.argv[2];
    if (!uidArg) {
      console.error('Usage: node scripts/probe-ledger.js <uid>');
      process.exit(1);
    }
    const uid = new ObjectId(uidArg);

    await mongoose.connect(process.env.MONGO_URI);
    const col = mongoose.connection.db.collection('transactions');
    const uidStr = uid.toString();

    // عدّادات صارمة/تعبيرية/واسعة
    const strictTotal = await col.countDocuments({ userId: uid });
    const exprCount   = await col.countDocuments({ $expr: { $eq: ["$userId", uid] } });
    const anyTotal    = await col.countDocuments({
      $or: [
        { userId: uid }, { user: uid },
        { userId: uidStr }, { user: uidStr },
        { $expr: { $eq: [{ $toString: "$userId" }, uidStr] } },
        { $expr: { $eq: [{ $toString: "$user"   }, uidStr] } }
      ]
    });

    // عيّنة سريعة
    const sample = await col.find(
      { $or: [{ userId: uid }, { user: uid }, { userId: uidStr }, { user: uidStr }] },
      { projection: { type:1, amount:1, userId:1, user:1, createdAt:1 } }
    ).sort({ createdAt: -1 }).limit(5).toArray();

    // ليدجر صارم
    const agg = await col.aggregate([
      { $match: { userId: uid } },
      { $group: {
          _id: null,
          credit: { $sum: { $cond: [{ $eq: ["$type","credit"] }, "$amount", 0] } },
          debit:  { $sum: { $cond: [{ $eq: ["$type","debit" ] }, "$amount", 0] } }
      }},
      { $project: { _id:0, ledger: { $subtract: ["$credit","$debit"] } } }
    ]).toArray();

    console.log(JSON.stringify({
      db: mongoose.connection.name,
      strictTotal, exprCount, anyTotal,
      ledgerStrict: Number(agg?.[0]?.ledger || 0),
      sample
    }, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    try { await mongoose.connection.close(); } catch {}
  }
})();
