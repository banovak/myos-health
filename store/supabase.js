/* Level 2 storage: your own Supabase project. Records live in the `health` schema,
   photos and files in the private `health-media` bucket under your user id.
   Saves send only the rows that changed since the last load or save. */
(function () {
  const BUCKET = 'health-media';
  /* Photo vault: AES-GCM, key derived from a passphrase with PBKDF2 (600k, SHA-256).
     The key never leaves the device; it is kept non-extractable in IndexedDB. */
  const VAULT_CHECK = 'myos-health-vault-v1', ITER = 600000;
  const b64 = u8 => btoa(String.fromCharCode(...u8));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptBytes(key, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
  }
  async function decryptBytes(key, buf) {
    const u = new Uint8Array(buf);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12)));
  }
  const keyDb = () => new Promise((res, rej) => { const r = indexedDB.open('myos-health-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function keyGet(id) { const db = await keyDb(); return new Promise(res => { const q = db.transaction('keys').objectStore('keys').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); }
  async function keyPut(id, k) { const db = await keyDb(); return new Promise((res, rej) => { const tx = db.transaction('keys', 'readwrite', { durability: 'strict' }); k ? tx.objectStore('keys').put(k, id) : tx.objectStore('keys').delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  const ORDER = ['metrics', 'concerns', 'regimens', 'regimen_logs', 'courses', 'plans', 'challenges', 'entries', 'lab_reports', 'lab_results', 'charts', 'suggestions', 'daily_metrics', 'cycle_days', 'reminders', 'profile'];
  const CONFLICT = { metrics: 'owner,key', daily_metrics: 'owner,on_date,source,key', cycle_days: 'owner,on_date,source', profile: 'owner' };
  // Rows that came from an integration (Apple Health, Oura, Whoop, Strava) are never written or deleted
  // by this app. Only manual rows take part in the diff, so a stale tab can't overwrite a fresher sync.
  const writable = rows => Object.fromEntries(Object.entries(rows).map(([t, rs]) => [t, t === 'daily_metrics' ? [] : (t === 'cycle_days' || t === 'regimen_logs') ? rs.filter(r => (r.source || 'manual') === 'manual') : rs]));
  const keyOf = (t, r) => t === 'metrics' ? r.key : t === 'daily_metrics' ? `${r.on_date}|${r.source}|${r.key}` : t === 'cycle_days' ? `${r.on_date}|${r.source}` : t === 'profile' ? 'me' : r.id;
  const rid = () => Math.random().toString(36).slice(2, 10);
  const safe = n => String(n || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
  function dataUrlToBlob(u) {
    const [head, b64] = u.split(',');
    const type = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }

  /* a photo as its row holds it: the storage path, whether it is encrypted, its fit and label (the same shape the phone writes) */
  const photoRow = p => ({ ...(p.enc ? { path: p.path, enc: true } : { path: p.path }), ...(p.fit ? { fit: p.fit } : {}), ...(p.label ? { label: p.label } : {}) });

  /* app state -> table rows */
  function toRows(D) {
    return {
      metrics: Object.entries(D.metrics || {}).map(([key, m], i) => { const kind = m.kind || (m.rating ? 'rating' : 'number'); return { key, label: m.l, unit: m.u || '', is_rating: kind === 'rating', kind, sort_order: i }; }),
      // kind, episodes and colour travel only when set (an illness, a coloured concern), so older rows keep saving without the columns
      concerns: D.concerns.map(c => ({ id: c.id, title: c.title, regions: c.regions || [], started_on: c.started_on || null, resolved_on: c.resolved_on || null, status: c.status || 'active', notes: c.notes || '', tracking: c.tracking || {}, ...(c.kind === 'illness' ? { kind: 'illness', episodes: c.episodes || [] } : {}), ...(c.color ? { color: c.color } : {}) })),
      // periods only travels when there is more than one stint, and only counts on the way back when it agrees with
      // started_on / ended_on: a row saved by a side that does not know stints keeps the ends right
      regimens: D.regimens.map(r => ({ id: r.id, name: r.name, category: r.category, dose: r.dose || '', frequency: r.frequency || '', started_on: r.started_on, ended_on: r.ended_on || null, regions: r.regions || [], concern_id: r.concern_id || null, color: r.color || null, notes: r.notes || '', target: r.target || null, match: r.match || { source: 'manual' }, changes: r.changes || [], photos: (r.photos || []).filter(p => p.path).map(photoRow), ...(r.periods && r.periods.length > 1 ? { periods: r.periods } : {}) })),
      regimen_logs: (D.regLogs || []).map(l => ({ id: l.id, regimen_id: l.regimen_id, on_date: l.on_date, at_time: l.time || null, source: l.source || 'manual', source_ref: l.source_ref || null, note: l.note || '' })),
      courses: D.courses.map(k => ({ id: k.id, title: k.title, kind: k.kind, provider: k.provider || '', practice: k.practice || '', cadence: k.cadence || '', started_on: k.started_on, ended_on: k.ended_on || null, concern_id: k.concern_id || null, metric: k.metric || null, cost: k.cost == null || k.cost === '' ? null : +k.cost, color: k.color || null, notes: k.notes || '' })),
      plans: D.plans.map((p, i) => ({ id: p.id, year: +p.year, title: p.title, kind: p.kind, per_year: +p.per_year || 1, notes: p.notes || '', category: p.category || '', sort_order: i })),
      challenges: D.challenges.map(c => ({ id: c.id, title: c.title, started_on: c.started_on, days: c.days ? +c.days : null, regimen_ids: c.regimen_ids || [], rules: c.rules || [], notes: c.notes || '', kind: c.kind || 'challenge', config: c.config || {} })),
      entries: D.entries.map(e => ({
        id: e.id, occurred_at: e.occurred_at, type: e.type, title: e.title, notes: e.notes || '', regions: e.regions || [],
        concern_id: e.concern_id || null, parent_entry_id: e.parent_entry_id || null, details: e.details || {}, source: e.source || 'manual',
        photos: (e.photos || []).filter(p => p.path).map(photoRow),
        files: (e.files || []).filter(f => f.path).map(f => ({ path: f.path, name: f.name, size: f.size || null, enc: !!f.enc, type: f.type || null }))
      })),
      // kind and title travel only for the other documents (a prescription, a scan), so lab rows keep saving without the columns
      lab_reports: D.labs.map(l => ({ id: l.id, collected_on: l.date, lab: l.lab || '', file: l.file && typeof l.file === 'object' && l.file.path ? { path: l.file.path, name: l.file.name, enc: !!l.file.enc, type: l.file.type || null } : null, notes: l.notes || '', ...(l.kind && l.kind !== 'lab' ? { kind: l.kind } : {}), ...(l.title ? { title: l.title } : {}) })),
      lab_results: D.labs.flatMap(l => l.results.map((r, i) => ({ id: `${l.id}~${i}`, report_id: l.id, marker: r.marker, value: +r.value, unit: r.unit || '', range_text: r.range || '', flag_text: r.flag || '', sort_order: i }))),
      charts: D.charts.map((c, i) => { const { id, title, ...config } = c; return { id, title: title || '', config, sort_order: i }; }),
      suggestions: D.suggestions.map(s => ({ id: s.id, source: s.source || 'calendar', source_ref: s.source_ref || null, title: s.title, occurred_at: s.occurred_at, details: s.details || {}, found: s.found || '', status: s.status })),
      reminders: (D.reminders || []).map(r => ({ id: r.id, title: r.title || '', target_kind: r.target_kind || 'custom', target_id: r.target_id || null, schedule: r.schedule || {}, private: !!r.private, skip_if_done: r.skip_if_done !== false, enabled: r.enabled !== false })),
      cycle_days: (D.cycle || []).map(c => ({ on_date: c.on_date, source: c.source || 'manual', flow: c.flow || 'none', symptoms: c.symptoms || [], note: c.note || '', source_ref: c.source_ref || null })),
      daily_metrics: Object.entries(D.hk || {}).flatMap(([key, pts]) => (pts || []).map(p => ({ on_date: p.d, source: 'apple_health', key, value: +p.v }))),
      profile: [{ base_photo: D.basePhotoPath ? (D.basePhotoEnc ? { path: D.basePhotoPath, enc: true } : { path: D.basePhotoPath }) : null, points: D.points || [], custom_regions: D.customRegions || {}, widgets: D.widgets || null, chart_layout: D.chartLayout || 'top', chart_zones: D.chartZones || null, settings: D.settings || {} }]
    };
  }
  const snapshotOf = rows => Object.fromEntries(ORDER.map(t => [t, new Map(rows[t].map(r => [keyOf(t, r), JSON.stringify(r)]))]));

  window.MyOSStores = window.MyOSStores || {};
  window.MyOSStores.supabase = function (cfg, hooks) {
    if (!window.supabase) throw new Error('The Supabase library did not load. Check your internet connection.');
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const T = n => sb.schema('health').from(n);
    const status = (s, m) => hooks && hooks.onStatus && hooks.onStatus(s, m);
    let uid = null, snap = null, timer = null, busy = false, latest = null, again = false, retry = null, vaultKey = null;
    const plain = new Map();

    async function selectAll(t) {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await T(t).select('*').range(from, from + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) return out;
      }
    }
    async function sign(paths) {
      const m = {};
      for (let i = 0; i < paths.length; i += 100) {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 100), 1800);
        if (error) throw error;
        data.forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl; });
      }
      return m;
    }
    async function upload(blob, path) {
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
      if (error) throw error;
    }
    // every photo and file is encrypted on this device before upload; storage only ever holds ciphertext
    async function sealed(blob, path) {
      if (!vaultKey) { const e = new Error('Photos and files are locked on this device. Unlock them under Security.'); e.code = 'VAULT_LOCKED'; throw e; }
      const ct = await encryptBytes(vaultKey, new Uint8Array(await blob.arrayBuffer()));
      await upload(new Blob([ct], { type: 'application/octet-stream' }), path);
    }
    async function uploadMedia(D) {
      for (const e of D.entries) {
        for (const p of e.photos || []) if (!p.path && p.src && p.src.startsWith('data:')) { const path = `${uid}/photos/${e.id}-${rid()}.bin`; await sealed(dataUrlToBlob(p.src), path); p.path = path; p.enc = true; plain.set(path, p.src); }
        for (const f of e.files || []) if (!f.path && (f.blob || f.dataUrl)) { const b = f.blob || dataUrlToBlob(f.dataUrl); const path = `${uid}/files/${e.id}-${rid()}.bin`; await sealed(b, path); f.path = path; f.enc = true; f.type = b.type || 'application/octet-stream'; delete f.blob; delete f.dataUrl; }
      }
      // photos of a regimen's product and of a provider: the same encryption, their own path prefixes (the phone reads them back the same way)
      for (const r of D.regimens) for (const p of r.photos || []) if (!p.path && p.src && p.src.startsWith('data:')) { const path = `${uid}/photos/reg-${r.id}-${rid()}.bin`; await sealed(dataUrlToBlob(p.src), path); p.path = path; p.enc = true; plain.set(path, p.src); }
      for (const pv of (D.settings && D.settings.providers) || []) { const p = pv.photo; if (p && !p.path && p.src && p.src.startsWith('data:')) { const path = `${uid}/photos/prov-${pv.id}-${rid()}.bin`; await sealed(dataUrlToBlob(p.src), path); p.path = path; p.enc = true; plain.set(path, p.src); delete p.src; } }
      for (const l of D.labs) { const f = l.file; if (f && typeof f === 'object' && !f.path && (f.blob || f.dataUrl)) { const b = f.blob || dataUrlToBlob(f.dataUrl); const path = `${uid}/labs/${l.id}-${rid()}.bin`; await sealed(b, path); f.path = path; f.enc = true; f.type = b.type || 'application/pdf'; delete f.blob; delete f.dataUrl; } }
      if (D.basePhoto && D.basePhoto.startsWith('data:') && !D.basePhotoPath) { const path = `${uid}/base-${rid()}.bin`; await sealed(dataUrlToBlob(D.basePhoto), path); D.basePhotoPath = path; D.basePhotoEnc = true; plain.set(path, D.basePhoto); }
    }
    async function flush() {
      if (busy) { again = true; return; }
      busy = true; clearTimeout(retry); status('saving');
      const D = latest;
      try {
        await uploadMedia(D);
        const rows = writable(toRows(D)), old = snap || snapshotOf(Object.fromEntries(ORDER.map(t => [t, []])));
        for (const t of ORDER) {
          const changed = rows[t].filter(r => old[t].get(keyOf(t, r)) !== JSON.stringify(r)).map(r => ({ ...r, owner: uid }));
          if (!changed.length) continue;
          const { error } = await T(t).upsert(changed, CONFLICT[t] ? { onConflict: CONFLICT[t] } : undefined);
          if (error) throw error;
        }
        for (const t of [...ORDER].reverse()) {
          if (t === 'profile') continue;
          const cur = new Set(rows[t].map(r => keyOf(t, r)));
          const gone = [...old[t].keys()].filter(k => !cur.has(k));
          if (!gone.length) continue;
          if (t === 'metrics') { const { error } = await T(t).delete().in('key', gone); if (error) throw error; }
          else if (t === 'cycle_days') { for (const k of gone) { const [on_date, source] = k.split('|'); const { error } = await T(t).delete().match({ on_date, source }); if (error) throw error; } }
          else if (t === 'daily_metrics') { for (const k of gone) { const [on_date, source, key] = k.split('|'); const { error } = await T(t).delete().match({ on_date, source, key }); if (error) throw error; } }
          else { const { error } = await T(t).delete().in('id', gone); if (error) throw error; }
        }
        snap = snapshotOf(rows);
        status('saved');
      } catch (e) {
        status('error', e.message || String(e));
        retry = setTimeout(flush, 15000);
      } finally {
        busy = false;
        if (again) { again = false; flush(); }
      }
    }

    return {
      mode: 'supabase',
      needsAuth: true,
      async session() {
        const { data } = await sb.auth.getSession();
        uid = data.session ? data.session.user.id : null;
        if (uid && !vaultKey) vaultKey = await keyGet(uid);
        return data.session;
      },
      async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; await this.session(); },
      async signUp(email, password) { const { data, error } = await sb.auth.signUp({ email, password }); if (error) throw error; await this.session(); return !data.session; },
      async signOut() { await sb.auth.signOut(); uid = null; snap = null; },
      /* two-step sign-in (TOTP) */
      async mfaFactors() { const { data, error } = await sb.auth.mfa.listFactors(); if (error) throw error; return data; },
      async mfaEnabled() { return (await this.mfaFactors()).totp.some(f => f.status === 'verified'); },
      async mfaNeeded() { const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); return !!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'; },
      async mfaEnroll() {
        const all = await this.mfaFactors();
        for (const f of all.all.filter(f => f.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
        const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'My OS Health' });
        if (error) throw error; return data;
      },
      async mfaVerify(factorId, code) { const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code }); if (error) throw error; },
      async mfaSignIn(code) { const f = (await this.mfaFactors()).totp.find(x => x.status === 'verified'); if (!f) throw new Error('No two-step factor found.'); await this.mfaVerify(f.id, code); },
      /* photo vault */
      vaultState(meta) { return !meta ? 'none' : vaultKey ? 'unlocked' : 'locked'; },
      async vaultRestore() { if (uid) vaultKey = await keyGet(uid); return !!vaultKey; },
      async vaultSetup(pass) {
        const salt = crypto.getRandomValues(new Uint8Array(16)), key = await deriveKey(pass, salt);
        const check = await encryptBytes(key, new TextEncoder().encode(VAULT_CHECK));
        vaultKey = key; await keyPut(uid, key);
        return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITER, salt: b64(salt), check: b64(check) };
      },
      async vaultUnlock(pass, meta) {
        const key = await deriveKey(pass, unb64(meta.salt));
        try { const out = new TextDecoder().decode(await decryptBytes(key, unb64(meta.check).buffer)); if (out !== VAULT_CHECK) throw 0; }
        catch (_) { throw new Error('That passphrase does not match.'); }
        vaultKey = key; await keyPut(uid, key);
      },
      async vaultForget() { vaultKey = null; plain.clear(); await keyPut(uid, null); },
      async decryptedUrl(path, type) {
        if (plain.has(path)) return plain.get(path);
        if (!vaultKey) throw Object.assign(new Error('Locked on this device.'), { code: 'VAULT_LOCKED' });
        const { data, error } = await sb.storage.from(BUCKET).download(path); if (error) throw error;
        const url = URL.createObjectURL(new Blob([await decryptBytes(vaultKey, await data.arrayBuffer())], { type }));
        plain.set(path, url); return url;
      },
      async photoUrl(path) { return this.decryptedUrl(path, 'image/jpeg'); },
      async email() { const { data } = await sb.auth.getUser(); return data.user ? data.user.email : ''; },
      async load() {
        const by = {};
        await Promise.all(ORDER.map(async t => { by[t] = await selectAll(t); }));
        if (!by.profile.length && !by.entries.length && !by.metrics.length) { snap = null; return null; }
        const paths = [...by.entries.flatMap(e => (e.photos || []).filter(p => !p.enc).map(p => p.path)), ...by.regimens.flatMap(r => (Array.isArray(r.photos) ? r.photos : []).filter(p => !p.enc).map(p => p.path)), ...(by.profile[0] && by.profile[0].base_photo && !by.profile[0].base_photo.enc ? [by.profile[0].base_photo.path] : [])];
        const signed = paths.length ? await sign(paths) : {};
        /* a stored photo as the app holds it: a signed url for an unencrypted one; fit and label carried over */
        const photoBack = x => ({ ...(x.enc ? { path: x.path, enc: true } : { path: x.path, src: signed[x.path] }), ...(x.fit ? { fit: x.fit } : {}), ...(x.label ? { label: x.label } : {}) });
        const p = by.profile[0] || {};
        const asc = k => (a, b) => (a[k] || 0) - (b[k] || 0);
        const hk = {};
        by.daily_metrics.filter(r => r.source === 'apple_health').sort((a, b) => a.on_date < b.on_date ? -1 : 1).forEach(r => (hk[r.key] = hk[r.key] || []).push({ d: r.on_date, v: +r.value }));
        const D = {
          metrics: Object.fromEntries(by.metrics.sort(asc('sort_order')).map(m => { const kind = m.kind || (m.is_rating ? 'rating' : 'number'); return [m.key, kind === 'rating' ? { l: m.label, u: m.unit, kind, rating: true } : { l: m.label, u: m.unit, kind }]; })),
          concerns: by.concerns.map(c => ({ id: c.id, title: c.title, regions: c.regions, started_on: c.started_on, resolved_on: c.resolved_on, status: c.status, notes: c.notes, tracking: c.tracking || {}, ...(c.kind === 'illness' ? { kind: 'illness', episodes: Array.isArray(c.episodes) ? c.episodes : [] } : {}), ...(c.color ? { color: c.color } : {}) })),
          regimens: by.regimens.map(r => ({ id: r.id, name: r.name, category: r.category, dose: r.dose, frequency: r.frequency, started_on: r.started_on, ended_on: r.ended_on, regions: r.regions, concern_id: r.concern_id, color: r.color, notes: r.notes, target: r.target, match: r.match || { source: 'manual' }, changes: r.changes || [], ...(Array.isArray(r.photos) && r.photos.length ? { photos: r.photos.map(photoBack) } : {}), ...(Array.isArray(r.periods) && r.periods.length > 1 && r.periods[0].from === r.started_on && (r.periods[r.periods.length - 1].to || null) === (r.ended_on || null) ? { periods: r.periods } : {}) })),
          regLogs: by.regimen_logs.map(l => ({ id: l.id, regimen_id: l.regimen_id, on_date: l.on_date, time: l.at_time, source: l.source, source_ref: l.source_ref, note: l.note })),
          courses: by.courses.map(k => ({ id: k.id, title: k.title, kind: k.kind, provider: k.provider, practice: k.practice, cadence: k.cadence, started_on: k.started_on, ended_on: k.ended_on, concern_id: k.concern_id, metric: k.metric, cost: k.cost == null ? null : +k.cost, color: k.color, notes: k.notes })),
          plans: by.plans.sort(asc('sort_order')).map(x => ({ id: x.id, year: x.year, title: x.title, kind: x.kind, per_year: x.per_year, notes: x.notes, category: x.category || '' })),
          challenges: by.challenges.map(c => ({ id: c.id, title: c.title, started_on: c.started_on, days: c.days, regimen_ids: c.regimen_ids, rules: c.rules, notes: c.notes, kind: c.kind || 'challenge', config: c.config || {} })),
          reminders: by.reminders.map(r => ({ id: r.id, title: r.title, target_kind: r.target_kind, target_id: r.target_id, schedule: r.schedule || {}, private: r.private, skip_if_done: r.skip_if_done, enabled: r.enabled })),
          cycle: by.cycle_days.map(c => ({ on_date: c.on_date, source: c.source, flow: c.flow, symptoms: c.symptoms || [], note: c.note || '', source_ref: c.source_ref })),
          entries: by.entries.map(e => ({ id: e.id, occurred_at: e.occurred_at, type: e.type, title: e.title, notes: e.notes, regions: e.regions, concern_id: e.concern_id, parent_entry_id: e.parent_entry_id, details: e.details, source: e.source, photos: (e.photos || []).map(photoBack), files: e.files || [] })),
          labs: by.lab_reports.map(l => ({ id: l.id, date: l.collected_on, lab: l.lab, file: l.file, notes: l.notes, kind: l.kind || 'lab', ...(l.title ? { title: l.title } : {}), results: by.lab_results.filter(r => r.report_id === l.id).sort(asc('sort_order')).map(r => ({ marker: r.marker, value: +r.value, unit: r.unit, range: r.range_text, flag: r.flag_text })) })),
          charts: by.charts.sort(asc('sort_order')).map(c => ({ id: c.id, title: c.title, ...c.config })),
          suggestions: by.suggestions.map(s => ({ id: s.id, source: s.source, source_ref: s.source_ref, title: s.title, occurred_at: s.occurred_at, details: s.details, found: s.found, status: s.status })),
          hk,
          points: p.points || null, customRegions: p.custom_regions || {}, widgets: p.widgets || null, chartLayout: p.chart_layout || 'top', chartZones: p.chart_zones || null, settings: p.settings || {},
          basePhotoPath: p.base_photo ? p.base_photo.path : null, basePhotoEnc: !!(p.base_photo && p.base_photo.enc),
          basePhoto: p.base_photo ? (p.base_photo.enc ? (vaultKey ? await this.photoUrl(p.base_photo.path) : null) : signed[p.base_photo.path] || null) : null
        };
        snap = snapshotOf(writable(toRows(D)));
        return D;
      },
      save(D) {
        latest = D;
        clearTimeout(timer);
        status('saving');
        timer = setTimeout(flush, 600);
      },
      async fileUrl(f) {
        if (!f) return null;
        if (f.path && f.enc) return this.decryptedUrl(f.path, f.type || 'application/octet-stream');
        if (f.path) { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.path, 300); if (error) throw error; return data.signedUrl; }
        if (f.blob) return URL.createObjectURL(f.blob);
        return f.dataUrl || null;
      }
    };
  };
})();
