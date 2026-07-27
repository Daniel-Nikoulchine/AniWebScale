export function envValue(env, name, fallback = '') {
  return typeof env?.[name] === 'string' ? env[name].trim() : fallback;
}

export function boolEnv(env, name) {
  return envValue(env, name) === 'true';
}

export function dayEnv(env, name) {
  const days = Number.parseInt(envValue(env, name), 10);
  return Number.isInteger(days) && days >= 0 && days <= 3_650 ? days : null;
}
