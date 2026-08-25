/**
 * 404 shell for routes that are not under the `[lang]` segment.
 *
 * The document shell lives in `app/[lang]/layout.tsx` so that the language
 * attribute can be derived from the locale route segment (see the comment in
 * `app/layout.tsx`). That leaves the root layout a pass-through, and this is the
 * one route reaching it that renders HTML rather than a redirect or a route
 * handler — so without a shell here a 404 would carry no root element at all.
 *
 * Two paths land on this file, and neither of them renders the `[lang]` layout:
 *
 * - a path that matches no route (`/no-such-page`), which Next serves from the
 *   root `_not-found` entry;
 * - `notFound()` thrown by a page below `[lang]` (`/docs/no-such-page`), which
 *   unwinds to the nearest not-found boundary. That boundary is this one, and it
 *   sits above the locale layout, so that layout's shell is replaced rather than
 *   wrapped. There is no nesting risk and exactly one root element either way.
 *
 * `en` is hardcoded deliberately: this boundary is above the locale segment and
 * cannot read it, which is the same position the root layout was in before. That
 * is what `main` declared here, and matching it keeps the 404 unchanged by the
 * locale work rather than quietly redesigned by it. The markup below reproduces
 * the Next.js built-in 404 that `main` rendered through the old root layout.
 */
export default function NotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <title>404: This page could not be found.</title>
        <div
          style={{
            fontFamily:
              'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
            height: '100vh',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div>
            <style
              dangerouslySetInnerHTML={{
                __html:
                  'body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}',
              }}
            />
            <h1
              className="next-error-h1"
              style={{
                display: 'inline-block',
                margin: '0 20px 0 0',
                padding: '0 23px 0 0',
                fontSize: 24,
                fontWeight: 500,
                verticalAlign: 'top',
                lineHeight: '49px',
              }}
            >
              404
            </h1>
            <div style={{ display: 'inline-block' }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: '49px',
                  margin: 0,
                }}
              >
                This page could not be found.
              </h2>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
