fetch('/api/config').then(response => response.json()).then(config => {
  const values = {
    name: config.legal.name,
    email: config.legal.email,
    address: config.legal.address,
    representatives: config.legal.representatives,
    vatId: config.legal.vatId,
  };
  document.querySelectorAll('[data-legal]').forEach(node => {
    const value = values[node.dataset.legal];
    if (!value && node.dataset.legal === 'vatId') node.closest('[data-optional]')?.remove();
    else node.textContent = value || '';
    if (node.tagName === 'A' && node.dataset.legal === 'email' && value && !value.startsWith('[')) node.href = `mailto:${value}`;
  });
  const incomplete = ['name', 'email', 'address', 'representatives'].some(key => !values[key] || values[key].startsWith('['));
  document.querySelector('.legal-warning')?.toggleAttribute('hidden', !incomplete);
}).catch(() => document.querySelector('.legal-warning')?.removeAttribute('hidden'));
