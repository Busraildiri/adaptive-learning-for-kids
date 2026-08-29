"use client";

import type { MediaJobStatus } from "../../lib/media/types";
import { mapJobStatusLabel } from "./pipeline";

export function MediaStatusBadge({ status }: { status: MediaJobStatus | "not_started" }) {
  const label = status === "not_started" ? "Başlamadı" : mapJobStatusLabel(status);
  const tone = status === "ready" ? "ready" : status === "failed" ? "failed" : "pending";
  return <span className={`media-status-badge media-status-${tone}`}>{label}</span>;
}
