import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { LlmService } from './llm/llm.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
    private readonly llmService: LlmService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('chat')
    async getLlm(@Body() body: MessageBody): Promise<string> {
    console.log(body);
    const result = await this.llmService.chat(body.msg);
    return result;
  }

  @Post('chatV2')
  async chatV2(@Body() body: MessageBody): Promise<string> {
  console.log(body);
  const result = await this.llmService.chatV2(body.msg,body.threadId);
  return result;
}
}

type MessageBody={
  msg: string
  threadId: string
}