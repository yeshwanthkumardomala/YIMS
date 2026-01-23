import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
  action: () => void;
}

const NAVIGATION_ROUTES = [
  { key: '1', path: '/', label: 'Dashboard' },
  { key: '2', path: '/items', label: 'Items' },
  { key: '3', path: '/categories', label: 'Categories' },
  { key: '4', path: '/locations', label: 'Locations' },
  { key: '5', path: '/stock', label: 'Stock Operations' },
  { key: '6', path: '/scan', label: 'Scan' },
  { key: '7', path: '/history', label: 'History' },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showQuickAddDialog, setShowQuickAddDialog] = useState<'category' | 'location' | 'item' | null>(null);

  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    ...NAVIGATION_ROUTES.map(route => ({
      key: route.key,
      ctrl: true,
      description: `Go to ${route.label}`,
      category: 'Navigation',
      action: () => navigate(route.path),
    })),
    // Quick actions
    {
      key: 'n',
      ctrl: true,
      description: 'Add new item',
      category: 'Quick Actions',
      action: () => setShowQuickAddDialog('item'),
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Open search',
      category: 'Quick Actions',
      action: () => setShowSearchDialog(true),
    },
    {
      key: '/',
      ctrl: true,
      description: 'Show keyboard shortcuts',
      category: 'Help',
      action: () => setShowShortcutsDialog(true),
    },
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      category: 'Help',
      action: () => setShowShortcutsDialog(true),
    },
    {
      key: 'Escape',
      description: 'Close dialog/modal',
      category: 'General',
      action: () => {
        setShowShortcutsDialog(false);
        setShowSearchDialog(false);
        setShowQuickAddDialog(null);
      },
    },
    {
      key: 'h',
      ctrl: true,
      description: 'Go to Home',
      category: 'Navigation',
      action: () => navigate('/'),
    },
    {
      key: 's',
      ctrl: true,
      shift: true,
      description: 'Go to Settings',
      category: 'Navigation',
      action: () => navigate('/settings'),
    },
    {
      key: 'l',
      ctrl: true,
      shift: true,
      description: 'Add new location',
      category: 'Quick Actions',
      action: () => setShowQuickAddDialog('location'),
    },
    {
      key: 'c',
      ctrl: true,
      shift: true,
      description: 'Add new category',
      category: 'Quick Actions',
      action: () => setShowQuickAddDialog('category'),
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getShortcutsByCategory = useCallback(() => {
    const categories: Record<string, KeyboardShortcut[]> = {};
    for (const shortcut of shortcuts) {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = [];
      }
      categories[shortcut.category].push(shortcut);
    }
    return categories;
  }, [shortcuts]);

  const formatShortcut = (shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return {
    shortcuts,
    showShortcutsDialog,
    setShowShortcutsDialog,
    showSearchDialog,
    setShowSearchDialog,
    showQuickAddDialog,
    setShowQuickAddDialog,
    getShortcutsByCategory,
    formatShortcut,
    currentPath: location.pathname,
  };
}
