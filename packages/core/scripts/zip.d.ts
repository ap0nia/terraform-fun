import type archiver from 'archiver'

export type GlobOptions = Parameters<archiver.Archiver['glob']>[1]

export type ZipOptions = {
  /**
   * The glob API is fucking stupid.
   */
  glob?: GlobOptions,

  data?: Partial<archiver.EntryData>
} 
