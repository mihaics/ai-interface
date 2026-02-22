export interface CodeExecPayload {
  runtime: 'browser';
  language: 'python' | 'javascript';
  code: string;
}

export function prepareCodeExec(
  code: string,
  language: string = 'python',
): CodeExecPayload {
  return {
    runtime: 'browser',
    language: language === 'javascript' ? 'javascript' : 'python',
    code,
  };
}
