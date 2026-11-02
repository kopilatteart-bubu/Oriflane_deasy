(() => {
  const hasRemoteConfig = Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);

  const getClient = () => {
    if (!hasRemoteConfig || !window.supabase) {
      throw new Error('Supabase client is not configured or loaded.');
    }

    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  };

  const loadState = async (stateName, fallback) => {
    if (!hasRemoteConfig) return fallback;

    try {
      const client = getClient();
      const { data, error } = await client
        .from('app_state')
        .select('payload')
        .eq('name', stateName)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data && Array.isArray(data.payload) ? data.payload : fallback;
    } catch (error) {
      console.warn(`Load ${stateName} from Supabase failed:`, error);
      return fallback;
    }
  };

  const saveState = async (stateName, payload) => {
    if (!hasRemoteConfig) return;

    try {
      const client = getClient();
      const { error } = await client
        .from('app_state')
        .upsert({ name: stateName, payload }, { onConflict: 'name' });

      if (error) throw error;
    } catch (error) {
      console.warn(`Save ${stateName} to Supabase failed:`, error);
    }
  };

  window.APP_DB = {
    isEnabled() {
      return hasRemoteConfig;
    },
    async loadInventory(fallback = []) {
      return loadState('inventory', fallback);
    },
    async saveInventory(products) {
      await saveState('inventory', products);
    },
    async loadTransactions(fallback = []) {
      return loadState('transactions', fallback);
    },
    async saveTransactions(transactions) {
      await saveState('transactions', transactions);
    },
    async reset() {
      const appData = window.APP_DATA || {};
      const defaultProducts = Array.isArray(appData.defaultProducts) ? appData.defaultProducts : [];
      await saveState('inventory', defaultProducts.map((product) => ({ ...product, stock: 0 })));
      await saveState('transactions', []);
    }
  };
})();
