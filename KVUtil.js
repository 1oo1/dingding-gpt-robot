class KVStore {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttl) {
    if (this.store.has(key)) {
      clearTimeout(this.store.get(key).timeoutId);
    }

    const timeoutId = ttl ? setTimeout(() => this.delete(key), ttl) : null;
    
    this.store.set(key, { value, timeoutId });
  }

  get(key) {
    const data = this.store.get(key);
    return data ? data.value : undefined;
  }

  delete(key) {
    const data = this.store.get(key);
    if (data) {
      clearTimeout(data.timeoutId);
      this.store.delete(key);
    }
  }

  has(key) {
    return this.store.has(key);
  }

  clear() {
    this.store.forEach((value, key) => {
      clearTimeout(value.timeoutId);
    });
    this.store.clear();
  }
}


const kvStore = new KVStore();
export default kvStore;