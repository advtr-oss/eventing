import { StreamManager } from './stream'

export = function createManager (uri, callback?: (error: Error | null, manager?: StreamManager) => void) {
  return new StreamManager(uri, callback)
}
