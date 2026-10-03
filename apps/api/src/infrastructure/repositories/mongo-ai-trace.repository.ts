import { Injectable } from '@nestjs/common';
import type { AITrace } from '@domain/entities/ai-trace.entity';
import type { AITraceRepository } from '@domain/repositories/ai-trace.repository';
import { MONGO_COLLECTIONS, MongoService } from '../database/mongo.service';

type AITraceDocument = {
  _id: string;
  conversationId: string;
  clinicId: string;
  turnIndex: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  toolsCalled: AITrace['toolsCalled'];
  finalStatus: string;
  createdAt: Date;
};

function toDomain(doc: AITraceDocument): AITrace {
  return {
    id: doc._id,
    conversationId: doc.conversationId,
    clinicId: doc.clinicId,
    turnIndex: doc.turnIndex,
    model: doc.model,
    inputTokens: doc.inputTokens,
    outputTokens: doc.outputTokens,
    latencyMs: doc.latencyMs,
    costUsd: doc.costUsd,
    toolsCalled: doc.toolsCalled,
    finalStatus: doc.finalStatus as AITrace['finalStatus'],
    createdAt: doc.createdAt,
  };
}

@Injectable()
export class MongoAITraceRepository implements AITraceRepository {
  constructor(private readonly mongo: MongoService) {}

  private get collection() {
    return this.mongo.getCollection<AITraceDocument>(MONGO_COLLECTIONS.aiTraces);
  }

  async create(trace: AITrace): Promise<void> {
    const doc: AITraceDocument = {
      _id: trace.id,
      conversationId: trace.conversationId,
      clinicId: trace.clinicId,
      turnIndex: trace.turnIndex,
      model: trace.model,
      inputTokens: trace.inputTokens,
      outputTokens: trace.outputTokens,
      latencyMs: trace.latencyMs,
      costUsd: trace.costUsd,
      toolsCalled: trace.toolsCalled,
      finalStatus: trace.finalStatus,
      createdAt: trace.createdAt,
    };

    await this.collection.insertOne(doc);
  }

  async findByConversationId(conversationId: string): Promise<AITrace[]> {
    const docs = await this.collection
      .find({ conversationId })
      .sort({ turnIndex: 1 })
      .toArray();
    return docs.map(toDomain);
  }
}
