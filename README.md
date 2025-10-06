# STP Backend – Wallet API

توثيق محفظة **Syria Transport Platform** (تشغيل محلي).

> **BASE:** `http://localhost:5000`

## المصادقة (Auth)

كل الطلبات تتطلب **Bearer JWT** في الهيدر:

Authorization: Bearer <JWT>

> أثناء التطوير يمكنك حفظ التوكن في المتصفح لتسهيل الاختبار:
```js
localStorage.setItem('stp.driver.token',    '<JWT_FROM_LOGIN>');
// أو للراكب:
localStorage.setItem('stp.passenger.token', '<JWT_FROM_LOGIN>');


1) GET /api/wallet/balance
يرجع رصيد المستخدم الحالي من قاعدة البيانات بعد مزامنة الرصيد الدفتري.

Headers
Authorization: Bearer <JWT>


Response 200
{
  "balance": 873500,
  "currency": "SYP"
}


Response 401
{ "message": "رمز الوصول لا يحوي معرّف مستخدم" }

مثال cURL
curl -H "Authorization: Bearer <JWT>" http://localhost:5000/api/wallet/balance


2) GET /api/wallet/statement
إرجاع حركات المحفظة مع ترشيح وترقيم الصفحات.

Query params

الاسم	النوع	الافتراضي	الوصف
limit	عدد صحيح	10	عدد العناصر في الصفحة (1..50).
page	عدد صحيح	1	رقم الصفحة (يبدأ من 1).
type	نص	—	credit أو debit لاختيار نوع الحركة.
before	نص (ISO)	—	تاريخ ISO (مثل 2025-10-03T20:00:00Z) لإرجاع ما قبله.

Headers
Authorization: Bearer <JWT>


Response 200
{
  "items": [
    { "_id": "68e097...d06b", "type": "debit",  "amount": 100, "desc": "تحويل إلى 5555555555", "createdAt": "2025-10-04T03:41:55.420Z" }
  ],
  "total": 14,
  "page": 1,
  "limit": 5
}


مثال cURL
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:5000/api/wallet/statement?limit=5&page=1&type=debit&before=2025-10-03T20:00:00Z"


3) POST /api/wallet/charge
شحن المحفظة (إضافة رصيد).

Headers
Authorization: Bearer <JWT>
Content-Type: application/json


Body
{ "amount": 500 }


Response 200
{ "message": "تم شحن الرصيد بنجاح", "balance": 874000 }


Response 400
{ "message": "مبلغ غير صالح" }


مثال cURL
curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{ "amount": 500 }' http://localhost:5000/api/wallet/charge


4) POST /api/wallet/transfer
تحويل رصيد بين سائق ↔ راكب فقط، مع حد أدنى لازم يبقى بمحفظة المُرسل.

Headers
Authorization: Bearer <JWT>
Content-Type: application/json


Body
{ "recipientPhone": "5555555555", "amount": 100 }


Response 200
{
  "message": "✅ تم تحويل الرصيد بنجاح",
  "newSenderBalance": 873900,
  "transferredTo": "5555555555"
}


Response 400
{ "message": "❌ لا يمكن التحويل، يجب أن يبقى في المحفظة على الأقل 20000 بعد التحويل" }


Response 403
{ "message": "❌ التحويل غير مسموح بين driver و passenger" }


Response 404
{ "message": "المستخدم المستلم غير موجود" }


مثال cURL
curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{ "recipientPhone": "5555555555", "amount": 100 }' \
  http://localhost:5000/api/wallet/transfer


