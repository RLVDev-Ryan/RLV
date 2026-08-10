/**
 * Push the local HEAD commit to GitHub via the Git Data API.
 * Workaround for when github.com (git smart HTTP) is unreachable but
 * api.github.com is not. Recreates the HEAD commit's tree changes.
 *
 * Usage: GH_TOKEN=... node scripts/api-push.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OWNER = 'RLVDev-Ryan';
const REPO = 'RLV';
const TOKEN = process.env.GH_TOKEN;
const API = `https://api.github.com/repos/${OWNER}/${REPO}/git`;

if (!TOKEN) {
  console.error('GH_TOKEN required');
  process.exit(1);
}

async function gh(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status}: ${data.message || JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

// 1. Get local HEAD commit + remote ref
const localCommitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const commitMsg = execSync('git log -1 --pretty=%B HEAD', { encoding: 'utf8' }).trim();
const remoteRef = await gh('GET', `${API}/ref/heads/main`);
const remoteCommitSha = remoteRef.object.sha;
const remoteCommit = await gh('GET', `${API}/commits/${remoteCommitSha}`);
const baseTree = remoteCommit.tree.sha;

// 2. Changed files in local HEAD vs its parent (the changeset to replay).
//    (Parent may differ from remote HEAD if they diverged — we replay the same
//    tree changes on top of the current remote tree.)
const nameStatus = execSync('git diff-tree --no-commit-id --name-status -r HEAD', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const treeEntries = [];
for (const line of nameStatus) {
  const [status, p] = line.split('\t');
  if (status === 'D') {
    treeEntries.push({ path: p, mode: '100644', type: 'blob', sha: null });
    continue;
  }
  const content = fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const blob = await gh('POST', `${API}/blobs`, { content, encoding: 'utf-8' });
  treeEntries.push({ path: p, mode: '100644', type: 'blob', sha: blob.sha });
}

// 3. Create tree from base
const tree = await gh('POST', `${API}/trees`, { base_tree: baseTree, tree: treeEntries });

// 4. Create commit
const commit = await gh('POST', `${API}/commits`, {
  message: commitMsg,
  tree: tree.sha,
  parents: [remoteCommitSha],
  author: { name: 'RLVDev-Ryan', email: 'rlv@users.noreply.github.com' },
  committer: { name: 'RLVDev-Ryan', email: 'rlv@users.noreply.github.com' },
});

// 5. Update ref (fast-forward)
await gh('PATCH', `${API}/refs/heads/main`, { sha: commit.sha, force: false });
console.log(`Pushed ${remoteCommitSha} -> ${commit.sha} (${treeEntries.length} changes)`);
