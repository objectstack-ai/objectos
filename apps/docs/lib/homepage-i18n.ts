/**
 * Homepage Internationalization
 *
 * Translations for the ObjectOS homepage.
 *
 * Audience: enterprise IT, security/compliance, and business owners
 * evaluating a customer-hosted runtime for ObjectStack applications —
 * NOT framework developers.
 *
 * Supports: en (English), cn (Chinese / 中文)
 */

import { SPEC_VERSION } from './version';

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

  // Bottom CTA
  bottomCta: {
    heading: string;
    subheading: string;
    primary: string;
    primaryHref: string;
    secondary: string;
    secondaryHref: string;
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
    status: 'Customer-Hosted Runtime',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: 'Your Data.',
      line2: 'Your Network. Your Rules.',
    },
    subtitle: {
      line1: 'ObjectOS runs ObjectStack applications inside your own infrastructure — private cloud, customer data centers, or fully air-gapped networks.',
      line2: 'No vendor lock-in. No data leaving your perimeter.',
    },
    cta: {
      primary: 'Quickstart',
      primaryHref: '/docs/quickstart',
      secondary: 'Deployment Guide',
      secondaryHref: '/docs/deploy',
    },
    quickStart: {
      label: 'Terminal',
      commands: [
        'npm i -g @objectstack/cli',
        'os start',
      ],
    },
  },
  features: {
    selfHosted: {
      title: 'Self-Hosted Runtime',
      description: 'ObjectOS runs in your environment, on your servers, against your database. The control plane is optional; the runtime never depends on a public service to keep your application alive.',
    },
    deployAnywhere: {
      title: 'Docker, Kubernetes, Bare Metal',
      description: 'Single-container Docker for evaluation, Kubernetes for production HA, or a long-running process on your own hardware. Same artifact, same behavior in every environment.',
    },
    airGapped: {
      title: 'Air-Gapped Ready',
      description: 'Ship a release bundle into a network with no internet egress. ObjectOS reads its application artifact from a local file and never reaches out to a hosted service.',
    },
    identity: {
      title: 'Identity & SSO',
      description: 'Local email/password, OAuth, OIDC, SAML, or your corporate SSO. Plug in the identity provider you already operate; ObjectOS enforces the session.',
    },
    permissions: {
      title: 'Permissions & Field Security',
      description: 'Role-based access, record-level rules, and field-level redaction enforced at the runtime — not at the UI. Every read and write goes through the same policy engine.',
    },
    observability: {
      title: 'Audit, Backup, Observability',
      description: 'Every state change is auditable. Backups run against your own storage. Logs and metrics export to the observability stack you already use — no extra SaaS required.',
    },
  },
  personas: {
    heading: 'Who Is ObjectOS For?',
    itOps: {
      title: 'IT & Platform Operators',
      description: 'Deploy ObjectStack applications the same way you run the rest of your stack. Docker images, Helm charts, environment variables, and standard secrets management.',
      action: 'Deployment Guide',
    },
    security: {
      title: 'Security & Compliance',
      description: 'Keep regulated data inside your perimeter. Enforce SSO, RBAC, field-level security, and full audit. Ship to air-gapped environments without compromise.',
      action: 'Permissions Model',
    },
    business: {
      title: 'Business Owners',
      description: 'Run the applications your teams need — CRM, contracts, procurement, helpdesk — without handing customer data to a third party.',
      action: 'Architecture Overview',
    },
  },
  deployModes: {
    heading: 'Three Ways to Run It',
    subheading: 'Same artifact, same behavior. Pick the shape that matches your infrastructure.',
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
      description: 'Ship a release bundle into a network with no public connectivity. ObjectOS reads its artifact from disk and never calls home.',
      href: '/docs/deploy/air-gapped',
      cta: 'Air-gapped guide',
    },
  },
  bottomCta: {
    heading: 'Run it where your data already lives.',
    subheading: 'A single artifact, the same behavior everywhere — from a laptop to an air-gapped data center.',
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
};

/**
 * Chinese Translations (中文翻译)
 */
export const cn: HomepageTranslations = {
  badge: {
    status: '客户自托管运行时',
    version: SPEC_VERSION,
  },
  hero: {
    title: {
      line1: '你的数据，',
      line2: '你的网络，你的规则。',
    },
    subtitle: {
      line1: 'ObjectOS 让 ObjectStack 应用运行在你自己的基础设施上 —— 私有云、客户数据中心、或完全离线的内网环境。',
      line2: '无厂商锁定，数据不离开企业边界。',
    },
    cta: {
      primary: '快速开始',
      primaryHref: '/docs/quickstart',
      secondary: '部署指南',
      secondaryHref: '/docs/deploy',
    },
    quickStart: {
      label: '终端',
      commands: [
        'npm i -g @objectstack/cli',
        'os start',
      ],
    },
  },
  features: {
    selfHosted: {
      title: '自托管运行时',
      description: 'ObjectOS 运行在你的环境、你的服务器、你的数据库上。控制台是可选的 —— 运行时永远不依赖任何外部服务来保持应用在线。',
    },
    deployAnywhere: {
      title: 'Docker、Kubernetes、裸金属',
      description: '试用用单容器 Docker，生产用 Kubernetes 高可用，也可以直接跑在你自己的硬件上。同一个发布包,在任何环境表现一致。',
    },
    airGapped: {
      title: '离线环境就绪',
      description: '可以把发布包送进完全无公网出口的网络。ObjectOS 从本地文件读取应用工件,不向任何托管服务发起调用。',
    },
    identity: {
      title: '身份与单点登录',
      description: '本地账号、OAuth、OIDC、SAML 或企业既有的 SSO。对接你已经在运行的身份提供方,会话由 ObjectOS 统一管控。',
    },
    permissions: {
      title: '权限与字段安全',
      description: '基于角色的访问、行级规则、字段级脱敏,都在运行时执行 —— 而不是只挡在 UI 层。每一次读写都走同一套策略引擎。',
    },
    observability: {
      title: '审计、备份、可观测',
      description: '每一次状态变更可审计。备份写入你自己的存储。日志和指标导出到你正在用的可观测栈 —— 不需要再多一套 SaaS。',
    },
  },
  personas: {
    heading: 'ObjectOS 面向谁?',
    itOps: {
      title: 'IT 与平台运维',
      description: '用你管理其他系统的方式管理 ObjectStack 应用。Docker 镜像、Helm Chart、环境变量、标准密钥管理 —— 都是熟悉的工具。',
      action: '部署指南',
    },
    security: {
      title: '安全与合规',
      description: '让受监管的数据留在企业边界内。强制 SSO、RBAC、字段级安全、完整审计。可以部署到完全离线的内网,无需妥协。',
    action: '权限模型',
    },
    business: {
      title: '业务负责人',
      description: '把团队需要的应用 —— CRM、合同、采购、客服 —— 运行起来,而无需把客户数据交给第三方。',
      action: '架构总览',
    },
  },
  deployModes: {
    heading: '三种部署形态',
    subheading: '同一个发布包,同一种行为。挑一种贴合你基础设施的方式即可。',
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
      description: '把发布包送进完全离线的网络。ObjectOS 从本地文件读取工件,不向任何外部服务发起调用。',
      href: '/docs/deploy/air-gapped',
      cta: '离线部署指南',
    },
  },
  bottomCta: {
    heading: '让应用跑在你数据已经在的地方。',
    subheading: '一份发布包,在笔记本和完全离线的数据中心里表现一致。',
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
};

/**
 * Get translations for a specific language
 */
export function getHomepageTranslations(lang: string): HomepageTranslations {
  switch (lang) {
    case 'cn':
      return cn;
    case 'en':
    default:
      return en;
  }
}
