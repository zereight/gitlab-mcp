import { config } from './config.js'
export const logger = {
  error: (...data: any[]) => {
    console.error(...data)
  },
  warn: (...data: any[]) => {
    console.warn(...data)
  },
  log: (...data: any[]) => {
    if(!config.VERBOSE) {
      return
    }
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
