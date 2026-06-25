import fs from 'fs';

/** Parse Todoist CSV export (handles quoted multiline DESCRIPTION fields). */
export function parseTodoistCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => c !== '')) rows.push(row);
  }

  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toUpperCase());
  const idx = (name) => header.indexOf(name);

  const typeIdx = idx('TYPE');
  const contentIdx = idx('CONTENT');
  const descIdx = idx('DESCRIPTION');
  const dateIdx = idx('DATE');

  const tasks = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if ((cols[typeIdx] || '').trim().toLowerCase() !== 'task') continue;
    tasks.push({
      content: cols[contentIdx] || '',
      description: descIdx >= 0 ? cols[descIdx] || '' : '',
      date: dateIdx >= 0 ? cols[dateIdx] || '' : '',
    });
  }
  return tasks;
}

export function loadTodoistCsv(path) {
  return parseTodoistCsv(fs.readFileSync(path, 'utf8'));
}
