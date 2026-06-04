import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export const gitConfig = {
  user: 'objectstack-ai',
  repo: 'objectos',
  branch: 'main',
};

const NAV_LABELS: Record<string, { website: string; docs: string; download: string; changelog: string }> = {
  en: { website: 'Website', docs: 'Docs', download: 'Download', changelog: 'Changelog' },
  'zh-Hans': { website: '官网', docs: '文档', download: '下载', changelog: '更新日志' },
  ja: { website: '公式サイト', docs: 'ドキュメント', download: 'ダウンロード', changelog: '変更履歴' },
  de: { website: 'Website', docs: 'Dokumentation', download: 'Download', changelog: 'Änderungen' },
  es: { website: 'Sitio web', docs: 'Documentación', download: 'Descargar', changelog: 'Cambios' },
  fr: { website: 'Site web', docs: 'Documentation', download: 'Télécharger', changelog: 'Journal' },
  ko: { website: '웹사이트', docs: '문서', download: '다운로드', changelog: '변경 내역' },
};

const RELEASES_URL = 'https://github.com/objectstack-ai/objectos/releases';
const WEBSITE_URL = 'https://www.objectos.ai';

function localePrefix(lang: string): string {
  return lang === 'en' ? '' : `/${lang}`;
}

export function baseOptions(lang: string = 'en'): BaseLayoutProps {
  const labels = NAV_LABELS[lang] ?? NAV_LABELS.en;
  const prefix = localePrefix(lang);

  return {
    nav: {
      url: WEBSITE_URL,
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
        text: labels.website,
        url: WEBSITE_URL,
        external: true,
      },
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
