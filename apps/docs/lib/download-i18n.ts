/**
 * Download page translations.
 *
 * English is the source of truth — edit `en` first, then sync `cn`.
 */

import { OBJECTOS_VERSION } from './version';

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
    binary: { title: string; tagline: string; description: string; cta: string; href: string };
  };
  cli: {
    heading: string;
    subheading: string;
    tabs: {
      macos: string;
      linux: string;
      windows: string;
      npm: string;
      manual: string;
    };
    manual: {
      heading: string;
      arch: string;
      file: string;
      size: string;
      sha: string;
    };
    verifyHint: string;
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
    checksumsCta: string;
    checksumsHref: string;
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
const LATEST = `${RELEASE_BASE}/latest`;
const LATEST_DL = `${LATEST}/download`;

export const en: DownloadTranslations = {
  badge: `Latest release · ${OBJECTOS_VERSION}`,
  hero: {
    title: 'Get ObjectOS',
    subtitle:
      'Run the server in your environment, install the CLI on your laptop, and connect your apps and AI agents. Everything ships from the same release.',
    primaryCta: 'Download for',
    secondaryCta: 'View on GitHub',
    secondaryHref: RELEASE_BASE,
    detected: 'Detected',
    detecting: 'Detecting your platform…',
    notSure: 'Not what you wanted?',
  },
  server: {
    heading: 'Run the server',
    subheading:
      'One artifact, three shapes. Pick the one that matches your infrastructure — same behavior in each.',
    docker: {
      title: 'Docker',
      tagline: 'Single host · single command',
      description: 'Pull the image and run a container against your own database. Best for evaluation and small deployments.',
      cta: 'Docker guide',
      href: '/docs/deploy/docker',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: 'Production HA',
      description: 'Helm chart with Deployment + Service + PVC. Plugs into your secrets, ingress, and observability stack.',
      cta: 'Kubernetes guide',
      href: '/docs/deploy/kubernetes',
    },
    binary: {
      title: 'Linux / macOS binary',
      tagline: 'Bare metal · systemd',
      description: 'Pre-built tarballs for direct install on a host you manage. Use this for air-gapped or appliance deployments.',
      cta: 'Air-gapped guide',
      href: '/docs/deploy/air-gapped',
    },
  },
  cli: {
    heading: 'Install the CLI',
    subheading:
      'The `os` command builds, boots, and inspects ObjectStack applications. One binary, every OS.',
    tabs: {
      macos: 'macOS',
      linux: 'Linux',
      windows: 'Windows',
      npm: 'npm',
      manual: 'Manual',
    },
    manual: {
      heading: 'Direct downloads',
      arch: 'Platform',
      file: 'File',
      size: 'Size',
      sha: 'SHA-256',
    },
    verifyHint: 'All downloads are signed and listed in the release checksums file.',
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
    heading: 'Verify your download',
    body:
      'Every release publishes a SHA-256 checksum file and a detached signature. Verify both before installing in production or air-gapped environments.',
    checksumsCta: 'Checksums',
    checksumsHref: `${LATEST_DL}/checksums.txt`,
    signingCta: 'Signing key',
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
      { label: 'OS', value: 'Linux (glibc 2.31+), macOS 12+, Windows 10/11 (x64 & arm64)' },
    ],
  },
  past: {
    heading: 'Looking for an older release?',
    body: 'Every release — including LTS lines — is permanently archived on GitHub with notes and checksums.',
    cta: 'All releases & changelogs',
    href: RELEASE_BASE,
  },
  copy: { copy: 'Copy', copied: 'Copied' },
};

export const cn: DownloadTranslations = {
  badge: `最新发布 · ${OBJECTOS_VERSION}`,
  hero: {
    title: '下载 ObjectOS',
    subtitle:
      '在你自己的环境里跑服务端,在笔记本上装好 CLI,再把应用和 AI Agent 接上来 —— 全部来自同一个发布。',
    primaryCta: '下载',
    secondaryCta: '在 GitHub 上查看',
    secondaryHref: RELEASE_BASE,
    detected: '已识别',
    detecting: '正在识别你的平台…',
    notSure: '不是你想要的?',
  },
  server: {
    heading: '运行服务端',
    subheading:
      '同一份发布包,三种部署形态。挑一种贴合你基础设施的方式即可 —— 行为完全一致。',
    docker: {
      title: 'Docker',
      tagline: '单机 · 单条命令',
      description: '拉取镜像,对接你自己的数据库,跑起一个容器。适合评估和小规模部署。',
      cta: 'Docker 指南',
      href: '/docs/deploy/docker',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: '生产级高可用',
      description: 'Helm Chart 自带 Deployment + Service + PVC,对接你已经在用的密钥、Ingress 和可观测栈。',
      cta: 'Kubernetes 指南',
      href: '/docs/deploy/kubernetes',
    },
    binary: {
      title: 'Linux / macOS 二进制',
      tagline: '裸金属 · systemd',
      description: '预编译压缩包,直接装在你管理的主机上。适合离线或一体机式部署。',
      cta: '离线部署指南',
      href: '/docs/deploy/air-gapped',
    },
  },
  cli: {
    heading: '安装 CLI',
    subheading:
      '`os` 命令用于构建、启动、查看 ObjectStack 应用。一个二进制,适配所有系统。',
    tabs: {
      macos: 'macOS',
      linux: 'Linux',
      windows: 'Windows',
      npm: 'npm',
      manual: '手动下载',
    },
    manual: {
      heading: '直接下载',
      arch: '平台',
      file: '文件',
      size: '大小',
      sha: 'SHA-256',
    },
    verifyHint: '所有产物都经过签名,并列在发布的 checksums 文件中。',
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
    heading: '校验你的下载',
    body:
      '每次发布都会附带 SHA-256 校验和文件与独立签名。生产或离线部署前请同时校验两者。',
    checksumsCta: '校验和',
    checksumsHref: `${LATEST_DL}/checksums.txt`,
    signingCta: '签名密钥',
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
      { label: '操作系统', value: 'Linux(glibc 2.31+)、macOS 12+、Windows 10/11(x64 与 arm64)' },
    ],
  },
  past: {
    heading: '想找旧版本?',
    body: '每个发布(包括 LTS)都会永久归档在 GitHub 上,附带发布说明与校验和。',
    cta: '全部发布与变更日志',
    href: RELEASE_BASE,
  },
  copy: { copy: '复制', copied: '已复制' },
};

export function getDownloadTranslations(lang: string): DownloadTranslations {
  return lang === 'cn' ? cn : en;
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

export const CLI_INSTALLS: Record<OsKey | 'npm', InstallCommand[]> = {
  macos: [
    { label: 'Homebrew', command: 'brew install objectstack-ai/tap/objectstack' },
    { label: 'Shell', command: 'curl -fsSL https://objectstack.ai/install.sh | sh' },
  ],
  linux: [
    { label: 'Shell', command: 'curl -fsSL https://objectstack.ai/install.sh | sh' },
    { label: 'apt (Debian / Ubuntu)', command: 'curl -fsSL https://objectstack.ai/apt/setup.sh | sudo sh\nsudo apt install objectstack' },
  ],
  windows: [
    { label: 'Scoop', command: 'scoop bucket add objectstack https://github.com/objectstack-ai/scoop-bucket\nscoop install objectstack' },
    { label: 'winget', command: 'winget install ObjectStack.ObjectStack' },
  ],
  npm: [
    { label: 'npm', command: 'npm i -g @objectstack/cli' },
    { label: 'pnpm', command: 'pnpm add -g @objectstack/cli' },
  ],
};

export const SERVER_COMMANDS = {
  docker: 'docker run -p 3000:3000 -v objectos-data:/var/lib/objectos \\\n  ghcr.io/objectstack-ai/objectos:latest',
  kubernetes: 'helm repo add objectos https://charts.objectstack.ai\nhelm install objectos objectos/objectos',
  binary: 'curl -fsSL https://objectstack.ai/install-server.sh | sh',
} as const;

export const CLIENT_COMMANDS = {
  js: 'npm i @objectstack/client',
  mcp: 'npx @objectstack/plugin-mcp-server --url http://localhost:3000',
  vscode: 'npx @objectstack/skills install --target claude-code',
} as const;

export interface ManualDownload {
  os: 'macOS' | 'Linux' | 'Windows';
  arch: 'x64' | 'arm64';
  file: string;
  size: string;
  href: string;
}

const LATEST_DOWNLOAD = `${RELEASE_BASE}/latest/download`;

export const MANUAL_DOWNLOADS: ManualDownload[] = [
  { os: 'macOS', arch: 'arm64', file: 'objectstack-darwin-arm64.tar.gz', size: '24 MB', href: `${LATEST_DOWNLOAD}/objectstack-darwin-arm64.tar.gz` },
  { os: 'macOS', arch: 'x64',   file: 'objectstack-darwin-x64.tar.gz',   size: '25 MB', href: `${LATEST_DOWNLOAD}/objectstack-darwin-x64.tar.gz` },
  { os: 'Linux', arch: 'x64',   file: 'objectstack-linux-x64.tar.gz',    size: '26 MB', href: `${LATEST_DOWNLOAD}/objectstack-linux-x64.tar.gz` },
  { os: 'Linux', arch: 'arm64', file: 'objectstack-linux-arm64.tar.gz',  size: '25 MB', href: `${LATEST_DOWNLOAD}/objectstack-linux-arm64.tar.gz` },
  { os: 'Windows', arch: 'x64', file: 'objectstack-windows-x64.zip',     size: '27 MB', href: `${LATEST_DOWNLOAD}/objectstack-windows-x64.zip` },
];
