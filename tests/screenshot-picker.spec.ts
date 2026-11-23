import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

// The Windows x64 optional dependency owns real HWNDs; other platforms do not load it.
it.skipIf(process.platform !== 'win32' || process.arch !== 'x64')('places the first and subsequent native selections above application windows without activation', async () => {
  const plugin = process.env.SCREENSHOT_PLUGIN_ROOT!
  const { stdout } = await promisify(execFile)('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass',
    '-File', join(import.meta.dirname, 'fixtures/screenshot-picker.ps1'), '-PluginDirectory', plugin,
  ], { windowsHide: true, timeout: 20_000, encoding: 'utf8' })
  expect(stdout.trim().split(/\r?\n/u).map((line: string) => JSON.parse(line) as object)).toEqual([1, 2].map(attempt => ({
    attempt, visible: true, topmost: true, noActivate: true,
    bounds: [-32000, -32000, 64, 64], closed: true,
  })))
})

it.skipIf(process.platform !== 'win32' || process.arch !== 'x64')('selects on each of three displays and closes every picker on completion or cancel', async () => {
  const { stdout } = await promisify(execFile)('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass',
    '-File', join(import.meta.dirname, 'fixtures/screenshot-picker.ps1'),
    '-PluginDirectory', process.env.SCREENSHOT_PLUGIN_ROOT!, '-MultipleDisplays',
  ], { windowsHide: true, timeout: 20_000, encoding: 'utf8' })
  expect(stdout.trim().split(/\r?\n/u).map(line => JSON.parse(line))).toMatchObject([
    { selected: true, x: -2552, y: -2591, width: 80, height: 50 },
    { selected: true, x: 8, y: -2391, width: 80, height: 50 },
    { selected: true, x: 1928, y: -2691, width: 80, height: 50 },
    { selected: false, reason: 'parent-cancel' },
  ])
})
