import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Rocket,
  Tags,
  MapPin,
  Package,
  ArrowUpDown,
  QrCode,
  BarChart3,
  Settings,
  WifiOff,
  Download,
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  steps: {
    title: string;
    content: string;
    tip?: string;
  }[];
}

const guideSections: GuideSection[] = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    description: 'First-time setup and installation',
    steps: [
      {
        title: 'Install the App (Optional)',
        content:
          'Click the "Install" button in your browser\'s address bar or use the browser menu and select "Install YIMS". Once installed, the app will work offline.',
        tip: 'Installing as a PWA gives you the best experience with offline support and quick access from your home screen.',
      },
      {
        title: 'Sign In or Sign Up',
        content:
          'If using online mode, create an account or sign in with your credentials. For offline mode, you can skip authentication.',
      },
      {
        title: 'Explore the Dashboard',
        content:
          'The dashboard shows an overview of your inventory including total items, low stock alerts, and recent transactions.',
      },
    ],
  },
  {
    id: 'categories',
    icon: Tags,
    title: 'Managing Categories',
    description: 'Organize your inventory with categories',
    steps: [
      {
        title: 'Go to Categories Page',
        content: 'Click on "Categories" in the sidebar navigation.',
      },
      {
        title: 'Create a New Category',
        content:
          'Click "Add Category" button. Enter a name (e.g., "Electronics", "Office Supplies"), optional description, choose an icon and color.',
      },
      {
        title: 'Edit or Delete Categories',
        content:
          'Use the edit (pencil) or delete (trash) icons next to each category. Note: Categories with items cannot be deleted.',
        tip: 'Use descriptive category names and colors to quickly identify item types.',
      },
    ],
  },
  {
    id: 'locations',
    icon: MapPin,
    title: 'Setting Up Locations',
    description: 'Create hierarchical storage locations',
    steps: [
      {
        title: 'Understand Location Types',
        content:
          'YIMS supports hierarchical locations: Building → Room → Shelf → Box → Drawer. This helps you organize exactly where items are stored.',
      },
      {
        title: 'Create a Location',
        content:
          'Go to Locations page, click "Add Location". Select the type, enter a name, and optionally choose a parent location.',
      },
      {
        title: 'Build Your Hierarchy',
        content:
          'Start with buildings, then add rooms within buildings, shelves within rooms, and so on. The tree view shows your complete structure.',
        tip: 'Plan your location hierarchy before adding items. A good structure makes finding items much easier.',
      },
    ],
  },
  {
    id: 'items',
    icon: Package,
    title: 'Adding Items',
    description: 'Create and manage inventory items',
    steps: [
      {
        title: 'Navigate to Items Page',
        content: 'Click "Items" in the sidebar to view your inventory.',
      },
      {
        title: 'Add a New Item',
        content:
          'Click "Add Item". Fill in the name, category, location, minimum stock level, and unit of measurement. An item code will be auto-generated.',
      },
      {
        title: 'Upload an Image (Optional)',
        content: 'Add a photo of the item for easy visual identification.',
      },
      {
        title: 'Set Stock Levels',
        content:
          'Enter the minimum stock level to receive low stock alerts. The current stock starts at 0 and is updated through stock operations.',
        tip: 'Use the search and filters to quickly find items. Filter by category, location, or stock status.',
      },
    ],
  },
  {
    id: 'stock-operations',
    icon: ArrowUpDown,
    title: 'Stock Operations',
    description: 'Manage stock in, out, and adjustments',
    steps: [
      {
        title: 'Stock In (Receiving Items)',
        content:
          'Go to Stock Operations page, select "Stock In" tab. Search or scan an item, enter the quantity received, add optional notes, and confirm.',
      },
      {
        title: 'Stock Out (Issuing Items)',
        content:
          'Select "Stock Out" tab. Find the item, enter the quantity to issue. You can specify the recipient and add notes.',
      },
      {
        title: 'Stock Adjustment',
        content:
          'Use adjustments for corrections, inventory counts, or write-offs. Select the item and enter the adjustment (positive or negative).',
      },
      {
        title: 'View Transaction History',
        content:
          'All transactions are recorded with timestamps, quantities, and who performed them. View history on the History page.',
        tip: 'Always add notes to transactions explaining why stock changed. This helps with auditing.',
      },
    ],
  },
  {
    id: 'scanner',
    icon: QrCode,
    title: 'Using the Scanner',
    description: 'Scan barcodes and QR codes',
    steps: [
      {
        title: 'Open Scanner Page',
        content: 'Click "Scan" in the sidebar to open the barcode scanner.',
      },
      {
        title: 'Allow Camera Access',
        content:
          'When prompted, allow the browser to access your camera. This is required for scanning.',
      },
      {
        title: 'Scan a Code',
        content:
          'Point your camera at a barcode or QR code. Hold steady and ensure good lighting. The code will be detected automatically.',
      },
      {
        title: 'Take Action',
        content:
          'Once scanned, you can view item details, perform stock in/out, or navigate to the item\'s page.',
        tip: 'Print QR codes for your items using the "Generate Code" feature on each item.',
      },
    ],
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Viewing Reports',
    description: 'Dashboard insights and analytics',
    steps: [
      {
        title: 'Dashboard Overview',
        content:
          'The Dashboard shows key metrics: total items, low stock count, locations, and recent transactions.',
      },
      {
        title: 'Stock Movement Charts',
        content:
          'Toggle "Show Charts" to view stock movement trends over the last 14 days.',
      },
      {
        title: 'Transaction History',
        content:
          'Go to History page for a complete log of all transactions. Filter by date, item, or type.',
      },
      {
        title: 'Export Data',
        content:
          'Use Import/Export page (Admin only) to export items, locations, or transactions as CSV files.',
        tip: 'Check low stock alerts regularly to avoid running out of important items.',
      },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Configuring Settings',
    description: 'Customize the application',
    steps: [
      {
        title: 'Access Settings',
        content: 'Click "Settings" in the sidebar (Admin only).',
      },
      {
        title: 'Appearance',
        content: 'Choose Light, Dark, or System theme. Enable Compact Mode for denser displays.',
      },
      {
        title: 'Notifications',
        content:
          'Toggle toast notifications, set duration, and enable/disable sound on successful scans.',
      },
      {
        title: 'Stock Defaults',
        content:
          'Set default minimum stock level, default unit, and low stock warning threshold percentage.',
      },
      {
        title: 'Display Options',
        content: 'Configure items per page and whether to show item codes in lists.',
      },
    ],
  },
  {
    id: 'offline-mode',
    icon: WifiOff,
    title: 'Offline Mode',
    description: 'Using YIMS without internet',
    steps: [
      {
        title: 'Enable Offline Mode',
        content:
          'Go to Settings → Offline & Storage and toggle "Enable Offline Mode" ON. The app will now use local storage instead of the cloud.',
      },
      {
        title: 'How It Works',
        content:
          'All data is stored in your browser\'s IndexedDB. This persists even when you close the browser.',
      },
      {
        title: 'Check Storage Usage',
        content:
          'The Settings page shows how much storage is being used by your offline data.',
      },
      {
        title: 'Important Notes',
        content:
          'Offline data is only on your device. Use Export to back up your data regularly.',
        tip: 'The app automatically detects when you\'re offline and switches to local storage.',
      },
    ],
  },
  {
    id: 'backup',
    icon: Download,
    title: 'Data Backup',
    description: 'Export and import your data',
    steps: [
      {
        title: 'Export All Data',
        content:
          'Go to Import/Export → Full Backup tab. Click "Export All Data" to download a JSON file with all your inventory data.',
      },
      {
        title: 'Import Data',
        content:
          'Select a previously exported JSON file and click "Import". Choose whether to merge with or replace existing data.',
      },
      {
        title: 'CSV Export',
        content:
          'For spreadsheet use, export individual tables (Items, Locations, Transactions) as CSV files.',
      },
      {
        title: 'Transfer Between Devices',
        content:
          'Export from one device and import on another to move your inventory data.',
        tip: 'Create regular backups, especially before major changes or updates.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    icon: HelpCircle,
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    steps: [
      {
        title: 'App Not Loading',
        content:
          'Check your internet connection (for first-time load). Try clearing browser cache and reloading. Reinstall the PWA if needed.',
      },
      {
        title: 'Scanner Not Working',
        content:
          'Ensure camera permissions are granted in your browser settings. Check lighting conditions. Hold the device steady, not too close to the code.',
      },
      {
        title: 'Data Not Saving',
        content:
          'Check if you\'re in offline mode (data saves locally). Ensure you have storage space available. Try refreshing the page.',
      },
      {
        title: 'Forgot Password',
        content:
          'Contact your administrator to reset your password. In offline mode, clear browser data to reset.',
      },
      {
        title: 'Performance Issues',
        content:
          'Large inventories may slow down. Try using filters to limit displayed items. Clear old transaction history if needed.',
      },
    ],
  },
];

export default function HowToUse() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">How to Use YIMS</h1>
        <p className="text-muted-foreground mt-1">
          Step-by-step guides to help you get the most out of YIMS
        </p>
      </div>

      {/* Quick Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Quick Navigation
          </CardTitle>
          <CardDescription>Jump to a specific topic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {guideSections.map((section) => (
              <Button
                key={section.id}
                variant="outline"
                size="sm"
                asChild
                className="gap-1"
              >
                <a href={`#${section.id}`}>
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </a>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guide Sections */}
      <div className="space-y-4">
        {guideSections.map((section) => (
          <Card key={section.id} id={section.id} className="scroll-mt-20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <section.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {section.steps.map((step, index) => (
                  <AccordionItem key={index} value={`step-${index}`}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
                        >
                          {index + 1}
                        </Badge>
                        <span>{step.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-9">
                      <p className="text-muted-foreground">{step.content}</p>
                      {step.tip && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Tip:</span> {step.tip}
                          </p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer CTA */}
      <Card className="bg-muted/50">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <div>
            <p className="font-medium">Still have questions?</p>
            <p className="text-sm text-muted-foreground">
              Check the About page for more information about YIMS.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/about" className="gap-1">
              About YIMS
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
