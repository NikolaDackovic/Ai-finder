export function deterministicChecks({ crawl, emailCandidates }) {
  const chatDetected = crawl.signals.chatKeywords.length > 0;
  const bookingDetected = crawl.signals.bookingKeywords.length > 0;
  const email = emailCandidates[0] || null;

  return {
    chatDetected,
    bookingDetected,
    hasEmail: Boolean(email),
    email,
    cms: crawl.signals.cms
  };
}
