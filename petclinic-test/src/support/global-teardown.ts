import {execFileSync} from 'child_process';
import * as path from 'path';
import {runGenerate, PLAYWRIGHT_SOURCES} from '../genseq/generate';

// Pull the acceptance suite's coverage out of the backend JVM while it is STILL RUNNING.
// That JVM is the one the browser exercised, and surefire's JaCoCo agent never sees it —
// without this dump, nothing the acceptance tests cover is counted anywhere.
//
// It has to happen here rather than on shutdown. A `destfile` agent writes its exec from a
// JVM shutdown hook, which needs the process to receive a signal and live long enough to
// handle it; under Playwright's webServer teardown (a SIGTERM to a shell that spawned mvn
// that forked java) that is not something to rely on. So the agent runs in tcpserver mode
// and we ask it for the data at the one moment both facts hold: the suite has finished,
// and the backend is still up.
//
// Best-effort, exactly like the diagram rendering below it: a missing dump costs a colour
// on a page, and must never turn a green suite red.
function dumpAcceptanceCoverage(): void {
  if (!process.env.JACOCO_E2E) return;
  const backendDir = path.join(__dirname, '..', '..', '..', 'petclinic-backend');
  const port = process.env.JACOCO_PORT || '6300';
  try {
    execFileSync('mvn', [
      '-o', '-q', 'jacoco:dump',
      '-Djacoco.address=127.0.0.1',
      `-Djacoco.port=${port}`,
      '-Djacoco.destFile=target/jacoco-e2e.exec',
      '-Djacoco.reset=false',
    ], {cwd: backendDir, stdio: 'inherit'});
    console.log('acceptance coverage dumped -> petclinic-backend/target/jacoco-e2e.exec');
  } catch (e) {
    // Almost always the same cause, and it is not obvious from Maven's "Connection
    // refused": Playwright's webServer probes ONLY port 4200, so a frontend left running
    // from an earlier session makes it reuse the whole stack and never run start-apps.ts
    // — the backend it talks to is then somebody else's, started without an agent. The
    // run goes green and the acceptance colour is silently empty, which is exactly the
    // shape of failure this project keeps writing down.
    console.warn(
      'could not dump acceptance coverage: nothing is listening on the agent port ' +
      `${port}.\n` +
      '  The backend under test was almost certainly NOT instrumented. Playwright only\n' +
      '  probes :4200, so an already-running frontend makes it reuse the whole stack and\n' +
      '  skip start-apps.ts. Free :4200 and :8080 first, or start the backend yourself\n' +
      '  with JACOCO_E2E=1 ./start-backend.sh and run with SKIP_SERVER_START=true.\n' +
      `  ${e}`);
  }
}

// Runs after the whole Playwright suite. Regenerates only the diagrams of the specs
// this runner owns: the windows file also holds the Cucumber suite's entries, so that
// a standalone `npm run diagram` can re-render everything at another detail level.
// runGenerate() never throws; any failure is logged and swallowed so a telemetry
// hiccup can't fail the test run.
export default async function globalTeardown(): Promise<void> {
  dumpAcceptanceCoverage();
  await runGenerate(PLAYWRIGHT_SOURCES);
}
