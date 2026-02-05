import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Helmet for HTTP headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false, // Allow iframes for payment providers
  }));

  // CORS: Configure allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : process.env.NODE_ENV === 'production'
      ? [] // Must be set in production
      : ['http://localhost:5173', 'http://localhost:3000']; // Dev defaults

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0) {
        // Allow requests with no origin (mobile apps, Postman, etc.) in dev only
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe with strict validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production', // Hide validation details in production
    }),
  );

  // Global exception filter (hides stack traces in production)
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('AspireCoWorks Client Onboarding API')
    .setDescription('API for client onboarding system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  const baseUrl = `http://localhost:${port}`;
  console.log(`🚀 Server running on ${baseUrl}`);
  console.log(`Swagger documentation: ${baseUrl}/api`);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}
bootstrap();
