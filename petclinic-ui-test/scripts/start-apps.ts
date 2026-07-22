#!/usr/bin/env ts-node

import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import * as net from 'net';
import * as path from 'path';

const DB_PORT = 5432;
const BACKEND_PORT = 8080;
const FRONTEND_PORT = 4200;
const MAX_RETRIES = 60;
const RETRY_DELAY = 2000;

let databaseProcess: ChildProcess | null = null;
let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;

async function waitForService(url: string, serviceName: string): Promise<void> {
  console.log(`Waiting for ${serviceName} at ${url}...`);

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await axios.get(url, { timeout: 5000 });
      console.log(`${serviceName} is ready!`);
      return;
    } catch (error) {
      if (i < MAX_RETRIES - 1) {
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  throw new Error(`${serviceName} failed to start within timeout`);
}

async function waitForPort(port: number, serviceName: string): Promise<void> {
  console.log(`Waiting for ${serviceName} on port ${port}...`);

  for (let i = 0; i < MAX_RETRIES; i++) {
    const reachable = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { resolve(false); });
      socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
    });
    if (reachable) {
      console.log(`${serviceName} is ready!`);
      return;
    }
    if (i < MAX_RETRIES - 1) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw new Error(`${serviceName} failed to start within timeout`);
}

async function startDatabase(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log('Starting database (embedded Postgres)...');

    const repoRoot = path.join(__dirname, '..', '..');

    const database = spawn('./start-database.sh', [], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true
    });

    database.on('error', (error) => {
      console.error('Failed to start database:', error);
      reject(error);
    });

    // Give it a moment to start, then resolve
    setTimeout(() => resolve(database), 2000);
  });
}

async function startBackend(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log('Starting backend...');

    const backendDir = path.join(__dirname, '..', '..', 'petclinic-backend');
    const mvnCmd = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';

    // Runs against the embedded Postgres started above (default profile). No H2.
    const backend = spawn(mvnCmd, ['spring-boot:run'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env
      }
    });

    backend.on('error', (error) => {
      console.error('Failed to start backend:', error);
      reject(error);
    });

    // Give it a moment to start, then resolve
    setTimeout(() => resolve(backend), 5000);
  });
}

async function startFrontend(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log('Starting frontend...');

    const frontendDir = path.join(__dirname, '..', '..', 'petclinic-frontend');

    const frontend = spawn('npm', ['start'], {
      cwd: frontendDir,
      stdio: 'inherit',
      shell: true
    });

    frontend.on('error', (error) => {
      console.error('Failed to start frontend:', error);
      reject(error);
    });

    // Give it a moment to start, then resolve
    setTimeout(() => resolve(frontend), 5000);
  });
}

async function cleanup() {
  console.log('\nShutting down services...');

  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
    frontendProcess = null;
  }

  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }

  if (databaseProcess) {
    databaseProcess.kill('SIGTERM');
    databaseProcess = null;
  }

  // Give processes time to shut down gracefully
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function main() {
  try {
    // Start database (embedded Postgres) first — the backend needs it on boot.
    databaseProcess = await startDatabase();
    await waitForPort(DB_PORT, 'Database');

    // Start backend
    backendProcess = await startBackend();
    await waitForService(
      `http://127.0.0.1:${BACKEND_PORT}/api/owners`,
      'Backend'
    );

    // Start frontend
    frontendProcess = await startFrontend();
    await waitForService(
      `http://127.0.0.1:${FRONTEND_PORT}`,
      'Frontend'
    );

    console.log('\nAll services are running!');
    console.log('Press Ctrl+C to stop all services');

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('Failed to start services:', error);
    await cleanup();
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Start if executed directly
if (require.main === module) {
  main();
}
