import { Injectable } from '@nestjs/common';

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage,HumanMessage } from '@langchain/core/messages';
import { END, MemorySaver, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';

@Injectable()
export class LlmService {

  private readonly key: string;
  private readonly url: string;
  private readonly model: ChatOpenAI;
  private readonly memory: MemorySaver;

  constructor() {
    this.key = "sk-d0cca87b98a54b6c868918db4f9744df";
    this.url = "https://api.deepseek.com";
    console.log('API Key:', this.key ? '已设置' : '未设置');
    console.log('API URL:', this.url);
    this.model = new ChatOpenAI({
      apiKey: this.key,
      configuration: {
        baseURL: this.url,
      },
      modelName: 'deepseek-chat',
    });
    this.memory = new MemorySaver();
  }
  getHello(): string {
    return 'Hello World!';
  }

  public async chat(msg: string) {
    const model = new ChatOpenAI({
      apiKey: this.key,
      configuration: {
        baseURL: this.url,
      },
      modelName: 'deepseek-chat',
    });

    try {
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: msg }
      ];
      
      const result = await model.invoke(messages);
      console.log('Result:', JSON.stringify(result, null, 2));
      
      return result.content.toString();
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }
  async chatV2(msg: string,threadId:string) {
    const workflow =new StateGraph(MessagesAnnotation)
    .addNode('model', this.callModel.bind(this))
    .addEdge(START, 'model')
    .addEdge('model', END)
    const app=workflow.compile({checkpointer:this.memory})
    const config={configurable:{thread_id:threadId}}
    const result = await app.invoke({messages:[new HumanMessage(msg)]},config)
    return result.messages[result.messages.length-1].content.toString()
  }


  async callModel(state: typeof MessagesAnnotation.State){
    const model = new ChatOpenAI({
      apiKey: this.key,
      configuration: {
        baseURL: this.url,
      },
      modelName: 'deepseek-chat',
    });
    const response = await model.invoke(state.messages);
    return { messages: response };
  }
  
  
}
