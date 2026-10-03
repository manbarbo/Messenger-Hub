export type SeedConversationStatus = 'resolved_by_ai' | 'appointment_booked' | 'escalated';

export type SeedAITraceFinalStatus = 'resuelta_por_ia' | 'cita_agendada' | 'escalada';

export type SeedClinicName = 'Clínica Norte' | 'Clínica Sur';

export interface SeedMessageSpec {
  direction: 'inbound' | 'outbound';
  role: 'user' | 'assistant' | 'system';
  content: string;
  minuteOffset: number;
  messageId?: string;
}

export interface SeedToolCallSpec {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  success: boolean;
}

export interface SeedTraceSpec {
  turnIndex: number;
  minuteOffset: number;
  toolsCalled: SeedToolCallSpec[];
  finalStatus: SeedAITraceFinalStatus;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface SeedConversationSpec {
  id: string;
  clinicName: SeedClinicName;
  patientPhone: string;
  status: SeedConversationStatus;
  messages: SeedMessageSpec[];
  traces: SeedTraceSpec[];
}

export interface MongoConversationDoc {
  _id: string;
  clinicId: string;
  patientPhone: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface MongoMessageDoc {
  _id: string;
  conversationId: string;
  clinicId: string;
  direction: string;
  role: string;
  content: string;
  messageId?: string;
  createdAt: Date;
}

export interface MongoAITraceDoc {
  _id: string;
  conversationId: string;
  clinicId: string;
  turnIndex: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  toolsCalled: SeedToolCallSpec[];
  finalStatus: string;
  createdAt: Date;
}

export interface BuiltMongoSeedData {
  conversations: MongoConversationDoc[];
  messages: MongoMessageDoc[];
  aiTraces: MongoAITraceDoc[];
}

export const COLOMBIA_UTC_OFFSET_HOURS = 5;
export const SEED_MODEL = 'gemini-2.5-flash';
export const SEED_CLINIC_NAMES: readonly SeedClinicName[] = ['Clínica Norte', 'Clínica Sur'];
