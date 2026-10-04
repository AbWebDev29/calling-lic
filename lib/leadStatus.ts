export const LEAD_STATUSES = [
  "Positive",
  "Negative",
  "Follow Up",
  "Contacted",
  "Wrong Number",
  "Not Picked",
] as const;

const LEGACY_STATUS_MAP: Record<string, string> = {
  New: "Not Picked",
  Interested: "Positive",
  "Not Interested": "Negative",
  Voicemail: "Not Picked",
  "No Answer": "Not Picked",
  "Do Not Call": "Negative",
};

export function normalizeLeadStatus(status: string): string {
  return LEGACY_STATUS_MAP[status] || status;
}
