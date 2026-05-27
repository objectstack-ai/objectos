import { cn } from '@/lib/utils';
import type { HomepageTranslations } from '@/lib/homepage-i18n';

interface CodePreviewProps {
  className?: string;
  t: HomepageTranslations['agentPreview'];
}

/**
 * Homepage hero preview.
 *
 * An end-user conversation with an ObjectOS Agent — querying, analyzing,
 * and acting on live business data through natural language.
 */
export function CodePreview({ className, t }: CodePreviewProps) {
  const user = 'text-foreground';
  const ai = 'text-foreground/90';
  const label = 'text-cyan-600 dark:text-sky-300 font-semibold';
  const aiLabel = 'text-purple-600 dark:text-purple-400 font-semibold';
  const ok = 'text-green-600 dark:text-green-400';
  const dim = 'text-foreground/50';
  const accent = 'text-amber-600 dark:text-yellow-300';
  const tool = 'text-blue-600 dark:text-blue-300';

  return (
    <div className={cn(
      "relative mx-auto mt-12 w-full max-w-3xl transform rounded-xl bg-gradient-to-br from-border/50 to-border/10 p-[2px] opacity-90 transition-all hover:scale-[1.01] hover:opacity-100 sm:mt-16",
      className
    )}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Window Controls */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
          <div className="ml-2 text-xs font-medium text-muted-foreground font-mono">
            {t.windowTitle}
          </div>
        </div>

        {/* Conversation */}
        <div className="overflow-x-auto p-6 text-left bg-gradient-to-br from-card to-muted/20">
          <pre className="font-mono text-sm leading-7 whitespace-pre-wrap break-words">
            <code>
              <span className={label}>{t.userLabel}</span>
              <br/>
              <span className={user}>{t.user1Line1}</span>
              <br/>
              <span className={user}>{t.user1Line2}</span>
              <br/><br/>

              <span className={aiLabel}>{t.agentLabel}</span>
              <span className={dim}>{'  '}</span>
              <span className={tool}>{t.tool1Name}</span>
              <span className={dim}>{t.tool1Target}</span>
              <br/>
              <span className={ai}>{t.matchSummary}</span>
              <br/>
              <span className={ai}>    • </span><span className={accent}>TKT-2041</span><span className={ai}>{t.ticket1Meta}</span><span className={dim}>{t.ticket1Note}</span>
              <br/>
              <span className={ai}>    • </span><span className={accent}>TKT-2038</span><span className={ai}>{t.ticket2Meta}</span><span className={dim}>{t.ticket2Note}</span>
              <br/>
              <span className={ai}>    • </span><span className={accent}>TKT-2035</span><span className={ai}>{t.ticket3Meta}</span><span className={dim}>{t.ticket3Note}</span>
              <br/>
              <span className={ai}>{t.insight}</span>
              <br/><br/>

              <span className={label}>{t.userLabel}</span>
              <br/>
              <span className={user}>{t.user2}</span>
              <br/><br/>

              <span className={aiLabel}>{t.agentLabel}</span>
              <span className={dim}>{'  '}</span>
              <span className={tool}>{t.tool2Name}</span>
              <span className={dim}>{t.tool2Count}</span>
              <span className={tool}>{t.tool3Name}</span>
              <span className={dim}>{t.tool3Count}</span>
              <br/>
              <span className={ok}>{t.actionResult}</span>
              <br/>
              <span className={dim}>{t.governance}</span>
            </code>
          </pre>
        </div>
      </div>

      {/* Glow Effect */}
      <div className="absolute -inset-4 -z-10 bg-primary/20 blur-3xl opacity-30 rounded-[50%]" />
    </div>
  );
}
