import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package,
  QrCode,
  ArrowUpDown,
  Tags,
  BarChart3,
  WifiOff,
  Monitor,
  Smartphone,
  Globe,
  HelpCircle,
  Heart,
  Github,
  ArrowLeft,
} from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Track items with codes, stock levels, and organize by categories and locations.',
  },
  {
    icon: QrCode,
    title: 'QR/Barcode Scanning',
    description: 'Scan barcodes and QR codes using your device camera for quick item lookup.',
  },
  {
    icon: ArrowUpDown,
    title: 'Stock Transactions',
    description: 'Record stock in, stock out, and adjustments with full transaction history.',
  },
  {
    icon: Tags,
    title: 'Categories & Locations',
    description: 'Organize inventory with custom categories and hierarchical storage locations.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'View dashboard insights, low stock alerts, and export reports.',
  },
  {
    icon: WifiOff,
    title: 'Offline Support',
    description: 'Works fully offline with local data storage. No internet required!',
  },
];

const techStack = [
  { name: 'React 18', color: 'bg-blue-500' },
  { name: 'TypeScript', color: 'bg-blue-700' },
  { name: 'Tailwind CSS', color: 'bg-cyan-500' },
  { name: 'shadcn/ui', color: 'bg-zinc-700' },
  { name: 'IndexedDB', color: 'bg-amber-500' },
  { name: 'PWA', color: 'bg-purple-500' },
];

const platforms = [
  { icon: Monitor, name: 'Desktop' },
  { icon: Smartphone, name: 'Mobile' },
  { icon: Globe, name: 'Web Browser' },
];

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-8 md:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-3xl shadow-lg">
              Y
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">YIMS</h1>
              <p className="text-muted-foreground text-lg">Youth Inventory Management System</p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mt-4">
            A modern, offline-capable inventory management system designed for youth organizations,
            schools, clubs, and small businesses. Track items, manage stock, and generate reports —
            all without needing an internet connection.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="secondary" className="text-sm">
              Version 1.0.0
            </Badge>
            <Badge variant="outline" className="text-sm">
              Open Source
            </Badge>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Features Grid */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Technology Stack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Technology Stack</CardTitle>
          <CardDescription>Built with modern, reliable technologies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <Badge key={tech.name} className={`${tech.color} text-white`}>
                {tech.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supported Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Supported Platforms</CardTitle>
          <CardDescription>Use YIMS on any device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {platforms.map((platform) => (
              <div key={platform.name} className="flex items-center gap-2 text-muted-foreground">
                <platform.icon className="h-5 w-5" />
                <span>{platform.name}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Install as a Progressive Web App (PWA) for the best experience. Works on Chrome, Firefox,
            Edge, Safari, and mobile browsers.
          </p>
        </CardContent>
      </Card>

      {/* User Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">User Roles</CardTitle>
          <CardDescription>Role-based access control for security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="destructive">Admin</Badge>
            <p className="text-sm text-muted-foreground">
              Full access to all features including user management, settings, and system logs.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-primary text-primary-foreground">Operator</Badge>
            <p className="text-sm text-muted-foreground">
              Manage inventory, perform stock operations, and view reports.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="secondary">Student</Badge>
            <p className="text-sm text-muted-foreground">
              View inventory and perform basic stock operations with approval workflows.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Card className="bg-muted/50">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Need help getting started?</p>
              <p className="text-sm text-muted-foreground">
                Check out our step-by-step guide.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/how-to-use">View How to Use Guide</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-4 border-t">
        <p className="flex items-center justify-center gap-1">
          Made with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> for youth organizations
        </p>
        <p className="mt-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Github className="h-4 w-4" />
            Open Source on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
