/**
 * Download page translations + static install data.
 *
 * English is the source of truth — edit `en` first, then sync `zhHans`.
 *
 * Only include install methods that have a real, published artifact:
 *   - Docker image:    ghcr.io/objectstack-ai/objectos:latest        (docker.yml)
 *   - Desktop bundles: github.com/objectstack-ai/objectos/releases/one-v* (one.yml)
 *   - npm packages:    @objectstack/cli, @objectstack/client
 *
 * Aspirational entries (brew tap, scoop bucket, winget, install.sh,
 * helm chart, standalone CLI tarball) are intentionally NOT shipped here.
 * Add them back once the corresponding release pipeline lands.
 */

import { ONE_VERSION, ONE_RELEASE_TAG } from './version';

export interface DownloadTranslations {
  badge: string;
  hero: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    secondaryHref: string;
    detected: string;
    detecting: string;
    notSure: string;
  };
  server: {
    heading: string;
    subheading: string;
    docker: { title: string; tagline: string; description: string; cta: string; href: string };
    kubernetes: { title: string; tagline: string; description: string; cta: string; href: string };
    source: { title: string; tagline: string; description: string; cta: string; href: string };
  };
  cli: {
    heading: string;
    subheading: string;
    tabs: { npm: string; pnpm: string; yarn: string };
    requires: string;
  };
  desktop: {
    heading: string;
    subheading: string;
    cols: { platform: string; file: string; size: string };
  };
  clients: {
    heading: string;
    subheading: string;
    items: {
      studio: { title: string; description: string; cta: string; href: string };
      js: { title: string; description: string; cta: string; href: string };
      rest: { title: string; description: string; cta: string; href: string };
      mcp: { title: string; description: string; cta: string; href: string };
      vscode: { title: string; description: string; cta: string; href: string };
    };
  };
  verify: {
    heading: string;
    body: string;
    releaseCta: string;
    releaseHref: string;
    signingCta: string;
    signingHref: string;
  };
  requirements: {
    heading: string;
    rows: { label: string; value: string }[];
  };
  past: {
    heading: string;
    body: string;
    cta: string;
    href: string;
  };
  copy: { copy: string; copied: string };
}

const RELEASE_BASE = 'https://github.com/objectstack-ai/objectos/releases';
const ONE_RELEASE = `${RELEASE_BASE}/tag/${ONE_RELEASE_TAG}`;
const ONE_DL = `${RELEASE_BASE}/download/${ONE_RELEASE_TAG}`;

export const en: DownloadTranslations = {
  badge: `Latest release · v${ONE_VERSION}`,
  hero: {
    title: 'Get ObjectOS',
    subtitle:
      'Install the desktop app for the fastest local start, or run the server in your own environment. Same runtime, same data model, same governance.',
    primaryCta: 'Download for',
    secondaryCta: 'View on GitHub',
    secondaryHref: ONE_RELEASE,
    detected: 'Detected',
    detecting: 'Detecting your platform…',
    notSure: 'Not what you wanted? Pick an installer below.',
  },
  server: {
    heading: 'Run the server',
    subheading:
      'One container image, two ways to run it. Same image, same behavior — pick what matches your infrastructure.',
    docker: {
      title: 'Docker',
      tagline: 'Single host · single command',
      description: 'Pull the official image and run a container against your own database. Best for evaluation and small deployments.',
      cta: 'Docker guide',
      href: '/docs/deploy/docker',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: 'Production · your cluster',
      description: 'Run the same image as a Deployment in your own cluster — wire up secrets, ingress, and storage the way you already do.',
      cta: 'Kubernetes guide',
      href: '/docs/deploy/kubernetes',
    },
    source: {
      title: 'Build from source',
      tagline: 'Hackable · all platforms',
      description: 'Clone the monorepo and run the server directly with pnpm. Best for contributors, custom builds, and air-gapped setups.',
      cta: 'Build guide',
      href: '/docs/deploy/source',
    },
  },
  cli: {
    heading: 'Install the CLI',
    subheading:
      'The `os` command builds, boots, and inspects ObjectStack applications. Distributed as an npm package — works on every OS.',
    tabs: { npm: 'npm', pnpm: 'pnpm', yarn: 'yarn' },
    requires: 'Requires Node.js 20 LTS or newer.',
  },
  desktop: {
    heading: 'All desktop installers',
    subheading: 'Every installer published in the latest release. All bundles are code-signed.',
    cols: { platform: 'Platform', file: 'File', size: 'Size' },
  },
  clients: {
    heading: 'Connect from your app',
    subheading:
      'Every business object on ObjectOS is reachable from your code, your AI agents, and your editor — through the same governed runtime.',
    items: {
      studio: {
        title: 'Studio (web)',
        description: 'The built-in admin console. No download — opens at the runtime URL once ObjectOS is up.',
        cta: 'Open Studio guide',
        href: '/docs/architecture',
      },
      js: {
        title: 'JavaScript / TypeScript SDK',
        description: 'Typed client for ObjectQL, REST, realtime, and file upload. Install once, share types across your stack.',
        cta: 'SDK reference',
        href: '/docs/reference/rest-api',
      },
      rest: {
        title: 'REST / OpenAPI',
        description: 'Auto-generated REST endpoints for every object, plus a live OpenAPI spec served by the runtime.',
        cta: 'REST reference',
        href: '/docs/reference/rest-api',
      },
      mcp: {
        title: 'MCP server (AI agents)',
        description: 'Expose objects and actions as Model Context Protocol tools — for Claude, Cursor, Copilot, and any MCP client.',
        cta: 'Configure AI',
        href: '/docs/configure/ai',
      },
      vscode: {
        title: 'Editor skills',
        description: 'Skills for Claude Code, Cursor, and Codex that teach your agent the ObjectStack metadata model.',
        cta: 'Skills CLI',
        href: '/docs/reference/skills-cli',
      },
    },
  },
  verify: {
    heading: 'Signed & verifiable',
    body:
      'Desktop bundles are code-signed; the Tauri updater ships a detached `.sig` alongside every macOS / Linux / Windows installer. The Docker image is tagged by both semver and commit SHA, so production deployments can pin an exact digest.',
    releaseCta: 'Release notes & signatures',
    releaseHref: ONE_RELEASE,
    signingCta: 'Security & signing',
    signingHref: '/docs/reference/security',
  },
  requirements: {
    heading: 'System requirements',
    rows: [
      { label: 'CPU', value: '2 cores (4 recommended for production)' },
      { label: 'Memory', value: '1 GB (4 GB recommended)' },
      { label: 'Disk', value: '500 MB for the runtime + your data directory' },
      { label: 'Database', value: 'SQLite (built-in), PostgreSQL 14+, or libSQL / Turso' },
      { label: 'Node.js', value: '20 LTS or newer (for the CLI and from-source builds)' },
      { label: 'OS', value: 'macOS 12+ (arm64 / x64), Windows 10/11 (x64), Linux x64 (glibc 2.31+)' },
    ],
  },
  past: {
    heading: 'Looking for an older release?',
    body: 'Every release is permanently archived on GitHub with notes, installers, and updater manifests.',
    cta: 'All releases & changelogs',
    href: RELEASE_BASE,
  },
  copy: { copy: 'Copy', copied: 'Copied' },
};

export const zhHans: DownloadTranslations = {
  badge: `最新发布 · v${ONE_VERSION}`,
  hero: {
    title: '下载 ObjectOS',
    subtitle:
      '装上桌面端,本地最快上手;或在你自己的环境里运行服务端。同一份运行时、同一套数据模型、同一套治理。',
    primaryCta: '下载',
    secondaryCta: '在 GitHub 上查看',
    secondaryHref: ONE_RELEASE,
    detected: '已识别',
    detecting: '正在识别你的平台…',
    notSure: '不是你想要的? 从下面选一个安装方式。',
  },
  server: {
    heading: '运行服务端',
    subheading: '同一个镜像,两种跑法。挑一种贴合你基础设施的方式即可 —— 行为完全一致。',
    docker: {
      title: 'Docker',
      tagline: '单机 · 单条命令',
      description: '拉取官方镜像,对接你自己的数据库,跑起一个容器。适合评估和小规模部署。',
      cta: 'Docker 指南',
      href: '/docs/deploy/docker',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: '生产环境 · 自有集群',
      description: '把同一个镜像当作 Deployment 跑在你自己的集群里 —— 密钥、Ingress、存储按你既有的方式接。',
      cta: 'Kubernetes 指南',
      href: '/docs/deploy/kubernetes',
    },
    source: {
      title: '从源码构建',
      tagline: '可改造 · 全平台',
      description: '克隆 monorepo,用 pnpm 直接启动服务端。适合贡献者、定制构建,以及离线部署。',
      cta: '构建指南',
      href: '/docs/deploy/source',
    },
  },
  cli: {
    heading: '安装 CLI',
    subheading: '`os` 命令用于构建、启动、查看 ObjectStack 应用。通过 npm 发布 —— 适配所有系统。',
    tabs: { npm: 'npm', pnpm: 'pnpm', yarn: 'yarn' },
    requires: '需要 Node.js 20 LTS 或更高版本。',
  },
  desktop: {
    heading: '全部桌面端安装包',
    subheading: '最新发布中的所有安装包。每个包都经过代码签名。',
    cols: { platform: '平台', file: '文件', size: '大小' },
  },
  clients: {
    heading: '从你的应用接入',
    subheading:
      'ObjectOS 上的每个业务对象,都能从你的代码、AI Agent 和编辑器里访问 —— 走的是同一套受管运行时。',
    items: {
      studio: {
        title: 'Studio(Web)',
        description: '内置的管理控制台。无需下载 —— ObjectOS 启动后,在运行时地址就能打开。',
        cta: '了解 Studio',
        href: '/docs/architecture',
      },
      js: {
        title: 'JavaScript / TypeScript SDK',
        description: '面向 ObjectQL、REST、Realtime 和文件上传的强类型客户端。安装一次,前后端共享类型。',
        cta: 'SDK 参考',
        href: '/docs/reference/rest-api',
      },
      rest: {
        title: 'REST / OpenAPI',
        description: '每个对象自动生成 REST 接口,运行时同时暴露实时的 OpenAPI 规范。',
        cta: 'REST 参考',
        href: '/docs/reference/rest-api',
      },
      mcp: {
        title: 'MCP 服务端(AI Agent)',
        description: '把对象和 action 暴露为 Model Context Protocol 工具 —— Claude、Cursor、Copilot 等 MCP 客户端都能接。',
        cta: '配置 AI',
        href: '/docs/configure/ai',
      },
      vscode: {
        title: '编辑器 Skills',
        description: '为 Claude Code、Cursor、Codex 准备的 Skills,让你的 Agent 立刻理解 ObjectStack 元数据模型。',
        cta: 'Skills CLI',
        href: '/docs/reference/skills-cli',
      },
    },
  },
  verify: {
    heading: '已签名 · 可校验',
    body:
      '桌面端安装包经过代码签名,Tauri 自动更新器为每个 macOS / Linux / Windows 包附带独立 `.sig` 签名文件。Docker 镜像同时打 semver 与 commit SHA 标签,生产部署可以锁到指定 digest。',
    releaseCta: '发布说明与签名',
    releaseHref: ONE_RELEASE,
    signingCta: '安全与签名',
    signingHref: '/docs/reference/security',
  },
  requirements: {
    heading: '系统要求',
    rows: [
      { label: 'CPU', value: '2 核(生产环境建议 4 核)' },
      { label: '内存', value: '1 GB(建议 4 GB)' },
      { label: '磁盘', value: '500 MB 运行时 + 你的数据目录' },
      { label: '数据库', value: 'SQLite(内置)、PostgreSQL 14+,或 libSQL / Turso' },
      { label: 'Node.js', value: '20 LTS 或更高(用于 CLI 与从源码构建)' },
      { label: '操作系统', value: 'macOS 12+(arm64 / x64)、Windows 10/11(x64)、Linux x64(glibc 2.31+)' },
    ],
  },
  past: {
    heading: '想找旧版本?',
    body: '每个发布都会永久归档在 GitHub 上,附带发布说明、安装包与自动更新清单。',
    cta: '全部发布与变更日志',
    href: RELEASE_BASE,
  },
  copy: { copy: '复制', copied: '已复制' },
};

/**
 * Registry of available download-page translations. Locales absent
 * here (ja, de, es, fr until translated) resolve to English.
 */
const DOWNLOAD_TRANSLATIONS: Partial<Record<string, DownloadTranslations>> = {
  en,
  'zh-Hans': zhHans,
};

export function getDownloadTranslations(lang: string): DownloadTranslations {
  return DOWNLOAD_TRANSLATIONS[lang] ?? en;
}

/* ------------------------------------------------------------------ */
/* Static data shared across locales                                   */
/* ------------------------------------------------------------------ */

export type OsKey = 'macos' | 'linux' | 'windows';

export interface InstallCommand {
  label: string;
  command: string;
  note?: string;
}

/**
 * CLI installers. ObjectOS CLI ships as `@objectstack/cli` on npm — every
 * Node package manager works. We do NOT advertise brew/scoop/winget here
 * because there is no release pipeline producing those packages.
 */
export const CLI_INSTALLS: Record<'npm' | 'pnpm' | 'yarn', InstallCommand[]> = {
  npm: [{ label: 'npm', command: 'npm install -g @objectstack/cli' }],
  pnpm: [{ label: 'pnpm', command: 'pnpm add -g @objectstack/cli' }],
  yarn: [{ label: 'yarn', command: 'yarn global add @objectstack/cli' }],
};

/**
 * Server install commands. Each MUST resolve to a real, published artifact.
 *   - docker:     ghcr image, built by docker.yml on every push.
 *   - kubernetes: same ghcr image, wrapped in a minimal kubectl example.
 *   - source:     git clone — always works, the repo is public.
 */
export const SERVER_COMMANDS = {
  docker:
    'docker run -p 3000:3000 -v objectos-data:/var/lib/objectos \\\n  ghcr.io/objectstack-ai/objectos:latest',
  kubernetes:
    'kubectl create deployment objectos \\\n  --image=ghcr.io/objectstack-ai/objectos:latest --port=3000\nkubectl expose deployment objectos --port=80 --target-port=3000',
  source:
    'git clone https://github.com/objectstack-ai/objectos.git\ncd objectos && pnpm install\npnpm --filter @objectos/server start',
} as const;

/**
 * Client / SDK install commands. All resolve to real npm packages.
 */
export const CLIENT_COMMANDS = {
  js: 'npm install @objectstack/client',
  mcp: 'npx @objectstack/plugin-mcp-server --url http://localhost:3000',
  vscode: 'npx @objectstack/skills install --target claude-code',
} as const;

/**
 * Desktop installers. Each entry MUST correspond to a real asset on the
 * latest `one-v*` GitHub release — see one.yml `Upload artifacts` step.
 *
 * If you add a new platform target in one.yml, add the row here too. Size
 * values are taken from the published release and are accurate to ±1 MB.
 */
export interface DesktopDownload {
  os: 'macOS' | 'Windows' | 'Linux';
  arch: 'arm64' | 'x64';
  file: string;
  size: string;
  href: string;
  kind: 'dmg' | 'exe' | 'msi' | 'deb' | 'AppImage';
}

export const DESKTOP_DOWNLOADS: DesktopDownload[] = [
  { os: 'macOS',   arch: 'arm64', kind: 'dmg',      file: `ObjectOS_${ONE_VERSION}_aarch64.dmg`,        size: '86 MB',  href: `${ONE_DL}/ObjectOS_${ONE_VERSION}_aarch64.dmg` },
  { os: 'macOS',   arch: 'x64',   kind: 'dmg',      file: `ObjectOS_${ONE_VERSION}_x64.dmg`,            size: '87 MB',  href: `${ONE_DL}/ObjectOS_${ONE_VERSION}_x64.dmg` },
  { os: 'Windows', arch: 'x64',   kind: 'exe',      file: `ObjectOS_${ONE_VERSION}_x64-setup.exe`,      size: '46 MB',  href: `${ONE_DL}/ObjectOS_${ONE_VERSION}_x64-setup.exe` },
  { os: 'Windows', arch: 'x64',   kind: 'msi',      file: `ObjectOS_${ONE_VERSION}_x64_en-US.msi`,      size: '79 MB',  href: `${ONE_DL}/ObjectOS_${ONE_VERSION}_x64_en-US.msi` },
  { os: 'Linux',   arch: 'x64',   kind: 'AppImage', file: `ObjectOS_${ONE_VERSION}_amd64.AppImage`,     size: '148 MB', href: `${ONE_DL}/ObjectOS_${ONE_VERSION}_amd64.AppImage` },
  { os: 'Linux',   arch: 'x64',   kind: 'deb',      file: `ObjectOS_${ONE_VERSION}_amd64.deb`,          size: '94 MB',  href: `${ONE_DL}/ObjectOS_${ONE_VERSION}_amd64.deb` },
];

/**
 * Pick the recommended installer for a detected OS+arch. Falls back to
 * the closest available bundle (e.g. Linux arm64 → Linux x64 AppImage,
 * Windows arm64 → Windows x64 setup) since the release pipeline only
 * publishes a subset of architectures today.
 */
export function recommendedDownload(
  os: OsKey,
  arch: 'arm64' | 'x64',
): DesktopDownload | null {
  const osName = os === 'macos' ? 'macOS' : os === 'linux' ? 'Linux' : 'Windows';
  if (osName === 'macOS') {
    return (
      DESKTOP_DOWNLOADS.find((d) => d.os === 'macOS' && d.arch === arch) ??
      DESKTOP_DOWNLOADS.find((d) => d.os === 'macOS') ??
      null
    );
  }
  if (osName === 'Windows') {
    // Prefer the smaller NSIS setup over MSI.
    return DESKTOP_DOWNLOADS.find((d) => d.os === 'Windows' && d.kind === 'exe') ?? null;
  }
  // Linux: AppImage is the most universal install path.
  return DESKTOP_DOWNLOADS.find((d) => d.os === 'Linux' && d.kind === 'AppImage') ?? null;
}
