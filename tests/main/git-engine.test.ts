import { describe, it, expect } from 'vitest';
import GitEngine from '../../src/main/git-engine';
import os from 'os';
import path from 'path';

describe('GitEngine', () => {
  it('should detect a valid git repo', async () => {
    const engine = new GitEngine(process.cwd());
    const isRepo = await engine.isGitRepo();
    expect(isRepo).toBe(true);
  });

  it('should detect a non-git directory', async () => {
    const engine = new GitEngine(os.tmpdir());
    const isRepo = await engine.isGitRepo();
    expect(isRepo).toBe(false);
  });

  it('should parse diff output correctly', () => {
    const engine = new GitEngine(process.cwd());
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,8 @@
 line1
+added line 1
+added line 2
 line3
-removed line
+replaced line
+added line 3
 line5`;
    const result = engine.parseDiff(diff);
    expect(result.added).toBe(4);
    expect(result.removed).toBe(1);
  });

  it('should handle empty diff', () => {
    const engine = new GitEngine(process.cwd());
    const result = engine.parseDiff('');
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it('should parse diff with binary files', () => {
    const engine = new GitEngine(process.cwd());
    const diff = `diff --git a/image.png b/image.png
Binary files a/image.png and b.image.png differ`;
    const result = engine.parseDiff(diff);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });
});
