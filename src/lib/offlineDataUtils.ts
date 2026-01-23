import {
  offlineDb,
  type OfflineCategory,
  type OfflineLocation,
  type OfflineItem,
  type OfflineItemVariant,
  type OfflineStockTransaction,
} from './offlineDb';

// Export format version for compatibility checking
const EXPORT_VERSION = '1.0.0';

export interface ExportData {
  version: string;
  exportedAt: string;
  data: {
    categories: OfflineCategory[];
    locations: OfflineLocation[];
    items: OfflineItem[];
    itemVariants: OfflineItemVariant[];
    stockTransactions: OfflineStockTransaction[];
  };
}

/**
 * Export all offline data to a JSON object
 */
export async function exportAllData(): Promise<ExportData> {
  const categories = await offlineDb.categories.toArray();
  const locations = await offlineDb.locations.toArray();
  const items = await offlineDb.items.toArray();
  const itemVariants = await offlineDb.itemVariants.toArray();
  const stockTransactions = await offlineDb.stockTransactions.toArray();

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      categories,
      locations,
      items,
      itemVariants,
      stockTransactions,
    },
  };
}

/**
 * Download export data as a JSON file
 */
export async function downloadExportFile(): Promise<void> {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `yims-backup-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate import data structure
 */
export function validateImportData(
  data: unknown
): { valid: true; data: ExportData } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.version || typeof obj.version !== 'string') {
    return { valid: false, error: 'Missing or invalid version' };
  }

  if (!obj.exportedAt || typeof obj.exportedAt !== 'string') {
    return { valid: false, error: 'Missing or invalid export date' };
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { valid: false, error: 'Missing data object' };
  }

  const dataObj = obj.data as Record<string, unknown>;

  if (!Array.isArray(dataObj.categories)) {
    return { valid: false, error: 'Missing or invalid categories array' };
  }

  if (!Array.isArray(dataObj.locations)) {
    return { valid: false, error: 'Missing or invalid locations array' };
  }

  if (!Array.isArray(dataObj.items)) {
    return { valid: false, error: 'Missing or invalid items array' };
  }

  return { valid: true, data: data as ExportData };
}

/**
 * Import data from a JSON file
 */
export async function importData(
  file: File,
  mode: 'replace' | 'merge' = 'merge'
): Promise<{
  success: boolean;
  counts: {
    categories: number;
    locations: number;
    items: number;
    itemVariants: number;
    stockTransactions: number;
  };
  error?: string;
}> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const validation = validateImportData(parsed);

    if (!validation.valid) {
      return {
        success: false,
        counts: { categories: 0, locations: 0, items: 0, itemVariants: 0, stockTransactions: 0 },
        error: 'error' in validation ? validation.error : 'Invalid data',
      };
    }

    const { data } = validation.data;

    if (mode === 'replace') {
      await offlineDb.clearAllData();
    }

    const counts = {
      categories: 0,
      locations: 0,
      items: 0,
      itemVariants: 0,
      stockTransactions: 0,
    };

    // Import categories
    for (const category of data.categories) {
      const existing =
        mode === 'merge' ? await offlineDb.categories.where('name').equals(category.name).first() : null;
      if (!existing) {
        // Remove id for auto-generation
        const { id, ...categoryData } = category;
        await offlineDb.categories.add({
          ...categoryData,
          createdAt: new Date(categoryData.createdAt),
          updatedAt: new Date(categoryData.updatedAt),
        });
        counts.categories++;
      }
    }

    // Import locations (need to handle hierarchy)
    const locationIdMap = new Map<number, number>();
    const sortedLocations = [...data.locations].sort((a, b) => {
      // Import parents first
      if (!a.parentId && b.parentId) return -1;
      if (a.parentId && !b.parentId) return 1;
      return 0;
    });

    for (const location of sortedLocations) {
      const existing =
        mode === 'merge' ? await offlineDb.locations.where('code').equals(location.code).first() : null;
      if (!existing) {
        const { id, parentId, ...locationData } = location;
        const newId = await offlineDb.locations.add({
          ...locationData,
          parentId: parentId ? locationIdMap.get(parentId) : undefined,
          createdAt: new Date(locationData.createdAt),
          updatedAt: new Date(locationData.updatedAt),
        });
        if (id) locationIdMap.set(id, newId);
        counts.locations++;
      }
    }

    // Import items
    const itemIdMap = new Map<number, number>();
    const categoryNameToId = new Map<string, number>();
    const categories = await offlineDb.categories.toArray();
    categories.forEach((c) => {
      if (c.id) categoryNameToId.set(c.name, c.id);
    });

    const locationCodeToId = new Map<string, number>();
    const locations = await offlineDb.locations.toArray();
    locations.forEach((l) => {
      if (l.id) locationCodeToId.set(l.code, l.id);
    });

    for (const item of data.items) {
      const existing =
        mode === 'merge' ? await offlineDb.items.where('code').equals(item.code).first() : null;
      if (!existing) {
        const { id, categoryId, locationId, ...itemData } = item;
        const newId = await offlineDb.items.add({
          ...itemData,
          categoryId: categoryId ? undefined : undefined, // Will need mapping from original import
          locationId: locationId ? undefined : undefined,
          createdAt: new Date(itemData.createdAt),
          updatedAt: new Date(itemData.updatedAt),
        });
        if (id) itemIdMap.set(id, newId);
        counts.items++;
      }
    }

    // Import item variants
    for (const variant of data.itemVariants || []) {
      const { id, parentItemId, ...variantData } = variant;
      const newParentId = itemIdMap.get(parentItemId);
      if (newParentId) {
        await offlineDb.itemVariants.add({
          ...variantData,
          parentItemId: newParentId,
          createdAt: new Date(variantData.createdAt),
          updatedAt: new Date(variantData.updatedAt),
        });
        counts.itemVariants++;
      }
    }

    // Import stock transactions
    for (const tx of data.stockTransactions || []) {
      const { id, itemId, variantId, ...txData } = tx;
      const newItemId = itemIdMap.get(itemId);
      if (newItemId) {
        await offlineDb.stockTransactions.add({
          ...txData,
          itemId: newItemId,
          variantId: variantId ? undefined : undefined, // Would need mapping
          createdAt: new Date(txData.createdAt),
        });
        counts.stockTransactions++;
      }
    }

    return { success: true, counts };
  } catch (error) {
    return {
      success: false,
      counts: { categories: 0, locations: 0, items: 0, itemVariants: 0, stockTransactions: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get storage usage information
 */
export async function getStorageInfo(): Promise<{
  used: string;
  available: string;
  percentage: number;
} | null> {
  const estimate = await offlineDb.getStorageEstimate();
  if (!estimate) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return {
    used: formatBytes(estimate.usage),
    available: formatBytes(estimate.quota - estimate.usage),
    percentage: Math.round((estimate.usage / estimate.quota) * 100),
  };
}

/**
 * Get record counts for display
 */
export async function getRecordCounts(): Promise<{
  categories: number;
  locations: number;
  items: number;
  itemVariants: number;
  stockTransactions: number;
}> {
  return {
    categories: await offlineDb.categories.count(),
    locations: await offlineDb.locations.count(),
    items: await offlineDb.items.count(),
    itemVariants: await offlineDb.itemVariants.count(),
    stockTransactions: await offlineDb.stockTransactions.count(),
  };
}
