(() => {
  const APP_KEY = 'oriflame_inventory_app_v1';
  const LEGACY_KEYS = {
    inventory: 'oriflame_inventory_data_v3_reset',
    transactions: 'oriflame_inventory_transactions_v3_reset',
    theme: 'oriflame_inventory_theme_v3_reset'
  };

  const defaultState = {
    version: 1,
    inventory: [],
    transactions: [],
    theme: 'light',
    updatedAt: null
  };

  const readParsed = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  };

  const writeState = (state) => {
    const payload = {
      ...defaultState,
      ...state,
      inventory: Array.isArray(state.inventory) ? state.inventory : [],
      transactions: Array.isArray(state.transactions) ? state.transactions : [],
      theme: state.theme || 'light',
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(APP_KEY, JSON.stringify(payload));
  };

  const syncLegacyStorage = () => {
    const state = { ...defaultState };
    const stored = readParsed(APP_KEY);

    if (stored && typeof stored === 'object') {
      state.inventory = Array.isArray(stored.inventory) ? stored.inventory : [];
      state.transactions = Array.isArray(stored.transactions) ? stored.transactions : [];
      state.theme = stored.theme || 'light';
    }

    Object.entries(LEGACY_KEYS).forEach(([key, legacyKey]) => {
      const value = readParsed(legacyKey);
      if (value === null) return;

      if (key === 'inventory') state.inventory = Array.isArray(value) ? value : state.inventory;
      if (key === 'transactions') state.transactions = Array.isArray(value) ? value : state.transactions;
      if (key === 'theme') state.theme = value || state.theme;
    });

    writeState(state);

    Object.values(LEGACY_KEYS).forEach((key) => {
      if (key !== APP_KEY) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          // Ignore cleanup errors in restricted contexts.
        }
      }
    });
  };

  const getState = () => {
    const stored = readParsed(APP_KEY);
    if (!stored || typeof stored !== 'object') {
      return { ...defaultState, inventory: [], transactions: [] };
    }

    return {
      ...defaultState,
      ...stored,
      inventory: Array.isArray(stored.inventory) ? stored.inventory : [],
      transactions: Array.isArray(stored.transactions) ? stored.transactions : [],
      theme: stored.theme || 'light'
    };
  };

  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.getItem = function (key) {
    if (key === APP_KEY) return originalGetItem.call(this, key);

    if (key === LEGACY_KEYS.inventory) {
      return JSON.stringify(getState().inventory);
    }

    if (key === LEGACY_KEYS.transactions) {
      return JSON.stringify(getState().transactions);
    }

    if (key === LEGACY_KEYS.theme) {
      return JSON.stringify(getState().theme);
    }

    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function (key, value) {
    const state = getState();

    if (key === APP_KEY) {
      return originalSetItem.call(this, key, value);
    }

    if (key === LEGACY_KEYS.inventory) {
      try {
        state.inventory = JSON.parse(value);
      } catch (error) {
        state.inventory = [];
      }
      writeState(state);
      return;
    }

    if (key === LEGACY_KEYS.transactions) {
      try {
        state.transactions = JSON.parse(value);
      } catch (error) {
        state.transactions = [];
      }
      writeState(state);
      return;
    }

    if (key === LEGACY_KEYS.theme) {
      try {
        state.theme = JSON.parse(value);
      } catch (error) {
        state.theme = 'light';
      }
      writeState(state);
      return;
    }

    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function (key) {
    if (key === APP_KEY) {
      return originalRemoveItem.call(this, key);
    }

    if (Object.values(LEGACY_KEYS).includes(key)) {
      const state = getState();
      if (key === LEGACY_KEYS.inventory) state.inventory = [];
      if (key === LEGACY_KEYS.transactions) state.transactions = [];
      if (key === LEGACY_KEYS.theme) state.theme = 'light';
      writeState(state);
      return;
    }

    return originalRemoveItem.call(this, key);
  };

  window.resetInventoryState = () => {
    const appData = window.APP_DATA || {};
    const defaults = Array.isArray(appData.defaultProducts) ? appData.defaultProducts : [];
    const freshInventory = defaults.map((product) => ({
      ...product,
      stock: 0,
      minStock: Number(product.minStock ?? 0),
      price: Number(product.price ?? 0),
      costPrice: Number(product.costPrice ?? 0),
      unit: product.unit || 'pcs',
      description: product.description || '',
      image: product.image || ''
    }));

    writeState({
      version: 1,
      inventory: freshInventory,
      transactions: [],
      theme: 'light',
      updatedAt: new Date().toISOString()
    });

    window.location.reload();
  };

  syncLegacyStorage();
})();
