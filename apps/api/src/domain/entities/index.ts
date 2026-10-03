export type { Clinic } from './clinic.entity';
export type { Doctor } from './doctor.entity';
export {
  type Slot,
  isValidSlotRange,
  assertValidSlotRange,
  isAvailableSlot,
} from './slot.entity';
export {
  type Appointment,
  canCancelAppointment,
  assertAppointmentTransition,
  cancelAppointment,
} from './appointment.entity';
export {
  type Conversation,
  isTerminalConversation,
  assertConversationTransition,
  transitionConversation,
} from './conversation.entity';
export { type Message, type MessageDirection, type MessageRole } from './message.entity';
export {
  type AITrace,
  type AITraceFinalStatus,
  type AITraceToolCall,
} from './ai-trace.entity';
export type { KnowledgeDocument } from './knowledge-document.entity';
