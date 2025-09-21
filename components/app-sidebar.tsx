"use client";

import { Upload, FileText, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Upload",
    url: "/dashboard/upload",
    icon: Upload,
  },
  {
    title: "Quotations",
    url: "/dashboard/quotations",
    icon: FileText,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" className="border-r border-gray-200">
      <SidebarHeader className="border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0">
            <Home className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              Construction
            </h2>
            <p className="text-sm text-gray-600 truncate">
              Measurement Analyzer
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white">
        <SidebarGroup className="px-3 py-4">
          <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={`
                      w-full justify-start px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200
                      ${
                        pathname === item.url
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      }
                    `}
                  >
                    <Link
                      href={item.url}
                      className="flex items-center gap-3 w-full"
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-100 bg-gray-50 p-4">
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">AI-powered measurement</p>
          <p>extraction system</p>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-400">v1.0.0</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
