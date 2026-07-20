import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

describe('database operations workflows', () => {
  it('restores the latest GitHub backup artifact into an ephemeral PostgreSQL 17 service', () => {
    const workflow = readWorkflow('database-restore-drill.yml');

    expect(workflow).toContain('services:');
    expect(workflow).toContain('image: postgres:17');
    expect(workflow).toContain('RESTORE_DATABASE_URL: postgresql://postgres:restore-drill@localhost:5432/aniwebscale_restore_drill');
    expect(workflow).not.toContain('secrets.RESTORE_DRILL_DATABASE_URL');
    expect(workflow).toContain('GH_TOKEN: ${{ github.token }}');
    expect(workflow).toContain('gh run list --workflow database-backup.yml');
    expect(workflow).toContain('gh run download "$backup_run_id"');
  });

  it('keeps GitHub artifacts mandatory while treating secondary S3 storage as optional', () => {
    const workflow = readWorkflow('database-backup.yml');

    expect(workflow).toContain('uses: actions/upload-artifact@');
    expect(workflow).toContain('if-no-files-found: error');
    expect(workflow).toContain('if [ -z "$BACKUP_SECONDARY_S3_ENDPOINT" ]');
    expect(workflow).toContain('Secondary S3 backup is not configured; the encrypted GitHub artifact remains available.');
  });
});
