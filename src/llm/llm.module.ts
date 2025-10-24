import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true, // 使 ConfigModule 全局可用
    envFilePath: '.env', // 指定 .env 文件路径
  })],
  //controllers: [LlmController],
  providers: [LlmService,],
  exports: [LlmService],
})
export class LlmModule { }
