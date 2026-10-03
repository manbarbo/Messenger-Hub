import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { ConversationSummary, ConversationDetailResult } from '@application/dto/conversation-view';
import { ListConversationsQuery } from '@application/queries/list-conversations/list-conversations.query';
import { GetConversationDetailQuery } from '@application/queries/get-conversation-detail/get-conversation-detail.query';
import { ConversationNotFoundError } from '@domain/errors';
import { LOGGER, type Logger } from '@domain/services';
import type { PaginatedResult } from '@domain/value-objects/pagination.vo';
import {
  formatZodErrors,
  ListConversationsQuerySchema,
} from '../dto/list-conversations.schema';

export interface ConversationListPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ConversationListResponse {
  readonly data: readonly ConversationSummary[];
  readonly pagination: ConversationListPagination;
}

@Controller('api/conversations')
export class ConversationsController {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  @Get()
  async list(@Query() query: Record<string, unknown>): Promise<ConversationListResponse> {
    const parsed = ListConversationsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: formatZodErrors(parsed.error),
      });
    }

    const { status, clinicId, page, limit } = parsed.data;

    const result = (await this.queryBus.execute(
      new ListConversationsQuery(
        {
          ...(clinicId !== undefined ? { clinicId } : {}),
          ...(status !== undefined ? { status } : {}),
        },
        { page, pageSize: limit },
      ),
    )) as PaginatedResult<ConversationSummary>;

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
  async detail(@Param('id') id: string): Promise<ConversationDetailResult> {
    try {
      return (await this.queryBus.execute(
        new GetConversationDetailQuery(id),
      )) as ConversationDetailResult;
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        this.logger.warn('Conversation not found', {
          context: 'ConversationsController',
          conversationId: id,
        });
        throw new NotFoundException({
          error: 'ConversationNotFoundError',
          message: error.message,
        });
      }
      throw error;
    }
  }
}
