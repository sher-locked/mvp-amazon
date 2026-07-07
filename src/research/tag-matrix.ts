import type { Tag, TagScope, TagSet, TagType } from '../domain/research';

const SCOPES: TagScope[] = ['brand', 'category', 'family', 'sku'];
const TYPES: TagType[] = ['fact', 'functional', 'sensory', 'emotional', 'occasion', 'audience'];

const cell = (tags: Tag[]): string =>
  tags
    .map((t) => `${t.value}${t.source === 'inferred' ? '*' : ''}${t.complianceSensitive ? ' (!)' : ''}`)
    .join(', ') || '—';

/** Deterministic markdown scope-x-type view of a tag set. Pure; no LLM. */
export function renderTagMatrix(tagSet: TagSet): string {
  const header = `| scope | ${TYPES.join(' | ')} |`;
  const divider = `| --- | ${TYPES.map(() => '---').join(' | ')} |`;
  const rows = SCOPES.map((scope) => {
    const cells = TYPES.map((type) =>
      cell(tagSet.tags.filter((t) => t.scope === scope && t.type === type)),
    );
    return `| **${scope}** | ${cells.join(' | ')} |`;
  });
  const legend = '`*` inferred (vs observed) · `(!)` compliance-sensitive';
  return [`### ${tagSet.identity.displayName}`, '', header, divider, ...rows, '', legend].join('\n');
}
