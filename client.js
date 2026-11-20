window.__ModuleLoader__.load({
  id: 'dsh-plugin-live-shot-custom',
  factory(require) {
    const React = require('react'), h = React.createElement;
    const { Button, Input, Checkbox, Tooltip, IconLoadingOutlineRegular, ICON_REGULAR_STROKE } = require('@deepseek-ai/dsh-client-ui-primitives');
    const { createSnapshotStore } = require('@deepseek-ai/dsh-client-store');
    return { inject: ['slots', 'locale', 'layout'], apply(ctx) {
    const client = sessionStorage.getItem('dsh-shot-client') || crypto.randomUUID();
    sessionStorage.setItem('dsh-shot-client', client);
    let running = false, stopped = false, retryAt = 0, errorShown = '', delivered = new Set();
    let hidePreference = false, preferenceLoaded = false;
    let hotkeyPreference = 'Ctrl+Shift+X', shortcutProblem = '';
    let gameCompatibilityReady = false, gameCompatibilityEnabling = false;
    const preferenceState = () => ({ value: hidePreference, ready: preferenceLoaded,
      hotkey: hotkeyPreference, problem: shortcutProblem,
      gameCompatibilityReady, gameCompatibilityEnabling });
    const preferences = createSnapshotStore(preferenceState());
    const namespace = 'live-shot';
    const zh = { settings: '截屏设置', hide: '隐藏桌面', hideHint: '截图前隐藏桌面应用窗口，完成或取消后恢复；全局热键也使用此设置',
      hotkey: '截图快捷键', examples: '例如 Ctrl+Alt+A、Ctrl+Shift+Z', save: '保存', reset: '恢复默认', cancel: '取消',
      gameReady: '游戏兼容已启用', gamePending: '等待 Windows 确认…', gameEnable: '启用管理员游戏兼容',
      gameHint: '用于游戏中 Esc 无法取消选框的情况。需确认 Windows 提示，仅本次运行有效' };
    const en = { settings: 'Screenshot settings', hide: 'Hide desktop app', hideHint: 'Hide the desktop app during capture and restore it on completion or cancellation; also applies to the global shortcut',
      hotkey: 'Screenshot shortcut', examples: 'For example Ctrl+Alt+A, Ctrl+Shift+Z', save: 'Save', reset: 'Restore default', cancel: 'Cancel',
      gameReady: 'Game compatibility enabled', gamePending: 'Waiting for Windows confirmation…', gameEnable: 'Enable administrator game compatibility',
      gameHint: 'Use when Esc cannot cancel capture in a game. Requires Windows confirmation and lasts for this run.' };
    ctx.effect(() => ctx.locale.register(namespace, { zh, en }));
    const composerLocale = 'live-shot.composer';
    ctx.effect(() => ctx.locale.register(composerLocale, {
      zh: { label: '截屏分析', hint: '截取屏幕区域（全局快捷键：{hotkey}）\n按住 Shift 点击，仅本次切换是否隐藏桌面应用' },
      en: { label: 'Screenshot analysis', hint: 'Capture a screen region ({hotkey})\nShift-click to toggle hiding the desktop app for this capture.' },
      ja: { label: 'スクリーンショット解析', hint: '画面の範囲を選んで撮影（{hotkey}）\nShift キーを押しながらクリックすると、今回だけアプリを隠す設定を切り替えます。' },
      de: { label: 'Screenshot-Analyse', hint: 'Bildschirmbereich aufnehmen ({hotkey})\nMit Umschalt-Klick ändern Sie nur für diese Aufnahme, ob die App ausgeblendet wird.' },
      es: { label: 'Analizar captura', hint: 'Capturar una zona de la pantalla ({hotkey})\nHaz clic con Mayús para cambiar si se oculta la aplicación solo en esta captura.' },
      fr: { label: 'Analyser une capture', hint: 'Capturer une zone de l’écran ({hotkey})\nMaj + clic pour masquer ou afficher l’application uniquement pour cette capture.' },
      pt: { label: 'Analisar captura', hint: 'Capturar uma área da tela ({hotkey})\nUse Shift + clique para alternar a visibilidade do aplicativo apenas nesta captura.' },
      ru: { label: 'Анализ снимка экрана', hint: 'Снять область экрана ({hotkey})\nЩёлкните с зажатой клавишей Shift, чтобы изменить видимость приложения только для этого снимка.' },
    }));
    const t = ctx.locale.bind(namespace);
    const preferenceProps = () => ({ hooks: { preference: preferences } });
    const closeSettings = () => ctx.layout.selectPanel(null);
    const openSettings = () => ctx.layout.selectPanel('dsh-shot-settings');
    ctx.effect(() => {
      const style = document.createElement('style');
      style.setAttribute('data-dsh-shot-settings-style', '');
      style.textContent = `
        .dsh-shot-settings { height: 100%; min-height: 0; box-sizing: border-box; overflow-y: auto; padding: 28px clamp(24px, 4vw, 48px) 48px; color: var(--dsw-alias-label-primary); }
        .dsh-shot-settings,
        .dsh-shot-settings :is(h1, p, label, span, input, button, ol, li) { font-size: 14px; }
        .dsh-shot-settings-inner { width: 100%; max-width: 960px; margin-inline: auto; }
        .dsh-shot-settings h1 { margin: 0 0 28px; text-align: center; font-size: 15px; line-height: 21px; font-weight: 700; }
        .dsh-shot-settings-card { border: 1px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-lg); padding: 8px 24px 24px; }
        .dsh-shot-settings-list { margin: 0; padding: 0; list-style: none; counter-reset: dsh-shot-setting; }
        .dsh-shot-settings-list > li { padding: 24px 0; counter-increment: dsh-shot-setting; }
        .dsh-shot-settings-list > li + li { border-top: 1px solid var(--dsw-alias-border-l3); }
        .dsh-shot-numbered-control { display: flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
        .dsh-shot-numbered-control::before { content: counter(dsh-shot-setting) "."; flex-shrink: 0; font-weight: 500; color: var(--dsw-alias-label-primary); }
        .dsh-shot-settings .dsh-shot-setting-title { font-weight: 700; color: var(--dsw-alias-label-primary); }
        .dsh-shot-settings .dsh-shot-hide-option { flex-direction: row-reverse; }
        .dsh-shot-settings-row { display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 12px 16px; }
        .dsh-shot-shortcut-input { flex: 0 1 220px; width: 220px; min-width: 140px; max-width: 100%; margin-inline-start: 8px; }
        .dsh-shot-shortcut-label { flex-shrink: 0; }
        .dsh-shot-shortcut-input input { width: 100%; text-align: center; font-weight: 400; }
        .dsh-shot-settings .dsh-shot-game-button { width: auto; max-width: 100%; background: var(--dsw-alias-interactive-bg-hover); }
        .dsh-shot-settings-hint { margin: 0; max-width: 100%; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
        .dsh-shot-settings-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; padding-top: 24px; border-top: 1px solid var(--dsw-alias-border-l3); }
        .dsh-shot-settings-loading { height: 100%; display: grid; place-items: center; }
        .dsh-shot-settings-loading svg { animation: dsh-shot-loading 1s linear infinite; }
        @keyframes dsh-shot-loading { to { transform: rotate(360deg); } }
        @media (max-width: 767px) { .dsh-shot-settings { padding-inline: 20px; } .dsh-shot-settings-card { padding-inline: 16px; } }
      `;
      document.head.appendChild(style);
      return () => style.remove();
    });
    function toast(message) {
      let el = document.getElementById('dsh-shot-toast');
      if (!el) {
        el = document.createElement('div'); el.id = 'dsh-shot-toast';
        el.style.cssText = 'position:fixed;bottom:85px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#222;color:white;padding:9px 16px;border-radius:8px;font:13px system-ui;pointer-events:none';
        document.body.appendChild(el);
      }
      el.textContent = message; el.hidden = false;
      clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 4500);
    }
    function deliver(file) {
      const input = document.querySelector('[data-composer-input="true"]');
      if (!input) return false;
      input.focus();
      const data = new DataTransfer(); data.items.add(file);
      const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      if (!input.dispatchEvent(paste)) return true;
      return !input.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
    }
    async function post(op, extra = {}) {
      const response = await fetch('/api/dsh-shot/control', { method: 'POST', cache: 'no-store',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, client, focused: document.hasFocus(), ...extra }) });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch (_) { throw new Error(response.status === 404 ? '截图 Host 接口未加载，请完整退出 DSH 后重开' : '截图服务返回异常（HTTP ' + response.status + '）'); }
      if (!response.ok) throw new Error(data.error || '截图服务不可用');
      if (typeof data.hideDsh === 'boolean') {
        hidePreference = data.hideDsh; preferenceLoaded = true;
        hotkeyPreference = data.hotkey || hotkeyPreference; shortcutProblem = data.hotkeyError || '';
        gameCompatibilityReady = data.gameCompatibilityReady === true;
        gameCompatibilityEnabling = data.gameCompatibilityEnabling === true;
        preferences.set(preferenceState());
      }
      return data;
    }
    async function poll() {
      if (running || stopped) return;
      running = true;
      try {
        const data = await post('poll', { skipImage: Date.now() < retryAt });
        if (data.error && errorShown !== data.error) { errorShown = data.error; toast(data.error); }
        if (data.hotkeyError && errorShown !== data.hotkeyError) { errorShown = data.hotkeyError; toast(data.hotkeyError); }
        if (data.result && Date.now() >= retryAt) {
          const item = data.result;
          if (!delivered.has(item.id)) {
            const bytes = Uint8Array.from(atob(item.png), c => c.charCodeAt(0));
            if (!deliver(new File([bytes], 'shot-' + Date.now() + '.png', { type: 'image/png' }))) {
              retryAt = Date.now() + 5000;
              toast('未找到可接收图片的输入框；图片已保留，打开对话后自动重试');
              await post('failure'); return;
            }
            delivered.add(item.id);
            if (delivered.size > 100) delivered.delete(delivered.values().next().value);
            toast('截图已插入输入框');
          }
          await post('ack', { id: item.id });
        }
      } catch (e) { /* A restarting Host is retried by the next poll. */ }
      finally { running = false; }
    }
    function ShotButton({ usePreference, t }) {
      const preference = usePreference(value => value);
      return h('button', { type: 'button', title: t('hint', { hotkey: preference.hotkey }), onClick: event => {
          void post('start', event.shiftKey ? { hideDsh: !preference.value } : {}).catch(e => toast(e.message));
        },
        style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'flex-end', gap: 3, padding: '0 5px 5px', boxSizing: 'border-box', height: 28, fontFamily: 'inherit', fontSize: 13, lineHeight: '18px', whiteSpace: 'nowrap' } },
        h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
          h('path', { d: 'M3 7h4l2-3h6l2 3h4v13H3z' }), h('circle', { cx: 12, cy: 13, r: 4 })), h('span', null, t('label')));
    }
    function SettingsIcon({ size }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: ICON_REGULAR_STROKE, 'aria-hidden': true },
        h('path', { d: 'M5.5 2.5h-3v3m8-3h3v3m0 5v3h-3m-5 0h-3v-3' }),
        h('rect', { x: 5, y: 5, width: 6, height: 6, strokeDasharray: '2 1' }));
    }
    function SettingsButton({ size, wide, active, label, classes, openSettings, usePreference }) {
      const ready = usePreference(value => value.ready);
      return h(Tooltip, { label, delayMs: 500, disabled: wide }, h('button', { type: 'button', className: classes.button, 'aria-label': label, 'aria-current': active ? 'page' : undefined, disabled: !ready, onClick: openSettings },
        h('span', { className: classes.glyph, 'aria-hidden': true }, h(SettingsIcon, { size })),
        wide && h('span', { className: classes.title }, label)));
    }
    function SettingsPage(props) {
      const ready = props.usePreference(value => value.ready);
      return ready ? h(SettingsForm, props) : h('div', { className: 'dsh-shot-settings-loading', 'aria-busy': true }, h(IconLoadingOutlineRegular, { size: 24 }));
    }
    function SettingsForm({ usePreference, closeSettings, t }) {
      const preference = usePreference(value => value);
      const [saving, setSaving] = React.useState(false);
      const [shortcutDraft, setShortcutDraft] = React.useState(preference.hotkey);
      const [settingsError, setSettingsError] = React.useState('');
      const changePreference = async value => {
        setSaving(true); setSettingsError('');
        try { await post('settings', { hideDsh: value }); }
        catch (error) { setSettingsError(error.message); }
        finally { setSaving(false); }
      };
      const saveShortcut = async () => {
        setSaving(true); setSettingsError('');
        try { const data = await post('settings', { hotkey: shortcutDraft }); toast(t('hotkey') + '：' + data.hotkey); }
        catch (error) { setSettingsError(error.message); }
        finally { setSaving(false); }
      };
      const enableGameCompatibility = async () => {
        setSettingsError('');
        try { await post('gameCompatibility'); toast('请确认 Windows 提示，启用后即可返回游戏截图'); }
        catch (error) { setSettingsError(error.message); }
      };
      return h('section', { className: 'dsh-shot-settings', 'aria-label': t('settings') },
        h('div', { className: 'dsh-shot-settings-inner' }, h('h1', null, t('settings')),
        h('div', { className: 'dsh-shot-settings-card' },
        h('ol', { className: 'dsh-shot-settings-list', role: 'list' },
          h('li', null, h('div', { className: 'dsh-shot-numbered-control' }, h(Checkbox, { className: 'dsh-shot-setting-title dsh-shot-hide-option', checked: preference.value, disabled: saving || !preference.ready,
            onChange: changePreference, label: t('hide'), title: t('hideHint') }))),
          h('li', null, h('div', { className: 'dsh-shot-settings-row' },
            h('label', { className: 'dsh-shot-numbered-control' }, h('span', { className: 'dsh-shot-setting-title dsh-shot-shortcut-label' }, t('hotkey')),
              h(Input, { className: 'dsh-shot-shortcut-input', value: shortcutDraft, 'aria-label': t('hotkey'),
                disabled: saving || !preference.ready, placeholder: 'Ctrl+Alt+A',
                onChange: event => setShortcutDraft(event.target.value),
                onKeyDown: event => { if (event.key === 'Enter' && !saving && preference.ready) { event.preventDefault(); void saveShortcut(); } } })),
            h('p', { className: 'dsh-shot-settings-hint' }, t('examples')))),
          h('li', null, h('div', { className: 'dsh-shot-settings-row' },
            h('div', { className: 'dsh-shot-numbered-control' }, h(Button, { variant: 'outline', className: 'dsh-shot-setting-title dsh-shot-game-button', disabled: preference.gameCompatibilityReady || preference.gameCompatibilityEnabling,
              onClick: () => { void enableGameCompatibility(); } },
              t(preference.gameCompatibilityReady ? 'gameReady' : preference.gameCompatibilityEnabling ? 'gamePending' : 'gameEnable'))),
            h('p', { className: 'dsh-shot-settings-hint' }, t('gameHint'))))),
        (settingsError || preference.problem) && h('p', { role: 'alert' }, settingsError || preference.problem),
        h('div', { className: 'dsh-shot-settings-actions' },
          h(Button, { variant: 'primary', disabled: saving, onClick: () => { void saveShortcut(); } }, t('save')),
          h(Button, { disabled: saving, onClick: () => setShortcutDraft('Ctrl+Shift+X') }, t('reset')),
          h(Button, { disabled: saving, onClick: closeSettings }, t('cancel'))))));
    }
    ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-shot', order: 20, locale: composerLocale, inject: preferenceProps }, ShotButton));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dsh-shot-settings', order: 5, label: () => t('settings') },
      SettingsIcon));
    ctx.slots.inject('sidebar.panellist.button', () => ctx.slots.register({ name: 'sidebar.panellist.button', key: 'dsh-shot-settings',
      inject: () => ({ hooks: { preference: preferences }, openSettings }) }, SettingsButton));
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-shot-settings', locale: namespace,
      inject: () => ({ hooks: { preference: preferences }, closeSettings }) }, SettingsPage));
      ctx.effect(() => {
        stopped = false; void poll(); const timer = setInterval(() => { void poll(); }, 700);
        return () => { stopped = true; clearInterval(timer); clearTimeout(toast.timer); document.getElementById('dsh-shot-toast')?.remove(); };
      });
    } };
  },
});
