const { useState, useEffect, useMemo } = React;

const STORAGE_KEYS = window.APP_DATA.storageKeys;
const DEFAULT_PRODUCTS = Array.isArray(window.APP_DATA.defaultProducts)
  ? window.APP_DATA.defaultProducts
  : [];
const CATEGORIES = window.APP_DATA.categories || [];
const ALL_CATEGORIES = ['Semua', ...CATEGORIES];

const EMPTY_FORM = {
  id: '',
  name: '',
  category: 'Skincare',
  price: '',
  stock: '',
  minStock: '',
  unit: 'pcs',
  description: '',
  image: ''
};

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatRupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Math.max(0, safeNumber(value, 0)));

const loadSavedValue = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

const saveSavedValue = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Storage save failed:', error);
  }
};

const Icon = ({ name, size = 18, className = '' }) => {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [name, size, className]);

  return (
    <i
      data-lucide={name}
      style={{ width: size, height: size }}
      className={`inline-block ${className}`}
    ></i>
  );
};

function App() {
  const [products, setProducts] = useState(() => loadSavedValue(STORAGE_KEYS.inventory, DEFAULT_PRODUCTS));
  const [transactions, setTransactions] = useState(() => loadSavedValue(STORAGE_KEYS.transactions, []));
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEYS.theme) || 'light');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [activeTab, setActiveTab] = useState('inventory');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saleForm, setSaleForm] = useState({ productId: '', quantity: 1, customer: '', phone: '', email: '' });
  const [importInputKey, setImportInputKey] = useState(Date.now());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveSavedValue(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    saveSavedValue(STORAGE_KEYS.inventory, products);
  }, [products]);

  useEffect(() => {
    saveSavedValue(STORAGE_KEYS.transactions, transactions);
  }, [transactions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [products, isFormOpen, toast, activeTab]);

  const categories = useMemo(() => {
    const unique = [...new Set(products.map((item) => item.category).filter(Boolean))];
    return ['Semua', ...unique];
  }, [products]);

  const stats = useMemo(() => {
    const totalSKU = products.length;
    const totalItems = products.reduce((sum, item) => sum + safeNumber(item.stock, 0), 0);
    const totalValue = products.reduce((sum, item) => sum + safeNumber(item.price, 0) * safeNumber(item.stock, 0), 0);
    const lowStockCount = products.filter((item) => {
      const min = safeNumber(item.minStock, 0);
      return min > 0 && safeNumber(item.stock, 0) <= min;
    }).length;

    return { totalSKU, totalItems, totalValue, lowStockCount };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || product.name.toLowerCase().includes(query) || product.id.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const salesChartData = useMemo(() => {
    const lastSeven = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('id-ID', { weekday: 'short' })
      };
    });

    const values = new Map(lastSeven.map((day) => [day.key, 0]));
    transactions.forEach((tx) => {
      const key = new Date(tx.createdAt).toISOString().slice(0, 10);
      if (values.has(key)) {
        values.set(key, values.get(key) + safeNumber(tx.total, 0));
      }
    });

    return lastSeven.map((day) => ({
      ...day,
      value: values.get(day.key) || 0
    }));
  }, [transactions]);

  const chartMaxValue = useMemo(() => Math.max(...salesChartData.map((day) => day.value), 1), [salesChartData]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
    [transactions]
  );

  const totalRevenue = useMemo(
    () => transactions.reduce((sum, tx) => sum + safeNumber(tx.total, 0), 0),
    [transactions]
  );

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const validateProduct = (data) => {
    const errors = {};
    const price = safeNumber(data.price, Number.NaN);
    const stock = safeNumber(data.stock, Number.NaN);
    const minStock = data.minStock === '' ? undefined : safeNumber(data.minStock, Number.NaN);

    if (!data.id.trim()) errors.id = 'ID produk wajib diisi.';
    if (!data.name.trim()) errors.name = 'Nama produk wajib diisi.';
    if (!data.category.trim()) errors.category = 'Kategori wajib diisi.';
    if (!data.unit.trim()) errors.unit = 'Satuan wajib diisi.';
    if (!Number.isFinite(price) || price <= 0) errors.price = 'Harga harus lebih dari 0.';
    if (!Number.isFinite(stock) || stock < 0) errors.stock = 'Stok tidak boleh negatif.';
    if (minStock !== undefined && (!Number.isFinite(minStock) || minStock < 0)) {
      errors.minStock = 'Minimum stok tidak valid.';
    }
    if (Number.isFinite(stock) && minStock !== undefined && Number.isFinite(minStock) && stock < minStock) {
      errors.stock = 'Stok tidak boleh lebih kecil dari minimum stok.';
    }

    return errors;
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setFormData({ ...EMPTY_FORM });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      minStock: product.minStock === undefined || product.minStock === null ? '' : String(product.minStock),
      unit: product.unit,
      description: product.description || '',
      image: product.image || ''
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setFormData({ ...EMPTY_FORM });
    setFormErrors({});
  };

  const handleFormInput = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setFormData((prev) => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = (event) => {
    event.preventDefault();

    const errors = validateProduct(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Harap periksa form sebelum menyimpan.', 'error');
      return;
    }

    const normalized = {
      id: formData.id.trim().toUpperCase(),
      name: formData.name.trim(),
      category: formData.category.trim(),
      price: safeNumber(formData.price, 0),
      stock: safeNumber(formData.stock, 0),
      minStock: formData.minStock === '' ? 0 : safeNumber(formData.minStock, 0),
      unit: formData.unit.trim() || 'pcs',
      description: formData.description.trim(),
      image: formData.image || ''
    };

    const duplicateExists = products.some((item) => {
      if (editingProduct && item.id === editingProduct.id) return false;
      return item.id.toUpperCase() === normalized.id.toUpperCase();
    });

    if (duplicateExists) {
      setFormErrors((prev) => ({ ...prev, id: 'ID produk sudah digunakan.' }));
      showToast('ID produk sudah digunakan.', 'error');
      return;
    }

    setProducts((prev) => {
      if (editingProduct) {
        return prev.map((item) => (item.id === editingProduct.id ? normalized : item));
      }
      return [normalized, ...prev];
    });

    closeForm();
    showToast(editingProduct ? 'Produk berhasil diperbarui.' : 'Produk berhasil ditambahkan.');
  };

  const handleQuickStock = (id, delta) => {
    setProducts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStock = Math.max(0, safeNumber(item.stock, 0) + delta);
        return { ...item, stock: nextStock };
      })
    );
  };

  const handleDeleteProduct = (id) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
    setDeleteId(null);
    showToast('Produk berhasil dihapus.');
  };

  const handleRecordSale = (event) => {
    event.preventDefault();
    const product = products.find((item) => item.id === saleForm.productId);

    if (!product) {
      showToast('Pilih produk terlebih dahulu.', 'error');
      return;
    }

    const quantity = safeNumber(saleForm.quantity, 0);
    if (quantity <= 0) {
      showToast('Jumlah penjualan harus lebih dari 0.', 'error');
      return;
    }

    if (quantity > safeNumber(product.stock, 0)) {
      showToast('Stok tidak cukup untuk transaksi ini.', 'error');
      return;
    }

    const total = product.price * quantity;
    const customerName = saleForm.customer.trim() || 'Walk-in Customer';
    const customerPhone = saleForm.phone.trim();
    const customerEmail = saleForm.email.trim();

    const newTransaction = {
      id: `TRX-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      total,
      customer: customerName,
      customerPhone,
      customerEmail,
      createdAt: new Date().toISOString()
    };

    setTransactions((prev) => [newTransaction, ...prev]);
    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, stock: safeNumber(item.stock, 0) - quantity } : item))
    );
    setSaleForm({ productId: '', quantity: 1, customer: '', phone: '', email: '' });
    showToast('Transaksi berhasil dicatat.');
  };

  const exportInventory = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      products,
      transactions
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'oriflame-inventory-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Inventaris berhasil diekspor.');
  };

  const importInventory = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incomingProducts = Array.isArray(parsed.products) ? parsed.products : Array.isArray(parsed) ? parsed : [];

        if (!incomingProducts.length) {
          showToast('File impor tidak berisi data produk.', 'error');
          return;
        }

        setProducts(incomingProducts);
        if (Array.isArray(parsed.transactions)) setTransactions(parsed.transactions);
        setImportInputKey(Date.now());
        showToast('Inventaris berhasil diimpor.');
      } catch (error) {
        showToast('Format file impor tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),transparent_28%),linear-gradient(135deg,#f8fafc_0%,#fff1f2_28%,#f8fafc_100%)] text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8">
        <header className="brand-shell mb-6 rounded-[28px] border border-pink-100 p-6 shadow-soft dark:border-pink-500/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="brand-mark flex h-16 w-16 items-center justify-center rounded-2xl font-black text-white shadow-lg">
                O
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-pink-600 dark:text-pink-300">Oriflame Beauty</p>
                <h1 className="mt-2 text-2xl font-black text-slate-800 dark:text-white md:text-3xl">Inventory Control Center</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-pink-50 dark:border-pink-500/20 dark:bg-slate-900/80 dark:text-slate-200"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>

              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:brightness-105"
              >
                <Icon name="plus" size={16} />
                Tambah Produk
              </button>
            </div>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-pink-100 bg-white/70 p-2 shadow-soft backdrop-blur-sm dark:border-pink-500/20 dark:bg-slate-900/70">
          {[
            { id: 'inventory', label: 'Inventory', icon: 'box' },
            { id: 'sales', label: 'Sales', icon: 'shopping-cart' },
            { id: 'transactions', label: 'Transactions', icon: 'receipt' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-lg shadow-pink-500/20'
                  : 'text-slate-600 hover:bg-pink-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'inventory' && (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total SKU', value: stats.totalSKU, icon: 'package', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200' },
                { label: 'Total Item', value: stats.totalItems, icon: 'layers', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200' },
                { label: 'Nilai Stok', value: formatRupiah(stats.totalValue), icon: 'wallet', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
                { label: 'Low Stock', value: stats.lowStockCount, icon: 'alert-triangle', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' }
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-pink-100 bg-white/80 p-4 shadow-soft dark:border-pink-500/20 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">{card.value}</p>
                    </div>
                    <div className={`rounded-xl p-2 ${card.color}`}>
                      <Icon name={card.icon} size={20} />
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="mb-6 rounded-2xl border border-pink-100 bg-white/80 p-4 shadow-soft dark:border-pink-500/20 dark:bg-slate-900/80">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full max-w-md">
                  <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau ID..."
                    className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-pink-400"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        selectedCategory === category
                          ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-pink-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportInventory}
                className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-pink-50 dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-200"
              >
                <Icon name="download" size={16} />
                Export Inventory
              </button>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-pink-50 dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-200">
                <Icon name="upload" size={16} />
                Import Inventory
                <input key={importInputKey} type="file" accept="application/json" className="hidden" onChange={importInventory} />
              </label>
            </section>

            <section className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-soft dark:border-pink-500/20 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-pink-100 dark:divide-pink-500/20">
                  <thead className="bg-pink-50/80 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kategori</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Harga</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stok</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-100 bg-white dark:divide-pink-500/20 dark:bg-slate-900">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                          Tidak ada produk yang cocok dengan filter saat ini.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => {
                        const minStockValue = safeNumber(product.minStock, 0);
                        const isLowStock = minStockValue > 0 && safeNumber(product.stock, 0) <= minStockValue;

                        return (
                          <tr key={product.id} className="hover:bg-pink-50/50 dark:hover:bg-slate-800/70">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-pink-100 to-violet-100 dark:border-pink-500/20 dark:from-pink-900/40 dark:to-violet-900/20">
                                  {product.image ? (
                                    <img src={product.image} alt={product.name} className="product-image h-full w-full" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-200">
                                      <Icon name="image" size={20} />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-100">{product.name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{product.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{product.category}</td>
                            <td className="px-4 py-4 text-sm font-medium text-slate-800 dark:text-slate-100">{formatRupiah(product.price)}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStock(product.id, -1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-pink-100 text-slate-600 hover:bg-pink-50 dark:border-pink-500/20 dark:text-slate-300 dark:hover:bg-slate-800"
                                  aria-label={`Kurangi stok ${product.name}`}
                                >
                                  <Icon name="minus" size={14} />
                                </button>
                                <span className="min-w-12 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">{product.stock}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStock(product.id, 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-pink-100 text-slate-600 hover:bg-pink-50 dark:border-pink-500/20 dark:text-slate-300 dark:hover:bg-slate-800"
                                  aria-label={`Tambah stok ${product.name}`}
                                >
                                  <Icon name="plus" size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  isLowStock
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                }`}
                              >
                                {isLowStock ? 'Low Stock' : minStockValue > 0 ? 'Tracked' : 'No Min'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(product)}
                                  className="rounded-lg border border-pink-100 p-2 text-slate-600 transition hover:bg-pink-50 dark:border-pink-500/20 dark:text-slate-300 dark:hover:bg-slate-800"
                                  aria-label={`Edit ${product.name}`}
                                >
                                  <Icon name="pencil" size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteId(product.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 dark:border-red-700/30 dark:bg-red-950/20 dark:text-red-300"
                                  aria-label={`Hapus ${product.name}`}
                                >
                                  <Icon name="trash-2" size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === 'sales' && (
          <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-soft dark:border-pink-500/20 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Create Sale</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Quick checkout and stock deduction</p>
                </div>
                <span className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-semibold text-pink-700 dark:bg-pink-900/40 dark:text-pink-200">
                  {transactions.length} transactions
                </span>
              </div>

              <form onSubmit={handleRecordSale} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Produk</label>
                  <select
                    value={saleForm.productId}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, productId: e.target.value }))}
                    className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Pilih produk</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.stock} stok)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, quantity: safeNumber(e.target.value, 1) }))}
                    className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Pelanggan</label>
                  <input
                    type="text"
                    value={saleForm.customer}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, customer: e.target.value }))}
                    placeholder="Walk-in Customer"
                    className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nomor Telepon</label>
                    <input
                      type="tel"
                      value={saleForm.phone}
                      onChange={(e) => setSaleForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Opsional"
                      className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                    <input
                      type="email"
                      value={saleForm.email}
                      onChange={(e) => setSaleForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Opsional"
                      className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {saleForm.productId && (
                  <div className="rounded-xl bg-pink-50 p-3 text-sm dark:bg-pink-950/20">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>Harga satuan</span>
                      <strong className="text-slate-800 dark:text-slate-100">
                        {formatRupiah(products.find((item) => item.id === saleForm.productId)?.price || 0)}
                      </strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>Estimasi total</span>
                      <strong className="text-slate-800 dark:text-slate-100">
                        {formatRupiah((products.find((item) => item.id === saleForm.productId)?.price || 0) * safeNumber(saleForm.quantity, 1))}
                      </strong>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                >
                  Simpan Transaksi
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-soft dark:border-pink-500/20 dark:bg-slate-900">
              <h2 className="mb-4 text-xl font-black text-slate-800 dark:text-white">Sales Summary</h2>

              <div className="space-y-3">
                <div className="rounded-xl bg-gradient-to-r from-pink-50 to-violet-50 p-4 dark:from-pink-900/20 dark:to-violet-900/15">
                  <p className="text-sm text-pink-700 dark:text-pink-200">Total Revenue</p>
                  <p className="mt-2 text-2xl font-black text-slate-800 dark:text-white">{formatRupiah(totalRevenue)}</p>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 dark:from-violet-900/20 dark:to-fuchsia-900/15">
                  <p className="text-sm text-violet-700 dark:text-violet-200">Top Product</p>
                  <p className="mt-2 text-lg font-bold text-slate-800 dark:text-white">
                    {transactions.length
                      ? [...transactions].sort((a, b) => b.total - a.total)[0].productName
                      : 'No sales yet'}
                  </p>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 dark:from-amber-900/20 dark:to-orange-900/15">
                  <p className="text-sm text-amber-700 dark:text-amber-200">Low Stock Alerts</p>
                  <p className="mt-2 text-2xl font-black text-slate-800 dark:text-white">{stats.lowStockCount}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'transactions' && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-soft dark:border-pink-500/20 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Revenue Trend</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Last 7 days performance</p>
                </div>
                <span className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-semibold text-pink-700 dark:bg-pink-900/40 dark:text-pink-200">
                  {formatRupiah(totalRevenue)} total
                </span>
              </div>

              <div className="mt-4 flex h-56 items-end gap-3">
                {salesChartData.map((day) => (
                  <div key={day.key} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-40 w-full items-end justify-center">
                      <div
                        className="w-full rounded-t-2xl bg-gradient-to-t from-pink-600 via-violet-500 to-rose-400 shadow-lg shadow-pink-500/20"
                        style={{ height: `${Math.max((day.value / chartMaxValue) * 100, 8)}%` }}
                        title={`${day.label}: ${formatRupiah(day.value)}`}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-pink-100 bg-white shadow-soft dark:border-pink-500/20 dark:bg-slate-900">
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Recent Transactions</h2>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total revenue: {formatRupiah(totalRevenue)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-pink-100 dark:divide-pink-500/20">
                    <thead className="bg-pink-50/80 dark:bg-slate-800/80">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Produk</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kontak</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-100 dark:divide-pink-500/20">
                      {recentTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            Belum ada transaksi.
                          </td>
                        </tr>
                      ) : (
                        recentTransactions.map((tx) => (
                          <tr key={tx.id} className="dark:hover:bg-slate-800/60">
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{tx.id}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{tx.productName}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{tx.quantity}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{tx.customer}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                              <div className="flex flex-col">
                                {tx.customerPhone && <span>{tx.customerPhone}</span>}
                                {tx.customerEmail && <span>{tx.customerEmail}</span>}
                                {!tx.customerPhone && !tx.customerEmail && <span>-</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(tx.total)}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                              {new Date(tx.createdAt).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-pink-100 bg-white p-6 shadow-2xl dark:border-pink-500/20 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">ID Produk</label>
                  <input
                    type="text"
                    name="id"
                    value={formData.id}
                    onChange={handleFormInput}
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.id ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  />
                  {formErrors.id && <p className="mt-1 text-xs text-red-500">{formErrors.id}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Produk</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormInput}
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.name ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  />
                  {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Kategori</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormInput}
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.category ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  {formErrors.category && <p className="mt-1 text-xs text-red-500">{formErrors.category}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Satuan</label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleFormInput}
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.unit ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  />
                  {formErrors.unit && <p className="mt-1 text-xs text-red-500">{formErrors.unit}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Harga</label>
                  <input
                    type="number"
                    name="price"
                    min="1"
                    value={formData.price}
                    onChange={handleFormInput}
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.price ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  />
                  {formErrors.price && <p className="mt-1 text-xs text-red-500">{formErrors.price}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Stok</label>
                  <input
                    type="number"
                    name="stock"
                    min="0"
                    value={formData.stock}
                    onChange={handleFormInput}
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.stock ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  />
                  {formErrors.stock && <p className="mt-1 text-xs text-red-500">{formErrors.stock}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Minimum Stok (opsional)</label>
                  <input
                    type="number"
                    name="minStock"
                    min="0"
                    value={formData.minStock}
                    onChange={handleFormInput}
                    placeholder="Kosongkan bila tidak diperlukan"
                    className={`input-shell w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition ${formErrors.minStock ? 'border-red-300' : 'border-pink-100 focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100'} `}
                  />
                  {formErrors.minStock && <p className="mt-1 text-xs text-red-500">{formErrors.minStock}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Gambar Produk</label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-xl border border-pink-100 bg-slate-50 dark:border-pink-500/20 dark:bg-slate-800">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Icon name="image" size={24} />
                        </div>
                      )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-pink-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-pink-50 dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-200">
                      <Icon name="upload" size={16} />
                      Upload Gambar
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormInput}
                    rows="4"
                    className="input-shell w-full rounded-xl border border-pink-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:bg-white dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-pink-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-pink-50 dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-105"
                >
                  {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-6 shadow-2xl dark:border-pink-500/20 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                <Icon name="trash-2" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Hapus Produk</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Apakah Anda yakin ingin menghapus produk ini?</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-pink-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-pink-50 dark:border-pink-500/20 dark:bg-slate-800 dark:text-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProduct(deleteId)}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60]">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
