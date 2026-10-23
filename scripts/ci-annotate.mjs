// Why: the raw workflow logs are not always reachable from where the fixing happens, so every CI step runs
// through this: it runs a command and, on failure, turns each line of output into a GitHub annotation that
// the API exposes. Usage: node scripts/ci-annotate.mjs "<step name>" <command...>
import { spawnSync } from 'node:child_process';

const [name, ...command] = process.argv.slice(2);
const result = spawnSync(command.join(' '), { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status !== 0) {
  const lines = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    .split('\n')
    .map((l) => l.replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'), '').trimEnd())
    .filter((l) => l.length > 0 && !/^npm (ERR|warn)/.test(l) && !/^> /.test(l));
  const head = lines.slice(0, 45);
  for (const line of head) console.log(`::error title=${name}::${line.replaceAll('%', '%25').replaceAll('\r', '').slice(0, 900)}`);
  if (lines.length > head.length) console.log(`::error title=${name}::… ${lines.length - head.length} more lines`);
  process.exit(result.status ?? 1);
}
