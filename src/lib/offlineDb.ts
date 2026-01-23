import Dexie, { type Table } from 'dexie';

// Offline data types matching the Supabase schema
export interface OfflineCategory {
  id?: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineLocation {
  id?: number;
  code: string;
  name: string;
  description?: string;
  locationType: 'building' | 'room' | 'shelf' | 'box' | 'drawer';
  parentId?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineItem {
  id?: number;
  code: string;
  name: string;
  description?: string;
  categoryId?: number;
  locationId?: number;
  currentStock: number;
  minimumStock: number;
  unit: string;
  imageUrl?: string;
  hasVariants: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineItemVariant {
  id?: number;
  parentItemId: number;
  variantName: string;
  skuSuffix?: string;
  variantAttributes: Record<string, string>;
  currentStock: number;
  minimumStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineStockTransaction {
  id?: number;
  itemId: number;
  variantId?: number;
  transactionType: 'stock_in' | 'stock_out' | 'adjustment' | 'transfer';
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  recipient?: string;
  locationId?: number;
  performedBy: string;
  createdAt: Date;
}

export interface OfflineUser {
  id?: number;
  username: string;
  fullName?: string;
  role: 'admin' | 'operator' | 'student';
  createdAt: Date;
}

export interface OfflineSettings {
  id?: number;
  key: string;
  value: string;
}

// Dexie database class
class YIMSOfflineDatabase extends Dexie {
  categories!: Table<OfflineCategory>;
  locations!: Table<OfflineLocation>;
  items!: Table<OfflineItem>;
  itemVariants!: Table<OfflineItemVariant>;
  stockTransactions!: Table<OfflineStockTransaction>;
  users!: Table<OfflineUser>;
  settings!: Table<OfflineSettings>;

  constructor() {
    super('yims-offline');

    this.version(1).stores({
      categories: '++id, name, isActive',
      locations: '++id, code, name, locationType, parentId, isActive',
      items: '++id, code, name, categoryId, locationId, isActive',
      itemVariants: '++id, parentItemId, variantName, isActive',
      stockTransactions: '++id, itemId, variantId, transactionType, createdAt',
      users: '++id, username, role',
      settings: '++id, &key',
    });
  }

  // Generate unique codes
  async generateItemCode(): Promise<string> {
    const count = await this.items.count();
    const prefix = 'ITM';
    const number = String(count + 1).padStart(5, '0');
    return `${prefix}-${number}`;
  }

  async generateLocationCode(locationType: string): Promise<string> {
    const prefixMap: Record<string, string> = {
      building: 'BLD',
      room: 'ROM',
      shelf: 'SHF',
      box: 'BOX',
      drawer: 'DRW',
    };
    const prefix = prefixMap[locationType] || 'LOC';
    const count = await this.locations.where('locationType').equals(locationType).count();
    const number = String(count + 1).padStart(4, '0');
    return `${prefix}-${number}`;
  }

  // Get items with joined category and location data
  async getItemsWithJoins(): Promise<
    (OfflineItem & { category?: OfflineCategory; location?: OfflineLocation })[]
  > {
    const items = await this.items.where('isActive').equals(1).toArray();
    const categories = await this.categories.toArray();
    const locations = await this.locations.toArray();

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    return items.map((item) => ({
      ...item,
      category: item.categoryId ? categoryMap.get(item.categoryId) : undefined,
      location: item.locationId ? locationMap.get(item.locationId) : undefined,
    }));
  }

  // Get transactions with item data
  async getTransactionsWithItems(
    limit = 100
  ): Promise<(OfflineStockTransaction & { item?: OfflineItem })[]> {
    const transactions = await this.stockTransactions
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray();
    const items = await this.items.toArray();
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return transactions.map((tx) => ({
      ...tx,
      item: tx.itemId ? itemMap.get(tx.itemId) : undefined,
    }));
  }

  // Perform stock operation
  async performStockOperation(
    itemId: number,
    transactionType: OfflineStockTransaction['transactionType'],
    quantity: number,
    performedBy: string,
    notes?: string,
    recipient?: string,
    variantId?: number
  ): Promise<void> {
    await this.transaction('rw', [this.items, this.itemVariants, this.stockTransactions], async () => {
      let balanceBefore: number;
      let balanceAfter: number;

      if (variantId) {
        const variant = await this.itemVariants.get(variantId);
        if (!variant) throw new Error('Variant not found');

        balanceBefore = variant.currentStock;
        balanceAfter =
          transactionType === 'stock_out'
            ? balanceBefore - quantity
            : transactionType === 'stock_in'
            ? balanceBefore + quantity
            : balanceBefore + quantity; // adjustment can be +/-

        await this.itemVariants.update(variantId, {
          currentStock: balanceAfter,
          updatedAt: new Date(),
        });
      } else {
        const item = await this.items.get(itemId);
        if (!item) throw new Error('Item not found');

        balanceBefore = item.currentStock;
        balanceAfter =
          transactionType === 'stock_out'
            ? balanceBefore - quantity
            : transactionType === 'stock_in'
            ? balanceBefore + quantity
            : balanceBefore + quantity;

        await this.items.update(itemId, {
          currentStock: balanceAfter,
          updatedAt: new Date(),
        });
      }

      await this.stockTransactions.add({
        itemId,
        variantId,
        transactionType,
        quantity: transactionType === 'stock_out' ? -quantity : quantity,
        balanceBefore,
        balanceAfter,
        notes,
        recipient,
        performedBy,
        createdAt: new Date(),
      });
    });
  }

  // Get dashboard stats
  async getDashboardStats(): Promise<{
    totalItems: number;
    lowStockCount: number;
    totalLocations: number;
    recentTransactions: number;
  }> {
    const activeItems = await this.items.where('isActive').equals(1).toArray();
    const totalItems = activeItems.length;
    const lowStockCount = activeItems.filter((i) => i.currentStock < i.minimumStock).length;
    const totalLocations = await this.locations.where('isActive').equals(1).count();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransactions = await this.stockTransactions
      .where('createdAt')
      .above(oneDayAgo)
      .count();

    return { totalItems, lowStockCount, totalLocations, recentTransactions };
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.categories,
        this.locations,
        this.items,
        this.itemVariants,
        this.stockTransactions,
        this.users,
      ],
      async () => {
        await this.categories.clear();
        await this.locations.clear();
        await this.items.clear();
        await this.itemVariants.clear();
        await this.stockTransactions.clear();
        await this.users.clear();
      }
    );
  }

  // Get storage estimate
  async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return null;
  }
}

// Export singleton instance
export const offlineDb = new YIMSOfflineDatabase();

// Helper to check if we should use offline mode
export function shouldUseOfflineMode(): boolean {
  const settings = localStorage.getItem('yims-settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      return parsed.offlineMode === true;
    } catch {
      return false;
    }
  }
  return false;
}
