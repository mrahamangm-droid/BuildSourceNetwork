import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { markNotificationsReadAction } from "@/server/actions";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireCtx();
  const items = await db.notification.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          unread ? (
            <form action={markNotificationsReadAction}>
              <Button variant="outline" type="submit">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      {items.length ? (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={n.readAt ? "" : "border-brand-500 bg-brand-50/40"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {n.href ? (
                      <Link className="hover:underline" href={n.href}>
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  {n.body ? <p className="text-sm text-muted">{n.body}</p> : null}
                </div>
                <span className="text-xs text-muted">{formatDate(n.createdAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You're all caught up"
          body="New RFQs, quotes and order updates will show up here."
        />
      )}
    </div>
  );
}
