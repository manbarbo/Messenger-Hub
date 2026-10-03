import { Injectable } from '@nestjs/common';
import type { Conversation } from '@domain/entities/conversation.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import type { ConversationRepository } from '@domain/repositories/conversation.repository';
import { createPaginatedResult } from '@domain/value-objects/pagination.vo';
import type { ConversationFilters } from '@domain/value-objects/conversation-filters.vo';
import type { PaginationParams } from '@domain/value-objects/pagination.vo';
import { MONGO_COLLECTIONS, MongoService } from '../database/mongo.service';

type ConversationDocument = {
  _id: string;
  clinicId: string;
  patientPhone: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
};

function toDomain(doc: ConversationDocument): Conversation {
  return {
    id: doc._id,
    clinicId: doc.clinicId,
    patientPhone: doc.patientPhone,
    status: doc.status as ConversationStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastMessageAt: doc.lastMessageAt,
  };
}

@Injectable()
export class MongoConversationRepository implements ConversationRepository {
  constructor(private readonly mongo: MongoService) {}

  private get collection() {
    return this.mongo.getCollection<ConversationDocument>(MONGO_COLLECTIONS.conversations);
  }

  async findByPatientPhone(clinicId: string, phone: string): Promise<Conversation | null> {
    const doc = await this.collection.findOne({
      clinicId,
      patientPhone: phone,
      status: { $nin: [ConversationStatus.ESCALATED] },
    });
    return doc ? toDomain(doc) : null;
  }

  async findById(id: string): Promise<Conversation | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toDomain(doc) : null;
  }

  async findAll(
    filters: ConversationFilters,
    pagination: PaginationParams,
  ) {
    const query: Record<string, unknown> = {};
    if (filters.clinicId) {
      query.clinicId = filters.clinicId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.patientPhone) {
      query.patientPhone = filters.patientPhone;
    }

    const total = await this.collection.countDocuments(query);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const docs = await this.collection
      .find(query)
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(pagination.pageSize)
      .toArray();

    return createPaginatedResult(
      docs.map(toDomain),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async create(conversation: Conversation): Promise<Conversation> {
    const doc: ConversationDocument = {
      _id: conversation.id,
      clinicId: conversation.clinicId,
      patientPhone: conversation.patientPhone,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { status, updatedAt: new Date() } },
    );
  }
}
