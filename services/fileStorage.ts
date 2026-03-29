/**
 * Service to handle local file system storage using the File System Access API.
 */

// --- TypeScript Augmentation for File System Access API ---
declare global {
  interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
  }
}

const DB_NAME = 'gmp_files_db';
const STORE_NAME = 'handles';
const ROOT_HANDLE_KEY = 'root_directory_handle';

/**
 * Opens IndexedDB to store/retrieve directory handles.
 */
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a handle in IndexedDB.
 */
async function storeHandle(key: string, handle: FileSystemHandle) {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieves a handle from IndexedDB.
 */
async function getHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export const fileStorage = {
  /**
   * Checks if the browser supports the File System Access API.
   */
  isSupported: () => 'showDirectoryPicker' in window,

  /**
   * Prompts the user to select the base storage directory.
   */
  async selectBaseDirectory(): Promise<boolean> {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        id: 'gmp_storage'
      });
      await storeHandle(ROOT_HANDLE_KEY, handle);
      return true;
    } catch (err) {
      console.error('Directory selection cancelled or failed', err);
      return false;
    }
  },

  /**
   * Gets the base directory handle, requesting permission if needed.
   */
  async getBaseDirectory(): Promise<FileSystemDirectoryHandle | null> {
    const handle = await getHandle(ROOT_HANDLE_KEY);
    if (!handle) return null;

    // Verify permission (browsers often require this on every session)
    const options = { mode: 'readwrite' };
    if ((await (handle as any).queryPermission(options)) === 'granted') {
      return handle;
    }

    if ((await (handle as any).requestPermission(options)) === 'granted') {
      return handle;
    }

    return null;
  },

  /**
   * Saves files for a specific guard.
   */
  async saveGuardFiles(guardName: string, guardId: string, files: { [key: string]: File | File[] | null }) {
    const root = await this.getBaseDirectory();
    if (!root) {
      const success = await this.selectBaseDirectory();
      if (!success) throw new Error('No storage directory selected');
      return this.saveGuardFiles(guardName, guardId, files); // Retry
    }

    // Create guard-specific folder: Name_ID
    const folderName = `${guardName.replace(/[^a-z0-9]/gi, '_')}_${guardId}`;
    const guardFolder = await root.getDirectoryHandle(folderName, { create: true });

    for (const [key, value] of Object.entries(files)) {
      if (!value) continue;

      const fileList = Array.isArray(value) ? value : [value];
      const label = key.replace('idProof', '');

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const extension = file.name.split('.').pop();
        // For multiple files, add an index suffix
        const suffix = fileList.length > 1 ? `_${i + 1}` : '';
        const filename = `${label}${suffix}.${extension}`;

        const fileHandle = await guardFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
      }
    }
  }
};
