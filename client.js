window.__ModuleLoader__.load({
  id: '@local/dsh-xingheng',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useSyncExternalStore } = React;
    const dictionaries = {
      zh: {
        title: '星衡 · 子代理配置', subtitle: '按任务角色选择模型与推理强度。主控模型仍在会话中设置。',
        team: '团队协作已启用：在会话标题栏打开「智能体团队」查看成员与共享任务。创建队友支持全新／继承对话；原生队友沿用主控模型，以下三组配置仅控制普通子任务。',
        scope: '仅作用于「星衡 · 协作」预设。保存后，下一次创建的子代理使用新配置；已运行的子代理不变。',
        iterate: '快速迭代', implement: '特性实现', analyze: '分析规划',
        iterateHelp: '局部修复、小改进、单点检查', implementHelp: '功能开发、接口实现、测试编写', analyzeHelp: '代码审查、架构分析、复杂问题诊断',
        provider: '提供商', model: '模型', effort: '推理强度', adapter: '原生默认（同模型可继承主控）',
        save: '保存配置', saving: '正在保存…', reload: '重新读取', loading: '正在读取实际配置…',
        dirty: '有未保存的更改', clean: '与已保存配置一致', saved: '已保存并回读确认；下一个子代理将使用新配置。',
        defaults: '填入初始组合', defaultsHelp: '仅填入草稿，不会自动保存；不代表价格或能力排名。',
        error: '操作未完成：', choose: '请选择', unavailable: '当前配置中的项目不在目录中；请重新选择后保存。',
        confirm: '放弃未保存的更改并重新读取？', noPreset: '星衡预设未激活；请检查插件管理器中的诊断。',
        version: '版本', pending: '请选择目录内的模型与推理档位',
      },
      en: {
        title: 'Xingheng · Subagent configuration', subtitle: 'Choose models and reasoning efforts by role. The lead model stays in session controls.',
        team: 'Agent Teams is enabled. Open the Team panel in the session header for members and shared tasks. Teammates use fresh or forked context and inherit the lead model; the three routes below control ordinary subagents only.',
        scope: 'Only affects the Xingheng collaboration preset. Saved routes apply to the next child; running children are unchanged.',
        iterate: 'Quick iteration', implement: 'Feature implementation', analyze: 'Analysis and planning',
        iterateHelp: 'Local fixes, small improvements and spot checks', implementHelp: 'Features, API implementation and test writing', analyzeHelp: 'Review, architecture analysis and complex debugging',
        provider: 'Provider', model: 'Model', effort: 'Reasoning effort', adapter: 'Native default (may inherit lead effort)',
        save: 'Save configuration', saving: 'Saving…', reload: 'Reload', loading: 'Reading actual configuration…',
        dirty: 'Unsaved changes', clean: 'Matches saved configuration', saved: 'Saved and read back. The next child will use these routes.',
        defaults: 'Fill initial combination', defaultsHelp: 'Only changes the draft. No price or capability ranking is implied.',
        error: 'Operation failed: ', choose: 'Choose', unavailable: 'A saved choice is no longer in the catalog; select an available option.',
        confirm: 'Discard unsaved changes and reload?', noPreset: 'The Xingheng preset is unavailable. Check plugin diagnostics.',
        version: 'Version', pending: 'Select an advertised model and reasoning effort',
      },
    };
    const roles = ['iterate', 'implement', 'analyze'];
    const defaults = {
      iterate: { provider: 'zero', model: 'deepseek-v4.1-flash-1017', effort: 'high' },
      implement: { provider: 'zero', model: 'gpt-6.1-sol', effort: 'medium' },
      analyze: { provider: 'zero', model: 'gpt-6.1-terra', effort: 'high' },
    };
    const styles = `
      .xh-page{color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6;max-width:820px;margin:0 auto;padding:4px 0 24px}
      .xh-page *{box-sizing:border-box}.xh-page h2{font-size:21px;font-weight:600;letter-spacing:-.3px;margin:0 0 8px}.xh-page h3{font-size:15px;font-weight:600;margin:0}
      .xh-sub,.xh-help{color:var(--dsw-alias-label-secondary);margin:0}.xh-help{font-size:12px}.xh-scope{padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);margin:20px 0}
      .xh-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:18px;margin:12px 0}.xh-role{display:flex;gap:12px;align-items:center;margin-bottom:14px}.xh-index{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px}
      .xh-grid{display:grid;grid-template-columns:minmax(100px,1fr) minmax(140px,2fr) minmax(110px,1fr);gap:12px}.xh-field{display:grid;gap:6px;min-width:0}.xh-field span{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .xh-page select,.xh-page button{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;min-height:40px;padding:8px 12px;max-width:100%}.xh-page select{width:100%;min-width:0;text-overflow:ellipsis}.xh-page button{cursor:pointer;white-space:normal}.xh-page button:disabled,.xh-page select:disabled{opacity:.5;cursor:not-allowed}.xh-page :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .xh-page .xh-primary{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);font-weight:600}.xh-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:20px}.xh-status{font-size:12px;color:var(--dsw-alias-label-secondary)}.xh-error{color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;overflow-wrap:anywhere}.xh-success{color:var(--dsw-alias-state-success-primary)}.xh-warning{color:var(--dsw-alias-state-warn-primary)}.xh-footer{margin-top:18px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:14px}.xh-fill{margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      @media(max-width:620px){.xh-grid{grid-template-columns:1fr}.xh-page select,.xh-page button{min-height:44px}.xh-card{padding:14px}.xh-actions button{flex:1}.xh-page h2{font-size:19px}}
    `;
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [lang, dict] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register('xingheng', lang, dict));
        const t = ctx.locale.bind('xingheng');
        function Panel() {
          useSyncExternalStore(cb => ctx.locale.subscribe(cb), () => ctx.locale.getSnapshot());
          const [snapshot, setSnapshot] = useState(null);
          const [draft, setDraft] = useState(null);
          const [busy, setBusy] = useState(false);
          const [error, setError] = useState('');
          const [success, setSuccess] = useState(false);
          const alive = useRef(true);
          const abort = useRef(null);
          const busyRef = useRef(false);
          const dirty = draft && JSON.stringify(draft) !== JSON.stringify(snapshot?.workers);
          async function transfer(body) {
            if (busyRef.current) return;
            busyRef.current = true;
            setBusy(true); setError(''); setSuccess(false);
            abort.current = new AbortController();
            try {
              // Relative URL preserves a reverse proxy's mount prefix; same-origin cookie authenticates.
              const res = await fetch('./api/xingheng/v3', { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin', signal: abort.current.signal, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
              if (alive.current) { setSnapshot(data); setDraft(structuredClone(data.workers)); setSuccess(Boolean(body)); }
            } catch (cause) { if (alive.current && cause.name !== 'AbortError') setError(cause.message); }
            finally { busyRef.current = false; if (alive.current) setBusy(false); }
          }
          useEffect(() => {
            alive.current = true; transfer();
            return () => { alive.current = false; abort.current?.abort(); };
          }, []);
          function edit(role, key, value) {
            setSuccess(false);
            setDraft(prev => ({ ...prev, [role]: { ...prev[role], [key]: value, ...(key === 'provider' ? { model: '', effort: '' } : key === 'model' ? { effort: '' } : {}) } }));
          }
          const valid = draft && roles.every(role => {
            const provider = snapshot.providers.find(p => p.id === draft[role].provider);
            const model = provider?.models.find(m => m.id === draft[role].model);
            return model && !model.error && (!draft[role].effort || model.efforts.some(e => e.id === draft[role].effort));
          });
          const select = (role, key, value, options) => h('label', { className: 'xh-field', key },
            h('span', null, t(key)), h('select', {
              'aria-label': `${t(role)} · ${t(key)}`, value, disabled: busy,
              onChange: e => edit(role, key, e.target.value),
            }, h('option', { value: '' }, key === 'effort' ? t('adapter') : t('choose')),
            value && !options.some(o => o.id === value) ? h('option', { value, disabled: true }, value) : null,
            ...options.map(o => h('option', { key: o.id, value: o.id, disabled: Boolean(o.error) }, o.name))));
          return h('section', { className: 'xh-page', 'aria-label': t('title'), 'aria-busy': busy },
            h('style', null, styles),
            h('h2', null, t('title')), h('p', { className: 'xh-sub' }, t('subtitle')),
            h('p', { className: 'xh-scope' }, t('scope')),
            h('p', { className: 'xh-scope' }, t('team')),
            !snapshot && !error ? h('p', { role: 'status' }, t('loading')) : null,
            snapshot && !snapshot.preset ? h('p', { className: 'xh-warning', role: 'alert' }, t('noPreset')) : null,
            ...(draft ? roles.map((role, index) => {
              const provider = snapshot.providers.find(p => p.id === draft[role].provider);
              const model = provider?.models.find(m => m.id === draft[role].model);
              return h('section', { className: 'xh-card', key: role },
                h('header', { className: 'xh-role' }, h('span', { className: 'xh-index', 'aria-hidden': true }, `0${index + 1}`), h('div', null, h('h3', null, t(role)), h('p', { className: 'xh-help' }, t(`${role}Help`)))),
                h('div', { className: 'xh-grid' }, select(role, 'provider', draft[role].provider, snapshot.providers), select(role, 'model', draft[role].model, provider?.models ?? []), select(role, 'effort', draft[role].effort, model?.efforts ?? [])),
                (!model || model.error || provider?.error) ? h('p', { className: 'xh-warning' }, model?.error || provider?.error || t('unavailable')) : null);
            }) : []),
            error ? h('p', { className: 'xh-error', role: 'alert' }, t('error') + error) : null,
            success ? h('p', { className: 'xh-success', role: 'status' }, t('saved')) : null,
            h('div', { className: 'xh-actions' },
              h('button', { className: 'xh-primary', type: 'button', disabled: busy || !valid || !dirty, onClick: () => transfer({ action: 'save', workers: draft, expectedRevision: snapshot.revision }) }, busy ? t(snapshot ? 'saving' : 'loading') : t('save')),
              h('button', { type: 'button', disabled: busy, onClick: () => { if (!dirty || window.confirm(t('confirm'))) transfer(); } }, t('reload')),
              h('span', { className: 'xh-status', role: 'status' }, dirty ? t('dirty') : t('clean'))),
            snapshot ? h('div', { className: 'xh-fill' }, h('button', { type: 'button', disabled: busy, onClick: () => { setDraft(structuredClone(defaults)); setSuccess(false); } }, t('defaults')), h('span', { className: 'xh-help' }, t('defaultsHelp'))) : null,
            h('footer', { className: 'xh-footer xh-help' }, `${t('version')} 3.0.0 · subagent_iterate / subagent_implement / subagent_analyze`));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'xingheng', order: 22, label: () => t('title') }, Panel));
      },
    };
  },
});
