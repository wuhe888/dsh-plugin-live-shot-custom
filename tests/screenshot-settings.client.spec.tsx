// @vitest-environment jsdom
/** Installed screenshot controls mounted through the production slot renderer. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ILayout, MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import * as stores from '@deepseek-ai/dsh-client-store'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

let runtime: SlotTestRuntime | undefined
let releaseReference: (() => void) | undefined
afterEach(async () => {
  try {
    await runtime?.dispose()
  } finally {
    releaseReference?.()
    releaseReference = undefined
    runtime = undefined
    cleanup()
  }
})

it.skipIf(process.platform !== 'win32')('edits screenshot settings in the main panel and keeps saved preferences across navigation', async () => {
  runtime = await SlotTestRuntime.create()
  const sessionId = 'screenshot-settings-test' as SessionId
  await runtime.sessions.add({ id: sessionId, summary: { cwd: '/workspace' } })
  const reference = runtime.sessions.retain(sessionId)
  releaseReference = () => { reference.release() }
  await reference.ready
  const locale = new LocaleRuntime(runtime.ctx)
  locale.setLocale('zh')
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  const panelInfo = runtime.panelInfo
  const layout = {
    panelInfo,
    selectPanel: (id) => { panelInfo.set({ activePanelId: id }) },
    beginNavigation: () => new AbortController().signal,
    toggleSidebar: vi.fn(), openRightbar: vi.fn(), closeRightbar: vi.fn(),
  } satisfies ILayout
  runtime.ctx.provide('layout', layout)
  const preferences = { hideDsh: false, hotkey: 'Ctrl+Shift+X', registered: true }
  const requests: { op: string; hideDsh?: boolean; hotkey?: string }[] = []
  const fetchControl = async (_url: string, options: RequestInit) => {
    if (typeof options.body !== 'string') throw new Error('Screenshot control body must be JSON text')
    const request = JSON.parse(options.body) as typeof requests[number]
    requests.push(request)
    if (request.op === 'settings') {
      if (request.hotkey === 'invalid') return new Response(JSON.stringify({ error: '快捷键无效' }), { status: 400 })
      Object.assign(preferences, request.hideDsh === undefined ? {} : { hideDsh: request.hideDsh },
        request.hotkey === undefined ? {} : { hotkey: request.hotkey })
    }
    return new Response(JSON.stringify(preferences))
  }
  const modules: Record<string, unknown> = {
    react: React, '@deepseek-ai/dsh-client-ui-primitives': primitives, '@deepseek-ai/dsh-client-store': stores,
  }
  type Plugin = { inject: string[]; apply(ctx: Context): void }
  let plugin: Plugin | undefined
  const source = readFileSync(join(process.env.SCREENSHOT_PLUGIN_ROOT!, 'client.js'), 'utf8')
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: (entry: { factory(require: (id: string) => unknown): Plugin }) => {
      plugin = entry.factory((id) => {
        if (!(id in modules)) throw new Error(`Unexpected client import: ${id}`)
        return modules[id]
      })
    } } },
    document, sessionStorage, crypto, fetch: fetchControl, setInterval, clearInterval, setTimeout, clearTimeout,
  })
  function Frame({ renderSlot, SessionProvider, usePanelInfo }: PropsRuntime<'root'> & PropsRenderSlots<'main' | 'sidebar.panellist' | 'sidebar.panellist.button' | 'conversation.input.left' | 'shell.overlay'>) {
    const selected = usePanelInfo(info => info.activePanelId)
    return <>
      <main>{selected === null ? <p>Conversation content</p> : renderSlot('main', {}, { entryKey: selected })}</main>
      {renderSlot('sidebar.panellist.button', {
        label: '截屏设置', size: 16, wide: true, active: selected === 'dsh-shot-settings', classes: { button: '', glyph: '', title: '' },
      }, { entryKey: 'dsh-shot-settings' })}
      <SessionProvider session={reference}>{renderSlot('conversation.input.left', {})}</SessionProvider>
      {renderSlot('shell.overlay', {})}
    </>
  }
  await runtime.root.declare({
    'main': { kind: 'keyed', scope: 'root' },
    'sidebar.panellist': { kind: 'list', scope: 'root' },
    'sidebar.panellist.button': { kind: 'keyed', scope: 'root' },
    'conversation.input.left': { kind: 'list', scope: 'session' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  }, Frame)
  if (plugin === undefined) throw new Error('Screenshot client did not register')
  const fiber = await runtime.mount(plugin)
  runtime.renderRoot()
  const launcher = screen.getByRole('button', { name: '截屏设置' })
  await waitFor(() => { expect(launcher.hasAttribute('disabled')).toBe(false) })
  expect(launcher.hasAttribute('aria-haspopup')).toBe(false)
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '截屏分析' }))
  await waitFor(() => { expect(requests.some(request => request.op === 'start')).toBe(true) })
  act(() => { launcher.focus() })
  fireEvent.click(launcher)
  expect(launcher.getAttribute('aria-current')).toBe('page')
  const page = screen.getByRole('region', { name: '截屏设置' })
  expect(document.querySelector('main')?.contains(page)).toBe(true)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(runtime.slots.entries('shell.overlay')).toEqual([])
  expect(page.textContent).toMatchSnapshot()
  expect(screen.getByRole('list').tagName).toBe('OL')
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(document.querySelector('style[data-dsh-shot-settings-style]')).not.toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: '隐藏桌面' }))
  await waitFor(() => { expect(preferences.hideDsh).toBe(true) })
  const shortcut = screen.getByRole('textbox', { name: '截图快捷键' })
  await waitFor(() => { expect(shortcut.hasAttribute('disabled')).toBe(false) })
  fireEvent.change(shortcut, { target: { value: 'invalid' } })
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('快捷键无效') })
  fireEvent.change(shortcut, { target: { value: 'Ctrl+Alt+A' } })
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() => { expect(preferences.hotkey).toBe('Ctrl+Alt+A') })
  await waitFor(() => { expect(screen.getByRole('button', { name: '保存' }).hasAttribute('disabled')).toBe(false) })
  expect(screen.getByRole('region', { name: '截屏设置' })).toBe(page)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(launcher.getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '截图快捷键' }).value).toBe('Ctrl+Shift+X')
  expect(preferences.hotkey).toBe('Ctrl+Alt+A')
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('region', { name: '截屏设置' })).toBeNull()
  expect(launcher.hasAttribute('aria-current')).toBe(false)
  expect(screen.getByText('Conversation content')).toBeTruthy()
  fireEvent.click(launcher)
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '截图快捷键' }).value).toBe('Ctrl+Alt+A')
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '隐藏桌面' }).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '启用管理员游戏兼容' }))
  await waitFor(() => { expect(requests.some(request => request.op === 'gameCompatibility')).toBe(true) })
  fireEvent.change(screen.getByRole('textbox', { name: '截图快捷键' }), { target: { value: 'F8' } })
  act(() => { layout.selectPanel(null) })
  expect(launcher.hasAttribute('aria-current')).toBe(false)
  expect(screen.getByText('Conversation content')).toBeTruthy()
  act(() => { layout.selectPanel('dsh-shot-settings' as MainPanelId) })
  expect(screen.getByRole('region', { name: '截屏设置' })).toBeTruthy()
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '截图快捷键' }).value).toBe('Ctrl+Alt+A')
  act(() => { layout.selectPanel(null) })
  expect(screen.queryByRole('region', { name: '截屏设置' })).toBeNull()
  await act(async () => fiber.dispose())
  expect(screen.queryByRole('button', { name: '截屏设置' })).toBeNull()
  expect(runtime.slots.entries('sidebar.panellist')).toEqual([])
  expect(runtime.slots.entries('main')).toEqual([])
  expect(document.querySelector('style[data-dsh-shot-settings-style]')).toBeNull()
})
