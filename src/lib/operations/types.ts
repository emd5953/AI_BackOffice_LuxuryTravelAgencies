export type Environment = "synthetic" | "sandbox" | "live";
export type Provider = "csv" | "gmail" | "whatsapp" | "mews" | "travefy";
export type FactKey =
  | "checkIn"
  | "checkOut"
  | "partySize"
  | "reservationStatus"
  | "reservationRef"
  | "arrivalFlight"
  | "transferStatus"
  | "paymentStatus"
  | "paymentDueDate"
  | "serviceDate"
  | "holdDeadline"
  | "luggageCount"
  | "specialRequests";
export type Fact = {
  key: FactKey;
  value: string;
  excerpt: string;
  kind?: "assertion" | "request" | "unknown";
  serviceRef?: string | null;
};
export type Trip = {
  id: string;
  reference: string;
  title: string;
  traveler: string;
  email?: string;
  phone?: string;
  environment: Environment;
};
export type Source = {
  id: string;
  externalId: string;
  provider: Provider;
  environment: Environment;
  title: string;
  locator: string;
  occurredAt: string | null;
  retrievedAt: string;
  content: string;
  digest: string;
  facts: Fact[];
  identifiers: { tripRef?: string; email?: string; phone?: string };
  tripId: string | null;
  linkReason: string;
  warnings: string[];
  parentId?: string;
  extractionError?: string;
  extraction?: {
    engine: string;
    status: "proposed" | "reviewed" | "dismissed";
    facts: Fact[];
    createdAt: string;
    version?: string;
    identifiers?: {
      kind: "tripRef" | "email" | "phone";
      value: string;
      excerpt: string;
    }[];
  };
};
export type Issue = {
  id: string;
  severity: "blocker" | "review";
  title: string;
  detail: string;
  sourceIds: string[];
};
export type Brief = {
  stale?: boolean;
  id: string;
  tripId: string;
  createdAt: string;
  engine: string;
  status: "proposed" | "approved" | "dismissed";
  fingerprint: string;
  paragraphs: { text: string; sourceIds: string[] }[];
  draft: string;
  issues: Issue[];
  evidence: Source[];
  reviewedAt?: string;
  reviewNote?: string;
};
export type Activity = {
  id: string;
  at: string;
  kind: string;
  detail: string;
  tripId?: string;
};
export type State = {
  version: 1;
  trips: Trip[];
  sources: Source[];
  briefs: Brief[];
  activity: Activity[];
};
export type Integration = {
  id: string;
  name: string;
  status: string;
  detail: string;
  docs: string;
};
export type Workspace = State & {
  integrations: Integration[];
  aiAvailable: boolean;
  importedSourceIds?: string[];
  pipeline?: {
    completed: number;
    skipped: number;
    failed: number;
    errors: { sourceId: string; message: string }[];
  };
};

export const FACT_LABELS: Record<FactKey, string> = {
  checkIn: "Check-in",
  checkOut: "Check-out",
  partySize: "Travelers",
  reservationStatus: "Reservation status",
  reservationRef: "Reservation reference",
  arrivalFlight: "Arrival flight",
  transferStatus: "Arrival transfer",
  paymentStatus: "Payment status",
  paymentDueDate: "Payment due",
  serviceDate: "Experience date",
  holdDeadline: "Hold deadline",
  luggageCount: "Luggage count",
  specialRequests: "Special requests",
};
