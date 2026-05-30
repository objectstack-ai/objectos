import { notFound } from 'next/navigation';
import { blog } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Extended type for blog post data
interface BlogPostData {
  title: string;
  description?: string;
  author?: string;
  date?: string;
  tags?: string[];
  body: React.ComponentType;
}

const components = getMDXComponents() as any;

// Locale-aware UI strings for the blog chrome. Post bodies are translated
// via per-locale MDX files; these are the surrounding labels.
const BLOG_UI: Record<
  string,
  { title: string; subtitle: string; by: string; back: string; empty: string; dateLocale: string }
> = {
  en: { title: 'Blog', subtitle: 'Insights, updates, and best practices from the ObjectStack team.', by: 'By', back: 'Back to Blog', empty: 'No blog posts yet. Check back soon!', dateLocale: 'en-US' },
  'zh-Hans': { title: '博客', subtitle: '来自 ObjectStack 团队的洞见、更新与最佳实践。', by: '作者', back: '返回博客', empty: '还没有博客文章,敬请期待!', dateLocale: 'zh-CN' },
  ja: { title: 'ブログ', subtitle: 'ObjectStack チームによる知見、アップデート、ベストプラクティス。', by: '著者', back: 'ブログに戻る', empty: 'まだ記事がありません。近日公開予定です!', dateLocale: 'ja-JP' },
  de: { title: 'Blog', subtitle: 'Einblicke, Neuigkeiten und Best Practices vom ObjectStack-Team.', by: 'Von', back: 'Zurück zum Blog', empty: 'Noch keine Beiträge. Schau bald wieder vorbei!', dateLocale: 'de-DE' },
  es: { title: 'Blog', subtitle: 'Ideas, novedades y buenas prácticas del equipo de ObjectStack.', by: 'Por', back: 'Volver al blog', empty: 'Aún no hay publicaciones. ¡Vuelve pronto!', dateLocale: 'es-ES' },
  fr: { title: 'Blog', subtitle: 'Analyses, actualités et bonnes pratiques de l’équipe ObjectStack.', by: 'Par', back: 'Retour au blog', empty: 'Pas encore d’articles. Revenez bientôt !', dateLocale: 'fr-FR' },
  ko: { title: '블로그', subtitle: 'ObjectStack 팀의 인사이트, 업데이트, 모범 사례.', by: '작성자', back: '블로그로 돌아가기', empty: '아직 게시글이 없습니다. 곧 다시 확인해 주세요!', dateLocale: 'ko-KR' },
};

export default async function BlogPage({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  const { slug, lang } = await params;
  
  const ui = BLOG_UI[lang] ?? BLOG_UI.en;

  // If no slug, show blog index
  if (!slug || slug.length === 0) {
    const posts = blog.getPages(lang);

    return (
      <HomeLayout {...baseOptions(lang)}>
        <main className="container max-w-5xl mx-auto px-4 py-16">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">{ui.title}</h1>
            <p className="text-lg text-fd-foreground/80">
              {ui.subtitle}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {posts.map((post) => {
              const postData = post.data as unknown as BlogPostData;
              return (
                <Link
                  key={post.url}
                  href={post.url}
                  className="group block rounded-lg border border-fd-border bg-fd-card p-6 transition-all hover:border-fd-primary/30 hover:shadow-md"
                >
                  <div className="mb-3">
                    <h2 className="text-2xl font-semibold mb-2 group-hover:text-fd-primary transition-colors">
                      {postData.title}
                    </h2>
                    {postData.description && (
                      <p className="text-fd-foreground/70">
                        {postData.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-fd-foreground/70">
                    {postData.date && (
                      <time dateTime={postData.date}>
                        {new Date(postData.date).toLocaleDateString(ui.dateLocale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    )}
                    {postData.author && (
                      <span>{ui.by} {postData.author}</span>
                    )}
                  </div>

                  {postData.tags && postData.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {postData.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-fd-primary/10 px-2.5 py-0.5 text-xs font-medium text-fd-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {posts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-fd-foreground/70">{ui.empty}</p>
            </div>
          )}
        </main>
      </HomeLayout>
    );
  }

  // Show individual blog post
  const page = blog.getPage(slug, lang);

  if (!page) {
    notFound();
  }

  const pageData = page.data as unknown as BlogPostData;
  const MDX = page.data.body;

  return (
    <HomeLayout {...baseOptions(lang)}>
      <main className="container max-w-4xl mx-auto px-4 py-16">
        <Link
          href={lang === 'en' ? '/blog' : `/${lang}/blog`}
          className="inline-flex items-center gap-2 text-sm text-fd-foreground/70 hover:text-fd-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {ui.back}
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <header className="mb-8 pb-8 border-b border-fd-border">
            <h1 className="text-4xl font-bold mb-4">{pageData.title}</h1>
            
            {pageData.description && (
              <p className="text-xl text-fd-foreground/80 mb-6">
                {pageData.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-fd-foreground/70">
              {pageData.date && (
                <time dateTime={pageData.date}>
                  {new Date(pageData.date).toLocaleDateString(ui.dateLocale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
              {pageData.author && (
                <span>{ui.by} {pageData.author}</span>
              )}
            </div>

            {pageData.tags && pageData.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {pageData.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-fd-primary/10 px-3 py-1 text-sm font-medium text-fd-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <MDX components={components} />
        </article>
      </main>
    </HomeLayout>
  );
}

export function generateStaticParams() {
  return blog.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  const { slug, lang } = await params;

  // If no slug, return default metadata for blog index
  if (!slug || slug.length === 0) {
    return {
      title: 'Blog',
      description: 'Insights, updates, and best practices from the ObjectStack team.',
    };
  }

  const page = blog.getPage(slug, lang);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
