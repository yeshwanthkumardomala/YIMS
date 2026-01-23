import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Package,
  Tags,
  MapPin,
  LayoutDashboard,
  ArrowUpDown,
  QrCode,
  History,
  Settings,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineDb } from '@/lib/offlineDb';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  type: 'page' | 'item' | 'category' | 'location';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

const PAGES: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => {} },
  { id: 'items', type: 'page', title: 'Items', icon: <Package className="h-4 w-4" />, action: () => {} },
  { id: 'categories', type: 'page', title: 'Categories', icon: <Tags className="h-4 w-4" />, action: () => {} },
  { id: 'locations', type: 'page', title: 'Locations', icon: <MapPin className="h-4 w-4" />, action: () => {} },
  { id: 'stock', type: 'page', title: 'Stock Operations', icon: <ArrowUpDown className="h-4 w-4" />, action: () => {} },
  { id: 'scan', type: 'page', title: 'Scan', icon: <QrCode className="h-4 w-4" />, action: () => {} },
  { id: 'history', type: 'page', title: 'History', icon: <History className="h-4 w-4" />, action: () => {} },
  { id: 'settings', type: 'page', title: 'Settings', icon: <Settings className="h-4 w-4" />, action: () => {} },
  { id: 'import-export', type: 'page', title: 'Import/Export', icon: <FileSpreadsheet className="h-4 w-4" />, action: () => {} },
  { id: 'users', type: 'page', title: 'Users', icon: <Users className="h-4 w-4" />, action: () => {} },
];

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { isOfflineMode } = useOfflineMode();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(PAGES.map(page => ({
        ...page,
        action: () => {
          navigate(page.id === 'dashboard' ? '/' : `/${page.id}`);
          onOpenChange(false);
        },
      })));
      return;
    }

    setIsSearching(true);
    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    // Filter pages
    const matchingPages = PAGES.filter(page =>
      page.title.toLowerCase().includes(lowerQuery)
    ).map(page => ({
      ...page,
      action: () => {
        navigate(page.id === 'dashboard' ? '/' : `/${page.id}`);
        onOpenChange(false);
      },
    }));
    searchResults.push(...matchingPages);

    try {
      if (isOfflineMode) {
        // Search offline data
        const items = await offlineDb.items.toArray();
        const matchingItems = items
          .filter(item => 
            item.isActive && 
            (item.name.toLowerCase().includes(lowerQuery) || 
             item.code.toLowerCase().includes(lowerQuery))
          )
          .slice(0, 5)
          .map(item => ({
            id: String(item.id),
            type: 'item' as const,
            title: item.name,
            subtitle: item.code,
            icon: <Package className="h-4 w-4" />,
            action: () => {
              navigate('/items');
              onOpenChange(false);
            },
          }));
        searchResults.push(...matchingItems);

        const categories = await offlineDb.categories.toArray();
        const matchingCategories = categories
          .filter(cat => 
            cat.isActive && 
            cat.name.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 3)
          .map(cat => ({
            id: String(cat.id),
            type: 'category' as const,
            title: cat.name,
            icon: <Tags className="h-4 w-4" />,
            action: () => {
              navigate('/categories');
              onOpenChange(false);
            },
          }));
        searchResults.push(...matchingCategories);

        const locations = await offlineDb.locations.toArray();
        const matchingLocations = locations
          .filter(loc => 
            loc.isActive && 
            (loc.name.toLowerCase().includes(lowerQuery) ||
             loc.code.toLowerCase().includes(lowerQuery))
          )
          .slice(0, 3)
          .map(loc => ({
            id: String(loc.id),
            type: 'location' as const,
            title: loc.name,
            subtitle: loc.code,
            icon: <MapPin className="h-4 w-4" />,
            action: () => {
              navigate('/locations');
              onOpenChange(false);
            },
          }));
        searchResults.push(...matchingLocations);
      } else {
        // Search Supabase
        const { data: items } = await supabase
          .from('items')
          .select('id, name, code')
          .eq('is_active', true)
          .or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`)
          .limit(5);

        if (items) {
          searchResults.push(...items.map(item => ({
            id: item.id,
            type: 'item' as const,
            title: item.name,
            subtitle: item.code,
            icon: <Package className="h-4 w-4" />,
            action: () => {
              navigate('/items');
              onOpenChange(false);
            },
          })));
        }

        const { data: categories } = await supabase
          .from('categories')
          .select('id, name')
          .eq('is_active', true)
          .ilike('name', `%${searchQuery}%`)
          .limit(3);

        if (categories) {
          searchResults.push(...categories.map(cat => ({
            id: cat.id,
            type: 'category' as const,
            title: cat.name,
            icon: <Tags className="h-4 w-4" />,
            action: () => {
              navigate('/categories');
              onOpenChange(false);
            },
          })));
        }

        const { data: locations } = await supabase
          .from('locations')
          .select('id, name, code')
          .eq('is_active', true)
          .or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`)
          .limit(3);

        if (locations) {
          searchResults.push(...locations.map(loc => ({
            id: loc.id,
            type: 'location' as const,
            title: loc.name,
            subtitle: loc.code,
            icon: <MapPin className="h-4 w-4" />,
            action: () => {
              navigate('/locations');
              onOpenChange(false);
            },
          })));
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    }

    setResults(searchResults);
    setSelectedIndex(0);
    setIsSearching(false);
  }, [isOfflineMode, navigate, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery('');
      search('');
    }
  }, [open, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].action();
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'page': return 'bg-primary/10 text-primary';
      case 'item': return 'bg-purple-500/10 text-purple-600';
      case 'category': return 'bg-green-500/10 text-green-600';
      case 'location': return 'bg-blue-500/10 text-blue-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search pages, items, categories, locations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          {isSearching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-2">
            {results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={result.action}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 rounded-md text-left transition-colors",
                    index === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-muted-foreground">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className={cn("text-[10px]", getTypeBadgeColor(result.type))}>
                    {result.type}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">↑↓</Badge>
            <span>to navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">Enter</Badge>
            <span>to select</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">Esc</Badge>
            <span>to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
