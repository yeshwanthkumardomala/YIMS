import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import Locations from "./pages/Locations";
import Stock from "./pages/Stock";
import Scan from "./pages/Scan";
import History from "./pages/History";
import ImportExport from "./pages/ImportExport";
import Users from "./pages/Users";
import SystemLogs from "./pages/SystemLogs";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/items"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Items />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/locations"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Locations />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stock"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Stock />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scan"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Scan />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <History />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Admin Only Routes */}
              <Route
                path="/import-export"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <ImportExport />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <Users />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <SystemLogs />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
