import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
    Home, 
    MessageCircle, 
    User, 
    LogOut,
    Brain,
    Settings,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ActivityCalendar from "./dashboard/ActivityCalendar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Practice",
    url: "/interview",
    icon: MessageCircle,
  }
];

function LayoutContent({ children }) {
  const location = useLocation();
  const { user, sessions, userStats, isAuthenticated, isLoadingData, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Sidebar className="border-r border-gray-200/60 backdrop-blur-sm bg-white/80">
          <SidebarHeader className="border-b border-gray-200/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-gray-900">PM Practice</h2>
                <p className="text-xs text-gray-500">AI Interview Coach</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-indigo-100 text-indigo-800 shadow-sm' : 'text-gray-600'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {user && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">
                  Activity
                </SidebarGroupLabel>
                <SidebarGroupContent className="p-2">
                  {isLoadingData ? (
                    <div className="flex justify-center items-center h-48">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                  ) : (
                    <ActivityCalendar sessions={sessions} />
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200/60 p-4">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{user.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link to="/profile">
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-800">
                      <Settings className="w-5 h-5" />
                    </Button>
                  </Link>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500">Not signed in</p>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          {/* Mobile header */}
          <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
                <div className="flex items-center gap-2">
                  <Brain className="w-6 h-6 text-indigo-600" />
                  <h1 className="text-lg font-semibold">PM Practice</h1>
                </div>
              </div>
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="text-gray-500">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children }) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}