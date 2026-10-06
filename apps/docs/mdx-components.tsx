import type { ComponentProps } from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

/**
 * fumadocs' own table wrapper — the same scroll container with the same
 * classes — plus `docs-table`, which `app/global.css` hangs the always-drawn
 * scrollbar and the trailing-edge fade on (#301). A class of our own, rather
 * than a selector for fumadocs' utility classes, so that a fumadocs release
 * that changes its markup cannot quietly detach the affordance.
 */
function Table(props: ComponentProps<'table'>) {
  return (
    <div className="docs-table relative overflow-auto prose-no-margin my-6">
      <table {...props} />
    </div>
  );
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    table: Table,
    ...components,
  };
}
