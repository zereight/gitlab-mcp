import { config } from './config.js'
import { format } from 'util'
export const logger = {
  error: (...data: any[]) => {
    console.error(...data)
  },
  warn: (...data: any[]) => {
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    console.warn(yellow + format(...data) + reset)
  },
  log: (...data: any[]) => {
    console.log(...data)
  },
  info: (...data: any[]) => {
    if(!config.VERBOSE) {
      return
    }
    console.log('[info]', ...data)
  },
  debug: (...data: any[]) => {
    if(!config.VERBOSE) {
      return
    }
    console.debug('[debug]', ...data)
  },
}
