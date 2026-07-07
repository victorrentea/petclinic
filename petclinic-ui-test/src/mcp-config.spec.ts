import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

type MpcServerConfig = {
  command: string;
  args: string[];
};

test('checked-in Playwright MCP config uses supported CLI flags', () => {
  const workspaceRoot = path.resolve(__dirname, '..', '..');
  const mcpConfig = JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, '..', '.mcp.json'), 'utf-8'),
  ) as { mcpServers: { playwright: MpcServerConfig } };

  const result = spawnSync(
    mcpConfig.mcpServers.playwright.command,
    [...mcpConfig.mcpServers.playwright.args, '--help'],
    { cwd: workspaceRoot, encoding: 'utf-8' },
  );

  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('Usage: Playwright MCP');
});
