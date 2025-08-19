import { Injectable } from '@nestjs/common';
import { DecideDto } from './dto/decide.dto';

@Injectable()
export class PaymentsService {
  async decide(_dto: DecideDto, requestId: string) {
    // stub for now; we’ll add RL, idempotency, agent, locks next
    return {
      decision: 'review',
      reasons: ['stub'],
      agentTrace: [{ step: 'plan', detail: 'stub' }],
      requestId,
    };
  }
}
