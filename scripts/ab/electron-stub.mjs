import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'electron') return { url: 'data:text/javascript,' + encodeURIComponent("import os from 'node:os'; import path from 'node:path'; export const app = { isPackaged: false, getPath: () => path.join(process.env.NCV_USERDATA || os.tmpdir()) }; export default { app };"), shortCircuit: true }
  return next(spec, ctx)
}`))
