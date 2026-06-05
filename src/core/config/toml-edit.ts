// Minimal surgical TOML editor: set one key inside a top-level [section], preserving the rest
// of the file (comments, ordering, other keys). NOT a general TOML writer — just enough for
// the GUI to flip `[gui].terminal` / `launch_command` without smol-toml reformatting everything.

function tomlString(value: string): string {
  // TOML basic string: escape backslash and double-quote. JSON.stringify covers control chars too.
  return JSON.stringify(value);
}

export function upsertKeyInSection(text: string, section: string, key: string, value: string): string {
  const line = `${key} = ${tomlString(value)}`;
  const lines = text.split('\n');
  const headerRe = new RegExp(`^\\s*\\[${section}\\]\\s*$`);
  const nextHeaderRe = /^\s*\[/;
  const keyRe = new RegExp(`^\\s*${key}\\s*=`);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) { headerIdx = i; break; }
  }

  if (headerIdx === -1) {
    // append a new section
    const sep = text.length === 0 || text.endsWith('\n') ? '' : '\n';
    const lead = text.length === 0 ? '' : '\n';
    return `${text}${sep}${lead}[${section}]\n${line}\n`;
  }

  // search within the section block for an existing key
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (nextHeaderRe.test(lines[i])) break; // end of section
    if (keyRe.test(lines[i])) {
      lines[i] = line;
      return lines.join('\n');
    }
  }
  // not found → insert right after the header
  lines.splice(headerIdx + 1, 0, line);
  return lines.join('\n');
}
