import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export const gitConfig = {
  user: 'objectstack-ai',
  repo: 'spec',
  branch: 'main',
};

const NAV_LABELS: Record<string, { docs: string; download: string; changelog: string }> = {
  en: { docs: 'Docs', download: 'Download', changelog: 'Changelog' },
  'zh-Hans': { docs: '文档', download: '下载', changelog: '更新日志' },
  ja: { docs: 'ドキュメント', download: 'ダウンロード', changelog: '変更履歴' },
  de: { docs: 'Dokumentation', download: 'Download', changelog: 'Änderungen' },
  es: { docs: 'Documentación', download: 'Descargar', changelog: 'Cambios' },
  fr: { docs: 'Documentation', download: 'Télécharger', changelog: 'Journal' },
  ko: { docs: '문서', download: '다운로드', changelog: '변경 내역' },
};

const RELEASES_URL = 'https://github.com/objectstack-ai/objectos/releases';

function localePrefix(lang: string): string {
  return lang === 'en' ? '' : `/${lang}`;
}

export function baseOptions(lang: string = 'en'): BaseLayoutProps {
  const labels = NAV_LABELS[lang] ?? NAV_LABELS.en;
  const prefix = localePrefix(lang);

  return {
    nav: {
      title: (
        <div className="flex items-center gap-2 font-bold">
          <Image
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            width={30}
            height={30}
          />
          ObjectOS
        </div>
      ),
      transparentMode: 'top',
    },
    links: [
      {
        text: labels.docs,
        url: `${prefix}/docs`,
        active: 'nested-url',
      },
      {
        text: labels.download,
        url: `${prefix}/download`,
        active: 'nested-url',
      },
      {
        text: labels.changelog,
        url: RELEASES_URL,
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
