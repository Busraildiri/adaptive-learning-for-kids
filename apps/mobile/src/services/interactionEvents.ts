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
let synchronizationInFlight: Promise<number> | null = null;
let synchronizationRevision = 0;

export function synchronizePendingInteractionEvents(): Promise<number> {
  synchronizationRevision += 1;
  if (synchronizationInFlight) return synchronizationInFlight;

  synchronizationInFlight = (async () => {
    initialized ??= store.initialize();
    await initialized;
    let synchronized = 0;
    let handledRevision = 0;
    do {
      handledRevision = synchronizationRevision;
      synchronized += await synchronizer.drain();
    } while (handledRevision < synchronizationRevision);
    return synchronized;
  })().finally(() => {
    synchronizationInFlight = null;
  });

  return synchronizationInFlight;
}

export function initializeInteractionEventSync(): () => void {
  initialized ??= store.initialize();

  const unsubscribeNetwork = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void synchronizePendingInteractionEvents().catch(() => undefined);
    }
  });
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void synchronizePendingInteractionEvents().catch(() => undefined);
  });

  void synchronizePendingInteractionEvents().catch(() => undefined);

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
  ensurePersisted(): Promise<void>;
  flush(): Promise<void>;
  clearPending(): Promise<void>;
}

export function createActivityEventRecorder(input: {
  childId: string;
  activityId: string;
  enabled: boolean;
}): ActivityEventRecorder {
  const sessionId = randomUUID();
  let sequenceNumber = 0;
  let pendingWrite = Promise.resolve();

  return {
    async record(eventType, payload = {}) {
      if (!input.enabled) return;
      pendingWrite = pendingWrite.then(async () => {
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
      });
      await pendingWrite;
      void synchronizePendingInteractionEvents().catch(() => undefined);
    },
    async ensurePersisted() {
      if (!input.enabled) return;
      await pendingWrite;
    },
    async flush() {
      if (!input.enabled) return;
      await pendingWrite;
      await synchronizePendingInteractionEvents();
    },
    async clearPending() {
      await store.clearForChild(input.childId);
    },
  };
}
