import { createServer } from './server.js';
import { initDatabase } from './utils/database.js';
import { initRedis, createQueues, setupJobEventListeners } from './utils/queue.js';
import { initFal } from './ai/fal.js';
import { initAllWorkers } from './workers/index.js';
import { projectRoutes } from './routes/projects.js';
import { jobRoutes } from './routes/jobs.js';
import { directorRoutes } from './routes/director.js';
import { agentRunRoutes } from './routes/agentRuns.js';

async function bootstrap() {
  try {
    console.log('🚀 Starting AI Film Studio Backend...\n');

    console.log('📦 Initializing core services...');
    initDatabase();
    await initRedis();
    createQueues();
    setupJobEventListeners();

    console.log('🤖 Initializing AI services...');
    initFal();

    console.log('🏭 Starting background workers...');
    initAllWorkers();

    console.log('🌐 Creating HTTP server...');
    const server = await createServer();

    await server.register(projectRoutes);
    await server.register(jobRoutes);
    await server.register(directorRoutes);
    await server.register(agentRunRoutes);

    server.register(async function (fastify) {
      await fastify.register(require('@fastify/static'), {
        root: process.cwd() + '/src/public',
        prefix: '/test/'
      });
    });

    const port = parseInt(process.env.PORT || '5000');
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });

    console.log(`
✅ AI Film Studio Backend is running!

🌐 Server: http://localhost:${port}
📚 API Docs: http://localhost:${port}/docs
🧪 Test Interface: http://localhost:${port}/test/test.html
🔍 Health Check: http://localhost:${port}/health

Environment: ${process.env.NODE_ENV || 'development'}
Features:
  • Project Management
  • Hierarchical Content Generation
  • AI-Powered Character/Scene/Video Creation
  • Background Job Processing
  • Director Agent with Streaming
  • URL-based Media Management

Ready for film production! 🎬
`);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

bootstrap();
