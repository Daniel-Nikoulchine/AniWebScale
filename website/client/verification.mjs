export const VERIFICATION_CODE_LENGTH = 6;

export function normalizeVerificationCode(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, VERIFICATION_CODE_LENGTH);
}

export function isCompleteVerificationCode(value) {
  return normalizeVerificationCode(value).length === VERIFICATION_CODE_LENGTH;
}
