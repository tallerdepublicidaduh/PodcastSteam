const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('lanzador Linux conserva rutas con espacios, argumentos y estado de salida; registra sin volcar secretos', { skip: process.platform !== 'linux' }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'podcaststeam-launch-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const appDir = path.join(root, 'Application folder'); await fs.mkdir(appDir);
  const image = path.join(appDir, 'PodcastSteam test.AppImage');
  await fs.writeFile(image, '#!/usr/bin/env bash\nprintf "cwd:%s\\narg:%s\\nlibrary-path:%s\\n" "$PWD" "$1" "${LD_LIBRARY_PATH+present}"\nexit 23\n', { mode: 0o755 });
  const launcher = path.resolve(__dirname, '../scripts/PodcastSteam-Steam.sh');
  const stateDir = path.join(root, 'state');
  const env = { ...process.env, XDG_STATE_HOME: stateDir, LD_LIBRARY_PATH: root, TEST_PRIVATE_VALUE: 'must-not-appear-in-log' };
  for (const flags of [[], ['--clean-runtime']]) {
    const result = spawnSync('bash', [launcher, ...flags, image, 'argument with spaces'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 23, result.stderr);
    const log = await fs.readFile(path.join(stateDir, 'PodcastSteam/steam-launch.log'), 'utf8');
    assert.ok(log.includes(`cwd:${appDir}`));
    assert.ok(log.includes('arg:argument with spaces'));
    assert.equal(log.includes('library-path:present'), !flags.length);
    assert.ok(log.includes('Application exit status: 23'));
    assert.ok(!log.includes('must-not-appear-in-log'));
  }
  assert.ok(await fs.stat(path.join(stateDir, 'PodcastSteam/steam-launch.log.previous')));
  assert.equal(spawnSync('bash', [launcher, path.join(root, 'missing')], { env }).status, 66);
});
