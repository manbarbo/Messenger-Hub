---
name: llm-tool-calling
description: "Use when working with LLM integration, tool calling, RAG, or prompt construction. Triggers: Gemini API, OpenAI SDK, tool calling loop, function calling, prompt construction, embedding generation, iteration limits, hallucination prevention, error handling for LLM calls."
metadata:
  author: messengerhub
  version: "1.0.0"
---

# LLM Tool Calling Skill

Comprehensive guide for implementing LLM integration with tool calling using Google Gemini via the OpenAI-compatible endpoint.

## When to Apply

- Implementing or modifying the `LLMService` adapter
- Defining tool schemas (Zod) for tool calling
- Building the tool calling loop (orchestrator)
- Constructing system prompts
- Handling LLM errors (timeout, rate limit, invalid response)
- Implementing RAG with embeddings
- Managing iteration limits and escalation

## Core Principles

1. **LLM output is untrusted** — Always validate tool arguments before execution
2. **Interface abstraction** — `LLMService` interface allows swapping providers
3. **Maximum 5 iterations** — Prevent infinite tool calling loops
4. **Errors are tool results** — Validation errors go back to the LLM as feedback, not as system errors
5. **Trace everything** — Every tool call and result must be saved to `ai_traces`

## Gemini via OpenAI-Compatible Endpoint

### Configuration

```env
LLM_API_KEY=your-gemini-api-key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-2.5-flash
```

### LLMService Implementation

```typescript
@Injectable()
export class GeminiLLMService implements LLMService {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: configService.get('LLM_API_KEY'),
      baseURL: configService.get('LLM_BASE_URL'),
    });
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.configService.get('LLM_MODEL', 'gemini-2.5-flash'),
        messages: params.messages,
        tools: params.tools.map(t => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: 'auto',
      });
      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];
      return {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls?.map(tc => ({
          id: tc.id, name: tc.function.name, arguments: JSON.parse(tc.function.arguments),
        })) || [],
        usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
        model: response.model, latencyMs,
      };
    } catch (error) {
      throw new LLMProviderError(error.message);
    }
  }
}
```

## Tool Definitions (OpenAI Format)

See `DESIGN.md` Section 4 for complete tool definitions. Four tools:
- `buscar_conocimiento(pregunta)` — RAG search over knowledge base
- `consultar_disponibilidad(especialidad, sede, fecha)` — Query available slots
- `agendar_cita(especialidad, sede, fecha, hora, paciente_telefono, paciente_nombre?)` — Book appointment
- `escalar_a_humano(motivo)` — Escalate to human agent

## Tool Validation (Zod Schemas)

```typescript
import { z } from 'zod';

export const BuscarConocimientoSchema = z.object({
  pregunta: z.string().min(1),
});

export const ConsultarDisponibilidadSchema = z.object({
  especialidad: z.enum(['Medicina General', 'Dermatologia', 'Cardiologia', 'Pediatria']),
  sede: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const AgendarCitaSchema = ConsultarDisponibilidadSchema.extend({
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  paciente_telefono: z.string().min(1),
  paciente_nombre: z.string().optional(),
});

export const EscalarAHumanoSchema = z.object({
  motivo: z.string().min(1),
});
```

### Validation Layer

```typescript
@Injectable()
export class ToolValidator {
  validate(toolName: string, args: Record<string, unknown>):
    | { valid: true; parsed: any }
    | { valid: false; error: string } {
    const schemas: Record<string, z.ZodSchema> = {
      buscar_conocimiento: BuscarConocimientoSchema,
      consultar_disponibilidad: ConsultarDisponibilidadSchema,
      agendar_cita: AgendarCitaSchema,
      escalar_a_humano: EscalarAHumanoSchema,
    };
    const schema = schemas[toolName];
    if (!schema) return { valid: false, error: `Unknown tool: ${toolName}` };
    const result = schema.safeParse(args);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { valid: false, error: `Invalid arguments: ${errors}` };
    }
    return { valid: true, parsed: result.data };
  }
}
```

## Tool Calling Loop (Orchestrator)

```typescript
@Injectable()
export class AIOrchestratorService {
  private readonly MAX_ITERATIONS = 5;

  async processTurn(conversationId: string, clinicId: string, userMessage: string):
    Promise<{ response: string; status: ConversationStatus }> {
    const history = await this.messageRepo.findByConversationId(conversationId);
    const systemPrompt = this.promptBuilder.buildSystemPrompt(clinicName);
    const messages = this.promptBuilder.buildMessages(history, userMessage);
    const trace: TraceData = { toolsCalled: [], turnIndex: history.length };

    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      const result = await this.llmService.chat({ messages, tools: TOOL_DEFINITIONS });

      if (result.toolCalls.length === 0) {
        await this.saveTrace(conversationId, clinicId, trace, result, 'resolved_by_ai');
        return { response: result.content, status: 'resolved_by_ai' };
      }

      for (const toolCall of result.toolCalls) {
        const validation = this.toolValidator.validate(toolCall.name, toolCall.arguments);
        if (!validation.valid) {
          messages.push({ role: 'assistant', tool_calls: [toolCall] });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: validation.error });
          trace.toolsCalled.push({ name: toolCall.name, arguments: toolCall.arguments, result: validation.error, success: false });
          continue;
        }
        const toolResult = await this.executeTool(toolCall.name, validation.parsed, clinicId);
        messages.push({ role: 'assistant', tool_calls: [toolCall] });
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) });
        trace.toolsCalled.push({ name: toolCall.name, arguments: toolCall.arguments, result: toolResult, success: true });

        if (toolCall.name === 'agendar_cita') {
          await this.saveTrace(conversationId, clinicId, trace, result, 'appointment_booked');
          return { response: 'Cita agendada exitosamente.', status: 'appointment_booked' };
        }
        if (toolCall.name === 'escalar_a_humano') {
          await this.saveTrace(conversationId, clinicId, trace, result, 'escalated');
          return { response: 'Te transfiero a un agente humano.', status: 'escalated' };
        }
      }
    }
    await this.executeTool('escalar_a_humano', { motivo: 'Iteration limit reached' }, clinicId);
    return { response: 'No pude resolver tu consulta. Te transfiero a un agente.', status: 'escalated' };
  }
}
```

## Prompt Construction

```typescript
@Injectable()
export class PromptBuilder {
  buildSystemPrompt(clinicName: string): string {
    const now = DateTime.now().setZone('America/Bogota');
    return `Eres un asistente de agendamiento para ${clinicName}.
Fecha y hora actual en Colombia: ${now.toFormat('yyyy-MM-dd HH:mm')} (UTC-5).
SOLO usa informacion de la base de conocimiento. NUNCA inventes datos.
Si no tienes la informacion, di "No tengo esa informacion" o escala a un humano.
Interpreta fechas relativas ("manana", "esta tarde") usando la fecha actual de Colombia.
Herramientas: buscar_conocimiento, consultar_disponibilidad, agendar_cita, escalar_a_humano.`;
  }

  buildMessages(history: Message[], currentMessage: string): LLMMessage[] {
    const messages: LLMMessage[] = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content,
    }));
    messages.push({ role: 'user', content: currentMessage });
    return messages;
  }
}
```

## Error Handling

- **LLM timeout/rate limit** → Catch `LLMProviderError`, escalate to human
- **Iteration limit (5)** → Force `escalar_a_humano` with auto-generated reason
- **Invalid tool arguments** → Feed error back to LLM as tool result for correction
- **Slot already booked** → Return error to LLM, suggest alternative times

## RAG Pipeline

1. Embed query via `GeminiEmbeddingService` (Google `gemini-embedding-001`, 768 dimensions via explicit `dimensions` param)
2. Cosine similarity search via pgvector: `1 - (embedding <=> $1::vector) > 0.7`
3. Return top 5 matching documents
4. If no match > 0.7, return "No relevant information found"
5. LLM responds honestly or escalates

## References

- [DESIGN.md](../../DESIGN.md) — Section 4 (AI Pipeline)
- [DECISIONS.md](../../DECISIONS.md) — Decisions #5, #6, #9
- [AGENTS.md](../../AGENTS.md) — Section 14 (AI Pipeline Rules)