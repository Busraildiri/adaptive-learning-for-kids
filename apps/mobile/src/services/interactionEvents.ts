import { createInteractionEvent, type InteractionEventType } from "@adaptive/analytics-events";
import NetInfo from "@react-native-community/netinfo";
import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import type { Json } from "../lib/database.types";
import { requireSupabase } from "../lib/supabase";
import {
  InteractionEventSynchronizer,
  type InteractionEventTransport,
  SQLiteInteractionEventStore,
} from "./interactionEventQueue";

const store = new SQLiteInteractionEventStore();

const supabaseTransport: InteractionEventTransport = {
  async send(events) {
    const { error } = await requireSupabase().rpc("sync_interaction_events", {
      events: events as unknown as Json,
    });
    if (error) throw error;
  },
};

const synchronizer = new InteractionEventSynchronizer(store, supabaseTransport);
let initialized: Promise<void> | null = null;

export function initializeInteractionEventSync(): () => void {
  initialized ??= store.initialize();

  const synchronize = async () => {
    await initialized;
    await synchronizer.drain();
  };

  const unsubscribeNetwork = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void synchronize().catch(() => undefined);
    }
  });
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void synchronize().catch(() => undefined);
  });

  void synchronize().catch(() => undefined);

  return () => {
    unsubscribeNetwork();
    appStateSubscription.remove();
  };
}

export async function clearPendingInteractionEventsForChild(childId: string): Promise<void> {
  initialized ??= store.initialize();
  await initialized;
  await store.clearForChild(childId);
}

export interface ActivityEventRecorder {
  record(
    eventType: InteractionEventType,
    payload?: Record<string, string | number | boolean | null>,
  ): Promise<void>;
  clearPending(): Promise<void>;
}

export function createActivityEventRecorder(input: {
  childId: string;
  activityId: string;
  enabled: boolean;
}): ActivityEventRecorder {
  const sessionId = randomUUID();
  let sequenceNumber = 0;

  return {
    async record(eventType, payload = {}) {
      if (!input.enabled) return;
      initialized ??= store.initialize();
      await initialized;
      sequenceNumber += 1;
      await store.enqueue(
        createInteractionEvent({
          eventId: randomUUID(),
          sessionId,
          sequenceNumber,
          childId: input.childId,
          activityId: input.activityId,
          eventType,
          payload,
        }),
      );
      void synchronizer.drain().catch(() => undefined);
    },
    async clearPending() {
      await store.clearForChild(input.childId);
    },
  };
}
