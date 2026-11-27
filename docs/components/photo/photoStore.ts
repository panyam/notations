/**
 * photoStore.ts - Keeps the photo page's work in IndexedDB, so a reload does not lose it.
 *
 * Four things are kept:
 *
 * - files: what the user uploaded, as the original bytes. A PDF is kept as the PDF, not as its
 *   rendered pages, so a 1 MB notebook does not become 30 MB of PNGs. The page re-renders it on
 *   load.
 * - pages: each page of those files, with its rotation.
 * - entries: the transcription list, with each entry's regions and last result (entries.ts).
 * - notation: the editor's text.
 *
 * Before entries existed, the page kept a list of photos, each with one region. `photos()`
 * still reads that list, so the page can convert it once; `savePages` then removes it.
 *
 * The API key is not here. It stays in localStorage, and only when the user ticks "Remember".
 */

import type { Entry } from "./entries";
import type { CropRect } from "./imageUtils";

const DB_NAME = "notations-photo";
const DB_VERSION = 1;
const FILES = "files";
const STATE = "state";
const PHOTOS_KEY = "photos";
const PAGES_KEY = "pages";
const ENTRIES_KEY = "entries";
const NOTATION_KEY = "notation";

/** An uploaded file. Bytes are an ArrayBuffer rather than a Blob, which older Safari could not store. */
export interface StoredFile {
  id: string;
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

/** One page of an uploaded file: the whole image, or one page of a PDF. */
export interface StoredPage {
  id: string;
  /** The StoredFile this page comes from. */
  fileId: string;
  /** 1-based page of a PDF; null for an image file. */
  page: number | null;
  name: string;
  /** Quarter turns clockwise. Regions are measured on the rotated page. */
  rotation: number;
}

/** One entry in the photo list the page kept before transcription entries. Read for migration. */
export interface StoredPhoto {
  /** The StoredFile this photo comes from. */
  fileId: string;
  /** 1-based page of a PDF; null for an image file. */
  page: number | null;
  name: string;
  /** Quarter turns clockwise. */
  rotation: number;
  /** Region on the rotated photo; null for the whole photo or no region yet. */
  crop: CropRect | null;
  /** Whether the user has picked a region, or chose the whole photo on purpose. */
  regionSet: boolean;
}

function done(request: IDBRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * A handle on the page's IndexedDB database. Every method is its own transaction, so a failed
 * write leaves the previous state intact.
 */
export class PhotoStore {
  private constructor(private db: IDBDatabase) {}

  /**
   * Opens the database, creating it on first use.
   *
   * Resolves to null when IndexedDB is missing or refuses to open (some private modes). The page
   * then works as before and forgets everything on reload.
   */
  static async open(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<PhotoStore | null> {
    if (!factory) return null;
    try {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STATE)) db.createObjectStore(STATE);
      };
      return new PhotoStore(await done(request));
    } catch {
      return null;
    }
  }

  close(): void {
    this.db.close();
  }

  /** Adds or replaces a file. Call it before savePhotos names the file, or savePhotos drops it. */
  async putFile(file: StoredFile): Promise<void> {
    const tx = this.db.transaction(FILES, "readwrite");
    tx.objectStore(FILES).put(file);
    await committed(tx);
  }

  /** Every stored file, in id order. */
  async files(): Promise<StoredFile[]> {
    const tx = this.db.transaction(FILES, "readonly");
    return done(tx.objectStore(FILES).getAll());
  }

  /**
   * Replaces the page list, and deletes every file the new list does not use. Removing the last
   * page of a PDF therefore removes the PDF. It also removes the legacy photo list.
   */
  async savePages(pages: StoredPage[]): Promise<void> {
    const used = new Set(pages.map((p) => p.fileId));
    const tx = this.db.transaction([FILES, STATE], "readwrite");
    tx.objectStore(STATE).put(pages, PAGES_KEY);
    tx.objectStore(STATE).delete(PHOTOS_KEY);
    const files = tx.objectStore(FILES);
    const keys = files.getAllKeys();
    // Delete from the success callback, which runs while the transaction is still active.
    keys.onsuccess = () => keys.result.forEach((key) => used.has(String(key)) || files.delete(key));
    await committed(tx);
  }

  /** The saved page list, or null when none was ever saved (a new store, or one from before pages). */
  async pages(): Promise<StoredPage[] | null> {
    const tx = this.db.transaction(STATE, "readonly");
    return (await done(tx.objectStore(STATE).get(PAGES_KEY))) ?? null;
  }

  async saveEntries(entries: Entry[]): Promise<void> {
    const tx = this.db.transaction(STATE, "readwrite");
    tx.objectStore(STATE).put(entries, ENTRIES_KEY);
    await committed(tx);
  }

  /** The saved transcription list, or an empty list. */
  async entries(): Promise<Entry[]> {
    const tx = this.db.transaction(STATE, "readonly");
    return (await done(tx.objectStore(STATE).get(ENTRIES_KEY))) || [];
  }

  /** Writes a legacy photo list. Only tests use it, to set up a store from before pages. */
  async saveLegacyPhotos(photos: StoredPhoto[]): Promise<void> {
    const tx = this.db.transaction(STATE, "readwrite");
    tx.objectStore(STATE).put(photos, PHOTOS_KEY);
    await committed(tx);
  }

  /** The legacy photo list, or an empty list. */
  async photos(): Promise<StoredPhoto[]> {
    const tx = this.db.transaction(STATE, "readonly");
    return (await done(tx.objectStore(STATE).get(PHOTOS_KEY))) || [];
  }

  async saveNotation(notation: string): Promise<void> {
    const tx = this.db.transaction(STATE, "readwrite");
    tx.objectStore(STATE).put(notation, NOTATION_KEY);
    await committed(tx);
  }

  /** The saved editor text, or null when nothing was saved. */
  async notation(): Promise<string | null> {
    const tx = this.db.transaction(STATE, "readonly");
    const value = await done(tx.objectStore(STATE).get(NOTATION_KEY));
    return typeof value === "string" ? value : null;
  }

  /**
   * Deletes every file, page and transcription entry, and the legacy photo list. The notation
   * is kept; Clear handles that.
   */
  async forgetFiles(): Promise<void> {
    const tx = this.db.transaction([FILES, STATE], "readwrite");
    tx.objectStore(FILES).clear();
    for (const key of [PHOTOS_KEY, PAGES_KEY, ENTRIES_KEY]) tx.objectStore(STATE).delete(key);
    await committed(tx);
  }
}
