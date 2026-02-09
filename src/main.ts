import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SKIP_VALIDATION_KEY } from './common/pipes/zod-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Razorpay webhook needs raw body for signature verification - register first for specific path
  app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));

  // JSON parser for all routes (must be before our debug middleware)
  app.use(express.json({
    verify: (req: any, res, buf) => {
      // Store raw body for debugging
      if (req.path === '/client-profiles' && req.method === 'POST') {
        try {
          const rawBody = buf.toString('utf8');
          console.log('=== RAW REQUEST BODY (FROM BUFFER) ===');
          console.log('Path:', req.path);
          console.log('Method:', req.method);
          console.log('Content-Type:', req.headers['content-type']);
          console.log('Raw body string:', rawBody);
          try {
            const parsed = JSON.parse(rawBody);
            console.log('Parsed body:', JSON.stringify(parsed, null, 2));
            console.log('Parsed body keys:', Object.keys(parsed));
          } catch (e) {
            console.log('Failed to parse body:', e);
          }
          console.log('==========================================');
        } catch (e) {
          console.error('Error in body parser verify:', e);
        }
      }
    }
  }));

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

  // STEP 3: TEMPORARILY DISABLE VALIDATION - Pass through everything
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // Don't strip properties
      forbidNonWhitelisted: false, // Don't reject unknown properties
      transform: false, // Don't transform
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
  await app.listen(port, '0.0.0.0');
  const baseUrl = `http://localhost:${port}`;
  console.log(`🚀 Server running on ${baseUrl} (listening on 0.0.0.0:${port})`);
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
