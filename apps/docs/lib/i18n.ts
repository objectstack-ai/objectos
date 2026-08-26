import { defineI18n } from 'fumadocs-core/i18n';

/**
 * i18n Configuration for ObjectStack Documentation
 *
 * Supported Languages (BCP 47 tags):
 * - en:      English (Default)
 * - zh-Hans: Chinese, Simplified (简体中文)
 * - zh-Hant: Chinese, Traditional (繁體中文) — generated from zh-Hans,
 *            see apps/docs/scripts/gen-zh-hant.mjs
 * - ja:      Japanese (日本語)
 * - de:      German (Deutsch)
 * - es:      Spanish (Español)
 * - fr:      French (Français)
 * - ko:      Korean (한국어)
 */
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'zh-Hans', 'zh-Hant', 'ja', 'de', 'es', 'fr', 'ko'],
  // Hide locale prefix for default language (e.g., /docs instead of /en/docs)
  hideLocale: 'default-locale',
});
