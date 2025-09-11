import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Menu } from "lucide-react"

const SidebarContext = React.createContext({
  isOpen: false,
  toggle: () => {},
})

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = React.useState(false)
  
  const toggle = React.useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return (
    <SidebarContext.Provider value={{ isOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider")
  }
  return context
}

export const Sidebar = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen } = useSidebar()
  
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => {}}
        />
      )}
      
      {/* Sidebar */}
      <div
        ref={ref}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 transform bg-white transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </>
  )
})
Sidebar.displayName = "Sidebar"

export const SidebarHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-4", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

export const SidebarFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-4", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"

export const SidebarGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mb-4", className)}
    {...props}
  />
))
SidebarGroup.displayName = "SidebarGroup"

export const SidebarGroupLabel = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mb-2 text-xs font-medium text-gray-500", className)}
    {...props}
  />
))
SidebarGroupLabel.displayName = "SidebarGroupLabel"

export const SidebarGroupContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

export const SidebarMenu = React.forwardRef(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("space-y-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarMenuButton = React.forwardRef(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? React.Fragment : "button"
  return (
    <Comp
      ref={ref}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SidebarTrigger = React.forwardRef(({ className, ...props }, ref) => {
  const { toggle } = useSidebar()
  
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn("md:hidden", className)}
      {...props}
    >
      <Menu className="h-4 w-4" />
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"