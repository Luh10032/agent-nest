import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';

@Module({
  imports: [],
  //controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
