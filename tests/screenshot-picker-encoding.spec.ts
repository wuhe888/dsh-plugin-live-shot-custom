/** Native picker JSON preserves localized errors across redirected Windows pipes. */
import { execFile } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'

type Reply = { id: string; ok: boolean; error: string | null; result: object | null }

async function runPicker(directory: string, commands: readonly object[]): Promise<Reply[]> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass',
      '-File', join(directory, 'native_picker.ps1'),
    ], { windowsHide: true, timeout: 20_000, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(new Error(error.message, { cause: error }))
      else resolve(stdout)
    })
    // All requests are queued before EOF; the WinForms thread processes them in order.
    child.stdin!.end([...commands, { id: 'done', op: 'quit' }].map(command => JSON.stringify(command)).join('\n') + '\n')
  })
  const lines = output.trim().split(/\r?\n/u)
  expect(lines.shift()).toBe('READY')
  return lines.map(line => JSON.parse(line) as Reply)
}

// Windows PowerShell owns the picker; other platforms do not ship this dependency.
it.skipIf(process.platform !== 'win32' || process.arch !== 'x64')('returns readable non-ASCII request ids and native errors without stopping the picker', async () => {
  const plugin = process.env.SCREENSHOT_PLUGIN_ROOT!
  const failedId = '权限检查-截图-📷'
  const nextId = '取消后仍可查询-📷'
  const replies = await runPicker(plugin, [
    { id: failedId, op: 'select', x: '不是数字', y: 0, width: 64, height: 64 },
    { id: nextId, op: 'adminEscapeStatus' },
  ])
  expect(replies).toHaveLength(2)
  expect(replies[0]).toMatchObject({ id: failedId, ok: false, result: null })
  expect(replies[0]!.error).toBeTruthy()
  expect(replies[0]!.error).not.toContain('\uFFFD')
  expect(replies[1]).toEqual({ id: nextId, ok: true, error: null, result: { ready: false } })
})

it.skipIf(process.platform !== 'win32' || process.arch !== 'x64').each([
  { code: 1223, message: '操作已被用户取消。' },
  { code: 5, message: '访问被拒绝。' },
])('preserves the localized administrator launch failure $code and allows another request', async ({ code, message }) => {
  const plugin = process.env.SCREENSHOT_PLUGIN_ROOT!
  const directory = mkdtempSync(join(tmpdir(), 'screenshot-picker-encoding-'))
  onTestFinished(() => { rmSync(directory, { recursive: true, force: true }) })
  copyFileSync(join(plugin, 'native_picker.ps1'), join(directory, 'native_picker.ps1'))
  const source = readFileSync(join(plugin, 'native_picker.cs'), 'utf8')
  const launch = 'System.Diagnostics.Process.Start(launch)'
  expect(source.split(launch)).toHaveLength(2)
  // Only the OS consent/launch operation is substituted; the server, protocol and pipes stay real.
  const literal = Array.from({ length: message.length }, (_, index) => `\\u${message.charCodeAt(index).toString(16).padStart(4, '0')}`).join('')
  const launcher = `public static class EncodingTestLauncher {
    public static System.Diagnostics.Process Start(System.Diagnostics.ProcessStartInfo launch) {
      throw new System.ComponentModel.Win32Exception(${code}, "${literal}");
    }
  }`
  writeFileSync(join(directory, 'native_picker.cs'), source.replace(launch, 'EncodingTestLauncher.Start(launch)') + '\n' + launcher)
  const replies = await runPicker(directory, [
    { id: 'permission', op: 'enableAdminEscape' },
    { id: 'retry', op: 'adminEscapeStatus' },
  ])
  expect(replies).toEqual([
    { id: 'permission', ok: false, result: null, error: message },
    { id: 'retry', ok: true, result: { ready: false }, error: null },
  ])
})
