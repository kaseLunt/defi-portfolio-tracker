"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, AlertCircle, TrendingUp, Fuel, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

const categoryIcons: Record<string, React.ReactNode> = {
  alert: <AlertCircle className="h-4 w-4 text-amber-500" />,
  yield: <TrendingUp className="h-4 w-4 text-green-500" />,
  gas: <Fuel className="h-4 w-4 text-blue-500" />,
  transaction: <Wallet className="h-4 w-4 text-purple-500" />,
  system: <Bell className="h-4 w-4 text-muted-foreground" />,
};

interface NotificationBellProps {
  userId?: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [mounted, setMounted] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only fetch if we have a user
  const { data: unreadData } = trpc.notification.getUnreadCount.useQuery(
    undefined,
    {
      enabled: !!userId && mounted,
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const { data: notificationsData } = trpc.notification.getNotifications.useQuery(
    { limit: 5 },
    {
      enabled: !!userId && mounted,
      refetchInterval: 30000,
    }
  );

  const markAsRead = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getNotifications.invalidate();
    },
  });

  const markAllAsRead = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getNotifications.invalidate();
    },
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notificationsData?.notifications ?? [];

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate({ notificationIds: [notificationId] });
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  // Prevent hydration mismatch - always render static bell during SSR
  // Also show static bell if no user
  if (!mounted || !userId) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
              >
                <div className="mt-0.5">
                  {categoryIcons[notification.category ?? "system"]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${notification.isRead ? "text-muted-foreground" : ""}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.body}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-sm text-muted-foreground cursor-pointer">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
