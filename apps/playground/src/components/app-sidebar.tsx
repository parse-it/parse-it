import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  MessageCircle,
  ChartBar,
  ChartArea,
  Code,
} from "lucide-react"

interface SidebarItem {
  title: string
  url: string
  icon: React.ComponentType<React.ComponentProps<"svg">>
}

const items: SidebarItem[] = [
  {
    title: "Home",
    url: "#",
    icon: Home,
  },
  {
    title: "SQL",
    url: "sql",
    icon: Code,
  },
  {
    title: "Chatbot",
    url: "chatbot",
    icon: MessageCircle,
  },
  {
    title: "Charts",
    url: "charts",
    icon: ChartArea,
  },
]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
