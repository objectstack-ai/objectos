/**
 * Homepage Internationalization
 *
 * Translations for the ObjectOS homepage.
 *
 * Audience: enterprise IT, security/compliance, and business owners
 * evaluating a customer-hosted runtime for ObjectStack applications —
 * NOT framework developers.
 *
 * Supports: en (English), zh-Hans (简体中文). Additional locales
 * (ja, de, es, fr) fall back to English until their objects are added.
 */

import { SPEC_VERSION, OBJECTOS_VERSION } from './version';

export interface HomepageTranslations {
  // Hero Section
  badge: {
    status: string;
    version: string;
  };
  hero: {
    title: {
      line1: string;
      line2: string;
    };
    subtitle: {
      line1: string;
      line2: string;
    };
    cta: {
      primary: string;
      primaryHref: string;
      secondary: string;
      secondaryHref: string;
    };
    quickStart: {
      label: string;
      commands: string[];
    };
    trustStrip: {
      license: string;
      selfHosted: string;
      version: string;
      runtime: string;
    };
  };

  // Features Section
  features: {
    selfHosted: {
      title: string;
      description: string;
    };
    deployAnywhere: {
      title: string;
      description: string;
    };
    airGapped: {
      title: string;
      description: string;
    };
    identity: {
      title: string;
      description: string;
    };
    permissions: {
      title: string;
      description: string;
    };
    observability: {
      title: string;
      description: string;
    };
  };

  // Deploy Modes Section
  deployModes: {
    eyebrow: string;
    heading: string;
    subheading: string;
    docker: {
      title: string;
      tagline: string;
      description: string;
      href: string;
      cta: string;
    };
    kubernetes: {
      title: string;
      tagline: string;
      description: string;
      href: string;
      cta: string;
    };
    airGapped: {
      title: string;
      tagline: string;
      description: string;
      href: string;
      cta: string;
    };
  };

  // Capabilities Section
  capabilities: {
    eyebrow: string;
    heading: string;
    subheading: string;
  };

  // Bottom CTA
  bottomCta: {
    heading: string;
    subheading: string;
    primary: string;
    primaryHref: string;
    secondary: string;
    secondaryHref: string;
  };

  // Hero Agent Preview (conversation shown under the hero)
  agentPreview: {
    windowTitle: string;
    userLabel: string;
    agentLabel: string;
    user1Line1: string;
    user1Line2: string;
    tool1Name: string;
    tool1Target: string;
    matchSummary: string;
    ticket1Meta: string;
    ticket1Note: string;
    ticket2Meta: string;
    ticket2Note: string;
    ticket3Meta: string;
    ticket3Note: string;
    insight: string;
    user2: string;
    tool2Name: string;
    tool2Count: string;
    tool2Sep: string;
    tool3Name: string;
    tool3Count: string;
    actionResult: string;
    governance: string;
  };

  // Footer
  footer: {
    copyright: string;
    privacy: string;
    privacyHref: string;
    terms: string;
    termsHref: string;
  };

  // Personas Section
  personas: {
    eyebrow: string;
    heading: string;
    itOps: {
      title: string;
      description: string;
      action: string;
    };
    security: {
      title: string;
      description: string;
      action: string;
    };
    business: {
      title: string;
      description: string;
      action: string;
    };
  };
}

/**
 * English Translations
 */
export const en: HomepageTranslations = {
  badge: {
    status: 'AI-Native Business Platform',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'The Business Platform',
      line2: 'AI Can Actually Use.',
    },
    subtitle: {
      line1: 'ObjectOS is the AI-native runtime for your business systems — CRM, contracts, tickets, approvals, anything modeled on the ObjectStack metadata protocol.',
      line2: 'Put your business objects on ObjectOS and AI agents can safely query, analyze, and act on that data — under your permissions, on your servers, with every step audited.',
    },
    cta: {
      primary: 'See How It Works',
      primaryHref: '/docs/architecture',
      secondary: 'Quickstart',
      secondaryHref: '/docs/quickstart',
    },
    quickStart: {
      label: 'Terminal',
      commands: [
        'npm i -g @objectstack/cli',
        'os start',
      ],
    },
    trustStrip: {
      license: 'MIT licensed',
      selfHosted: 'Self-hosted',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · Air-gapped',
    },
  },
  features: {
    selfHosted: {
      title: 'Every Object Is an AI Tool',
      description: 'Define a business object once in ObjectStack metadata, and ObjectOS automatically exposes it to AI agents as a governed, callable tool — no glue code, no separate integration layer to maintain.',
    },
    deployAnywhere: {
      title: 'AI Acts as the Signed-In User',
      description: "When an agent queries or updates data, it runs with the caller's identity. Whatever that person is allowed to see or do, the agent can — nothing more. The boundary is enforced in the runtime, not in the prompt.",
    },
    airGapped: {
      title: 'Every Action Audited',
      description: "Every read, every write, every escalation — by a human or an agent — is recorded with who, what, when, and why. Compliance gets one log to look at, not two.",
    },
    identity: {
      title: 'Plugs Into Your Identity',
      description: 'OAuth, OIDC, SAML, corporate SSO, or local accounts. AI sessions inherit the same identity, the same MFA, the same offboarding — there is no separate "AI account" to govern.',
    },
    permissions: {
      title: 'Permissions Enforced at the Runtime',
      description: 'Role-based access, record-level rules, and field-level redaction run inside ObjectOS — so the same policy applies whether a request comes from the UI, an API client, or an AI agent.',
    },
    observability: {
      title: 'Your Data, Your Network',
      description: 'ObjectOS runs in your environment — private cloud, on-prem, or fully air-gapped. Business data and AI prompts stay inside your perimeter. No third party in the loop.',
    },
  },
  capabilities: {
    eyebrow: '02 — How it’s safe',
    heading: 'AI Access, Without Giving Up Control',
    subheading: 'Every safeguard your platform already has — identity, permissions, audit, network boundary — applies the moment an agent touches your data. Nothing new to govern.',
  },
  personas: {
    eyebrow: '03 — Who it’s for',
    heading: 'Built for the Three People Who Have to Say Yes',
    itOps: {
      title: 'IT & Platform Operators',
      description: 'Ships as a Docker image and a Helm chart. Plugs into the database, identity, and observability stack you already operate. One artifact runs the same from a laptop to an air-gapped data center.',
      action: 'Deployment Guide',
    },
    security: {
      title: 'Security & Compliance',
      description: 'AI agents can never see or do more than the user behind them. SSO, RBAC, field-level redaction, and full audit are enforced at the runtime — and apply identically to human and AI traffic.',
      action: 'Permissions Model',
    },
    business: {
      title: 'Business Owners',
      description: 'Give your teams an AI that actually knows your CRM, your contracts, your tickets — because it talks to the system of record, not a copy. Customer data never leaves your company.',
      action: 'Architecture Overview',
    },
  },
  deployModes: {
    eyebrow: '01 — Deploy',
    heading: 'Runs Where Your Data Already Lives',
    subheading: 'Same artifact, same behavior. Pick the shape that matches your infrastructure — ObjectOS, and the AI access that comes with it, stays inside your network.',
    docker: {
      title: 'Docker',
      tagline: 'Single host, single command',
      description: 'One container against your own database. Ideal for evaluation, internal tools, and small-team deployments.',
      href: '/docs/deploy/docker',
      cta: 'Docker guide',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: 'Production HA',
      description: 'Deployment + Service + PersistentVolumeClaim, with secrets and config from the mechanisms you already use. Helm chart included.',
      href: '/docs/deploy/kubernetes',
      cta: 'Kubernetes guide',
    },
    airGapped: {
      title: 'Air-Gapped',
      tagline: 'No internet egress',
      description: 'Ship a release bundle into a network with no public connectivity. ObjectOS reads its artifact from disk and never calls home — including the AI integration surface.',
      href: '/docs/deploy/air-gapped',
      cta: 'Air-gapped guide',
    },
  },
  bottomCta: {
    heading: 'Give AI a business system it can actually use.',
    subheading: 'Define your objects once with ObjectStack. Run them on ObjectOS. Let AI work — under your rules, inside your network.',
    primary: 'Quickstart',
    primaryHref: '/docs/quickstart',
    secondary: 'Architecture',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: 'Privacy Policy',
    privacyHref: '/privacy',
    terms: 'Terms of Service',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · Support Copilot',
    userLabel: 'You',
    agentLabel: 'Agent',
    user1Line1: 'Which urgent tickets have been open more than 24h,',
    user1Line2: "and who's on the hook?",
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  3 tickets match — grouped by assignee:',
    ticket1Meta: ' · 31h open · Maya  ',
    ticket1Note: '(billing outage)',
    ticket2Meta: ' · 28h open · Maya  ',
    ticket2Note: '(SSO failure)',
    ticket3Meta: ' · 26h open · Jordan',
    ticket3Note: ' (export bug)',
    insight: '  Maya is carrying 2/3 — likely the bottleneck.',
    user2: "Escalate all three and reassign Maya's to the on-call.",
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ priority → urgent · on-call notified · audited',
    governance: '  Runs as you. Permissions + field rules enforced.',
  },
};

/**
 * Chinese (Simplified) Translations (简体中文翻译)
 */
export const zhHans: HomepageTranslations = {
  badge: {
    status: 'AI 原生业务平台',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: '让 AI 真正能用上',
      line2: '你的业务系统。',
    },
    subtitle: {
      line1: 'ObjectOS 是你企业自有的 AI 原生业务运行平台 —— 用 ObjectStack 元数据协议描述的 CRM、合同、工单、审批等业务对象,都跑在它之上。',
      line2: '把业务对象托管到 ObjectOS,AI Agent 就能在你的权限和审计规则下,直接查询数据、分析趋势、执行操作 —— 数据不出企业,每一步都有迹可查。',
    },
    cta: {
      primary: '看它是怎么工作的',
      primaryHref: '/docs/architecture',
      secondary: '快速开始',
      secondaryHref: '/docs/quickstart',
    },
    quickStart: {
      label: '终端',
      commands: [
        'npm i -g @objectstack/cli',
        'os start',
      ],
    },
    trustStrip: {
      license: 'MIT 开源',
      selfHosted: '私有部署',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · 离线',
    },
  },
  features: {
    selfHosted: {
      title: '每个业务对象,自动就是 AI 工具',
      description: '在 ObjectStack 里把业务对象定义一次,ObjectOS 就会自动把它暴露成 AI Agent 可调用的工具 —— 不需要再写胶水代码,也不需要单独维护一层 AI 集成。',
    },
    deployAnywhere: {
      title: 'AI 以"用户本人"的身份执行',
      description: 'Agent 查询或更新数据时,使用的是调用者的身份。那个人能看的、能做的,AI 就能;多一点都不行。这条边界由运行时强制,而不是靠提示词。',
    },
    airGapped: {
      title: '每一次操作都被审计',
      description: '每一次读、每一次写、每一次升级 —— 不论来自人还是 Agent —— 都会留下"谁、在什么时候、做了什么、为什么"。合规只需要看一份日志。',
    },
    identity: {
      title: '对接你现有的身份系统',
      description: 'OAuth、OIDC、SAML、企业 SSO 或本地账号都可。AI 会话沿用同一套身份、同一套 MFA、同一套离职流程 —— 没有需要单独治理的"AI 账号"。',
    },
    permissions: {
      title: '权限在运行时强制,而非 UI',
      description: '基于角色的访问、行级规则、字段级脱敏全部在 ObjectOS 运行时执行 —— 不论请求来自 UI、API 客户端还是 AI Agent,都用同一套策略。',
    },
    observability: {
      title: '你的数据,你的网络',
      description: 'ObjectOS 跑在你的环境里 —— 私有云、本地机房、甚至完全离线的内网。业务数据和 AI 提示词都留在企业边界内,链路上没有第三方。',
    },
  },
  capabilities: {
    eyebrow: '02 — 安全之上',
    heading: '让 AI 接得进来,但放不出去',
    subheading: '你平台上已有的身份、权限、审计、网络边界 —— 在 Agent 一接触数据的那一刻就全部生效。没有需要额外治理的新东西。',
  },
  personas: {
    eyebrow: '03 — 适用人群',
    heading: '为最终需要点头的三类人设计',
    itOps: {
      title: 'IT 与平台运维',
      description: '以 Docker 镜像和 Helm Chart 交付。对接你现在就在用的数据库、身份和可观测栈。同一份发布包,从笔记本到完全离线的数据中心表现一致。',
      action: '部署指南',
    },
    security: {
      title: '安全与合规',
      description: 'AI Agent 永远只能看到、做到背后那个用户能做的事。SSO、RBAC、字段级脱敏、完整审计在运行时强制 —— 人和 AI 的流量走同一套规则。',
      action: '权限模型',
    },
    business: {
      title: '业务负责人',
      description: '给团队一个真正懂你 CRM、合同、工单的 AI —— 因为它直连业务系统本身,不是一份导出的拷贝。客户数据从不出公司。',
      action: '架构总览',
    },
  },
  deployModes: {
    eyebrow: '01 — 部署',
    heading: '跑在你数据已经在的地方',
    subheading: '同一份发布包,同一种行为。挑一种贴合你基础设施的形态 —— ObjectOS 和它带来的 AI 访问能力,都留在你的网络内。',
    docker: {
      title: 'Docker',
      tagline: '单机单条命令',
      description: '一个容器对接你自己的数据库。适合评估、内部工具与小团队部署。',
      href: '/docs/deploy/docker',
      cta: 'Docker 指南',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: '生产级高可用',
      description: 'Deployment + Service + PersistentVolumeClaim,密钥和配置来自你已经在用的机制。提供 Helm Chart。',
      href: '/docs/deploy/kubernetes',
      cta: 'Kubernetes 指南',
    },
    airGapped: {
      title: '完全离线',
      tagline: '无公网出口',
      description: '把发布包送进完全离线的网络。ObjectOS 从本地文件读取工件,不向任何外部服务发起调用 —— AI 集成层同样如此。',
      href: '/docs/deploy/air-gapped',
      cta: '离线部署指南',
    },
  },
  bottomCta: {
    heading: '给 AI 一个它真正能用的业务系统。',
    subheading: '用 ObjectStack 定义一次业务对象,跑在 ObjectOS 上,让 AI 在你的规则下、你的网络内开始工作。',
    primary: '快速开始',
    primaryHref: '/docs/quickstart',
    secondary: '架构总览',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: '隐私政策',
    privacyHref: '/privacy',
    terms: '服务条款',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · 客服副驾',
    userLabel: '你',
    agentLabel: 'Agent',
    user1Line1: '哪些紧急工单已经超过 24 小时没关,',
    user1Line2: '分别是谁在跟?',
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  匹配到 3 条 —— 按负责人分组：',
    ticket1Meta: ' · 已开 31h · Maya  ',
    ticket1Note: '(账单中断)',
    ticket2Meta: ' · 已开 28h · Maya  ',
    ticket2Note: '(SSO 故障)',
    ticket3Meta: ' · 已开 26h · Jordan',
    ticket3Note: ' (导出 bug)',
    insight: '  Maya 一人扛 2/3 —— 很可能是瓶颈。',
    user2: '把三条都升级,Maya 的两条转给值班工程师。',
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ 优先级 → 紧急 · 值班已通知 · 已审计',
    governance: '  以你本人身份执行。权限与字段规则照常生效。',
  },
};

/**
 * Registry of available homepage translations. Locales absent here
 * (ja, de, es, fr until translated) resolve to English via the getter.
 */
const HOMEPAGE_TRANSLATIONS: Partial<Record<string, HomepageTranslations>> = {
  en,
  'zh-Hans': zhHans,
};

/**
 * Get translations for a specific language, falling back to English.
 */
export function getHomepageTranslations(lang: string): HomepageTranslations {
  return HOMEPAGE_TRANSLATIONS[lang] ?? en;
}
