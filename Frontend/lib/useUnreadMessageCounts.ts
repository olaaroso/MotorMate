"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMessageSummary, type MessagingView } from "@/lib/messages";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/notifications";
import { useVisibleInterval } from "@/lib/useVisibleInterval";

const SUMMARY_POLL_INTERVAL_MS = 30_000;

/**
 * Unread message counts keyed by service request ID for the signed-in actor.
 * Refreshes on load, focus, tab visibility, the notifications-updated event
 * (fired after a thread is read or a message is sent), and every 30 seconds
 * while the tab is visible.
 */
export function useUnreadMessageCounts(actorId: string, view: MessagingView) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const inFlight = useRef(false);
  const queued = useRef(false);

  // Background refreshes (poll, focus) are dropped while one is in flight;
  // forced ones (after a read or send) run once more afterwards so they
  // never see a summary fetched before the change.
  const refresh = useCallback(
    (force = false) => {
      if (!actorId) return;
      if (inFlight.current) {
        if (force) queued.current = true;
        return;
      }

      const run = () => {
        inFlight.current = true;
        fetchMessageSummary(actorId, view)
          .then((summary) => {
            setUnreadCounts(
              Object.fromEntries(
                Object.entries(summary).map(([requestId, item]) => [
                  requestId,
                  item.unread_count,
                ])
              )
            );
          })
          // Badges keep their last known counts until a refresh succeeds.
          .catch(() => undefined)
          .finally(() => {
            inFlight.current = false;
            if (queued.current) {
              queued.current = false;
              run();
            }
          });
      };

      run();
    },
    [actorId, view]
  );

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    const refreshAfterChange = () => refresh(true);
    const refreshInBackground = () => refresh();

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshAfterChange);
    window.addEventListener("focus", refreshInBackground);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshAfterChange);
      window.removeEventListener("focus", refreshInBackground);
    };
  }, [refresh]);

  useVisibleInterval(refresh, SUMMARY_POLL_INTERVAL_MS, Boolean(actorId));

  const refreshUnreadCounts = useCallback(() => refresh(true), [refresh]);

  return { unreadCounts, refreshUnreadCounts };
}
