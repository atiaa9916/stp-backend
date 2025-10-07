# STP Backend – Wallet API

توثيق محفظة **Syria Transport Platform** (تشغيل محلي).

> **BASE:** `http://localhost:5000`

---

## المصادقة (Auth)

كل الطلبات تتطلب **Bearer JWT** في الهيدر:

```http
Authorization: Bearer <JWT>
```

> أثناء التطوير يمكنك حفظ التوكن في المتصفح لتسهيل الاختبار:

```js
localStorage.setItem('stp.driver.token',    '<JWT_FROM_LOGIN>');
// أو للراكب:
localStorage.setItem('stp.passenger.token', '<JWT_FROM_LOGIN>');
```

---

## نقاط النهاية (Endpoints)

### 1) `GET /api/wallet/balance`

- **Headers**
```http
Authorization: Bearer <JWT>
```
- **Response 200**
```json
{
  "balance": 873500,
  "currency": "SYP"
}
```
- **Response 401**
```json
{ "message": "غير مصرح: التوكن مفقود أو منتهي" }
```
- **cURL**
```bash
curl -H "Authorization: Bearer <JWT>" http://localhost:5000/api/wallet/balance
```

---

### 2) `GET /api/wallet/statement`

إرجاع حركات المحفظة مع الترشيح (filtering) وترقيم الصفحات (pagination).

- **Query params**

| الاسم      | النوع             | الافتراضي | الوصف                                                         |
|-----------|--------------------|-----------|---------------------------------------------------------------|
| `limit`   | عدد صحيح (1..50)  | `10`      | عدد العناصر في الصفحة.                                       |
| `page`    | عدد صحيح          | `1`       | رقم الصفحة (يبدأ من 1).                                       |
| `type`    | نص                 | —         | إما `credit` أو `debit` لاختيار نوع الحركة.                   |
| `before`  | نص (ISO datetime)  | —         | تاريخ بصيغة ISO مثل `2025-10-03T20:00:00Z` لإرجاع ما قبله.    |

- **Headers**
```http
Authorization: Bearer <JWT>
```

- **Response 200 (مثال)**
```json
{
  "items": [
    {
      "_id": "68e097...d06b",
      "type": "debit",
      "amount": 100,
      "desc": "تحويل إلى 5555555555",
      "createdAt": "2025-10-04T03:41:55.420Z"
    }
  ],
  "total": 14,
  "page": 1,
  "limit": 5
}
```

- **Response 401**
```json
{ "message": "غير مصرح: التوكن مفقود أو منتهي" }
```

- **cURL**
```bash
curl -H "Authorization: Bearer <JWT>" "http://localhost:5000/api/wallet/statement?limit=5&page=1&type=debit&before=2025-10-03T20:00:00Z"
```

---

### 3) `POST /api/wallet/charge`

شحن المحفظة (إضافة رصيد).

- **Headers**
```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

- **Body**
```json
{ "amount": 500 }
```

- **Response 200**
```json
{ "message": "تم شحن الرصيد بنجاح", "balance": 874000 }
```

- **Response 400**
```json
{ "message": "مبلغ غير صالح" }
```

- **Response 401**
```json
{ "message": "غير مصرح: التوكن مفقود أو منتهي" }
```

- **cURL**
```bash
curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json"   -d '{ "amount": 500 }' http://localhost:5000/api/wallet/charge
```

---

### 4) `POST /api/wallet/transfer`

تحويل رصيد بين **سائق ↔ راكب فقط**، مع حدٍّ أدنى يجب أن يبقى في محفظة المُرسل بعد التحويل.

- **Headers**
```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

- **Body**
```json
{ "recipientPhone": "5555555555", "amount": 100 }
```

- **Response 200**
```json
{
  "message": "✅ تم تحويل الرصيد بنجاح",
  "newSenderBalance": 873900,
  "transferredTo": "5555555555"
}
```

- **Response 400**  *(مثال لسياسة الحد الأدنى)*
```json
{ "message": "❌ لا يمكن التحويل، يجب أن يبقى في المحفظة على الأقل 20000 بعد التحويل" }
```

- **Response 401**
```json
{ "message": "غير مصرح: التوكن مفقود أو منتهي" }
```

- **Response 403**
```json
{ "message": "❌ التحويل غير مسموح بين driver و passenger" }
```

- **Response 404**
```json
{ "message": "المستخدم المستلم غير موجود" }
```

- **cURL**
```bash
curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json"   -d '{ "recipientPhone": "5555555555", "amount": 100 }'   http://localhost:5000/api/wallet/transfer
```

---

## ملاحظات

- جميع الواجهات تستخدم استجابة **401** موحّدة عند غياب/انتهاء التوكن.
- العملة الافتراضية: **SYP (ل.س)**.
- للمطورين: أثناء الاختبار على واجهة الويب، يمكنك القراءة من `localStorage`:
```js
const driverToken    = localStorage.getItem('stp.driver.token');
const passengerToken = localStorage.getItem('stp.passenger.token');
```
- تأكد من تمرير الـ JWT الصحيح حسب دور المستخدم (سائق/راكب).
- هذا الملف يركّز على الاندبوينتس الخاصة بالمحفظة فقط.
