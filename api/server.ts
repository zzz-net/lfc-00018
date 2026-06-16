/**
 * local server entry file, for local development
 */
import app from './app.js';
import { initializeDatabase, closeDatabase, getDatabaseInfo } from './db/index.js';
import { generateReadmeAccountTable } from './config/seed.config.js';

const PORT = process.env.PORT || 3001;

try {
  const initResult = initializeDatabase();
  console.log('Database initialized successfully');
  console.log(`  Mode: ${initResult.mode}`);
  console.log(`  Version: ${initResult.version}`);
  console.log(`  Users created: ${initResult.usersCreated}`);
  console.log(`  Designs created: ${initResult.designsCreated}`);

  const dbInfo = getDatabaseInfo();
  console.log(`  Total users: ${dbInfo.userCount}`);
  console.log(`  Has demo users: ${dbInfo.hasDemoUsers}`);

  console.log('\nDemo accounts (from seed.config.ts):');
  console.log(generateReadmeAccountTable());
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;