import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用优雅关闭
  app.enableShutdownHooks();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`应用程序运行在端口s ${port}`);
}


bootstrap();
