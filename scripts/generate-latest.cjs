const fs = require("fs")
const path = require("path")

const root = process.cwd()
const tauriConfig = require(path.join(root, "src-tauri/tauri.conf.json"))

const version = tauriConfig.version
const repo = "https://github.com/UnLuckyLust/NTEMM"
const tag = `v${version}`

const nsisDir = path.join(root, "src-tauri/target/release/bundle/nsis")
const outDir = path.join(root, "public/changelog")
const changelogPath = path.join(root, "src/data/changelog.ts")

const exeName = `NTEMM_${version}_x64-setup.exe`
const sigPath = path.join(nsisDir, `${exeName}.sig`)

if (!fs.existsSync(sigPath)) {
  throw new Error(`Missing signature file: ${sigPath}`)
}

function getChangelogNotes() {
  if (!fs.existsSync(changelogPath)) {
    return `NTEMM v${version}`
  }

  const changelogFile = fs.readFileSync(changelogPath, "utf8")

  const versionRegex = new RegExp(
    `"${version}"\\s*:\\s*\\[([\\s\\S]*?)\\]`,
    "m",
  )

  const match = changelogFile.match(versionRegex)

  if (!match) {
    return `NTEMM v${version}`
  }

  const items = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])

  if (!items.length) {
    return `NTEMM v${version}`
  }

  return [`NTEMM v${version}`, "", ...items.map((item) => `- ${item}`)].join(
    "\n",
  )
}

const latest = {
  version,
  notes: getChangelogNotes(),
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: fs.readFileSync(sigPath, "utf8").trim(),
      url: `${repo}/releases/download/${tag}/${exeName}`,
    },
  },
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(
  path.join(outDir, "latest.json"),
  JSON.stringify(latest, null, 2) + "\n",
)

console.log(`Generated latest.json for v${version}`)