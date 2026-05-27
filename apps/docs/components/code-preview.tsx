import { cn } from '@/lib/utils';

interface CodePreviewProps {
  className?: string;
}

/**
 * Homepage code preview.
 *
 * Shows a real docker-compose.yml that an enterprise operator can copy,
 * paste, and run to bring ObjectOS up against their own database in a
 * single command. Replaces the previous developer-flavored object
 * definition snippet.
 */
export function CodePreview({ className }: CodePreviewProps) {
  const kw = 'text-purple-600 dark:text-purple-400 font-semibold';
  const str = 'text-green-600 dark:text-green-300';
  const num = 'text-amber-600 dark:text-yellow-300';
  const key = 'text-cyan-600 dark:text-sky-300';
  const fg = 'text-foreground';
  const cm = 'text-foreground/40 italic';

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
            docker-compose.yml
          </div>
        </div>

        {/* Code Content — real docker-compose deployment */}
        <div className="overflow-x-auto p-6 text-left bg-gradient-to-br from-card to-muted/20">
          <pre className="font-mono text-sm leading-7">
            <code>
              <span className={cm}>{'# Run ObjectOS against your own Postgres'}</span>
              <br/>
              <span className={key}>services</span><span className={fg}>:</span>
              <br/>
              {'  '}<span className={key}>objectos</span><span className={fg}>:</span>
              <br/>
              {'    '}<span className={key}>image</span><span className={fg}>:</span>{' '}
              <span className={str}>ghcr.io/objectstack/objectos:latest</span>
              <br/>
              {'    '}<span className={key}>ports</span><span className={fg}>:</span>{' '}
              [<span className={str}>&quot;3000:3000&quot;</span>]
              <br/>
              {'    '}<span className={key}>environment</span><span className={fg}>:</span>
              <br/>
              {'      '}<span className={key}>OS_ARTIFACT_FILE</span><span className={fg}>:</span>{' '}
              <span className={str}>/artifacts/objectstack.json</span>
              <br/>
              {'      '}<span className={key}>OS_DATABASE_URL</span><span className={fg}>:</span>{' '}
              <span className={str}>postgres://app@db:5432/objectos</span>
              <br/>
              {'      '}<span className={key}>OS_AUTH_SECRET</span><span className={fg}>:</span>{' '}
              <span className={fg}>$</span><span className={key}>{'{AUTH_SECRET}'}</span>
              <br/>
              {'    '}<span className={key}>volumes</span><span className={fg}>:</span>
              <br/>
              {'      '}<span className={fg}>-</span>{' '}
              <span className={str}>./artifacts:/artifacts:ro</span>
              <br/>
              {'      '}<span className={fg}>-</span>{' '}
              <span className={str}>objectos-data:/var/lib/objectos</span>
              <br/>
              {'    '}<span className={key}>depends_on</span><span className={fg}>:</span>{' '}
              [<span className={str}>db</span>]
              <br/><br/>
              {'  '}<span className={key}>db</span><span className={fg}>:</span>
              <br/>
              {'    '}<span className={key}>image</span><span className={fg}>:</span>{' '}
              <span className={str}>postgres:</span><span className={num}>16</span>
              <br/>
              {'    '}<span className={key}>volumes</span><span className={fg}>:</span>{' '}
              [<span className={str}>db-data:/var/lib/postgresql/data</span>]
              <br/><br/>
              <span className={key}>volumes</span><span className={fg}>:</span>{' '}
              <span className={fg}>{'{ objectos-data: {}, db-data: {} }'}</span>
              <br/><br/>
              <span className={cm}>{'# → Application at http://localhost:3000'}</span>
              <br/>
              <span className={cm}>{'# → Setup app at  http://localhost:3000/_setup/'}</span>
            </code>
          </pre>
        </div>
      </div>

      {/* Glow Effect */}
      <div className="absolute -inset-4 -z-10 bg-primary/20 blur-3xl opacity-30 rounded-[50%]" />
    </div>
  );
}
