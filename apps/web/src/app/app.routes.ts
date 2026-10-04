import { Routes } from '@angular/router';
import { ConversationDetailComponent } from './conversations/conversation-detail/conversation-detail.component';
import { ConversationListComponent } from './conversations/conversation-list/conversation-list.component';
import { KnowledgeListComponent } from './knowledge/knowledge-list/knowledge-list.component';
import { SimulatorComponent } from './simulator/simulator.component';

export const routes: Routes = [
  { path: '', redirectTo: 'conversations', pathMatch: 'full' },
  { path: 'conversations', component: ConversationListComponent },
  { path: 'conversations/:id', component: ConversationDetailComponent },
  { path: 'simulator', component: SimulatorComponent },
  { path: 'knowledge', component: KnowledgeListComponent },
  { path: '**', redirectTo: 'conversations' },
];
