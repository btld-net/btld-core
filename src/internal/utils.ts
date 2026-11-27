export const sym = '@btld/core/v1/';

export function templateDisallowPlaceholder(strings: TemplateStringsArray, ...values: never[]): string {
  if (values.length > 0) throw new Error('No placeholder allowed');
  return strings[0];
}

export async function safeInvoke<O>(run: () => Promise<O> | O) {
  try {
    return await run();
  } catch (error) {
    reportError(error);
  }
}

const pending: (() => void)[] = [];

export function safeInvokeAsTask<O>(run: () => Promise<O> | O) {
  if (pending.push(run) > 1) return;
  setTimeout(() => {
    for (const setup of pending.splice(0)) safeInvoke(setup);
  });
}

export function safeDeepClone(value: unknown) {
  if (value === null || typeof value !== 'object') return value;
  // Nested functions and non serializable values return undefined
  return safeInvoke(() => structuredClone(value));
}
