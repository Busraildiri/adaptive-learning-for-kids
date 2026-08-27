import {
  type InteractionEvent,
  interactionEventBatchSchema,
  interactionEventSchema,
  MAX_SYNC_BATCH_SIZE,
} from "@adaptive/analytics-events";
import * as SQLite from "expo-sqlite";

export interface InteractionEventStore {
  initialize(): Promise<void>;
  enqueue(event: InteractionEvent): Promise<void>;
  readOldestSessionBatch(limit: number): Promise<InteractionEvent[]>;
  remove(eventIds: string[]): Promise<void>;
  clearForChild(childId: string): Promise<void>;
  count(): Promise<number>;
}

interface QueueRow {
  event_id: string;
  event_json: string;
}

interface SessionRow {
  session_id: string;
}

export class SQLiteInteractionEventStore implements InteractionEventStore {
  private databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

  private database() {
    this.databasePromise ??= SQLite.openDatabaseAsync("adaptive-kids-events.db");
    return this.databasePromise;
  }

  async initialize(): Promise<void> {
    const database = await this.database();
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS interaction_event_queue (
        event_id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
        child_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS interaction_event_queue_session_sequence_idx
        ON interaction_event_queue (session_id, sequence_number);
      CREATE INDEX IF NOT EXISTS interaction_event_queue_created_at_idx
        ON interaction_event_queue (created_at, event_id);
    `);
  }

  async enqueue(event: InteractionEvent): Promise<void> {
    const parsed = interactionEventSchema.parse(event);
    const database = await this.database();
    await database.runAsync(
      `INSERT OR IGNORE INTO interaction_event_queue
        (event_id, session_id, sequence_number, child_id, event_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      parsed.eventId,
      parsed.sessionId,
      parsed.sequenceNumber,
      parsed.childId,
      JSON.stringify(parsed),
      parsed.occurredAt,
    );
  }

  async readOldestSessionBatch(limit: number): Promise<InteractionEvent[]> {
    const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_SYNC_BATCH_SIZE);
    const database = await this.database();
    const oldestSession = await database.getFirstAsync<SessionRow>(
      `SELECT session_id
       FROM interaction_event_queue
       ORDER BY created_at, event_id
       LIMIT 1`,
    );

    if (!oldestSession) return [];

    const rows = await database.getAllAsync<QueueRow>(
      `SELECT event_id, event_json
       FROM interaction_event_queue
       WHERE session_id = ?
       ORDER BY sequence_number
       LIMIT ?`,
      oldestSession.session_id,
      safeLimit,
    );

    return rows.map((row) => interactionEventSchema.parse(JSON.parse(row.event_json)));
  }

  async remove(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const database = await this.database();
    const placeholders = eventIds.map(() => "?").join(", ");
    await database.runAsync(
      `DELETE FROM interaction_event_queue WHERE event_id IN (${placeholders})`,
      ...eventIds,
    );
  }

  async clearForChild(childId: string): Promise<void> {
    const database = await this.database();
    await database.runAsync("DELETE FROM interaction_event_queue WHERE child_id = ?", childId);
  }

  async count(): Promise<number> {
    const database = await this.database();
    const row = await database.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM interaction_event_queue",
    );
    return row?.count ?? 0;
  }
}

export interface InteractionEventTransport {
  send(events: InteractionEvent[]): Promise<void>;
}

export class InteractionEventSynchronizer {
  constructor(
    private readonly store: InteractionEventStore,
    private readonly transport: InteractionEventTransport,
  ) {}

  async syncOnce(): Promise<number> {
    const pending = await this.store.readOldestSessionBatch(MAX_SYNC_BATCH_SIZE);
    if (pending.length === 0) return 0;

    const batch = interactionEventBatchSchema.parse(pending);
    await this.transport.send(batch);
    await this.store.remove(batch.map((event) => event.eventId));
    return batch.length;
  }

  async drain(): Promise<number> {
    let synchronized = 0;
    while (true) {
      const count = await this.syncOnce();
      if (count === 0) return synchronized;
      synchronized += count;
    }
  }
}
