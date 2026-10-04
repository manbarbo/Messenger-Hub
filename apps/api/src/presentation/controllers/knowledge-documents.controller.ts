import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { DeleteKnowledgeDocumentResult } from '@application/commands/knowledge-documents/delete-knowledge-document/delete-knowledge-document.handler';
import { CreateKnowledgeDocumentCommand } from '@application/commands/knowledge-documents/create-knowledge-document/create-knowledge-document.command';
import { DeleteKnowledgeDocumentCommand } from '@application/commands/knowledge-documents/delete-knowledge-document/delete-knowledge-document.command';
import { UpdateKnowledgeDocumentCommand } from '@application/commands/knowledge-documents/update-knowledge-document/update-knowledge-document.command';
import type {
  KnowledgeDocumentDetail,
  KnowledgeDocumentSummary,
} from '@application/dto/knowledge-document-view';
import { GetKnowledgeDocumentQuery } from '@application/queries/knowledge-documents/get-knowledge-document/get-knowledge-document.query';
import { ListKnowledgeDocumentsQuery } from '@application/queries/knowledge-documents/list-knowledge-documents/list-knowledge-documents.query';
import type { PaginatedResult } from '@domain/value-objects/pagination.vo';
import {
  CreateKnowledgeBodySchema,
  formatZodErrors,
  KnowledgeIdParamSchema,
  ListKnowledgeQuerySchema,
  UpdateKnowledgeBodySchema,
} from '../dto/knowledge-document.schema';

export interface KnowledgeListPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface KnowledgeListResponse {
  readonly data: readonly KnowledgeDocumentSummary[];
  readonly pagination: KnowledgeListPagination;
}

function parseIdParam(id: string): string {
  const parsed = KnowledgeIdParamSchema.safeParse(id);
  if (!parsed.success) {
    throw new BadRequestException({
      error: 'ValidationError',
      message: formatZodErrors(parsed.error),
    });
  }
  return parsed.data;
}

@Controller('api/knowledge')
export class KnowledgeDocumentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async list(@Query() query: Record<string, unknown>): Promise<KnowledgeListResponse> {
    const parsed = ListKnowledgeQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: formatZodErrors(parsed.error),
      });
    }

    const { clinicId, category, page, limit } = parsed.data;

    const result = (await this.queryBus.execute(
      new ListKnowledgeDocumentsQuery(
        {
          clinicId,
          ...(category !== undefined ? { category } : {}),
        },
        { page, pageSize: limit },
      ),
    )) as PaginatedResult<KnowledgeDocumentSummary>;

    return {
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<KnowledgeDocumentDetail> {
    const documentId = parseIdParam(id);
    return (await this.queryBus.execute(
      new GetKnowledgeDocumentQuery(documentId),
    )) as KnowledgeDocumentDetail;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<KnowledgeDocumentDetail> {
    const parsed = CreateKnowledgeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: formatZodErrors(parsed.error),
      });
    }

    return (await this.commandBus.execute(
      new CreateKnowledgeDocumentCommand(
        parsed.data.clinicId,
        parsed.data.title,
        parsed.data.content,
        parsed.data.category,
      ),
    )) as KnowledgeDocumentDetail;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<KnowledgeDocumentDetail> {
    const documentId = parseIdParam(id);
    const parsed = UpdateKnowledgeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: formatZodErrors(parsed.error),
      });
    }

    return (await this.commandBus.execute(
      new UpdateKnowledgeDocumentCommand(
        documentId,
        parsed.data.title,
        parsed.data.content,
        parsed.data.category,
      ),
    )) as KnowledgeDocumentDetail;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<DeleteKnowledgeDocumentResult> {
    const documentId = parseIdParam(id);
    return (await this.commandBus.execute(
      new DeleteKnowledgeDocumentCommand(documentId),
    )) as DeleteKnowledgeDocumentResult;
  }
}
