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
    connectSystems: {
      title: string;
      description: string;
    };
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
    connectSystems: {
      title: 'Extend the Systems You Already Run',
      description: 'Connect ObjectOS to your existing business databases, model the tables as objects, and add AI-native query, analysis, and automation on top — without migrating off your system of record. A coding agent can scan the schema and generate the objects for you.',
    },
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
    connectSystems: {
      title: '直接扩展你现有的业务系统',
      description: '把 ObjectOS 接到你现有的业务数据库,用对象描述这些表,就能在不迁移、不动原系统的前提下,叠加 AI 原生的查询、分析与自动化能力。还能让编码 Agent 扫描库表、自动生成这些对象。',
    },
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
 * Japanese (日本語) Translations
 */
export const ja: HomepageTranslations = {
  badge: {
    status: 'AI ネイティブのビジネスプラットフォーム',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'AI が本当に使える',
      line2: 'ビジネスプラットフォーム。',
    },
    subtitle: {
      line1: 'ObjectOS は、あなたのビジネスシステムのための AI ネイティブなランタイムです —— CRM、契約、チケット、承認など、ObjectStack メタデータプロトコルでモデル化したあらゆるものが対象です。',
      line2: 'ビジネスオブジェクトを ObjectOS に載せれば、AI エージェントはそのデータを安全に照会・分析し、操作できます —— あなたの権限のもとで、あなたのサーバー上で、すべての手順を監査しながら。',
    },
    cta: {
      primary: '仕組みを見る',
      primaryHref: '/docs/architecture',
      secondary: 'クイックスタート',
      secondaryHref: '/docs/quickstart',
    },
    quickStart: {
      label: 'ターミナル',
      commands: [
        'npm i -g @objectstack/cli',
        'os start',
      ],
    },
    trustStrip: {
      license: 'MIT ライセンス',
      selfHosted: 'セルフホスト',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · エアギャップ',
    },
  },
  features: {
    connectSystems: {
      title: 'すでに運用しているシステムを拡張',
      description: 'ObjectOS を既存のビジネスデータベースに接続し、テーブルをオブジェクトとしてモデル化すれば、システム・オブ・レコードから移行することなく、AI ネイティブな照会・分析・自動化をその上に追加できます。コーディングエージェントがスキーマをスキャンし、オブジェクトを自動生成することもできます。',
    },
    selfHosted: {
      title: 'すべてのオブジェクトが AI ツールに',
      description: 'ビジネスオブジェクトを ObjectStack メタデータで一度定義すれば、ObjectOS が自動的にそれをガバナンスの効いた呼び出し可能なツールとして AI エージェントに公開します —— 接着コードも、個別に保守する統合レイヤーも不要です。',
    },
    deployAnywhere: {
      title: 'AI はサインインしたユーザーとして動く',
      description: 'エージェントがデータを照会・更新するとき、それは呼び出し元の本人として実行されます。その人が見られるもの、できることだけをエージェントもでき、それ以上はありません。この境界はプロンプトではなく、ランタイムで強制されます。',
    },
    airGapped: {
      title: 'すべての操作を監査',
      description: 'すべての読み取り、すべての書き込み、すべてのエスカレーション —— 人によるものでもエージェントによるものでも —— 誰が、何を、いつ、なぜ行ったかが記録されます。コンプライアンスが確認するログは、2 つではなく 1 つです。',
    },
    identity: {
      title: 'あなたの ID 基盤に接続',
      description: 'OAuth、OIDC、SAML、社内 SSO、またはローカルアカウント。AI セッションは同じ ID、同じ MFA、同じオフボーディングを引き継ぎます —— 個別に統制すべき「AI アカウント」は存在しません。',
    },
    permissions: {
      title: '権限はランタイムで強制',
      description: 'ロールベースのアクセス、レコード単位のルール、フィールド単位のマスキングが ObjectOS 内部で実行されます —— だからリクエストが UI、API クライアント、AI エージェントのどこから来ても、同じポリシーが適用されます。',
    },
    observability: {
      title: 'あなたのデータ、あなたのネットワーク',
      description: 'ObjectOS はあなたの環境で動作します —— プライベートクラウド、オンプレミス、または完全なエアギャップ環境。ビジネスデータも AI プロンプトも、あなたの境界の内側にとどまります。途中に第三者は入りません。',
    },
  },
  capabilities: {
    eyebrow: '02 — 安全である理由',
    heading: 'コントロールを手放さずに AI アクセスを',
    subheading: 'あなたのプラットフォームがすでに備えるすべての安全策 —— ID、権限、監査、ネットワーク境界 —— が、エージェントがデータに触れた瞬間に適用されます。新たに統制すべきものはありません。',
  },
  personas: {
    eyebrow: '03 — 対象となる人',
    heading: '「ゴーサイン」を出す 3 者のために設計',
    itOps: {
      title: 'IT・プラットフォーム運用',
      description: 'Docker イメージと Helm チャートとして提供されます。あなたがすでに運用しているデータベース、ID、可観測性スタックに組み込めます。1 つの成果物が、ノート PC からエアギャップのデータセンターまで同じように動作します。',
      action: 'デプロイガイド',
    },
    security: {
      title: 'セキュリティ・コンプライアンス',
      description: 'AI エージェントは、その背後にいるユーザー以上のものを決して見たり実行したりできません。SSO、RBAC、フィールド単位のマスキング、完全な監査はランタイムで強制され —— 人と AI のトラフィックに同一に適用されます。',
      action: '権限モデル',
    },
    business: {
      title: 'ビジネスオーナー',
      description: 'あなたの CRM、契約、チケットを本当に理解した AI をチームに —— コピーではなく、システム・オブ・レコードそのものと対話するからです。顧客データが会社の外に出ることはありません。',
      action: 'アーキテクチャ概要',
    },
  },
  deployModes: {
    eyebrow: '01 — デプロイ',
    heading: 'データがすでにある場所で動く',
    subheading: '同じ成果物、同じ動作。あなたのインフラに合った形態を選んでください —— ObjectOS と、それがもたらす AI アクセスは、あなたのネットワーク内にとどまります。',
    docker: {
      title: 'Docker',
      tagline: '単一ホスト、単一コマンド',
      description: '1 つのコンテナをあなた自身のデータベースに接続。評価、社内ツール、小規模チームでの導入に最適です。',
      href: '/docs/deploy/docker',
      cta: 'Docker ガイド',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: '本番 HA',
      description: 'Deployment + Service + PersistentVolumeClaim。シークレットと設定は、あなたがすでに使っている仕組みから取り込めます。Helm チャートを同梱。',
      href: '/docs/deploy/kubernetes',
      cta: 'Kubernetes ガイド',
    },
    airGapped: {
      title: 'エアギャップ',
      tagline: 'インターネット送信なし',
      description: 'リリースバンドルを公衆接続のないネットワークへ持ち込みます。ObjectOS は成果物をディスクから読み込み、外部へ通信することはありません —— AI 連携面も同様です。',
      href: '/docs/deploy/air-gapped',
      cta: 'エアギャップガイド',
    },
  },
  bottomCta: {
    heading: 'AI が本当に使えるビジネスシステムを。',
    subheading: 'ObjectStack でオブジェクトを一度定義し、ObjectOS で動かす。AI に働いてもらいましょう —— あなたのルールのもとで、あなたのネットワークの内側で。',
    primary: 'クイックスタート',
    primaryHref: '/docs/quickstart',
    secondary: 'アーキテクチャ',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: 'プライバシーポリシー',
    privacyHref: '/privacy',
    terms: '利用規約',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · サポートコパイロット',
    userLabel: 'あなた',
    agentLabel: 'Agent',
    user1Line1: '24 時間以上オープンのままの緊急チケットはどれで、',
    user1Line2: '誰が担当している？',
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  3 件が該当 —— 担当者別にグループ化：',
    ticket1Meta: ' · 31h オープン · Maya  ',
    ticket1Note: '(請求障害)',
    ticket2Meta: ' · 28h オープン · Maya  ',
    ticket2Note: '(SSO 障害)',
    ticket3Meta: ' · 26h オープン · Jordan',
    ticket3Note: ' (エクスポート不具合)',
    insight: '  Maya が 2/3 を抱えています —— ボトルネックの可能性大。',
    user2: '3 件すべてをエスカレーションし、Maya の分はオンコール担当に再割り当てして。',
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ 優先度 → 緊急 · オンコールに通知 · 監査済み',
    governance: '  あなた本人として実行。権限とフィールドルールが適用されます。',
  },
};

/**
 * German (Deutsch) Translations
 */
export const de: HomepageTranslations = {
  badge: {
    status: 'KI-native Business-Plattform',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'Die Business-Plattform,',
      line2: 'die KI wirklich nutzen kann.',
    },
    subtitle: {
      line1: 'ObjectOS ist die KI-native Runtime für deine Business-Systeme — CRM, Verträge, Tickets, Freigaben, alles, was über das ObjectStack-Metadatenprotokoll modelliert ist.',
      line2: 'Lege deine Business-Objekte auf ObjectOS, und KI-Agenten können diese Daten sicher abfragen, analysieren und darauf handeln — unter deinen Berechtigungen, auf deinen Servern, mit jedem Schritt im Audit.',
    },
    cta: {
      primary: 'So funktioniert es',
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
      license: 'MIT-lizenziert',
      selfHosted: 'Self-hosted',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · Air-Gapped',
    },
  },
  features: {
    connectSystems: {
      title: 'Erweitere die Systeme, die du schon betreibst',
      description: 'Verbinde ObjectOS mit deinen bestehenden Business-Datenbanken, modelliere die Tabellen als Objekte und ergänze KI-native Abfrage, Analyse und Automatisierung obendrauf — ohne dein System of Record zu migrieren. Ein Coding-Agent kann das Schema scannen und die Objekte für dich generieren.',
    },
    selfHosted: {
      title: 'Jedes Objekt ist ein KI-Tool',
      description: 'Definiere ein Business-Objekt einmal in ObjectStack-Metadaten, und ObjectOS stellt es KI-Agenten automatisch als kontrolliertes, aufrufbares Tool bereit — kein Glue-Code, keine separate Integrationsschicht, die du pflegen musst.',
    },
    deployAnywhere: {
      title: 'KI handelt als der angemeldete Nutzer',
      description: 'Wenn ein Agent Daten abfragt oder aktualisiert, läuft er mit der Identität des Aufrufers. Was diese Person sehen oder tun darf, darf der Agent — nicht mehr. Die Grenze wird in der Runtime durchgesetzt, nicht im Prompt.',
    },
    airGapped: {
      title: 'Jede Aktion auditiert',
      description: 'Jeder Lesezugriff, jeder Schreibzugriff, jede Eskalation — durch einen Menschen oder einen Agenten — wird mit Wer, Was, Wann und Warum festgehalten. Compliance hat ein Log zu prüfen, nicht zwei.',
    },
    identity: {
      title: 'Bindet sich an deine Identität an',
      description: 'OAuth, OIDC, SAML, Unternehmens-SSO oder lokale Konten. KI-Sessions erben dieselbe Identität, dasselbe MFA, denselben Offboarding-Prozess — es gibt kein separates „KI-Konto“, das verwaltet werden muss.',
    },
    permissions: {
      title: 'Berechtigungen in der Runtime durchgesetzt',
      description: 'Rollenbasierter Zugriff, Regeln auf Datensatzebene und Redaktion auf Feldebene laufen innerhalb von ObjectOS — sodass dieselbe Policy gilt, egal ob eine Anfrage aus der UI, von einem API-Client oder von einem KI-Agenten kommt.',
    },
    observability: {
      title: 'Deine Daten, dein Netzwerk',
      description: 'ObjectOS läuft in deiner Umgebung — Private Cloud, On-Prem oder vollständig Air-Gapped. Business-Daten und KI-Prompts bleiben innerhalb deines Perimeters. Kein Dritter im Spiel.',
    },
  },
  capabilities: {
    eyebrow: '02 — Wie es sicher ist',
    heading: 'KI-Zugriff, ohne die Kontrolle abzugeben',
    subheading: 'Jede Schutzmaßnahme, die deine Plattform bereits hat — Identität, Berechtigungen, Audit, Netzwerkgrenze — greift in dem Moment, in dem ein Agent deine Daten berührt. Nichts Neues zu verwalten.',
  },
  personas: {
    eyebrow: '03 — Für wen es ist',
    heading: 'Gebaut für die drei Menschen, die Ja sagen müssen',
    itOps: {
      title: 'IT & Plattform-Betrieb',
      description: 'Wird als Docker-Image und Helm-Chart ausgeliefert. Bindet sich an die Datenbank, Identität und den Observability-Stack an, die du bereits betreibst. Ein Artefakt läuft gleich — vom Laptop bis zum Air-Gapped-Rechenzentrum.',
      action: 'Deployment-Leitfaden',
    },
    security: {
      title: 'Security & Compliance',
      description: 'KI-Agenten können nie mehr sehen oder tun als der Nutzer hinter ihnen. SSO, RBAC, Redaktion auf Feldebene und vollständiges Audit werden in der Runtime durchgesetzt — und gelten identisch für menschlichen und KI-Traffic.',
      action: 'Berechtigungsmodell',
    },
    business: {
      title: 'Business-Verantwortliche',
      description: 'Gib deinen Teams eine KI, die dein CRM, deine Verträge, deine Tickets wirklich kennt — weil sie mit dem System of Record spricht, nicht mit einer Kopie. Kundendaten verlassen dein Unternehmen nie.',
      action: 'Architektur-Überblick',
    },
  },
  deployModes: {
    eyebrow: '01 — Deploy',
    heading: 'Läuft, wo deine Daten ohnehin liegen',
    subheading: 'Dasselbe Artefakt, dasselbe Verhalten. Wähle die Form, die zu deiner Infrastruktur passt — ObjectOS und der KI-Zugriff, der dazugehört, bleiben in deinem Netzwerk.',
    docker: {
      title: 'Docker',
      tagline: 'Ein Host, ein Befehl',
      description: 'Ein Container gegen deine eigene Datenbank. Ideal für Evaluierung, interne Tools und Deployments für kleine Teams.',
      href: '/docs/deploy/docker',
      cta: 'Docker-Leitfaden',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: 'Produktions-HA',
      description: 'Deployment + Service + PersistentVolumeClaim, mit Secrets und Config aus den Mechanismen, die du bereits nutzt. Helm-Chart inklusive.',
      href: '/docs/deploy/kubernetes',
      cta: 'Kubernetes-Leitfaden',
    },
    airGapped: {
      title: 'Air-Gapped',
      tagline: 'Kein Internet-Egress',
      description: 'Liefere ein Release-Bundle in ein Netzwerk ohne öffentliche Konnektivität. ObjectOS liest sein Artefakt von der Festplatte und ruft nie nach Hause — einschließlich der KI-Integrationsfläche.',
      href: '/docs/deploy/air-gapped',
      cta: 'Air-Gapped-Leitfaden',
    },
  },
  bottomCta: {
    heading: 'Gib der KI ein Business-System, das sie wirklich nutzen kann.',
    subheading: 'Definiere deine Objekte einmal mit ObjectStack. Betreibe sie auf ObjectOS. Lass die KI arbeiten — nach deinen Regeln, in deinem Netzwerk.',
    primary: 'Quickstart',
    primaryHref: '/docs/quickstart',
    secondary: 'Architektur',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: 'Datenschutzerklärung',
    privacyHref: '/privacy',
    terms: 'Nutzungsbedingungen',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · Support-Copilot',
    userLabel: 'Du',
    agentLabel: 'Agent',
    user1Line1: 'Welche dringenden Tickets sind seit über 24 h offen,',
    user1Line2: 'und wer ist verantwortlich?',
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  3 Tickets passen — gruppiert nach Bearbeiter:',
    ticket1Meta: ' · 31h offen · Maya  ',
    ticket1Note: '(Abrechnungsausfall)',
    ticket2Meta: ' · 28h offen · Maya  ',
    ticket2Note: '(SSO-Ausfall)',
    ticket3Meta: ' · 26h offen · Jordan',
    ticket3Note: ' (Export-Bug)',
    insight: '  Maya trägt 2/3 — wahrscheinlich der Engpass.',
    user2: 'Eskaliere alle drei und weise Mayas dem Bereitschaftsdienst zu.',
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ Priorität → dringend · Bereitschaft benachrichtigt · auditiert',
    governance: '  Läuft als du. Berechtigungen + Feldregeln durchgesetzt.',
  },
};

/**
 * Spanish (Español) Translations
 */
export const es: HomepageTranslations = {
  badge: {
    status: 'Plataforma de negocio AI-native',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'La plataforma de negocio',
      line2: 'que la IA sí puede usar.',
    },
    subtitle: {
      line1: 'ObjectOS es el runtime AI-native para tus sistemas de negocio — CRM, contratos, tickets, aprobaciones, cualquier cosa modelada con el protocolo de metadatos de ObjectStack.',
      line2: 'Pon tus objetos de negocio en ObjectOS y los agentes de IA podrán consultar, analizar y actuar sobre esos datos de forma segura — bajo tus permisos, en tus servidores, con cada paso auditado.',
    },
    cta: {
      primary: 'Mira cómo funciona',
      primaryHref: '/docs/architecture',
      secondary: 'Inicio rápido',
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
      license: 'Licencia MIT',
      selfHosted: 'Autoalojado',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · Air-gapped',
    },
  },
  features: {
    connectSystems: {
      title: 'Extiende los sistemas que ya operas',
      description: 'Conecta ObjectOS a tus bases de datos de negocio existentes, modela las tablas como objetos y añade encima consulta, análisis y automatización AI-native — sin migrar fuera de tu sistema de registro. Un agente de programación puede escanear el esquema y generar los objetos por ti.',
    },
    selfHosted: {
      title: 'Cada objeto es una herramienta de IA',
      description: 'Define un objeto de negocio una sola vez en los metadatos de ObjectStack, y ObjectOS lo expone automáticamente a los agentes de IA como una herramienta gobernada e invocable — sin código de pegamento, sin una capa de integración aparte que mantener.',
    },
    deployAnywhere: {
      title: 'La IA actúa como el usuario autenticado',
      description: 'Cuando un agente consulta o actualiza datos, se ejecuta con la identidad de quien lo invoca. Lo que esa persona puede ver o hacer, el agente puede hacerlo — nada más. El límite se impone en el runtime, no en el prompt.',
    },
    airGapped: {
      title: 'Cada acción auditada',
      description: 'Cada lectura, cada escritura, cada escalación — por una persona o un agente — queda registrada con el quién, qué, cuándo y por qué. Cumplimiento tiene un solo registro que revisar, no dos.',
    },
    identity: {
      title: 'Se integra con tu identidad',
      description: 'OAuth, OIDC, SAML, SSO corporativo o cuentas locales. Las sesiones de IA heredan la misma identidad, el mismo MFA, el mismo proceso de baja — no hay una "cuenta de IA" aparte que gobernar.',
    },
    permissions: {
      title: 'Permisos impuestos en el runtime',
      description: 'El acceso basado en roles, las reglas a nivel de registro y la ocultación a nivel de campo se ejecutan dentro de ObjectOS — así que la misma política aplica venga la petición de la UI, de un cliente de API o de un agente de IA.',
    },
    observability: {
      title: 'Tus datos, tu red',
      description: 'ObjectOS se ejecuta en tu entorno — nube privada, on-premise o completamente air-gapped. Los datos de negocio y los prompts de IA permanecen dentro de tu perímetro. Ningún tercero en el medio.',
    },
  },
  capabilities: {
    eyebrow: '02 — Por qué es seguro',
    heading: 'Acceso de IA, sin renunciar al control',
    subheading: 'Cada salvaguarda que tu plataforma ya tiene — identidad, permisos, auditoría, límite de red — aplica desde el momento en que un agente toca tus datos. Nada nuevo que gobernar.',
  },
  personas: {
    eyebrow: '03 — Para quién es',
    heading: 'Diseñado para las tres personas que tienen que decir que sí',
    itOps: {
      title: 'IT y operadores de plataforma',
      description: 'Se entrega como una imagen de Docker y un Helm chart. Se integra con la base de datos, la identidad y el stack de observabilidad que ya operas. Un solo artefacto se ejecuta igual desde un portátil hasta un centro de datos air-gapped.',
      action: 'Guía de despliegue',
    },
    security: {
      title: 'Seguridad y cumplimiento',
      description: 'Los agentes de IA nunca pueden ver ni hacer más que el usuario detrás de ellos. SSO, RBAC, ocultación a nivel de campo y auditoría completa se imponen en el runtime — y aplican de forma idéntica al tráfico humano y al de IA.',
      action: 'Modelo de permisos',
    },
    business: {
      title: 'Responsables de negocio',
      description: 'Dale a tus equipos una IA que realmente conoce tu CRM, tus contratos, tus tickets — porque habla con el sistema de registro, no con una copia. Los datos de los clientes nunca salen de tu empresa.',
      action: 'Visión de la arquitectura',
    },
  },
  deployModes: {
    eyebrow: '01 — Despliega',
    heading: 'Se ejecuta donde tus datos ya viven',
    subheading: 'Mismo artefacto, mismo comportamiento. Elige la forma que encaje con tu infraestructura — ObjectOS, y el acceso de IA que trae consigo, se quedan dentro de tu red.',
    docker: {
      title: 'Docker',
      tagline: 'Un host, un comando',
      description: 'Un contenedor contra tu propia base de datos. Ideal para evaluación, herramientas internas y despliegues de equipos pequeños.',
      href: '/docs/deploy/docker',
      cta: 'Guía de Docker',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: 'Alta disponibilidad en producción',
      description: 'Deployment + Service + PersistentVolumeClaim, con secretos y configuración desde los mecanismos que ya usas. Helm chart incluido.',
      href: '/docs/deploy/kubernetes',
      cta: 'Guía de Kubernetes',
    },
    airGapped: {
      title: 'Air-Gapped',
      tagline: 'Sin salida a internet',
      description: 'Lleva un paquete de release a una red sin conectividad pública. ObjectOS lee su artefacto desde disco y nunca llama a casa — incluida la superficie de integración con IA.',
      href: '/docs/deploy/air-gapped',
      cta: 'Guía air-gapped',
    },
  },
  bottomCta: {
    heading: 'Dale a la IA un sistema de negocio que sí pueda usar.',
    subheading: 'Define tus objetos una sola vez con ObjectStack. Ejecútalos en ObjectOS. Deja que la IA trabaje — bajo tus reglas, dentro de tu red.',
    primary: 'Inicio rápido',
    primaryHref: '/docs/quickstart',
    secondary: 'Arquitectura',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: 'Política de privacidad',
    privacyHref: '/privacy',
    terms: 'Términos del servicio',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · Copiloto de soporte',
    userLabel: 'Tú',
    agentLabel: 'Agente',
    user1Line1: 'Qué tickets urgentes llevan abiertos más de 24h,',
    user1Line2: '¿y quién es el responsable?',
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  3 tickets coinciden — agrupados por responsable:',
    ticket1Meta: ' · 31h abierto · Maya  ',
    ticket1Note: '(corte de facturación)',
    ticket2Meta: ' · 28h abierto · Maya  ',
    ticket2Note: '(fallo de SSO)',
    ticket3Meta: ' · 26h abierto · Jordan',
    ticket3Note: ' (bug de exportación)',
    insight: '  Maya carga con 2/3 — probablemente el cuello de botella.',
    user2: 'Escala los tres y reasigna los de Maya a quien esté de guardia.',
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ prioridad → urgente · guardia notificada · auditado',
    governance: '  Se ejecuta como tú. Permisos + reglas de campo impuestos.',
  },
};

/**
 * French (Français) Translations
 */
export const fr: HomepageTranslations = {
  badge: {
    status: 'Plateforme métier AI-native',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'La plateforme métier',
      line2: 'que l’IA peut vraiment utiliser.',
    },
    subtitle: {
      line1: 'ObjectOS est le runtime AI-native de vos systèmes métier — CRM, contrats, tickets, approbations, tout ce qui est modélisé sur le protocole de métadonnées ObjectStack.',
      line2: 'Placez vos objets métier sur ObjectOS et les agents IA peuvent interroger, analyser et agir sur ces données en toute sécurité — sous vos permissions, sur vos serveurs, chaque étape étant auditée.',
    },
    cta: {
      primary: 'Voir comment ça marche',
      primaryHref: '/docs/architecture',
      secondary: 'Démarrage rapide',
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
      license: 'Sous licence MIT',
      selfHosted: 'Auto-hébergé',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · Air-gapped',
    },
  },
  features: {
    connectSystems: {
      title: 'Étendez les systèmes que vous exploitez déjà',
      description: 'Connectez ObjectOS à vos bases de données métier existantes, modélisez les tables sous forme d’objets et ajoutez par-dessus des capacités AI-native de requête, d’analyse et d’automatisation — sans migrer hors de votre système de référence. Un agent de code peut scanner le schéma et générer les objets pour vous.',
    },
    selfHosted: {
      title: 'Chaque objet est un outil pour l’IA',
      description: 'Définissez un objet métier une seule fois dans les métadonnées ObjectStack, et ObjectOS l’expose automatiquement aux agents IA comme un outil gouverné et appelable — sans code de liaison, sans couche d’intégration séparée à maintenir.',
    },
    deployAnywhere: {
      title: 'L’IA agit en tant qu’utilisateur connecté',
      description: 'Lorsqu’un agent interroge ou met à jour des données, il s’exécute avec l’identité de l’appelant. Tout ce que cette personne est autorisée à voir ou à faire, l’agent le peut — rien de plus. La frontière est appliquée dans le runtime, pas dans le prompt.',
    },
    airGapped: {
      title: 'Chaque action auditée',
      description: 'Chaque lecture, chaque écriture, chaque escalade — par un humain ou un agent — est enregistrée avec le qui, le quoi, le quand et le pourquoi. La conformité n’a qu’un seul journal à consulter, pas deux.',
    },
    identity: {
      title: 'S’intègre à votre identité',
      description: 'OAuth, OIDC, SAML, SSO d’entreprise ou comptes locaux. Les sessions IA héritent de la même identité, du même MFA, du même offboarding — il n’y a pas de « compte IA » distinct à gouverner.',
    },
    permissions: {
      title: 'Permissions appliquées dans le runtime',
      description: 'L’accès basé sur les rôles, les règles au niveau des enregistrements et le masquage au niveau des champs s’exécutent à l’intérieur d’ObjectOS — la même politique s’applique donc que la requête provienne de l’UI, d’un client API ou d’un agent IA.',
    },
    observability: {
      title: 'Vos données, votre réseau',
      description: 'ObjectOS s’exécute dans votre environnement — cloud privé, on-prem ou entièrement air-gapped. Les données métier et les prompts IA restent à l’intérieur de votre périmètre. Aucun tiers dans la boucle.',
    },
  },
  capabilities: {
    eyebrow: '02 — La sécurité',
    heading: 'L’accès de l’IA, sans renoncer au contrôle',
    subheading: 'Chaque garde-fou que votre plateforme possède déjà — identité, permissions, audit, frontière réseau — s’applique dès l’instant où un agent touche vos données. Rien de nouveau à gouverner.',
  },
  personas: {
    eyebrow: '03 — À qui ça s’adresse',
    heading: 'Conçu pour les trois personnes qui doivent dire oui',
    itOps: {
      title: 'IT & exploitants de plateforme',
      description: 'Livré sous forme d’image Docker et de chart Helm. S’intègre à la base de données, à l’identité et à la pile d’observabilité que vous exploitez déjà. Un seul artefact se comporte de façon identique, du portable au centre de données air-gapped.',
      action: 'Guide de déploiement',
    },
    security: {
      title: 'Sécurité & conformité',
      description: 'Les agents IA ne peuvent jamais voir ni faire plus que l’utilisateur derrière eux. SSO, RBAC, masquage au niveau des champs et audit complet sont appliqués dans le runtime — et s’appliquent à l’identique au trafic humain et au trafic IA.',
      action: 'Modèle de permissions',
    },
    business: {
      title: 'Responsables métier',
      description: 'Offrez à vos équipes une IA qui connaît vraiment votre CRM, vos contrats, vos tickets — parce qu’elle dialogue avec le système de référence, pas avec une copie. Les données clients ne quittent jamais votre entreprise.',
      action: 'Vue d’ensemble de l’architecture',
    },
  },
  deployModes: {
    eyebrow: '01 — Déployer',
    heading: 'S’exécute là où vivent déjà vos données',
    subheading: 'Même artefact, même comportement. Choisissez la forme qui correspond à votre infrastructure — ObjectOS, et l’accès IA qui l’accompagne, reste à l’intérieur de votre réseau.',
    docker: {
      title: 'Docker',
      tagline: 'Un hôte, une seule commande',
      description: 'Un conteneur connecté à votre propre base de données. Idéal pour l’évaluation, les outils internes et les déploiements en petite équipe.',
      href: '/docs/deploy/docker',
      cta: 'Guide Docker',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: 'Haute disponibilité en production',
      description: 'Deployment + Service + PersistentVolumeClaim, avec secrets et configuration issus des mécanismes que vous utilisez déjà. Chart Helm inclus.',
      href: '/docs/deploy/kubernetes',
      cta: 'Guide Kubernetes',
    },
    airGapped: {
      title: 'Air-gapped',
      tagline: 'Aucune sortie internet',
      description: 'Livrez un bundle de release dans un réseau sans connectivité publique. ObjectOS lit son artefact depuis le disque et ne contacte jamais l’extérieur — y compris la surface d’intégration IA.',
      href: '/docs/deploy/air-gapped',
      cta: 'Guide air-gapped',
    },
  },
  bottomCta: {
    heading: 'Donnez à l’IA un système métier qu’elle peut vraiment utiliser.',
    subheading: 'Définissez vos objets une seule fois avec ObjectStack. Exécutez-les sur ObjectOS. Laissez l’IA travailler — sous vos règles, à l’intérieur de votre réseau.',
    primary: 'Démarrage rapide',
    primaryHref: '/docs/quickstart',
    secondary: 'Architecture',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: 'Politique de confidentialité',
    privacyHref: '/privacy',
    terms: 'Conditions d’utilisation',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · Copilote de support',
    userLabel: 'Vous',
    agentLabel: 'Agent',
    user1Line1: 'Quels tickets urgents sont ouverts depuis plus de 24 h,',
    user1Line2: 'et qui en a la charge ?',
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  3 tickets correspondent — groupés par responsable :',
    ticket1Meta: ' · ouvert 31h · Maya  ',
    ticket1Note: '(panne de facturation)',
    ticket2Meta: ' · ouvert 28h · Maya  ',
    ticket2Note: '(échec SSO)',
    ticket3Meta: ' · ouvert 26h · Jordan',
    ticket3Note: ' (bug d’export)',
    insight: '  Maya en porte 2/3 — probablement le goulot d’étranglement.',
    user2: 'Escalade les trois et réassigne ceux de Maya à l’astreinte.',
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ priorité → urgent · astreinte notifiée · audité',
    governance: '  S’exécute en votre nom. Permissions + règles de champs appliquées.',
  },
};

/**
 * Korean (한국어) Translations
 */
export const ko: HomepageTranslations = {
  badge: {
    status: 'AI 네이티브 비즈니스 플랫폼',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'AI가 실제로 쓸 수 있는',
      line2: '비즈니스 플랫폼.',
    },
    subtitle: {
      line1: 'ObjectOS는 여러분의 비즈니스 시스템을 위한 AI 네이티브 런타임입니다 — CRM, 계약, 티켓, 승인 등 ObjectStack 메타데이터 프로토콜로 모델링된 모든 것을 담습니다.',
      line2: '비즈니스 객체를 ObjectOS 위에 올리면, AI 에이전트가 그 데이터를 안전하게 조회하고 분석하고 실행할 수 있습니다 — 여러분의 권한 아래, 여러분의 서버에서, 모든 단계가 감사된 채로.',
    },
    cta: {
      primary: '작동 방식 보기',
      primaryHref: '/docs/architecture',
      secondary: '빠른 시작',
      secondaryHref: '/docs/quickstart',
    },
    quickStart: {
      label: '터미널',
      commands: [
        'npm i -g @objectstack/cli',
        'os start',
      ],
    },
    trustStrip: {
      license: 'MIT 라이선스',
      selfHosted: '자체 호스팅',
      version: OBJECTOS_VERSION,
      runtime: 'Docker · Kubernetes · 에어갭',
    },
  },
  features: {
    connectSystems: {
      title: '이미 운영 중인 시스템을 그대로 확장',
      description: 'ObjectOS를 기존 비즈니스 데이터베이스에 연결하고, 테이블을 객체로 모델링한 뒤, 그 위에 AI 네이티브 조회·분석·자동화를 더하세요 — 기록 시스템을 옮길 필요가 없습니다. 코딩 에이전트가 스키마를 스캔해 객체를 대신 생성해 줄 수 있습니다.',
    },
    selfHosted: {
      title: '모든 객체가 곧 AI 도구',
      description: 'ObjectStack 메타데이터에서 비즈니스 객체를 한 번 정의하면, ObjectOS가 자동으로 그것을 거버넌스된, 호출 가능한 도구로 AI 에이전트에 노출합니다 — 글루 코드도, 따로 유지보수할 통합 계층도 필요 없습니다.',
    },
    deployAnywhere: {
      title: 'AI는 로그인한 사용자로서 행동합니다',
      description: '에이전트가 데이터를 조회하거나 업데이트할 때, 그것은 호출자의 신원으로 실행됩니다. 그 사람이 보거나 할 수 있는 것까지만 에이전트도 할 수 있고, 그 이상은 안 됩니다. 이 경계는 프롬프트가 아니라 런타임에서 강제됩니다.',
    },
    airGapped: {
      title: '모든 작업이 감사됩니다',
      description: '모든 읽기, 모든 쓰기, 모든 에스컬레이션 — 사람이든 에이전트든 — 은 누가, 무엇을, 언제, 왜 했는지와 함께 기록됩니다. 컴플라이언스는 두 개가 아니라 하나의 로그만 보면 됩니다.',
    },
    identity: {
      title: '여러분의 신원 체계에 그대로 연결',
      description: 'OAuth, OIDC, SAML, 기업 SSO 또는 로컬 계정. AI 세션은 동일한 신원, 동일한 MFA, 동일한 오프보딩을 그대로 따릅니다 — 따로 관리할 "AI 계정" 같은 건 없습니다.',
    },
    permissions: {
      title: '권한은 런타임에서 강제됩니다',
      description: '역할 기반 접근, 레코드 수준 규칙, 필드 수준 마스킹이 ObjectOS 내부에서 실행됩니다 — 요청이 UI에서 오든, API 클라이언트에서 오든, AI 에이전트에서 오든 동일한 정책이 적용됩니다.',
    },
    observability: {
      title: '여러분의 데이터, 여러분의 네트워크',
      description: 'ObjectOS는 여러분의 환경에서 실행됩니다 — 프라이빗 클라우드, 온프레미스, 또는 완전한 에어갭. 비즈니스 데이터와 AI 프롬프트는 여러분의 경계 안에 머뭅니다. 중간에 제3자는 없습니다.',
    },
  },
  capabilities: {
    eyebrow: '02 — 어떻게 안전한가',
    heading: '통제를 포기하지 않는 AI 접근',
    subheading: '플랫폼이 이미 갖춘 모든 보호 장치 — 신원, 권한, 감사, 네트워크 경계 — 가 에이전트가 데이터에 닿는 그 순간 적용됩니다. 새로 관리할 것은 없습니다.',
  },
  personas: {
    eyebrow: '03 — 누구를 위한 것인가',
    heading: '결국 승인해야 하는 세 사람을 위해 설계',
    itOps: {
      title: 'IT 및 플랫폼 운영자',
      description: 'Docker 이미지와 Helm 차트로 제공됩니다. 이미 운영 중인 데이터베이스, 신원, 관측성 스택에 그대로 연결됩니다. 하나의 산출물이 노트북에서든 에어갭 데이터 센터에서든 동일하게 실행됩니다.',
      action: '배포 가이드',
    },
    security: {
      title: '보안 및 컴플라이언스',
      description: 'AI 에이전트는 그 뒤의 사용자보다 더 보거나 더 할 수 없습니다. SSO, RBAC, 필드 수준 마스킹, 완전한 감사가 런타임에서 강제되며 — 사람과 AI 트래픽에 동일하게 적용됩니다.',
      action: '권한 모델',
    },
    business: {
      title: '비즈니스 책임자',
      description: '팀에게 여러분의 CRM, 계약, 티켓을 진짜로 아는 AI를 주세요 — 복사본이 아니라 기록 시스템과 직접 대화하기 때문입니다. 고객 데이터는 결코 회사 밖으로 나가지 않습니다.',
      action: '아키텍처 개요',
    },
  },
  deployModes: {
    eyebrow: '01 — 배포',
    heading: '데이터가 이미 있는 곳에서 실행',
    subheading: '동일한 산출물, 동일한 동작. 여러분의 인프라에 맞는 형태를 고르세요 — ObjectOS와 그것이 가져오는 AI 접근은 여러분의 네트워크 안에 머뭅니다.',
    docker: {
      title: 'Docker',
      tagline: '단일 호스트, 단일 명령',
      description: '여러분의 데이터베이스에 연결되는 컨테이너 하나. 평가, 내부 도구, 소규모 팀 배포에 이상적입니다.',
      href: '/docs/deploy/docker',
      cta: 'Docker 가이드',
    },
    kubernetes: {
      title: 'Kubernetes',
      tagline: '프로덕션 HA',
      description: 'Deployment + Service + PersistentVolumeClaim, 시크릿과 설정은 이미 쓰고 있는 방식 그대로. Helm 차트 포함.',
      href: '/docs/deploy/kubernetes',
      cta: 'Kubernetes 가이드',
    },
    airGapped: {
      title: '에어갭',
      tagline: '인터넷 송신 없음',
      description: '공개 연결이 전혀 없는 네트워크로 릴리스 번들을 들여보내세요. ObjectOS는 디스크에서 산출물을 읽으며 절대 외부로 호출하지 않습니다 — AI 통합 영역도 마찬가지입니다.',
      href: '/docs/deploy/air-gapped',
      cta: '에어갭 가이드',
    },
  },
  bottomCta: {
    heading: 'AI에게 진짜로 쓸 수 있는 비즈니스 시스템을 주세요.',
    subheading: 'ObjectStack으로 객체를 한 번 정의하고, ObjectOS에서 실행하세요. AI가 일하게 하세요 — 여러분의 규칙 아래, 여러분의 네트워크 안에서.',
    primary: '빠른 시작',
    primaryHref: '/docs/quickstart',
    secondary: '아키텍처',
    secondaryHref: '/docs/architecture',
  },
  footer: {
    copyright: '© 2026 ObjectStack AI LLC.',
    privacy: '개인정보 처리방침',
    privacyHref: '/privacy',
    terms: '서비스 약관',
    termsHref: '/terms',
  },
  agentPreview: {
    windowTitle: 'Console · 고객지원 코파일럿',
    userLabel: '나',
    agentLabel: 'Agent',
    user1Line1: '24시간 넘게 열려 있는 긴급 티켓은 어떤 거고,',
    user1Line2: '각각 누가 맡고 있어?',
    tool1Name: 'query_data',
    tool1Target: ' · support_ticket',
    matchSummary: '  3건 일치 — 담당자별 그룹화:',
    ticket1Meta: ' · 31h 열림 · Maya  ',
    ticket1Note: '(결제 장애)',
    ticket2Meta: ' · 28h 열림 · Maya  ',
    ticket2Note: '(SSO 실패)',
    ticket3Meta: ' · 26h 열림 · Jordan',
    ticket3Note: ' (내보내기 버그)',
    insight: '  Maya가 3건 중 2건을 떠안고 있음 — 병목일 가능성이 큼.',
    user2: '세 건 모두 에스컬레이션하고, Maya 건은 온콜에게 재배정해.',
    tool2Name: 'action_escalate_ticket',
    tool2Count: ' ×3 · ',
    tool2Sep: '',
    tool3Name: 'action_reassign',
    tool3Count: ' ×2',
    actionResult: '  ✓ 우선순위 → 긴급 · 온콜 통보 완료 · 감사됨',
    governance: '  나로서 실행됨. 권한 + 필드 규칙 그대로 적용.',
  },
};

/**
 * Registry of available homepage translations. Locales absent here
 * (ja, de, es, fr until translated) resolve to English via the getter.
 */
const HOMEPAGE_TRANSLATIONS: Partial<Record<string, HomepageTranslations>> = {
  en,
  'zh-Hans': zhHans,
  ja,
  de,
  es,
  fr,
  ko,
};

/**
 * Get translations for a specific language, falling back to English.
 */
export function getHomepageTranslations(lang: string): HomepageTranslations {
  return HOMEPAGE_TRANSLATIONS[lang] ?? en;
}
