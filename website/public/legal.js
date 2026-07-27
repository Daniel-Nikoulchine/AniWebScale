fetch('/api/config').then(response => response.json()).then(config => {
  const legal = config.legal || {};
  const privacy = config.privacy || {};
  const values = {
    name: legal.name,
    email: legal.email,
    address: legal.address,
    representatives: legal.representatives,
    vatId: legal.vatId,
    phone: legal.phone,
    registerCourt: legal.registerCourt,
    registerNumber: legal.registerNumber,
    taxNotice: legal.taxNotice,
  };

  document.querySelectorAll('[data-legal]').forEach(node => {
    const value = values[node.dataset.legal];
    node.textContent = value || '';
    if (node.tagName === 'A' && node.dataset.legal === 'email' && value && !value.startsWith('[')) {
      node.href = `mailto:${value}`;
    }
  });

  document.querySelectorAll('[data-optional]').forEach(node => {
    const key = node.dataset.optional;
    const present = key === 'register'
      ? Boolean(values.registerCourt && values.registerNumber)
      : Boolean(values[key]);
    if (!present) node.remove();
  });

  document.querySelectorAll('[data-privacy]').forEach(node => {
    const key = node.dataset.privacy;
    const value = privacy[key];
    if (key.endsWith('Days')) {
      node.textContent = Number.isInteger(value) ? `${value} Tage` : 'noch nicht freigegeben';
    } else {
      node.textContent = value || 'noch nicht freigegeben';
    }
  });

  const required = ['name', 'email', 'address', 'representatives'];
  const incomplete = required.some(key => !values[key] || values[key].startsWith('['));
  const needsProfessionalReview = legal.reviewApproved !== true
    || legal.taxConfigurationApproved !== true
    || legal.dataProtectionApproved !== true;
  document.querySelector('.legal-warning')?.toggleAttribute('hidden', !(incomplete || needsProfessionalReview));
}).catch(() => document.querySelector('.legal-warning')?.removeAttribute('hidden'));
