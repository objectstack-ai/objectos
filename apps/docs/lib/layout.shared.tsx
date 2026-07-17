import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export const gitConfig = {
  user: 'objectstack-ai',
  repo: 'objectos',
  branch: 'main',
};

const WEBSITE_URL = 'https://www.objectos.ai';

export function baseOptions(lang: string = 'en'): BaseLayoutProps {
  void lang;

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
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
