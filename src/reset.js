(() => {
  const appData = window.APP_DATA || {};
  const storageKeys = appData.storageKeys || {};
  const defaultProducts = Array.isArray(appData.defaultProducts) ? appData.defaultProducts : [];

  const resetInventory = () => {
    const freshInventory = defaultProducts.map((product) => ({
      ...product,
      stock: 0,
      minStock: Number(product.minStock ?? 0),
      price: Number(product.price ?? 0),
      costPrice: Number(product.costPrice ?? 0),
      unit: product.unit || 'pcs',
      description: product.description || '',
      image: product.image || ''
    }));

    const inventoryKey = storageKeys.inventory || 'oriflame_inventory_data_v3_reset';
    const transactionsKey = storageKeys.transactions || 'oriflame_inventory_transactions_v3_reset';

    localStorage.setItem(inventoryKey, JSON.stringify(freshInventory));
    localStorage.setItem(transactionsKey, JSON.stringify([]));

    window.location.reload();
  };

  const mountResetButton = () => {
    if (document.getElementById('reset-inventory-button')) return;

    const button = document.createElement('button');
    button.id = 'reset-inventory-button';
    button.type = 'button';
    button.textContent = 'Reset data';
    button.setAttribute(
      'style',
      [
        'position: fixed;',
        'left: 20px;',
        'bottom: 20px;',
        'z-index: 9999;',
        'padding: 12px 16px;',
        'border: 0;',
        'border-radius: 14px;',
        'background: linear-gradient(135deg, #ec4899, #8b5cf6);',
        'color: white;',
        'font-weight: 700;',
        'font-size: 13px;',
        'box-shadow: 0 10px 30px rgba(236, 72, 153, 0.35);',
        'cursor: pointer;',
        'font-family: Arial, sans-serif;'
      ].join('')
    );

    button.addEventListener('click', () => {
      const confirmed = window.confirm('Apakah Anda yakin ingin mereset semua stok dan penjualan menjadi nol?');
      if (confirmed) resetInventory();
    });

    document.body.appendChild(button);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountResetButton, { once: true });
  } else {
    mountResetButton();
  }
})();
