import { config } from '../config.js';
import { createLocalStore } from './localStore.js';
import { createFirebaseStore } from './firebaseStore.js';

let store;

export function getStore() {
  if (store) return store;
  if (config.firebase.databaseUrl) {
    store = createFirebaseStore(config.firebase);
    console.log(`[db] Firebase Realtime Database → ${config.firebase.databaseUrl}`);
  } else {
    store = createLocalStore(config.dataFile);
    console.log(`[db] Almacén local (JSON) → ${config.dataFile}`);
  }
  return store;
}
