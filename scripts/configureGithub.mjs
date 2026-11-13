// Apply reviewed repository settings using an already authenticated GitHub CLI.
// This script never creates a repository, changes its visibility, or pushes code.
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const metadata = JSON.parse(await readFile(new URL('../.github/repository.json', import.meta.url), 'utf8'))
const repository = `${metadata.owner}/${metadata.name}`
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repository)) throw new Error('Invalid repository identifier')
if (metadata.topics.length > 20 || metadata.topics.some((topic) => !/^[a-z0-9][a-z0-9-]{0,49}$/.test(topic))) {
  throw new Error('Invalid repository topics')
}
function gh(args, input) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8', shell: false, windowsHide: true,
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    input: input === undefined ? undefined : JSON.stringify(input),
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} failed: ${result.stderr.trim()}`)
  return result.stdout.trim()
}
function api(method, suffix, body) {
  return gh(['api', '--method', method, `repos/${repository}${suffix}`, ...(body === undefined ? [] : ['--input', '-'])], body)
}

const account = gh(['api', 'user', '--jq', '.login'])
if (account.toLowerCase() !== metadata.owner.toLowerCase()) throw new Error(`Expected ${metadata.owner}; authenticated as ${account}`)
const current = JSON.parse(api('GET', ''))
if (current.private) throw new Error('Repository must already be public; this script will not change visibility')

const settings = Object.fromEntries([
  'description', 'homepage', 'has_issues', 'has_wiki', 'has_projects',
  'delete_branch_on_merge', 'allow_squash_merge', 'allow_merge_commit', 'allow_rebase_merge',
].map((key) => [key, metadata[key]]))
api('PATCH', '', settings)
api('PUT', '/topics', { names: metadata.topics })
console.log(`Updated description, topics and collaboration settings for ${repository}`)

// Security settings can require extra account permissions. Report every failure
// and leave the command unsuccessful instead of claiming that protections exist.
const protections = [
  ['Private vulnerability reporting', () => api('PUT', '/private-vulnerability-reporting')],
  ['Dependabot alerts', () => api('PUT', '/vulnerability-alerts')],
  ['Secret scanning and push protection', () => api('PATCH', '', {
    security_and_analysis: {
      secret_scanning: { status: 'enabled' },
      secret_scanning_push_protection: { status: 'enabled' },
    },
  })],
]
let failed = false
for (const [name, apply] of protections) {
  try { apply(); console.log(`Enabled ${name}`) }
  catch (error) { failed = true; console.error(`${name}: ${error.message}`) }
}

const verified = JSON.parse(api('GET', ''))
const topics = JSON.parse(api('GET', '/topics')).names
if (Object.entries(settings).some(([key, value]) => verified[key] !== value) ||
    JSON.stringify([...topics].sort()) !== JSON.stringify([...metadata.topics].sort())) {
  throw new Error('Repository metadata verification failed')
}
const privateReports = JSON.parse(api('GET', '/private-vulnerability-reporting'))
if (!privateReports.enabled) { failed = true; console.error('Private vulnerability reporting was not confirmed') }
try { api('GET', '/vulnerability-alerts') }
catch (error) { failed = true; console.error(`Dependabot alert verification: ${error.message}`) }
for (const name of ['secret_scanning', 'secret_scanning_push_protection']) {
  if (verified.security_and_analysis?.[name]?.status !== 'enabled') {
    failed = true; console.error(`${name} was not confirmed enabled`)
  }
}
if (failed) process.exitCode = 1
else console.log('Verified repository metadata and security settings')
