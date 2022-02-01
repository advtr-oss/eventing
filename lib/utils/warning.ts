import { emitWarning } from 'process'

interface Emitter { warned: boolean }

export function emitAlreadyClosed (message: string | Error = 'Already closed event manager'): void {
  if (!(emitAlreadyClosed as unknown as Emitter).warned) {
    (emitAlreadyClosed as unknown as Emitter).warned = true
    emitWarning(message)
  }
}
