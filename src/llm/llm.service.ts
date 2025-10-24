import { Injectable } from '@nestjs/common';
import "cheerio";
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { Annotation, END, MemorySaver, MessagesAnnotation, START, StateGraph, } from '@langchain/langgraph';
import { ConfigService } from '@nestjs/config';
import { wrapSDK } from 'langsmith/wrappers'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

@Injectable()
export class LlmService {

  private readonly key: string;
  private readonly url: string;
  private readonly modelName: string;
  private readonly model: ChatOpenAI;
  private readonly memory: MemorySaver;
  private readonly vectorStore: MemoryVectorStore;
  private readonly embeddings: OpenAIEmbeddings;
  constructor(private readonly configService: ConfigService) {

    this.key = this.configService.get('OPENAI_API_KEY');
    this.url = this.configService.get('OPENAI_API_URL');
    this.modelName = this.configService.get('OPENAI_MODEL_NAME');

    console.log('API Key:', this.key ? '已设置' : '未设置');
    console.log('API URL:', this.url);
    // this.model = new ChatOpenAI({
    //   apiKey: this.key,
    //   configuration: {
    //     baseURL: this.url,
    //   },
    //   modelName: 'deepseek-chat',
    // });
    this.memory = new MemorySaver();
    this.embeddings = new OpenAIEmbeddings({
      model: this.modelName,
      apiKey: this.key,
      configuration: {
        baseURL: this.url,
      },
    })
    this.vectorStore = new MemoryVectorStore(this.embeddings);
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
      modelName: this.modelName,
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
  async chatV2(msg: string, threadId: string) {
    console.log(msg, threadId)
    const humanMsg = [new HumanMessage(msg)]

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('model', this.callModel.bind(this))
      .addEdge(START, 'model')
      .addEdge('model', END)

    const app = workflow.compile({ checkpointer: this.memory })
    const config = { configurable: { thread_id: threadId } }
    const result = await app.invoke({ messages: humanMsg }, config)
    return result.messages[result.messages.length - 1].content.toString()
  }

  async chatV3(msg: string, threadId: string,
    options: {
      searchUrl?: string;
    }
  ) {
    console.log(msg, threadId)

    if (options.searchUrl) {
      await this.getDocFromHTML(options.searchUrl);
    }

    const graph = new StateGraph(StateAnnotation)
      .addNode('retrieve', this.retrieve.bind(this))
      .addNode('generate', this.generate.bind(this))
      .addEdge("__start__", "retrieve")
      .addEdge("retrieve", "generate")
      .addEdge("generate", "__end__")
      .compile({ checkpointer: this.memory });

    let inputs = { question: msg };

    const config = { configurable: { thread_id: threadId } }
    const result = await graph.invoke(inputs, config)
    return result.answer.toString()
  }


  async callModel(state: typeof MessagesAnnotation.State) {
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", "你是一个善于解决能力,并且友好待人的中文机器人,你的名字是超级无敌霸王机器人.你会竭尽所能去回答问题"],
      ["placeholder", "{messages}"]
    ])

    const prompt = await promptTemplate.invoke(state);

    const model = this.createWrappedModel()
    const response = await model.invoke(prompt);
    return { messages: [response] };
  }

  private createWrappedModel(): ChatOpenAI {
    const model = new ChatOpenAI({
      apiKey: this.key,
      configuration: {
        baseURL: this.url,
      },
      modelName: 'deepseek-chat',
    });

    // 使用 LangSmith wrapper 包装模型
    return wrapSDK(model, {
      name: 'deepseek-chat-model',
      tags: ['nestjs', 'agent'],
    });
  }

  async retrieve(state: typeof InputStateAnnotation.State) {
    const retrievedDocs = await this.vectorStore.similaritySearch(state.question);
    return { context: retrievedDocs };
  }

  async generate(state: typeof StateAnnotation.State) {
    const docsContent = state.context.map(doc => doc.pageContent as string).join('\n');
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.You should answer in Chinese.
Question: {question} 
Context: {context}`],
    ])
    const messages = await promptTemplate.invoke({
      question: state.question,
      context: docsContent,
    });
    const model = this.createWrappedModel();
    const response = await model.invoke(messages);
    return { answer: response.content };
  }

  async getDocFromHTML(url: string = 'https://lilianweng.github.io/posts/2023-06-23-agent/') {
    try {
      console.log(`Loading document from ${url}`);
      const pTagSelector = 'p';
      const cheerioLoader = new CheerioWebBaseLoader(url, {
        selector: pTagSelector,
        timeout: 10000, // 10秒超时
      })

      const docs = await cheerioLoader.load();
      console.log(`Total characters: ${docs[0].pageContent.length}`);

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const allSplits = await splitter.splitDocuments(docs);
      console.log(`Split blog post into ${allSplits.length} sub-documents.`);

      this.vectorStore.addDocuments(allSplits);
      return docs[0].pageContent;
    } catch (error) {
      console.error('Failed to load document:', error);
      throw error;
    }
  }

}
