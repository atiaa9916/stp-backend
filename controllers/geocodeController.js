// backend/controllers/geocodeController.js
// Proxy خفيف للبحث الجغرافي + العكس مع Cache داخلي (10 دقائق) وفولباك آمن

const TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4500;

const _cache = new Map(); // key -> { at, data }

function _get(key) {
  const row = _cache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return row.data;
}
function _set(key, data) {
  _cache.set(key, { at: Date.now(), data });
}

const clamp = (n, mn, mx) => Math.min(mx, Math.max(mn, n));
const normLang = (l) => (String(l || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en');

// إلغاء تلقائي للطلبات البطيئة
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'SyriaTransportPlatform/1.0',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ───────── تبسيط النتائج ─────────
function simplifyPhotonFeature(feat) {
  const p = feat?.properties || {};
  const [lon, lat] = feat?.geometry?.coordinates || [];
  const name =
    p.name || p.street || p.city || p.county || p.state || p.country || '—';
  const label = [p.name, p.street, p.city, p.state, p.country]
    .filter(Boolean)
    .join(' • ');
  return { name, label: label || name, lat, lng: lon };
}

function simplifyNominatimFeature(feat) {
  const p = feat?.properties || {};
  const [lon, lat] = feat?.geometry?.coordinates || [];
  const display = p.display_name || '';
  const name =
    p.name ||
    (display ? String(display).split(',')[0].trim() : '') ||
    p.type ||
    '—';
  return { name, label: display || name, lat, lng: lon };
}

function dedupByCoord(list) {
  const seen = new Set();
  const out = [];
  for (const it of list) {
    const key = `${(+it.lat).toFixed(5)},${(+it.lng).toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// ───────── البحث عن أماكن ─────────
exports.search = async (req, res) => {
  try {
    const qRaw = (req.query.q || '').trim();
    if (!qRaw || qRaw.length < 2) {
      return res.status(400).json({ message: 'q مطلوب (حد أدنى حرفان)' });
    }
    const lang = normLang(req.query.lang);
    const limit = clamp(Number(req.query.limit) || 6, 1, 10);

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hasNear = Number.isFinite(lat) && Number.isFinite(lng);

    const cacheKey = `geo:search:${lang}:${qRaw}:${hasNear ? lat.toFixed(3) + ',' + lng.toFixed(3) : ''}:${limit}`;
    const cached = _get(cacheKey);
    if (cached) return res.json({ data: cached });

    // 1) Photon (أسرع عادةً + يدعم ترجيح الموقع)
    const phParams = new URLSearchParams({
      q: qRaw,
      lang,
      limit: String(limit),
    });
    if (hasNear) {
      phParams.set('lat', String(lat));
      phParams.set('lon', String(lng));
    }
    const phUrl = `https://photon.komoot.io/api/?${phParams.toString()}`;

    let list = [];
    try {
      const r = await fetchWithTimeout(phUrl);
      if (r.ok) {
        const j = await r.json();
        const feats = Array.isArray(j?.features) ? j.features : [];
        list = feats.map(simplifyPhotonFeature);
      }
    } catch {
      // تجاهل – سنحاول Nominatim
    }

    // 2) فولباك إلى Nominatim (GeoJSON)
    if (!Array.isArray(list) || list.length === 0) {
      const nmParams = new URLSearchParams({
        format: 'geojson',
        q: qRaw,
        'accept-language': lang,
        limit: String(limit),
      });
      const nmUrl = `https://nominatim.openstreetmap.org/search?${nmParams.toString()}`;
      const r2 = await fetchWithTimeout(nmUrl);
      if (!r2.ok) throw new Error(`Nominatim HTTP ${r2.status}`);
      const j2 = await r2.json();
      const feats = Array.isArray(j2?.features) ? j2.features : [];
      list = feats.map(simplifyNominatimFeature);
    }

    // إزالة التكرارات + قصّ للحد
    list = dedupByCoord(list).slice(0, limit);

    _set(cacheKey, list);
    return res.json({ data: list });
  } catch (err) {
    return res.status(500).json({ message: 'فشل البحث', error: err.message });
  }
};

// ───────── تحويل إحداثيات إلى عنوان ─────────
exports.reverse = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'lat/lng غير صالحة' });
    }
    const lang = normLang(req.query.lang);
    const cacheKey = `geo:rev:${lang}:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = _get(cacheKey);
    if (cached) return res.json({ data: cached });

    // Nominatim أولاً (أدق في العكس)
    const nmParams = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      'accept-language': lang,
    });
    const nmUrl = `https://nominatim.openstreetmap.org/reverse?${nmParams.toString()}`;
    const r = await fetchWithTimeout(nmUrl);
    if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
    const j = await r.json();

    const display =
      j.display_name ||
      [j.address?.road, j.address?.city, j.address?.state, j.address?.country]
        .filter(Boolean)
        .join(' • ') ||
      '—';

    const data = { label: display, lat, lng };
    _set(cacheKey, data);
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ message: 'فشل العكس', error: err.message });
  }
};
