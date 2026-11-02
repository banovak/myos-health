/* Level 1 storage: everything stays in this browser on this computer (IndexedDB).
   Photos are kept inline; attached files are kept as Blobs. Nothing leaves the machine. */
(function () {
  const DB = 'myos-health', OBJ = 'state', KEY = 'data';
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OBJ);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

  window.MyOSStores = window.MyOSStores || {};
  window.MyOSStores.local = function (cfg, hooks) {
    const status = (s, m) => hooks && hooks.onStatus && hooks.onStatus(s, m);
    let timer = null;
    return {
      mode: 'local',
      needsAuth: false,
      async load() {
        const db = await open();
        return new Promise((res, rej) => {
          const q = db.transaction(OBJ).objectStore(OBJ).get(KEY);
          q.onsuccess = () => res(q.result || null);
          q.onerror = () => rej(q.error);
        });
      },
      save(D) {
        clearTimeout(timer);
        status('saving');
        timer = setTimeout(async () => {
          try {
            const db = await open();
            await new Promise((res, rej) => {
              // strict: the write is on disk before we report "saved", even if the browser quits next
              const tx = db.transaction(OBJ, 'readwrite', { durability: 'strict' });
              tx.objectStore(OBJ).put(structuredClone(D), KEY);
              tx.oncomplete = res;
              tx.onerror = () => rej(tx.error);
            });
            status('saved');
          } catch (e) {
            status('error', 'Could not save in this browser: ' + (e.message || e));
          }
        }, 300);
      },
      async fileUrl(f) {
        if (!f) return null;
        if (f.blob) return URL.createObjectURL(f.blob);
        return f.dataUrl || null;
      }
    };
  };
})();
