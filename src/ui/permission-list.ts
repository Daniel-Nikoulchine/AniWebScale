export interface PermissionListEntry {
  id: string;
  state: string;
  stateClass: string;
}

export interface PermissionListOptions {
  container: HTMLElement;
  clearButton: HTMLButtonElement;
  entries: readonly PermissionListEntry[];
  emptyMessage: string;
  removeLabel: string;
  onRemove: (entry: PermissionListEntry) => void | Promise<void>;
  onClear: (entries: readonly PermissionListEntry[]) => void | Promise<void>;
}

export function renderPermissionList(options: PermissionListOptions): void {
  const { container, clearButton, entries } = options;
  container.replaceChildren();
  clearButton.disabled = entries.length === 0;
  clearButton.onclick = () => void options.onClear(entries);

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = options.emptyMessage;
    container.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'site-row';

    const text = document.createElement('code');
    text.textContent = entry.id;

    const state = document.createElement('span');
    state.className = `permission ${entry.stateClass}`;
    state.textContent = entry.state;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = options.removeLabel;
    remove.addEventListener('click', () => void options.onRemove(entry));

    row.append(text, state, remove);
    container.appendChild(row);
  }
}
