import JSZip from 'jszip';
import { useStore } from '../store';
import { t, useI18n } from '../i18n';
import { nodeLabel } from './canvas-chat';
import { activeProjectName } from './export';
import { frameMembers, isFrameNode } from './frames';
import type { ThoughtEdge, ThoughtNode } from '../types';

// Obsidian resolves [[title]] by file name, so the file name IS the link target.
// A node that is not exported (material, archived, frame) must never be linked:
// that plants a dead note in the vault. Those ends become a plain source line.

/** Material and frames are not notes; they never become their own file. */
const NOT_A_NOTE = ['file', 'link', 'frame'];

type Note = { node: ThoughtNode; file: string };

// Characters a file system refuses, plus any newline or tab folded to one space.
const safeName = (raw: string, fallback: string): string => {
  const cleaned = raw.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return cleaned || fallback;
};

const titleOf = (n: ThoughtNode, lang: 'zh' | 'en'): string => {
  const firstLine = (n.data.question ?? '').split('\n').map((l) => l.trim()).find(Boolean);
  return safeName(firstLine ?? nodeLabel(n.data, lang), `node-${n.id.slice(0, 8)}`);
};

/** The vault's notes: every Q&A and note node on this canvas that is not archived. */
function collectNotes(): { notes: Note[]; byId: Map<string, Note> } {
  const lang = useI18n.getState().lang;
  const taken = new Map<string, number>();
  const notes: Note[] = [];
  for (const n of useStore.getState().nodes) {
    if (NOT_A_NOTE.includes(n.data.stepKind ?? '') || n.data.archived) continue;
    if (!n.data.question?.trim() && !n.data.response?.trim()) continue;
    const base = titleOf(n, lang);
    const seen = taken.get(base) ?? 0;
    taken.set(base, seen + 1);
    const file = seen ? `${base} (${seen + 1})` : base;
    notes.push({ node: n, file });
  }
  return { notes, byId: new Map(notes.map((x) => [x.node.id, x])) };
}

function frontmatter(n: ThoughtNode, file: string): string {
  const model = n.data.generatedBy?.[n.data.responseIndex ?? 0] ?? n.data.model;
  const created = (n.data.createdAt ?? n.data.askedAt ?? '').slice(0, 10);
  const lines = ['---', `title: ${JSON.stringify(file)}`, `thoughtdag: ${JSON.stringify(activeProjectName())}`, `node: ${n.id}`];
  if (model) lines.push(`model: ${JSON.stringify(model)}`);
  if (created) lines.push(`created: ${created}`);
  if (n.data.tokenCount) lines.push(`tokens: ${n.data.tokenCount}`);
  lines.push('---', '');
  return lines.join('\n');
}

// The wires carry direction; Obsidian's backlinks do not. Splitting them into
// upstream / references / downstream keeps "who was context for whom" readable.
function linksOf(n: ThoughtNode, edges: ThoughtEdge[], byId: Map<string, Note>, lang: 'zh' | 'en'): string {
  const all = useStore.getState().nodes;
  const render = (id: string): string => {
    const note = byId.get(id);
    if (note) return `- [[${note.file}]]`;
    const other = all.find((x) => x.id === id);
    return other ? `- ${nodeLabel(other.data, lang)}` : '';
  };
  const structural = edges.filter((e) => !e.data?.isCrossLink);
  const group = (label: string, items: string[]) =>
    items.length ? [`## ${label}`, '', ...items, ''] : [];
  return [
    ...group(t('obsidian.upstream'), structural.filter((e) => e.target === n.id).map((e) => render(e.source)).filter(Boolean)),
    ...group(t('obsidian.references'), edges.filter((e) => e.data?.isCrossLink && (e.source === n.id || e.target === n.id)).map((e) => render(e.source === n.id ? e.target : e.source)).filter(Boolean)),
    ...group(t('obsidian.downstream'), structural.filter((e) => e.source === n.id).map((e) => render(e.target)).filter(Boolean)),
  ].join('\n');
}

function noteMarkdown(note: Note, edges: ThoughtEdge[], byId: Map<string, Note>, lang: 'zh' | 'en'): string {
  const d = note.node.data;
  const parts: string[] = [frontmatter(note.node, note.file), `# ${note.file}`, ''];
  if (d.question?.trim()) parts.push(d.question.trim(), '');
  if (d.response?.trim()) parts.push(d.response.trim(), '');
  else if (d.isLoading) parts.push(`_${t('obsidian.generating')}_`, '');
  const links = linksOf(note.node, edges, byId, lang);
  if (links) parts.push('---', '', links);
  return parts.join('\n');
}

/** One entry page: the frames as sections, everything else under a plain list. */
function indexMarkdown(notes: Note[], byId: Map<string, Note>): string {
  const { nodes } = useStore.getState();
  const grouped = new Map<string, Note[]>();
  const claimed = new Set<string>();
  for (const frame of nodes.filter(isFrameNode)) {
    const members = frameMembers(frame, nodes).map((n) => byId.get(n.id)).filter((x): x is Note => !!x);
    const fresh = members.filter((m) => !claimed.has(m.node.id));
    if (!fresh.length) continue;
    fresh.forEach((m) => claimed.add(m.node.id));
    grouped.set(safeName(frame.data.question ?? '', t('obsidian.unnamedFrame')), fresh);
  }
  const rest = notes.filter((n) => !claimed.has(n.node.id));
  const lines = [`# ${activeProjectName()}`, ''];
  for (const [name, members] of grouped) lines.push(`## ${name}`, '', ...members.map((m) => `- [[${m.file}]]`), '');
  if (rest.length) lines.push(`## ${t('obsidian.ungrouped')}`, '', ...rest.map((m) => `- [[${m.file}]]`), '');
  return lines.join('\n');
}

function buildFiles(): { name: string; content: string }[] {
  const lang = useI18n.getState().lang;
  const { notes, byId } = collectNotes();
  const edges = useStore.getState().edges;
  return [
    ...notes.map((n) => ({ name: n.file, content: noteMarkdown(n, edges, byId, lang) })),
    { name: '_index', content: indexMarkdown(notes, byId) },
  ];
}

/** Folder writing needs the File System Access API: Chrome, Edge, the desktop shell. */
export const obsidianFolderSupported = (): boolean => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Write the notes into a subfolder named after the canvas, inside the picked folder. */
export async function exportObsidianFolder(): Promise<number> {
  const picked = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker({ mode: 'readwrite' });
  const dir = await picked.getDirectoryHandle(safeName(activeProjectName(), 'thoughtdag'), { create: true });
  const files = buildFiles();
  for (const f of files) {
    const handle = await dir.getFileHandle(`${f.name}.md`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(f.content);
    await writable.close();
  }
  return files.length;
}

/** Same files, zipped: works in every browser and lands wherever the user wants. */
export async function exportObsidianZip(): Promise<number> {
  const folderName = safeName(activeProjectName(), 'thoughtdag');
  const zip = new JSZip();
  const folder = zip.folder(folderName)!;
  const files = buildFiles();
  for (const f of files) folder.file(`${f.name}.md`, f.content);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return files.length;
}
