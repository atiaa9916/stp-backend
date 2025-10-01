require('dotenv').config();
const m = require('mongoose');
const T = require('./models/Transaction');

(async () => {
  await m.connect(process.env.MONGO_URI);
  const { ObjectId } = m.Types;
  const uid = new ObjectId('68d4defc7af8ce8d25eec4a9');

  const a = await T.collection.aggregate([
    { $match: { userId: uid } },
    { $group: {
        _id: null,
        credit: { $sum: { $cond: [ { $eq: ['$type','credit'] }, '$amount', 0 ] } },
        debit:  { $sum: { $cond: [ { $eq: ['$type','debit']  }, '$amount', 0 ] } },
    } },
    { $project: { _id:0, ledger: { $subtract: ['$credit','$debit'] } } }
  ]).toArray();

  console.log({ db: m.connection.name, ledger: a?.[0]?.ledger || 0 });
  process.exit(0);
})();
