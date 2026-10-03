import {
  COLOMBIA_UTC_OFFSET_HOURS,
  SEED_MODEL,
  type BuiltMongoSeedData,
  type MongoAITraceDoc,
  type MongoConversationDoc,
  type MongoMessageDoc,
  type SeedConversationSpec,
  type SeedToolCallSpec,
} from './types';

const TOKEN_COST_PER_INPUT = 0.0000005;
const TOKEN_COST_PER_OUTPUT = 0.0000015;

export function colombiaDateOnly(date: Date): string {
  const colombia = new Date(date.getTime() - COLOMBIA_UTC_OFFSET_HOURS * 3_600_000);
  return colombia.toISOString().slice(0, 10);
}

export function tomorrowColombiaDate(baseTime: Date): string {
  const colombia = new Date(baseTime.getTime() - COLOMBIA_UTC_OFFSET_HOURS * 3_600_000);
  colombia.setUTCDate(colombia.getUTCDate() + 1);
  return colombia.toISOString().slice(0, 10);
}

export function resolvePlaceholders(
  value: unknown,
  replacements: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    let resolved = value;
    for (const [token, replacement] of Object.entries(replacements)) {
      resolved = resolved.split(token).join(replacement);
    }
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolvePlaceholders(item, replacements));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolvePlaceholders(nested, replacements);
    }
    return result;
  }

  return value;
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost = inputTokens * TOKEN_COST_PER_INPUT + outputTokens * TOKEN_COST_PER_OUTPUT;
  return Number(cost.toFixed(6));
}

export function resolveToolsCalled(
  tools: SeedToolCallSpec[],
  replacements: Record<string, string>,
): SeedToolCallSpec[] {
  return tools.map((tool) => ({
    ...tool,
    arguments: resolvePlaceholders(tool.arguments, replacements) as Record<string, unknown>,
    result: resolvePlaceholders(tool.result, replacements),
  }));
}

function minutesFrom(baseTime: Date, minuteOffset: number): Date {
  return new Date(baseTime.getTime() + minuteOffset * 60 * 1000);
}

export function buildMongoSeedDocuments(
  specs: readonly SeedConversationSpec[],
  clinicIdByName: ReadonlyMap<string, string>,
  options: { baseTime: Date; model?: string },
): BuiltMongoSeedData {
  const model = options.model ?? SEED_MODEL;
  const baseTime = options.baseTime;
  const replacements = {
    '{{tomorrow_colombia}}': tomorrowColombiaDate(baseTime),
    '{{today_colombia}}': colombiaDateOnly(baseTime),
  };

  const conversations: MongoConversationDoc[] = [];
  const messages: MongoMessageDoc[] = [];
  const aiTraces: MongoAITraceDoc[] = [];

  for (const spec of specs) {
    const clinicId = clinicIdByName.get(spec.clinicName);
    if (!clinicId) {
      throw new Error(`Clinic id not found for seed conversation clinic: ${spec.clinicName}`);
    }

    if (spec.messages.length === 0) {
      throw new Error(`Seed conversation ${spec.id} must include at least one message`);
    }

    const lastMessageOffset = Math.max(...spec.messages.map((m) => m.minuteOffset));
    const createdAt = minutesFrom(baseTime, spec.messages[0]?.minuteOffset ?? 0);
    const lastMessageAt = minutesFrom(baseTime, lastMessageOffset);

    conversations.push({
      _id: spec.id,
      clinicId,
      patientPhone: spec.patientPhone,
      status: spec.status,
      createdAt,
      updatedAt: lastMessageAt,
      lastMessageAt,
    });

    for (const [index, message] of spec.messages.entries()) {
      const doc: MongoMessageDoc = {
        _id: `seed-msg-${spec.id}-${String(index + 1).padStart(2, '0')}`,
        conversationId: spec.id,
        clinicId,
        direction: message.direction,
        role: message.role,
        content: message.content,
        createdAt: minutesFrom(baseTime, message.minuteOffset),
      };

      if (message.messageId) {
        doc.messageId = message.messageId;
      }

      messages.push(doc);
    }

    for (const trace of spec.traces) {
      const toolsCalled = resolveToolsCalled(trace.toolsCalled, replacements);
      aiTraces.push({
        _id: `seed-trace-${spec.id}-${String(trace.turnIndex).padStart(2, '0')}`,
        conversationId: spec.id,
        clinicId,
        turnIndex: trace.turnIndex,
        model,
        inputTokens: trace.inputTokens,
        outputTokens: trace.outputTokens,
        latencyMs: trace.latencyMs,
        costUsd: estimateCostUsd(trace.inputTokens, trace.outputTokens),
        toolsCalled,
        finalStatus: trace.finalStatus,
        createdAt: minutesFrom(baseTime, trace.minuteOffset),
      });
    }
  }

  return { conversations, messages, aiTraces };
}
