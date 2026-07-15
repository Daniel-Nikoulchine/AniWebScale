const planLabels = { pro_monthly: 'AniWebScale Pro — monthly', pro_yearly: 'AniWebScale Pro — yearly', lifetime: 'AniWebScale Pro — lifetime' };
const sessionId = new URLSearchParams(location.search).get('session_id');

async function loadConfirmation() {
  if (!sessionId) {
    document.querySelector('[data-session-status]').textContent = 'Session not found';
    return;
  }
  try {
    const [sessionResponse, configResponse] = await Promise.all([
      fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`),
      fetch('/api/config'),
    ]);
    const session = await sessionResponse.json();
    if (!sessionResponse.ok) throw new Error(session.error || 'Could not confirm checkout.');
    document.querySelector('[data-session-status]').textContent = session.paymentStatus === 'paid' ? 'Paid' : session.paymentStatus || session.status;
    document.querySelector('[data-session-plan]').textContent = planLabels[session.plan] || 'AniWebScale Pro';
    document.querySelector('[data-session-email]').textContent = session.customerEmail || 'Sent by Stripe';
    if (configResponse.ok) {
      const config = await configResponse.json();
      const portal = document.querySelector('[data-portal-link]');
      if (config.links.portal) { portal.href = config.links.portal; portal.target = '_blank'; portal.rel = 'noopener'; }
    }
  } catch (error) {
    document.querySelector('[data-session-status]').textContent = 'Check your Stripe receipt';
  }
}
loadConfirmation();
