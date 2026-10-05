import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Almacenamiento de las partidas.
 *
 * Cada carrera pesa varios MB y localStorage tiene un tope de ~5 MB por sitio: con 2 o 3 slots el
 * navegador rechazaba la escritura (en silencio) y solo quedaba lo que había entrado antes. Por eso
 * se guarda en IndexedDB, un registro por slot. Lo que ya había en localStorage se lee una vez y se
 * migra solo.
 */

const DB_NAME = "scudetto-saves";
const STORE = "kv";
const META_KEY = "meta";
const slotKey = (i: number) => `slot:${i}`;
/** Espera corta para juntar varios cambios seguidos en una sola escritura. */
const DEBOUNCE_MS = 250;
/** Mínimo de slots que se intentan leer, aunque el registro guardado diga menos. */
const MIN_READ = 5;

type Shape = { slot: number; slots: Array<unknown | null> };
type Value = StorageValue<Shape>;

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB bloqueada"));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transacción cancelada"));
  });
}

function readLegacy(name: string): Value | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Value;
    return parsed && typeof parsed === "object" && parsed.state ? parsed : null;
  } catch {
    return null;
  }
}

async function readIdb(): Promise<Value | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const meta = (await reqToPromise(store.get(META_KEY))) as { slot: number; version: number; count: number } | undefined;
  if (!meta) return null;
  // Se leen al menos MIN_READ registros: si antes se guardaron menos slots que ahora, no se pierde nada.
  const count = Math.max(meta.count ?? 0, MIN_READ);
  const slots = await Promise.all(
    Array.from({ length: count }, (_, i) => reqToPromise(store.get(slotKey(i))).then((v) => (v as unknown) ?? null)),
  );
  return { state: { slot: meta.slot, slots }, version: meta.version };
}

/** Últimos objetos que ya quedaron escritos en IndexedDB, por slot (para no reescribir lo que no cambió). */
const written: Array<unknown> = [];

async function writeIdb(value: Value): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const { slot, slots } = value.state;
  const touched: Array<[number, unknown]> = [];
  slots.forEach((s, i) => {
    if (written[i] === s && i in written) return; // sin cambios desde la última escritura
    if (s) store.put(s, slotKey(i));
    else store.delete(slotKey(i));
    touched.push([i, s]);
  });
  // Registros que sobren de versiones con más slots.
  for (let i = slots.length; i < slots.length + 16; i++) store.delete(slotKey(i));
  store.put({ slot, version: value.version ?? 0, count: slots.length }, META_KEY);
  await txDone(tx);
  // Recién acá, con la transacción confirmada, se da por guardado.
  for (const [i, s] of touched) written[i] = s;
}

function writeLegacy(name: string, value: Value): void {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch (e) {
    console.error("[scudetto] No se pudo guardar la partida:", e);
  }
}

export function createSaveStorage(): PersistStorage<Shape> {
  let pending: { name: string; value: Value } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let listening = false;
  let lastSlot: number | null = null;

  const flush = (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const job = pending;
    pending = null;
    if (!job) return chain;
    chain = chain.then(async () => {
      if (!idbAvailable()) {
        writeLegacy(job.name, job.value);
        return;
      }
      try {
        await writeIdb(job.value);
        // Ya está a salvo en IndexedDB: se libera el espacio viejo de localStorage.
        try {
          localStorage.removeItem(job.name);
        } catch {
          /* sin localStorage */
        }
      } catch (e) {
        console.error("[scudetto] No se pudo guardar la partida en IndexedDB:", e);
        writeLegacy(job.name, job.value);
      }
    });
    return chain;
  };

  const listen = () => {
    if (listening || typeof window === "undefined") return;
    listening = true;
    // Pide al navegador que no borre las partidas cuando falte espacio.
    try {
      void navigator.storage?.persist?.();
    } catch {
      /* no disponible */
    }
    // Al salir de la pestaña o cerrar el juego se guarda lo que haya pendiente.
    const onHide = () => {
      void flush();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
  };

  return {
    getItem: async (name) => {
      if (typeof window === "undefined") return null;
      listen();
      if (idbAvailable()) {
        try {
          const fromIdb = await readIdb();
          if (fromIdb) {
            // Si alguna escritura a IndexedDB falló antes y esa partida quedó en localStorage, se rescata.
            const legacy = readLegacy(name);
            if (legacy) {
              const lslots = legacy.state.slots ?? [];
              const merged = [...fromIdb.state.slots];
              for (let i = 0; i < lslots.length; i++) if (!merged[i] && lslots[i]) merged[i] = lslots[i];
              fromIdb.state.slots = merged;
            }
            return fromIdb as Value;
          }
        } catch (e) {
          console.error("[scudetto] No se pudo leer IndexedDB:", e);
        }
      }
      return readLegacy(name);
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      listen();
      const slotChanged = lastSlot !== null && lastSlot !== value.state.slot;
      lastSlot = value.state.slot;
      pending = { name, value: value as Value };
      if (timer) clearTimeout(timer);
      // Al cambiar de slot se guarda ya, sin esperar.
      timer = setTimeout(() => void flush(), slotChanged ? 0 : DEBOUNCE_MS);
    },
    removeItem: async (name) => {
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        localStorage.removeItem(name);
      } catch {
        /* nada */
      }
      if (!idbAvailable()) return;
      try {
        const db = await openDb();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        await txDone(tx);
        written.length = 0;
      } catch (e) {
        console.error("[scudetto] No se pudo borrar IndexedDB:", e);
      }
    },
  };
}
