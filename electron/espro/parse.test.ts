import { describe, it, expect } from 'vitest'
import { parseEsproAttendance } from './parse'

describe('parseEsproAttendance (stub)', () => {
  // Locks the contract: the stub returns the CSV-import row shape and, until a
  // real ESPRO HTML sample is available, returns nothing rather than guessing.
  it('returns no rows until real ESPRO table parsing is implemented', () => {
    expect(parseEsproAttendance('<table><tr><td>anything</td></tr></table>')).toEqual([])
  })
})
