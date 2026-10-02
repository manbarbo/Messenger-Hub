---
name: mongodb-nestjs
description: "Use when working with MongoDB in the NestJS backend. Triggers: MongoDB collections, indexes, aggregation pipelines, NestJS integration, connection management, document schema design, idempotency handling. Load this skill BEFORE writing or changing MongoDB repositories, creating indexes, or debugging MongoDB issues."
metadata:
  author: messengerhub
  version: "1.0.0"
---

# MongoDB + NestJS Skill

Comprehensive guide for using MongoDB with the native driver in a NestJS application for the MessengerHub project.

## When to Apply

- Designing or modifying MongoDB document schemas
- Creating or managing indexes
- Implementing repository adapters that use the MongoDB driver
- Writing aggregation pipelines
- Debugging MongoDB connection or query issues
- Handling idempotency with unique indexes

## Core Principles

1. **MongoDB driver, not Mongoose** — Use the native `mongodb` driver directly. No ODM abstractions.
2. **Collections map to domain entities** — `conversations`, `messages`, `ai_traces`.
3. **Never import MongoDB driver in domain/application layers** — It belongs in infrastructure only.
4. **All documents include `clinicId`** — For tenant scoping. Queries always filter by `clinicId`.
5. **Indexes match query patterns** — Design indexes based on actual queries, not hypothetical ones.

## Connection Management

### MongoService (NestJS)

```typescript
@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient;
  private db: Db;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const uri = this.configService.get<string>('MONGODB_URI');
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db('messenger_hub');
    await this.createIndexes();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  getCollection(name: string): Collection {
    return this.db.collection(name);
  }

  private async createIndexes() {
    // Messages: unique sparse on message_id (idempotency)
    await this.db.collection('messages').createIndex(
      { messageId: 1 },
      { unique: true, sparse: true }
    );

    // Messages: compound on conversation_id + created_at (history loading)
    await this.db.collection('messages').createIndex(
      { conversationId: 1, createdAt: 1 }
    );

    // Conversations: compound on clinic_id + status (dashboard filtering)
    await this.db.collection('conversations').createIndex(
      { clinicId: 1, status: 1 }
    );

    // Conversations: patient phone lookup
    await this.db.collection('conversations').createIndex(
      { clinicId: 1, patientPhone: 1 }
    );

    // AI Traces: compound on conversation_id + turn_index
    await this.db.collection('ai_traces').createIndex(
      { conversationId: 1, turnIndex: 1 }
    );
  }
}
```

**Key points:**
- Connection pooling is handled by the MongoDB driver automatically
- Indexes are created on startup (idempotent with `createIndex`)
- The service is a singleton (NestJS default)

## Document Schemas

### conversations

```typescript
interface ConversationDocument {
  _id: string;                    // UUID
  clinicId: string;               // References PostgreSQL clinic
  patientPhone: string;           // E.164 format
  status: 'active' | 'resolved_by_ai' | 'appointment_booked' | 'escalated';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}
```

### messages

```typescript
interface MessageDocument {
  _id: string;                    // UUID
  conversationId: string;         // References ConversationDocument
  clinicId: string;               // Denormalized for tenant queries
  direction: 'inbound' | 'outbound';
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId?: string;             // WhatsApp message_id (idempotency)
  createdAt: Date;
}
```

### ai_traces

```typescript
interface AITraceDocument {
  _id: string;                    // UUID
  conversationId: string;
  clinicId: string;
  turnIndex: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  toolsCalled: {
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
    success: boolean;
  }[];
  finalStatus: 'resuelta_por_ia' | 'cita_agendada' | 'escalada';
  createdAt: Date;
}
```

## Repository Adapter Pattern

### Conversation Repository

```typescript
@Injectable()
export class MongoConversationRepository implements ConversationRepository {
  constructor(private mongo: MongoService) {}

  private get collection() {
    return this.mongo.getCollection('conversations');
  }

  async findByPatientPhone(clinicId: string, phone: string): Promise<Conversation | null> {
    const doc = await this.collection.findOne({
      clinicId,
      patientPhone: phone,
      status: { $nin: ['escalated'] }, // Don't return escalated conversations
    });
    return doc ? this.toDomain(doc) : null;
  }

  async findById(id: string): Promise<Conversation | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(filters: ConversationFilters, pagination: PaginationParams): Promise<PaginatedResult<Conversation>> {
    const query: Filter<Document> = {};
    if (filters.clinicId) query.clinicId = filters.clinicId;
    if (filters.status) query.status = filters.status;

    const total = await this.collection.countDocuments(query);
    const data = await this.collection
      .find(query)
      .sort({ lastMessageAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .toArray();

    return {
      data: data.map(this.toDomain),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { status, updatedAt: new Date() } }
    );
  }

  async create(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
    const doc = { _id: uuid(), ...conversation };
    await this.collection.insertOne(doc);
    return this.toDomain(doc);
  }

  private toDomain(doc: any): Conversation {
    return {
      id: doc._id,
      clinicId: doc.clinicId,
      patientPhone: doc.patientPhone,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastMessageAt: doc.lastMessageAt,
    };
  }
}
```

### Message Repository (with Idempotency)

```typescript
@Injectable()
export class MongoMessageRepository implements MessageRepository {
  constructor(private mongo: MongoService) {}

  private get collection() {
    return this.mongo.getCollection('messages');
  }

  async create(message: Omit<Message, 'id'>): Promise<void> {
    try {
      await this.collection.insertOne({ _id: uuid(), ...message });
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error on message_id — already processed
        return; // Silent return for idempotency
      }
      throw error;
    }
  }

  async findByMessageId(messageId: string): Promise<Message | null> {
    const doc = await this.collection.findOne({ messageId });
    return doc ? this.toDomain(doc) : null;
  }

  async findByConversationId(conversationId: string): Promise<Message[]> {
    const docs = await this.collection
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();
    return docs.map(this.toDomain);
  }
}
```

## Indexing Strategy

### Index Design Rules

1. **Query-first design** — Create indexes based on actual query patterns
2. **ESR rule** — Equality, Sort, Range fields in that order
3. **Compound indexes** — For queries filtering on multiple fields
4. **Sparse indexes** — For optional fields (e.g., `messageId`)
5. **Unique indexes** — For idempotency (e.g., `messageId`)

### Index Definitions

```javascript
// Idempotency: unique sparse on message_id
db.messages.createIndex({ messageId: 1 }, { unique: true, sparse: true });

// History loading: compound on conversation_id + created_at
db.messages.createIndex({ conversationId: 1, createdAt: 1 });

// Dashboard filtering: compound on clinic_id + status
db.conversations.createIndex({ clinicId: 1, status: 1 });

// Patient lookup: compound on clinic_id + patient_phone
db.conversations.createIndex({ clinicId: 1, patientPhone: 1 });

// Trace lookup: compound on conversation_id + turn_index
db.ai_traces.createIndex({ conversationId: 1, turnIndex: 1 });

// Time-based queries: clinic_id + created_at
db.messages.createIndex({ clinicId: 1, createdAt: -1 });
```

## Common Pitfalls

1. **Forgetting `clinicId` filter** — Every query must include `clinicId` for tenant scoping
2. **Not handling duplicate key errors** — Idempotency requires catching error code 11000
3. **Missing indexes for sort operations** — MongoDB needs an index for sort + filter combinations
4. **Using `$or` instead of `$in`** — `$in` is more efficient for matching multiple values on the same field
5. **Not using `sparse` for optional unique indexes** — Without `sparse`, only one document can have a null `messageId`
6. **Large document sizes** — Keep documents under 16MB; use references for very large arrays

## NestJS Module

```typescript
@Module({
  providers: [
    MongoService,
    { provide: CONVERSATION_REPOSITORY, useClass: MongoConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: MongoMessageRepository },
    { provide: AI_TRACE_REPOSITORY, useClass: MongoAITraceRepository },
  ],
  exports: [CONVERSATION_REPOSITORY, MESSAGE_REPOSITORY, AI_TRACE_REPOSITORY],
})
export class MongoModule {}
```

## References

- [MongoDB Node.js Driver Docs](https://www.mongodb.com/docs/drivers/node/current/)
- [MongoDB Indexing Best Practices](https://www.mongodb.com/docs/manual/indexes/)
- [DESIGN.md](../../DESIGN.md) — Section 1 (MongoDB collections and indexes)
- [AGENTS.md](../../AGENTS.md) — Section 15 (Database — MongoDB)