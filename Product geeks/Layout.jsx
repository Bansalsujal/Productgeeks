
import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
import { User as UserEntity } from "@/entities/User";
import { InterviewSession } from "@/entities/InterviewSession";
import { UserStats } from "@/entities/UserStats";
import ActivityCalendar from "./components/dashboard/ActivityCalendar";

// Create auth context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Home"),
    icon: Home,
  },
  {
    title: "Practice",
    url: createPageUrl("Interview"),
    icon: MessageCircle,
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load user data function - stable reference
  const loadUserData = useCallback(async (userId) => {
    if (!userId) return;
    
    setIsLoadingData(true);
    try {
      console.log('Loading data for user:', userId);
      // Load all user data in parallel - filter sessions by current user
      const [sessionsData, statsData] = await Promise.all([
        InterviewSession.filter({ user_id: userId }, '-created_date', 90),
        UserStats.filter({ user_id: userId })
      ]);
      
      console.log('Loaded sessions for current user:', sessionsData.length);
      setSessions(sessionsData);
      setUserStats(statsData.length > 0 ? statsData[0] : null);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    setIsLoadingData(false);
  }, []);

  // Refresh function with stable reference
  const refreshUserData = useCallback(() => {
    if (user?.id) {
      loadUserData(user.id);
    }
  }, [user?.id, loadUserData]);

  // Initial auth and data loading
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const userData = await UserEntity.me();
        setUser(userData);
        
        // Load user data after authentication
        if (userData?.id) {
          await loadUserData(userData.id);
        }
      } catch (error) {
        // User not authenticated
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    loadAuth();
  }, [loadUserData]);

  const handleLogout = async () => {
    await UserEntity.logout();
    setUser(null);
    setSessions([]);
    setUserStats(null);
    window.location.reload();
  };

  // Show loading spinner while checking authentication
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      sessions,
      userStats,
      isAuthenticated: !!user, 
      isLoading: isLoadingAuth,
      isLoadingData,
      refreshUserData 
    }}>
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
                            location.pathname.startsWith(item.url) ? 'bg-indigo-100 text-indigo-800 shadow-sm' : 'text-gray-600'
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
                    <Link to={createPageUrl("Profile")}>
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
                  <Button onClick={() => UserEntity.login()} className="mt-2 w-full">Sign In</Button>
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
                <Link to={createPageUrl("Profile")}>
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
    </AuthContext.Provider>
  );
}
