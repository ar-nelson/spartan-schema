// ex. scripts/build_npm.ts
import { build, emptyDir } from 'https://deno.land/x/dnt/mod.ts';

await emptyDir('./build');

await build({
  shims: {
    deno: 'dev',
  },
  entryPoints: ['./mod.ts'],
  outDir: './build',
  package: {
    name: 'spartan-schema',
    version: Deno.args[0],
    description: 'Ultra-minimal JSON schema language',
    author: 'Adam Nelson <adam@nels.onl>',
    license: 'BlueOak-1.0.0',
    repository: {
      'type': 'git',
      'url': 'https://github.com/ar-nelson/spartan-schema.git',
    },
  },
});

Deno.copyFileSync('LICENSE.md', 'build/LICENSE.md');
Deno.copyFileSync('README.md', 'build/README.md');
