export type KnowledgeSection = {
  title: string;
  body: string;
};

const HEADING = /^#\s+(.+)$/;

export function parseKnowledgeSections(text: string): KnowledgeSection[] {
  const sections: KnowledgeSection[] = [];
  let title: string | null = null;
  let lines: string[] = [];
  const preamble: string[] = [];

  function push(nextTitle: string, nextLines: string[]) {
    sections.push({
      title: nextTitle,
      body: nextLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, ""),
    });
  }

  for (const line of text.split("\n")) {
    const match = HEADING.exec(line);
    if (match) {
      if (title) push(title, lines);
      else if (preamble.some((item) => item.trim())) push("Вступ", preamble);
      title = match[1].trim();
      lines = [];
      continue;
    }
    if (title) lines.push(line);
    else preamble.push(line);
  }

  if (title) push(title, lines);
  if (sections.length === 0) return [{ title: "База знань", body: text.trim() }];
  return sections;
}

export function joinKnowledgeSections(sections: readonly KnowledgeSection[]) {
  return sections.map((section) => `# ${section.title}\n${section.body.trim()}\n`).join("\n");
}

export function knowledgeFold(value: string) {
  return value.toLocaleLowerCase("uk");
}
