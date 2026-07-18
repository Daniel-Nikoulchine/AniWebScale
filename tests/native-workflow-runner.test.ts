import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

describe('native GitHub runner compatibility', () => {
  it('pins the Visual Studio 17 native build to the Windows 2022 image', () => {
    const workflow = readWorkflow('build.yml');
    expect(workflow).toMatch(/native-windows:\s*\n\s+runs-on: windows-2022/);
  });

  it('pins signed native release builds to the Windows 2022 image', () => {
    const workflow = readWorkflow('native-release.yml');
    expect(workflow).toMatch(/runs-on: windows-2022/);
    expect(workflow).not.toMatch(/runs-on: windows-latest/);
  });
});
