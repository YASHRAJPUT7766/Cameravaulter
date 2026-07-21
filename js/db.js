// Simple IndexedDB wrapper for VaultCam
const VaultDB = (() => {
  const DB_NAME = 'vaultcam_db';
  const DB_VERSION = 1;
  let dbInstance = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          const store = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
          store.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
      req.onerror = (e) => reject(e);
    });
  }

  async function addFile(fileObj) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const req = tx.objectStore('files').add(fileObj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async function getAllFiles() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async function deleteFile(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const req = tx.objectStore('files').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  async function setMeta(key, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const req = tx.objectStore('meta').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  async function getMeta(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = (e) => reject(e);
    });
  }

  return { addFile, getAllFiles, deleteFile, setMeta, getMeta };
})();
