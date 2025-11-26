import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Startup script that launches:
 * 1. Docker database (PostgreSQL)
 * 2. Ollama LLM service
 * 3. Backend server
 */

async function checkDockerRunning(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch (error) {
    return false;
  }
}

async function checkOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434');
    return response.ok || response.status === 404; // Ollama returns 404 on root
  } catch (error) {
    return false;
  }
}

async function startDockerDatabase() {
  console.log('🐳 Starting Docker database...');

  try {
    // Check if docker-compose.yml exists
    const { stdout } = await execAsync('docker compose ps', { cwd: process.cwd() + '/..' });

    // Check if database is already running
    if (stdout.includes('email_rag-db') && stdout.includes('Up')) {
      console.log('✓ Docker database is already running\n');
      return;
    }

    // Start database
    console.log('  Starting PostgreSQL container...');
    await execAsync('docker compose up -d db', { cwd: process.cwd() + '/..' });

    // Wait for database to be ready
    console.log('  Waiting for database to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✓ Docker database started successfully\n');
  } catch (error: any) {
    console.error('⚠️  Could not start Docker database:', error.message);
    console.log('  Please start it manually: docker compose up -d db\n');
  }
}

async function startOllama() {
  console.log('🤖 Starting Ollama LLM service...');

  const isRunning = await checkOllamaRunning();
  if (isRunning) {
    console.log('✓ Ollama is already running\n');
    return;
  }

  try {
    // Try to start Ollama (Windows service)
    console.log('  Starting Ollama service...');

    // On Windows, Ollama runs as a service - just check if it starts
    await execAsync('ollama serve', { timeout: 2000 }).catch(() => {
      // Timeout is expected, service starts in background
    });

    // Wait for Ollama to be ready
    console.log('  Waiting for Ollama to be ready...');
    let attempts = 0;
    while (attempts < 10) {
      const running = await checkOllamaRunning();
      if (running) {
        console.log('✓ Ollama started successfully\n');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    console.log('✓ Ollama service check completed\n');
  } catch (error: any) {
    console.log('⚠️  Ollama may need to be started manually');
    console.log('  Check if Ollama is installed: https://ollama.com/download\n');
  }
}

async function startBackend() {
  console.log('🚀 Starting backend server...');
  console.log('=' .repeat(60));
  console.log('');

  // Spawn backend process
  const backend = spawn('tsx', ['src/index.ts'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  backend.on('error', (error) => {
    console.error('❌ Failed to start backend:', error);
    process.exit(1);
  });

  backend.on('exit', (code) => {
    console.log(`\nBackend exited with code ${code}`);
    process.exit(code || 0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    backend.kill('SIGINT');
    process.exit(0);
  });
}

async function main() {
  console.log('\n');
  console.log('=' .repeat(60));
  console.log('🚀 EMAIL RAG - COMPLETE STARTUP');
  console.log('=' .repeat(60));
  console.log('\n');

  // Check prerequisites
  console.log('📋 Checking prerequisites...\n');

  const dockerInstalled = await checkDockerRunning();
  if (!dockerInstalled) {
    console.error('❌ Docker is not installed or not running');
    console.log('   Please install Docker: https://www.docker.com/get-started\n');
    process.exit(1);
  }
  console.log('✓ Docker is installed\n');

  // Start services
  await startDockerDatabase();
  await startOllama();

  // Start backend (this will keep running)
  await startBackend();
}

main().catch((error) => {
  console.error('❌ Startup failed:', error);
  process.exit(1);
});
