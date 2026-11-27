/**
 * Client half of dsh-deeptutor-study.
 *
 * Two sidebar entries share this file:
 *   - 错题本      (dsh-deeptutor-study/wrongbook)
 *   - 知识库管理  (dsh-deeptutor-study/knowledge)
 *
 * Both are plain ES modules registered through the Harness module loader; there
 * is no build step, so this file is the shipped artifact.
 */

/**
 * Client half of the wrong-answer notebook.
 *
 * Registers one left-sidebar entry and the matching global `main` panel: the
 * notebook itself, grouped by knowledge point, with the reviews due today and
 * the two actions the brief allows.
 */

window.__ModuleLoader__.load({
  id: 'dsh-deeptutor-study',
  factory(require) {
    /**
     * 「选段提问」的作用范围：只在学习模式出现，还是所有会话都出现。
     * 功能本体和「功能」面板里的选择器共用一个状态，避免两处读到的值不一样。
     * 读不到当前预设时按「全局可用」处理，宁可多显示也不要静默失效。
     */
    const askScope = (function () {
      const KEY = 'dsh-study:ask-scope'
      const VALID = ['study', 'all']
      const listeners = new Set()
      let scope = 'study'
      let preset = null
      try {
        const raw = window.localStorage.getItem(KEY)
        if (VALID.indexOf(raw) >= 0) scope = raw
      } catch {
        /* 存不了就用默认值 */
      }
      const emit = () => {
        for (const fn of listeners) {
          try {
            fn(scope)
          } catch {
            /* 单个订阅者出错不该影响其他订阅者 */
          }
        }
      }
      return {
        get: () => scope,
        set(next) {
          scope = VALID.indexOf(next) >= 0 ? next : 'study'
          try {
            window.localStorage.setItem(KEY, scope)
          } catch {
            /* ignore */
          }
          emit()
        },
        preset: () => preset,
        setPreset(value) {
          if (preset === value) return
          preset = value
          emit()
        },
        /** 当前会话能不能用这个功能。 */
        allows() {
          if (scope === 'all') return true
          if (preset === null) return true
          return preset === 'study'
        },
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      }
    })()

    const wrongbook = (function (require) {

    const React = require('react')
    const h = React.createElement

    /** Locale namespace and, at the same time, the panel id this plugin registers. */
    const NS = 'dsh-deeptutor-study/wrongbook'
    /** Authenticated exact route the Host half registers. */
    const ENDPOINT = '/api/study/wrong-answers'
    /** Sidebar position: after the shipped panels. */
    const SIDEBAR_ORDER = 6

    const MESSAGES = {
      zh: {
        panel: '错题本',
        title: '错题本',
        intro: '按知识点归拢答错的题，标出今天该复习的题量和每道题的复习时间。',
        dueTodayCount: '今天该复习',
        statDue: '今天该复习',
        statMastered: '已掌握',
        statTotal: '全部错题',
        badgeDue: '待复习',
        summaryMeta: '共 {total} 题 · 已掌握 {mastered} 题',
        groupCount: '{count} 题',
        loading: '正在读取本机错题…',
        refresh: '刷新',
        markMastered: '已掌握',
        mastered: '已掌握',
        practiceAgain: '再练一次',
        dueToday: '今天到期',
        dueTomorrow: '明天到期',
        dueInDays: '{days} 天后到期',
        overdueDays: '已逾期 {days} 天',
        dueAt: '今天 {time} 到期',
        dueOn: '{date} 到期',
        dueUnset: '未安排复习',
        masteredOn: '{date} 掌握',
        yourAnswer: '你的答案',
        correctAnswer: '正确答案',
        explanation: '解析',
        noAnswer: '未作答',
        noExplanation: '暂无解析',
        emptyTitle: '还没有错题',
        emptyBody: '学习模式判分后会把答错的题写进本机错题文件，这里会自动显示。',
        errorTitle: '读取错题失败',
        retry: '重试',
        fileLabel: '错题文件',
        untitledQuestion: '未记录题目内容',
        uncategorized: '未分类',
        actionFailed: '操作失败：{message}',
        expandHint: '展开题目',
        collapseHint: '收起题目',
        pickOne: '选一个答案（点选项）',
        submitAnswer: '提交答案',
        verdictOk: '答对了 —— 可以点「已掌握」把它移出复习队列',
        verdictBad: '答错了 —— 明天再练一次',
        missingFile: '错题文件还不存在，等学习模式写入第一道错题。',
      },
      en: {
        panel: 'Wrong answers',
        title: 'Wrong-answer notebook',
        intro: 'Graded mistakes grouped by knowledge point, with the reviews due today and when each one comes back.',
        dueTodayCount: 'Due today',
        statDue: 'Due today',
        statMastered: 'Mastered',
        statTotal: 'All questions',
        badgeDue: 'Due',
        summaryMeta: '{total} recorded · {mastered} mastered',
        groupCount: '{count}',
        loading: 'Reading the local wrong-answer file…',
        refresh: 'Refresh',
        markMastered: 'Mastered',
        mastered: 'Mastered',
        practiceAgain: 'Practice again',
        dueToday: 'Due today',
        dueTomorrow: 'Due tomorrow',
        dueInDays: 'Due in {days} days',
        overdueDays: 'Overdue by {days} days',
        dueAt: 'Due today at {time}',
        dueOn: 'Due {date}',
        dueUnset: 'No review scheduled',
        masteredOn: 'Mastered {date}',
        yourAnswer: 'Your answer',
        correctAnswer: 'Correct answer',
        explanation: 'Explanation',
        noAnswer: 'No answer recorded',
        noExplanation: 'No explanation recorded',
        emptyTitle: 'No wrong answers yet',
        emptyBody: 'After the learning mode grades a quiz, the questions you miss are written to the local wrong-answer file and appear here.',
        errorTitle: 'Could not read the wrong answers',
        retry: 'Retry',
        fileLabel: 'Notebook file',
        untitledQuestion: 'Question text not recorded',
        uncategorized: 'Uncategorized',
        actionFailed: 'Action failed: {message}',
        expandHint: 'Expand question',
        collapseHint: 'Collapse question',
        pickOne: 'Pick one answer',
        submitAnswer: 'Submit answer',
        verdictOk: 'Correct — you can mark it mastered',
        verdictBad: 'Wrong — it comes back tomorrow',
        missingFile: 'The wrong-answer file does not exist yet; it appears once the learning mode records the first mistake.',
      },
    }

    /**
     * Read one host service without letting a missing one break the panel.
     * @param ctx - client plugin context.
     * @param name - service name.
     * @returns the service, or undefined.
     */
    function service(ctx, name) {
      try {
        return ctx.get(name)
      } catch {
        return undefined
      }
    }

    /**
     * Pick the workspace whose notebook should be shown: the one holding the
     * session on screen, otherwise the most recent workspace.
     * @param ctx - client plugin context.
     * @returns a workspace id, or undefined to let the host default.
     */
    function pickWorkspaceId(ctx) {
      const workspaces = service(ctx, 'workspaces')
      let snapshot
      try {
        snapshot = workspaces && workspaces.list && workspaces.list.getSnapshot()
      } catch {
        snapshot = undefined
      }
      const rows = snapshot && Array.isArray(snapshot.items) ? snapshot.items : []
      if (rows.length === 0) return undefined
      const sessions = service(ctx, 'sessions')
      let sessionRows = []
      try {
        const sessionsSnapshot = sessions && sessions.list && sessions.list.getSnapshot()
        sessionRows = sessionsSnapshot && sessionsSnapshot.byId ? Object.values(sessionsSnapshot.byId) : []
      } catch {
        sessionRows = []
      }
      const current = sessionRows.find((row) => row && (row.retainedBy ? row.retainedBy.mainView || 0 : 0) > 0)
      if (current) {
        const id = current.id === undefined ? current.sessionId : current.id
        const owner = rows.find((row) => row && Array.isArray(row.sessionIds) && row.sessionIds.includes(id))
        if (owner && owner.workspaceId) return owner.workspaceId
      }
      return rows[0] && rows[0].workspaceId ? rows[0].workspaceId : undefined
    }

    /**
     * Turn one recorded value into a date.
     * @param value - ISO string, timestamp number (seconds or milliseconds), or Date.
     * @returns the date, or undefined when the value is absent or unparsable.
     */
    function toDate(value) {
      if (value === undefined || value === null || value === '') return undefined
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
      if (typeof value === 'number') {
        const milliseconds = value < 100000000000 ? value * 1000 : value
        const date = new Date(milliseconds)
        return Number.isNaN(date.getTime()) ? undefined : date
      }
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? undefined : date
    }

    /** Midnight of the day containing `value`. */
    function startOfDay(value) {
      const date = new Date(value)
      date.setHours(0, 0, 0, 0)
      return date
    }

    /** Last millisecond of the day containing `value`. */
    function endOfDay(value) {
      const date = new Date(value)
      date.setHours(23, 59, 59, 999)
      return date
    }

    /** Whole calendar days from `from` to `to`. */
    function dayDistance(from, to) {
      return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)
    }

    /** First present, non-empty field of one record. */
    function field(record, names) {
      for (const name of names) {
        const value = record[name]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }

    /**
     * Normalize one stored record into what the panel renders.
     * @param record - raw record from the notebook file.
     * @param index - position, used only to synthesize a missing id.
     * @returns the normalized item.
     */
    function normalize(record, index) {
      const id = field(record, ['id', 'key', 'questionId', 'uid'])
      const mastered = record.mastered === true || record.status === 'mastered' || record.state === 'mastered'
      return {
        id: id === undefined ? `item-${index}` : String(id),
        topic: field(record, ['topic', 'knowledgePoint', 'knowledge', 'category', 'chapter', 'subject']),
        question: field(record, ['question', 'prompt', 'stem', 'title', 'text']),
        userAnswer: field(record, ['userAnswer', 'yourAnswer', 'answer', 'answerText', 'selected', 'wrongAnswer']),
        correctAnswer: field(record, ['correctAnswer', 'rightAnswer', 'correct', 'expected', 'answerKey']),
        explanation: field(record, ['explanation', 'analysis', 'comment', 'reason', 'rationale']),
        options: Array.isArray(record.options) ? record.options.map((option) => String(option)) : undefined,
        correctIndex: Number.isInteger(record.correctIndex) ? record.correctIndex : undefined,
        due: toDate(field(record, ['dueAt', 'reviewAt', 'nextReviewAt', 'due'])),
        wrongAt: toDate(field(record, ['wrongAt', 'createdAt', 'answeredAt', 'time'])),
        mastered,
        masteredAt: toDate(field(record, ['masteredAt'])),
      }
    }

    /** Normalize every record the host returned. */
    function normalizeAll(records) {
      if (!Array.isArray(records)) return []
      const items = []
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index]
        if (record === null || typeof record !== 'object' || Array.isArray(record)) continue
        items.push(normalize(record, index))
      }
      return items
    }

    /** Short date, localized through Intl for the active language. */
    function formatDate(date, language) {
      try {
        return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : undefined, { month: 'short', day: 'numeric' }).format(date)
      } catch {
        return date.toISOString().slice(0, 10)
      }
    }

    /** Wall-clock time of one date. */
    function formatTime(date) {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    /**
     * Human sentence for one item's scheduling state.
     * @param item - normalized item.
     * @param now - current time.
     * @param t - translator for this plugin's namespace.
     * @param language - active locale id.
     * @returns the sentence to show beside the question.
     */
    function dueSentence(item, now, t, language) {
      if (item.mastered) {
        return item.masteredAt ? t('masteredOn', { date: formatDate(item.masteredAt, language) }) : t('mastered')
      }
      if (!item.due) return t('dueUnset')
      const days = dayDistance(now, item.due)
      if (days < 0) return t('overdueDays', { days: String(-days) })
      if (days === 0) return t('dueAt', { time: formatTime(item.due) })
      if (days === 1) return t('dueTomorrow')
      if (days <= 30) return t('dueInDays', { days: String(days) })
      return t('dueOn', { date: formatDate(item.due, language) })
    }

    /** Sort key: unmastered first, then due time, then most recent mistake. */
    function compareItems(left, right) {
      if (left.mastered !== right.mastered) return left.mastered ? 1 : -1
      const leftDue = left.due ? left.due.getTime() : Number.POSITIVE_INFINITY
      const rightDue = right.due ? right.due.getTime() : Number.POSITIVE_INFINITY
      if (leftDue !== rightDue) return leftDue - rightDue
      const leftWrong = left.wrongAt ? left.wrongAt.getTime() : 0
      const rightWrong = right.wrongAt ? right.wrongAt.getTime() : 0
      return rightWrong - leftWrong
    }

    /** Group normalized items by knowledge point, ordering groups by their earliest review. */
    function groupItems(items, fallbackTopic) {
      const groups = new Map()
      for (const item of items) {
        const topic = item.topic === undefined ? fallbackTopic : String(item.topic)
        if (!groups.has(topic)) groups.set(topic, [])
        groups.get(topic).push(item)
      }
      const rows = []
      for (const [topic, list] of groups) {
        const sorted = list.slice().sort(compareItems)
        const next = sorted.find((item) => !item.mastered && item.due)
        rows.push({ topic, items: sorted, nextAt: next && next.due ? next.due.getTime() : Number.POSITIVE_INFINITY })
      }
      rows.sort((left, right) => {
        if (left.nextAt !== right.nextAt) return left.nextAt - right.nextAt
        return left.topic.localeCompare(right.topic)
      })
      return rows
    }

    const styles = {
      page: {
        boxSizing: 'border-box',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 clamp(20px, 4vw, 48px)',
        color: 'var(--dsw-alias-label-primary)',
      },
      column: { boxSizing: 'border-box', width: '100%', maxWidth: 960 },
      head: {
        display: 'flex',
        flex: 'none',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        paddingTop: 'calc(28px + var(--dsh-frame-top-clearance, 0px))',
        paddingBottom: 16,
      },
      heading: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
      title: { margin: 0, fontSize: 20, fontWeight: 500, lineHeight: '28px' },
      intro: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)' },
      headActions: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
      button: {
        height: 28,
        padding: '0 12px',
        borderRadius: 8,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12.5,
        lineHeight: '20px',
        cursor: 'pointer',
      },
      body: {
        boxSizing: 'border-box',
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: 960,
        overflowY: 'auto',
        paddingBottom: 48,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      },
      summary: {
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '0.5px solid var(--dsw-alias-border-l2)',
      },
      summaryValue: { fontSize: 26, fontWeight: 600, lineHeight: '32px', fontVariantNumeric: 'tabular-nums' },
      summaryLabel: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginLeft: 6 },
      summaryMeta: { marginLeft: 'auto', fontSize: 12.5, color: 'var(--dsw-alias-label-tertiary)' },
      statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 },
      stat: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '12px 14px',
        borderRadius: 12,
        border: '0.5px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      statValue: {
        fontSize: 24,
        fontWeight: 600,
        lineHeight: '30px',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--dsw-alias-label-primary)',
      },
      statLabel: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      group: { display: 'flex', flexDirection: 'column', gap: 10 },
      groupHead: { display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 },
      groupTitle: { margin: 0, fontSize: 13, fontWeight: 560, lineHeight: '22px' },
      groupCount: {
        fontSize: 11.5,
        lineHeight: '18px',
        padding: '0 8px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
      card: {
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 12,
        padding: '12px 14px',
        background: 'var(--dsw-alias-bg-layer-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      cardHead: { display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 },
      openButton: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        background: 'transparent',
        border: 0,
        padding: 0,
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
      },
      question: {
        display: 'block',
        maxWidth: '100%',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '20px',
        overflowWrap: 'anywhere',
      },
      metaLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      due: { fontSize: 12.5, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      dueToday: { fontSize: 12.5, lineHeight: '18px', color: 'var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warn-primary))' },
      badge: {
        fontSize: 11,
        lineHeight: '18px',
        padding: '0 8px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent)',
        color: 'var(--dsw-alias-state-success-secondary, var(--dsw-alias-state-success-primary))',
        whiteSpace: 'nowrap',
      },
      badgeDue: {
        fontSize: 11,
        lineHeight: '18px',
        padding: '0 8px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent)',
        color: 'var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warn-primary))',
        whiteSpace: 'nowrap',
      },
      actions: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
      actionButton: {
        height: 28,
        padding: '0 12px',
        borderRadius: 9,
        border: '0.5px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12,
        lineHeight: '18px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      actionButtonDisabled: { opacity: 0.45, cursor: 'default' },
      details: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        margin: '2px 0 2px',
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-module-platform)',
        borderLeft: '2px solid var(--dsw-alias-label-primary)',
      },
      detailLabel: { fontSize: 11.5, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      detailText: { fontSize: 13, lineHeight: '20px', margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
      yourAnswer: { color: 'var(--dsw-alias-state-error-primary)' },
      correctAnswer: { color: 'var(--dsw-alias-state-success-primary)' },
      empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '40px 24px',
        borderRadius: 14,
        border: '0.5px dashed var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        lineHeight: '20px',
        textAlign: 'center',
      },
      emptyTitle: { margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' },
      emptyBody: { margin: 0 },
      code: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11.5,
        padding: '2px 6px',
        borderRadius: 4,
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-secondary)',
        overflowWrap: 'anywhere',
      },
      error: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--dsw-alias-state-warn-tertiary)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12.5,
        lineHeight: '18px',
      },
      errorTitle: { color: 'var(--dsw-alias-state-error-primary)', fontWeight: 500 },
      status: { fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
    }

    /**
     * Build the notebook page bound to one plugin context and translator.
     * @param ctx - client plugin context.
     * @param t - translator for this plugin's namespace.
     * @returns the page component.
     */
    function createPage(ctx, t) {
      const activeLanguage = () => {
        const locale = service(ctx, 'locale')
        try {
          const snapshot = locale && locale.getSnapshot && locale.getSnapshot()
          return snapshot && typeof snapshot.active === 'string' ? snapshot.active : 'en'
        } catch {
          return 'en'
        }
      }

      return function NotebookPage() {
        const [state, setState] = React.useState({ phase: 'loading', items: [], file: null, workspace: null, error: null })
        const [expanded, setExpanded] = React.useState({})
        const [busy, setBusy] = React.useState(null)
        const [notice, setNotice] = React.useState(null)
        const [picks, setPicks] = React.useState({})
        const [graded, setGraded] = React.useState({})
        const alive = React.useRef(true)
        const wasActive = React.useRef(false)

        React.useEffect(
          () => () => {
            alive.current = false
          },
          [],
        )

        const load = React.useCallback(async () => {
          setState((previous) => ({ ...previous, phase: previous.items.length > 0 ? previous.phase : 'loading', error: null }))
          try {
            const workspaceId = pickWorkspaceId(ctx)
            const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
            const response = await fetch(`${ENDPOINT}${query}`, {
              headers: { accept: 'application/json' },
              credentials: 'same-origin',
            })
            if (!response.ok) {
              let detail = `HTTP ${response.status}`
              try {
                const payload = await response.json()
                if (payload && typeof payload.message === 'string') detail = payload.message
              } catch {
                /* keep the status line */
              }
              throw new Error(detail)
            }
            const payload = await response.json()
            if (!alive.current) return
            setState({
              phase: 'ready',
              items: normalizeAll(payload && payload.items),
              file: payload && payload.file ? payload.file : null,
              workspace: payload && payload.workspace ? payload.workspace : null,
              error: null,
            })
          } catch (error) {
            if (!alive.current) return
            const message = error instanceof Error ? error.message : String(error)
            setState((previous) => ({ ...previous, phase: 'error', error: message }))
          }
        }, [])

        React.useEffect(() => {
          load()
        }, [load])

        React.useEffect(() => {
          const layout = service(ctx, 'layout')
          const info = layout && layout.panelInfo
          if (!info || typeof info.subscribe !== 'function') return undefined
          try {
            const stop = info.subscribe((snapshot) => {
              const active = !!(snapshot && snapshot.activePanelId === NS)
              if (active && !wasActive.current) load()
              wasActive.current = active
            })
            return typeof stop === 'function' ? stop : undefined
          } catch {
            return undefined
          }
        }, [load])

        const toggle = React.useCallback((id) => {
          setExpanded((previous) => ({ ...previous, [id]: previous[id] !== true }))
        }, [])

        const act = React.useCallback(
          async (item, action) => {
            if (busy !== null) return
            setBusy(item.id)
            setNotice(null)
            try {
              const workspaceId = pickWorkspaceId(ctx)
              const body = { id: item.id, action }
              if (workspaceId) body.workspaceId = workspaceId
              const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
              })
              if (!response.ok) {
                let detail = `HTTP ${response.status}`
                try {
                  const payload = await response.json()
                  if (payload && typeof payload.message === 'string') detail = payload.message
                } catch {
                  /* keep the status line */
                }
                throw new Error(detail)
              }
              await load()
            } catch (error) {
              if (!alive.current) return
              setNotice(t('actionFailed', { message: error instanceof Error ? error.message : String(error) }))
            } finally {
              if (alive.current) setBusy(null)
            }
          },
          [busy, load],
        )

        const language = activeLanguage()
        const now = new Date()
        const items = state.items
        const dueToday = items.filter((item) => !item.mastered && (!item.due || item.due.getTime() <= endOfDay(now).getTime()))
        const masteredCount = items.filter((item) => item.mastered).length
        const groups = groupItems(items, t('uncategorized'))

        const statTile = (value, label, tone) =>
          h(
            'div',
            { style: styles.stat },
            h('div', { style: tone ? { ...styles.statValue, color: tone } : styles.statValue }, String(value)),
            h('div', { style: styles.statLabel }, label),
          )

        const summary = h(
          'div',
          { style: styles.statRow },
          statTile(dueToday.length, t('statDue'), 'var(--dsw-alias-state-warn-primary)'),
          statTile(masteredCount, t('statMastered'), 'var(--dsw-alias-state-success-primary)'),
          statTile(items.length, t('statTotal')),
        )

        const header = h(
          'div',
          { style: styles.head },
          h(
            'div',
            { style: styles.heading },
            h('h1', { style: styles.title }, t('title')),
            h('p', { style: styles.intro }, t('intro')),
          ),
          h(
            'div',
            { style: styles.headActions },
            h(
              'button',
              {
                type: 'button',
                style: styles.button,
                onClick: () => {
                  load()
                },
              },
              t('refresh'),
            ),
          ),
        )

        /** One question card. */
        const renderItem = (item) => {
          const open = expanded[item.id] === true
          const isBusy = busy === item.id
          const dueStyle = !item.mastered && item.due && item.due.getTime() <= endOfDay(now).getTime() ? styles.dueToday : styles.due
          const actionStyle = (disabled) => (disabled ? { ...styles.actionButton, ...styles.actionButtonDisabled } : styles.actionButton)
          const detailRow = (label, value, extra) =>
            h(
              'div',
              null,
              h('div', { style: styles.detailLabel }, label),
              h('p', { style: { ...styles.detailText, ...(extra || {}) } }, value),
            )
          const quizStyles = {
            wrap: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
            option: {
              textAlign: 'left',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-layer-2)',
              color: 'var(--dsw-alias-label-primary)',
              fontSize: 13,
              lineHeight: '20px',
              cursor: 'pointer',
            },
            picked: { borderColor: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-3)' },
            right: { borderColor: 'var(--dsw-alias-state-success-primary)', color: 'var(--dsw-alias-state-success-primary)' },
            wrong: { borderColor: 'var(--dsw-alias-state-error-primary)', color: 'var(--dsw-alias-state-error-primary)' },
            verdictOk: { margin: 0, fontSize: 12.5, color: 'var(--dsw-alias-state-success-primary)' },
            verdictBad: { margin: 0, fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)' },
            submit: { alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 },
          }
          const renderQuiz = (item) => {
            const options = item.options
            if (!Array.isArray(options) || options.length === 0) {
              return h(
                'div',
                null,
                detailRow(t('yourAnswer'), item.userAnswer === undefined ? t('noAnswer') : String(item.userAnswer), styles.yourAnswer),
                detailRow(t('correctAnswer'), item.correctAnswer === undefined ? t('noAnswer') : String(item.correctAnswer), styles.correctAnswer),
              )
            }
            const picked = picks[item.id]
            const done = graded[item.id]
            const rightIndex = typeof item.correctIndex === 'number' ? item.correctIndex : -1
            const canSubmit = picked !== undefined && !done
            return h(
              'div',
              { style: quizStyles.wrap },
              h('div', { style: styles.detailLabel }, t('pickOne')),
              ...options.map((option, index) =>
                h(
                  'button',
                  {
                    key: item.id + '-' + String(index),
                    type: 'button',
                    disabled: Boolean(done),
                    style: {
                      ...quizStyles.option,
                      ...(picked === index ? quizStyles.picked : null),
                      ...(done && index === rightIndex ? quizStyles.right : null),
                      ...(done && picked === index && index !== rightIndex ? quizStyles.wrong : null),
                    },
                    onClick: () => setPicks((previous) => ({ ...previous, [item.id]: index })),
                  },
                  String.fromCharCode(65 + index) + '. ' + option,
                ),
              ),
              done
                ? h('p', { style: done.correct ? quizStyles.verdictOk : quizStyles.verdictBad }, done.correct ? t('verdictOk') : t('verdictBad'))
                : h(
                    'button',
                    {
                      type: 'button',
                      disabled: !canSubmit,
                      style: {
                        ...quizStyles.submit,
                        background: canSubmit ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-bg-layer-3)',
                        color: canSubmit ? 'var(--dsw-alias-bg-layer-2)' : 'var(--dsw-alias-label-tertiary)',
                        cursor: canSubmit ? 'pointer' : 'default',
                      },
                      onClick: () => {
                        if (picked === undefined) return
                        const ok = picked === rightIndex
                        setGraded((previous) => ({ ...previous, [item.id]: { correct: ok } }))
                        if (ok) act(item, 'mastered')
                      },
                    },
                    t('submitAnswer'),
                  ),
            )
          }
          return h(
            'li',
            { key: item.id, style: styles.card },
            h(
              'div',
              { style: styles.cardHead },
              h(
                'button',
                {
                  type: 'button',
                  style: styles.openButton,
                  'aria-expanded': open,
                  title: open ? t('collapseHint') : t('expandHint'),
                  onClick: () => toggle(item.id),
                },
                h('span', { style: styles.question }, item.question === undefined ? t('untitledQuestion') : String(item.question)),
                h(
                  'span',
                  { style: styles.metaLine },
                  !item.mastered && item.due && item.due.getTime() <= endOfDay(now).getTime()
                    ? h('span', { style: styles.badgeDue }, t('badgeDue'))
                    : null,
                  h('span', { style: dueStyle }, dueSentence(item, now, t, language)),
                  item.mastered ? h('span', { style: styles.badge }, t('mastered')) : null,
                ),
              ),
              h(
                'div',
                { style: styles.actions },
                h(
                  'button',
                  {
                    type: 'button',
                    style: actionStyle(isBusy || item.mastered),
                    disabled: isBusy || item.mastered,
                    onClick: () => {
                      act(item, 'mastered')
                    },
                  },
                  t('markMastered'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    style: actionStyle(isBusy),
                    disabled: isBusy,
                    onClick: () => {
                      act(item, 'practice')
                      setGraded((previous) => {
                        const next = { ...previous }
                        delete next[item.id]
                        return next
                      })
                      setPicks((previous) => {
                        const next = { ...previous }
                        delete next[item.id]
                        return next
                      })
                      setExpanded((previous) => ({ ...previous, [item.id]: true }))
                    },
                  },
                  t('practiceAgain'),
                ),
              ),
            ),
            open
              ? h(
                  'div',
                  { style: styles.details },
                  renderQuiz(item),
                  detailRow(t('explanation'), item.explanation === undefined ? t('noExplanation') : String(item.explanation)),
                )
              : null,
          )
        }

        const filePath = state.file && typeof state.file.path === 'string' ? state.file.path : null

        const empty = h(
          'div',
          { style: styles.empty },
          h('div', { style: { fontSize: 26, lineHeight: '32px' } }, '📭'),
          h('p', { style: styles.emptyTitle }, t('emptyTitle')),
          h('p', { style: styles.emptyBody }, state.file && state.file.exists === false ? t('missingFile') : t('emptyBody')),
          filePath ? h('code', { style: styles.code }, filePath) : null,
        )

        const failure =
          state.error === null
            ? null
            : h(
                'div',
                { style: styles.error },
                h('span', { style: styles.errorTitle }, t('errorTitle')),
                h('span', null, state.error),
                h(
                  'button',
                  {
                    type: 'button',
                    style: styles.button,
                    onClick: () => {
                      load()
                    },
                  },
                  t('retry'),
                ),
              )

        const noticeLine = notice === null ? null : h('div', { style: styles.error }, h('span', null, notice))

        let content
        if (state.phase === 'loading' && items.length === 0) {
          content = h('p', { style: styles.status }, t('loading'))
        } else if (items.length === 0 && state.error !== null) {
          content = null
        } else if (items.length === 0) {
          content = empty
        } else {
          content = groups.map((group) =>
            h(
              'section',
              { key: group.topic, style: styles.group },
              h(
                'div',
                { style: styles.groupHead },
                h('h2', { style: styles.groupTitle }, group.topic),
                h('span', { style: styles.groupCount }, t('groupCount', { count: String(group.items.length) })),
              ),
              h('ul', { style: styles.list }, group.items.map(renderItem)),
            ),
          )
        }

        const footer = filePath
          ? h(
              'p',
              { style: { ...styles.status, margin: 0 } },
              `${t('fileLabel')}: `,
              h('code', { style: styles.code }, filePath),
            )
          : null

        return h(
          'div',
          { style: styles.page },
          h('div', { style: styles.column }, header),
          h(
            'div',
            { style: styles.body },
            failure,
            noticeLine,
            items.length > 0 ? summary : null,
            content,
            footer,
          ),
        )
      }
    }

    /** The left-sidebar entry glyph. */
    function NotebookIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M6 3.75h9.5A2.5 2.5 0 0 1 18 6.25v11.5a2.5 2.5 0 0 0-2.5-2.5H6z' }),
        h('path', { d: 'M6 3.75A1.75 1.75 0 0 0 4.25 5.5v13A1.75 1.75 0 0 0 6 20.25h9.5' }),
        h('path', { d: 'M8.5 8.5h5' }),
        h('path', { d: 'M8.5 12h5' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = service(ctx, 'locale')
        if (locale && typeof locale.register === 'function') {
          ctx.effect(() => locale.register(NS, MESSAGES))
        }
        /** Messages for the language the app is showing right now. */
        const dictionary = () => {
          let language = 'en'
          try {
            const snapshot = locale && locale.getSnapshot && locale.getSnapshot()
            if (snapshot && typeof snapshot.active === 'string') language = snapshot.active
          } catch {
            /* keep the default language */
          }
          if (locale === undefined) {
            const preferred = typeof navigator === 'object' && navigator && typeof navigator.language === 'string' ? navigator.language : ''
            language = preferred.toLowerCase().startsWith('zh') ? 'zh' : 'en'
          }
          return MESSAGES[language] || MESSAGES.en
        }
        const bound = locale && typeof locale.bind === 'function' ? locale.bind(NS) : undefined
        /** Read one message through the host locale service, else straight from this plugin's table. */
        const raw = (key) => {
          if (typeof bound === 'function') {
            try {
              const value = bound(key)
              if (typeof value === 'string' && value !== key) return value
            } catch {
              /* fall through to the local table */
            }
          }
          const messages = dictionary()
          if (messages[key] !== undefined) return messages[key]
          if (MESSAGES.en[key] !== undefined) return MESSAGES.en[key]
          return key
        }
        /** Translate one key and fill `{placeholder}` slots without relying on host interpolation. */
        const t = (key, params) => {
          const text = String(raw(key))
          if (params === undefined || params === null) return text
          return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])))
        }

        const NotebookPage = createPage(ctx, t)

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: NS,
              locale: NS,
            },
            NotebookPage,
          ),
        )

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: NS,
              order: SIDEBAR_ORDER,
              label: () => t('panel'),
              locale: NS,
            },
            NotebookIcon,
          ),
        )

        const layout = service(ctx, 'layout')
        ctx.effect(() => () => {
          try {
            const snapshot = layout && layout.panelInfo && layout.panelInfo.getSnapshot && layout.panelInfo.getSnapshot()
            if (snapshot && snapshot.activePanelId === NS && typeof layout.selectPanel === 'function') {
              layout.selectPanel(null)
            }
          } catch {
            /* the layout is already gone */
          }
        })
      },
    }
    })(require)

    const knowledge = (function (require) {

    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-deeptutor-study/knowledge'
    const ENDPOINT = '/api/study/kb'
    const SIDEBAR_ORDER = 7

    const MESSAGES = {
      zh: {
        panel: '知识库管理',
        title: '知识库管理',
        intro: '列出 DeepTutor 的全部知识库。新建和删除会调用 DeepTutor 自己的命令，可能要跑一两分钟。',
        refresh: '刷新',
        loading: '正在读取知识库…',
        empty: '还没有知识库。下面新建一个。',
        createTitle: '新建知识库',
        namePlaceholder: '知识库名称，例如 视觉方向',
        dirPlaceholder: '点这里选择放文档的文件夹，例如 D:\\books\\ros2',
        dirBrowse: '选择文件夹…',
        dirPickUnavailable: '这个界面没有可用的文件夹选择器，请直接粘贴路径。',
        create: '新建',
        creating: '正在建…',
        folderOnly: '仅建文件夹（稍后再放文档）',
        folderOnlyHint: '只创建知识库目录和登记，不建索引。把文档放进它的 raw/ 后，回到这里点「建索引」。',
        emptyBadge: '空库',
        foldersTitle: '已有文件夹',
        foldersHint: '点击选择；DeepTutor 会把文档复制进知识库，原文件夹保持不动。',
        foldersLoading: '正在读取文件夹…',
        foldersEmpty: '这里没有子文件夹。把资料放进知识库所在位置下的任意文件夹就会出现在这里。',
        foldersUp: '上一级',
        foldersFiles: '个文件',
        foldersDirs: '个目录',
        foldersRefresh: '刷新',
        trash: '删除',
        trashConfirm: '确认？',
        trashTitle: '已删除（可恢复）',
        restore: '恢复',
        reindex: '建索引',
        rename: '改名',
        renameConfirm: '确定',
        cancel: '取消',
        remove: '删除',
        removeConfirm: '确认删除？',
        setDefault: '设为默认',
        isDefault: '默认库',
        docs: '{count} 篇文档',
        chunks: '{count} 个索引块',
        noDocs: '还没索引',
        jobRunning: '{label}：进行中…',
        jobDone: '{label}：完成',
        jobFailed: '{label}：失败',
        showLog: '看日志',
        hideLog: '收起日志',
        error: '出错了：{message}',
        hint: '改名只改本机目录和配置，不会重新索引；删除会连同索引一起清掉。',
        setupTitle: '学习环境',
        setupMissing: 'DeepTutor 环境还没准备好（缺 Python 依赖或配置）。',
        setupReady: 'DeepTutor 环境已就绪。',
        setupRun: '准备学习环境',
        setupRunning: '正在准备…首次会下载约 500MB，可能需要几分钟。',
        setupDone: '准备完成。重启 DSH 后生效。',
        setupFailed: '准备失败，展开日志看原因。',
        docsButton: '文档',
        openFolder: '文件夹',
        rawPathLabel: '放文档的目录',
        review: '温习',
        reviewEmpty: '这个库还没索引，先放文档再点「建索引」。',
        reviewHint: '已请求用「{kb}」温习；提示词已复制到剪贴板 —— 输入框没自动填上就 Ctrl+V 再回车。',
        reviewPrompt: '用「{kb}」知识库带我温习一次：先检索库里我最近学过的主题，挑一个最值得复习的点，按「讲解 → 出题 → 判分」的节奏来，题目用 GenUI quiz 卡片；判分后把错题写进错题本。开始前先问我这次想温习哪个方向。',
        docsTitle: '库里的文档',
        docsEmpty: '这个库还没有文档。',
        docsLoading: '正在列出文档…',
        preview: '预览',
        open: '打开',
        close: '关闭',
        openWithApp: '用系统程序打开',
        openWithAppShort: '打开',
        binaryNote: '这是二进制文档（{kind}），页面里显示不了内容。点「用系统程序打开」。',
        truncatedNote: '只显示前 200 KB。',
        bytes: '{size}',
        back: '返回列表',
      },
      en: {
        panel: 'Knowledge bases',
        title: 'Knowledge bases',
        intro: 'Every DeepTutor knowledge base. Create and delete call DeepTutor’s own commands and can take a minute or two.',
        refresh: 'Refresh',
        loading: 'Reading knowledge bases…',
        empty: 'No knowledge base yet. Create one below.',
        createTitle: 'New knowledge base',
        namePlaceholder: 'Name, e.g. vision',
        dirPlaceholder: 'Click to choose the folder holding the documents, e.g. D:\\books\\ros2',
        dirBrowse: 'Choose folder…',
        dirPickUnavailable: 'No folder picker is available here — paste the path instead.',
        create: 'Create',
        creating: 'Creating…',
        folderOnly: 'Folder only (add documents later)',
        folderOnlyHint: 'Creates the folder and registry entry without an index. Drop documents into its raw/ folder, then press Index here.',
        emptyBadge: 'Empty',
        foldersTitle: 'Existing folders',
        foldersHint: 'Click to pick one; DeepTutor copies the documents into the KB and leaves the folder alone.',
        foldersLoading: 'Reading folders…',
        foldersEmpty: 'No subfolders here. Put material under any folder of the knowledge-base root and it shows up here.',
        foldersUp: 'Up',
        foldersFiles: 'files',
        foldersDirs: 'folders',
        foldersRefresh: 'Refresh',
        trash: 'Delete',
        trashConfirm: 'Sure?',
        trashTitle: 'Deleted (restorable)',
        restore: 'Restore',
        reindex: 'Index',
        rename: 'Rename',
        renameConfirm: 'OK',
        cancel: 'Cancel',
        remove: 'Delete',
        removeConfirm: 'Delete for real?',
        setDefault: 'Set default',
        isDefault: 'Default',
        docs: '{count} documents',
        chunks: '{count} chunks',
        noDocs: 'Not indexed yet',
        jobRunning: '{label}: running…',
        jobDone: '{label}: done',
        jobFailed: '{label}: failed',
        showLog: 'Show log',
        hideLog: 'Hide log',
        error: 'Failed: {message}',
        hint: 'Renaming only moves the local folder and config; it does not reindex. Deleting removes the index as well.',
        setupTitle: 'Study environment',
        setupMissing: 'The DeepTutor environment is not ready yet (missing Python packages or config).',
        setupReady: 'The DeepTutor environment is ready.',
        setupRun: 'Prepare environment',
        setupRunning: 'Preparing… the first run downloads about 500 MB and can take minutes.',
        setupDone: 'Done. Restart DSH to pick it up.',
        setupFailed: 'Preparation failed; expand the log for the reason.',
        docsButton: 'Files',
        openFolder: 'Folder',
        rawPathLabel: 'Documents folder',
        review: 'Review',
        reviewEmpty: 'This base has no index yet — add documents and press Index first.',
        reviewHint: 'Review request for “{kb}” is ready; the prompt is on your clipboard — paste it if the composer stays empty.',
        reviewPrompt: 'Quiz me on the “{kb}” knowledge base: first search it for what I studied recently, pick the most worthwhile point, then go explain → quiz → grade, rendering the quiz as GenUI cards and filing wrong answers into the notebook. Ask me which direction I want before starting.',
        docsTitle: 'Documents in this base',
        docsEmpty: 'This base has no documents yet.',
        docsLoading: 'Listing documents…',
        preview: 'Preview',
        open: 'Open',
        close: 'Close',
        openWithApp: 'Open with the system app',
        openWithAppShort: 'Open',
        binaryNote: 'This is a binary document ({kind}); the page cannot show it. Use “Open with the system app”.',
        truncatedNote: 'Only the first 200 KB are shown.',
        bytes: '{size}',
        back: 'Back to the list',
      },
    }

    const styles = {
      page: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
      column: { padding: '20px 24px 0' },
      body: { flex: 1, overflowY: 'auto', padding: '12px 24px 32px', display: 'flex', flexDirection: 'column', gap: 14 },
      titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
      title: { margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      intro: { margin: '6px 0 0', fontSize: 12.5, lineHeight: '19px', color: 'var(--dsw-alias-label-tertiary)' },
      ghost: {
        padding: '5px 12px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12.5,
        cursor: 'pointer',
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 12,
        padding: '12px 14px',
        background: 'var(--dsw-alias-bg-layer-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      createRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
      checkRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12.5,
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
      },
      dirBox: {
        flex: '1 1 260px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 6px 4px 10px',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-3)',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      },
      dirBoxFilled: {
        borderColor: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 0 0 1px var(--dsw-alias-label-primary) inset',
      },
      dirIcon: { fontSize: 14, opacity: 0.8, userSelect: 'none' },
      dirInput: {
        flex: 1,
        minWidth: 120,
        padding: '5px 2px',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
      },
      dirPick: {
        padding: '4px 10px',
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      folderHead: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
      folderTitle: { fontSize: 13, fontWeight: 560, color: 'var(--dsw-alias-label-primary)' },
      folderRoot: {
        fontSize: 11.5,
        color: 'var(--dsw-alias-label-tertiary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      chipWrap: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' },
      chip: {
        display: 'flex',
        alignItems: 'stretch',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-layer-2)',
        maxWidth: 280,
      },
      chipActive: {
        borderColor: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 0 0 1px var(--dsw-alias-label-primary) inset',
      },
      chipMain: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        textAlign: 'left',
      },
      chipIcon: { fontSize: 15, lineHeight: '18px' },
      chipBody: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
      chipName: {
        fontSize: 12.5,
        fontWeight: 520,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      chipMeta: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' },
      chipX: {
        padding: '0 9px',
        border: 'none',
        borderLeft: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      chipXDanger: {
        background: 'var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-bg-layer-2)',
      },
      chipBack: {
        alignSelf: 'flex-start',
        padding: '4px 10px',
        borderRadius: 8,
        border: '1px dashed var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        cursor: 'pointer',
      },
      trashToggle: {
        alignSelf: 'flex-start',
        padding: '3px 8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 12,
        cursor: 'pointer',
        textDecoration: 'underline',
      },
      trashList: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 },
      trashRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-layer-3)',
      },
      trashName: { fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)', flex: 1 },
      input: {
        flex: '1 1 180px',
        minWidth: 140,
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
      },
      primary: {
        padding: '7px 14px',
        borderRadius: 8,
        border: 'none',
        background: 'var(--dsw-alias-label-primary)',
        color: 'var(--dsw-alias-bg-layer-2)',
        fontSize: 13,
        cursor: 'pointer',
      },
      disabled: { opacity: 0.45, cursor: 'default' },
      row: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderTop: '1px solid var(--dsw-alias-border-l2)',
        paddingTop: 10,
      },
      rowFirst: { borderTop: 'none', paddingTop: 0 },
      name: { fontSize: 14, fontWeight: 560, color: 'var(--dsw-alias-label-primary)' },
      meta: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      badge: {
        display: 'inline-block',
        marginLeft: 8,
        padding: '1px 7px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
      },
      actions: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
      log: {
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11.5,
        lineHeight: '17px',
        maxHeight: 200,
        overflow: 'auto',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      error: {
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--dsw-alias-state-warn-tertiary)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12.5,
      },
      hint: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      docPanel: { margin: '2px 0 14px', padding: '10px 12px', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-3)' },
      docRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      docName: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 13,
        color: 'var(--dsw-alias-label-primary)',
      },
      previewBox: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
      previewText: {
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        lineHeight: '19px',
        maxHeight: 360,
        overflow: 'auto',
        color: 'var(--dsw-alias-label-secondary)',
      },
    }

    function service(ctx, name) {
      try {
        return ctx.get(name)
      } catch {
        return undefined
      }
    }

    /**
     * Open the host's folder chooser and return the picked path.
     *
     * The Desktop shell exposes `__DSH_DIRECTORY_PICKER__`; the web build goes
     * through the uiWorkspace service instead. Both resolve to `null` when the
     * user cancels, so this throws only when neither surface exists.
     */
    async function browseDirectory(ctx) {
      const desktop = typeof globalThis === 'object' ? globalThis.__DSH_DIRECTORY_PICKER__ : undefined
      if (desktop && typeof desktop.pick === 'function') {
        const picked = await desktop.pick()
        return typeof picked === 'string' && picked !== '' ? picked : null
      }
      const workspaceUi = service(ctx, 'uiWorkspace')
      if (workspaceUi && typeof workspaceUi.pickDirectory === 'function') {
        const picked = await workspaceUi.pickDirectory()
        return typeof picked === 'string' && picked !== '' ? picked : null
      }
      throw new Error('no-directory-picker')
    }

    function createPage(ctx, t) {
      const activeLanguage = () => {
        const locale = service(ctx, 'locale')
        try {
          const snapshot = locale && locale.getSnapshot && locale.getSnapshot()
          return snapshot && typeof snapshot.active === 'string' ? snapshot.active : 'en'
        } catch {
          return 'en'
        }
      }

      return function KbManagerPage() {
        const [state, setState] = React.useState({ phase: 'loading', items: [], home: null, error: null })
        const [draft, setDraft] = React.useState({ name: '', dir: '' })
        const [folderOnly, setFolderOnly] = React.useState(false)
        const [folders, setFolders] = React.useState(null)
        const [foldersBusy, setFoldersBusy] = React.useState(false)
        const [pendingTrash, setPendingTrash] = React.useState(null)
        const [trashOpen, setTrashOpen] = React.useState(false)
        const [renaming, setRenaming] = React.useState(null)
        const [renameValue, setRenameValue] = React.useState('')
        const [confirming, setConfirming] = React.useState(null)
        const [job, setJob] = React.useState(null)
        const [showLog, setShowLog] = React.useState(false)
        const [notice, setNotice] = React.useState(null)
        const [working, setWorking] = React.useState(false)
        const [docsFor, setDocsFor] = React.useState(null)
        const [docs, setDocs] = React.useState({})
        const [docsBusy, setDocsBusy] = React.useState(false)
        const [preview, setPreview] = React.useState(null)
        const [setup, setSetup] = React.useState(null)
        const [setupJob, setSetupJob] = React.useState(null)
        const alive = React.useRef(true)

        React.useEffect(() => () => { alive.current = false }, [])

        const load = React.useCallback(async () => {
          try {
            const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
            const text = await response.text()
            let payload = null
            try {
              payload = JSON.parse(text)
            } catch {
              payload = null
            }
            if (!response.ok) {
              throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status} ${text.slice(0, 120)}`)
            }
            if (payload === null) throw new Error(`返回的不是 JSON：${text.slice(0, 120)}`)
            if (!alive.current) return
            setState({ phase: 'ready', items: Array.isArray(payload.items) ? payload.items : [], home: payload.home ?? null, error: null })
          } catch (error) {
            if (!alive.current) return
            setState((previous) => ({ ...previous, phase: 'ready', error: error instanceof Error ? error.message : String(error) }))
          }
        }, [])

        React.useEffect(() => { load() }, [load])

        React.useEffect(() => {
          let alive2 = true
          fetch(ENDPOINT.replace('/kb', '/setup'), { headers: { accept: 'application/json' }, credentials: 'same-origin' })
            .then((response) => response.json())
            .then((payload) => { if (alive2) setSetup(payload) })
            .catch(() => {})
          return () => { alive2 = false }
        }, [])

        React.useEffect(() => {
          if (setupJob === null || setupJob.status !== 'running') return undefined
          const timer = setInterval(async () => {
            try {
              const response = await fetch(`${ENDPOINT.replace('/kb', '/setup')}?job=${encodeURIComponent(setupJob.id)}`, {
                headers: { accept: 'application/json' },
                credentials: 'same-origin',
              })
              const payload = await response.json()
              if (!response.ok) return
              if (!alive.current) return
              setSetupJob(payload.job)
            } catch {
              /* keep polling */
            }
          }, 3000)
          return () => clearInterval(timer)
        }, [setupJob])

        React.useEffect(() => {
          if (job === null || job.status !== 'running') return undefined
          const timer = setInterval(async () => {
            try {
              const response = await fetch(`${ENDPOINT}?job=${encodeURIComponent(job.id)}`, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
              const payload = await response.json()
              if (!response.ok) return
              if (!alive.current) return
              setJob(payload.job)
              if (payload.job && payload.job.status !== 'running') load()
            } catch {
              /* keep polling */
            }
          }, 2000)
          return () => clearInterval(timer)
        }, [job, load])

        const post = async (body) => {
          setWorking(true)
          setNotice(null)
          try {
            const response = await fetch(ENDPOINT, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(body),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
            if (payload.job) setJob(payload.job)
            await load()
            return payload
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error))
            return null
          } finally {
            setWorking(false)
          }
        }

        /** Load one level of the folder picker under the study root. */
        const loadFolders = React.useCallback(async (rel = '') => {
          setFoldersBusy(true)
          try {
            const response = await fetch(`${ENDPOINT}?folders=${encodeURIComponent(rel)}`, {
              headers: { accept: 'application/json' },
              credentials: 'same-origin',
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
            if (!alive.current) return
            setFolders(payload)
          } catch (error) {
            if (!alive.current) return
            setNotice(error instanceof Error ? error.message : String(error))
          } finally {
            if (alive.current) setFoldersBusy(false)
          }
        }, [])

        React.useEffect(() => { loadFolders() }, [loadFolders])

        /** Move a folder into .trash — two clicks, the second one confirms. */
        const trashOne = async (row) => {
          if (pendingTrash !== row.rel) {
            setPendingTrash(row.rel)
            return
          }
          setPendingTrash(null)
          const payload = await post({ action: 'folderDelete', rel: row.rel })
          if (payload !== null) {
            setFolders((previous) => (previous === null ? previous : { ...previous, ...payload }))
            if (draft.dir === row.path) setDraft((previous) => ({ ...previous, dir: '' }))
          }
        }

        /** Put a trashed folder back. */
        const restoreOne = async (row) => {
          const payload = await post({ action: 'folderRestore', entry: row.entry })
          if (payload !== null) setFolders((previous) => (previous === null ? previous : { ...previous, ...payload }))
        }

        const language = activeLanguage()
        const items = state.items

        const header = h(
          'div',
          { style: styles.column },
          h(
            'div',
            { style: styles.titleRow },
            h('div', null, h('h1', { style: styles.title }, t('title')), h('p', { style: styles.intro }, t('intro'))),
            h('button', { type: 'button', style: styles.ghost, onClick: load }, t('refresh')),
          ),
        )

        const canCreate = draft.name.trim() !== '' && (folderOnly || draft.dir.trim() !== '')

        const createRow = h(
          'div',
          { style: styles.card },
          h('div', { style: styles.name }, t('createTitle')),
          h(
            'div',
            { style: styles.createRow },
            h('input', {
              style: styles.input,
              value: draft.name,
              placeholder: t('namePlaceholder'),
              onChange: (event) => setDraft((previous) => ({ ...previous, name: event.target.value })),
            }),
            folderOnly
              ? null
              : h(
                  'div',
                  { style: { ...styles.dirBox, ...(draft.dir.trim() !== '' ? styles.dirBoxFilled : null) } },
                  h('span', { style: styles.dirIcon }, '📂'),
                  h('input', {
                    style: styles.dirInput,
                    value: draft.dir,
                    placeholder: t('dirPlaceholder'),
                    title: t('dirBrowse'),
                    onChange: (event) => setDraft((previous) => ({ ...previous, dir: event.target.value })),
                    onClick: async () => {
                      // An empty field opens the chooser straight away; once a path is
                      // there, a click means "let me edit it".
                      if (draft.dir.trim() !== '') return
                      try {
                        const picked = await browseDirectory(ctx)
                        if (picked !== null) setDraft((previous) => ({ ...previous, dir: picked }))
                      } catch {
                        setNotice(t('dirPickUnavailable'))
                      }
                    },
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      style: styles.dirPick,
                      title: t('dirBrowse'),
                      onClick: async () => {
                        try {
                          const picked = await browseDirectory(ctx)
                          if (picked !== null) setDraft((previous) => ({ ...previous, dir: picked }))
                        } catch {
                          setNotice(t('dirPickUnavailable'))
                        }
                      },
                    },
                    t('dirBrowse'),
                  ),
                ),
            h(
              'button',
              {
                type: 'button',
                style: { ...styles.primary, ...(working || !canCreate ? styles.disabled : null) },
                disabled: working || !canCreate,
                onClick: async () => {
                  const payload = folderOnly
                    ? await post({ action: 'create', name: draft.name.trim(), folderOnly: true })
                    : await post({ action: 'create', name: draft.name.trim(), docsDir: draft.dir.trim() })
                  if (payload !== null) setDraft({ name: '', dir: '' })
                },
              },
              working ? t('creating') : t('create'),
            ),
          ),
          h(
            'label',
            { style: styles.checkRow },
            h('input', {
              type: 'checkbox',
              checked: folderOnly,
              onChange: (event) => setFolderOnly(event.target.checked),
            }),
            h('span', null, t('folderOnly')),
          ),
          folderOnly ? h('p', { style: styles.meta }, t('folderOnlyHint')) : null,
        )

        const folderCard = folderOnly ? null : h(
          'div',
          { style: styles.card },
          h(
            'div',
            { style: styles.folderHead },
            h('div', { style: styles.folderTitle }, t('foldersTitle')),
            h('div', { style: styles.folderRoot }, folders === null ? '' : folders.path),
            h(
              'button',
              {
                type: 'button',
                style: styles.trashToggle,
                disabled: foldersBusy,
                onClick: () => loadFolders(folders === null ? '' : folders.rel),
              },
              t('foldersRefresh'),
            ),
          ),
          h('p', { style: styles.meta }, t('foldersHint')),
          folders !== null && folders.parent !== null
            ? h(
                'button',
                { type: 'button', style: styles.chipBack, onClick: () => loadFolders(folders.parent) },
                `↑ ${t('foldersUp')}`,
              )
            : null,
          h(
            'div',
            { style: styles.chipWrap },
            folders === null || foldersBusy
              ? h('span', { style: styles.meta }, t('foldersLoading'))
              : folders.items.length === 0
                ? h('span', { style: styles.meta }, t('foldersEmpty'))
                : folders.items.map((row) => {
                    const active = draft.dir === row.path
                    const pending = pendingTrash === row.rel
                    return h(
                      'div',
                      { key: row.rel, style: { ...styles.chip, ...(active ? styles.chipActive : null) } },
                      h(
                        'button',
                        {
                          type: 'button',
                          style: styles.chipMain,
                          title: row.path,
                          onClick: () => {
                            setDraft((previous) => ({ ...previous, dir: row.path }))
                            setPendingTrash(null)
                          },
                        },
                        h('span', { style: styles.chipIcon }, '📁'),
                        h(
                          'span',
                          { style: styles.chipBody },
                          h('span', { style: styles.chipName }, row.name),
                          h(
                            'span',
                            { style: styles.chipMeta },
                            `${row.files} ${t('foldersFiles')}${row.dirs ? ` · ${row.dirs} ${t('foldersDirs')}` : ''}`,
                          ),
                        ),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          style: { ...styles.chipX, ...(pending ? styles.chipXDanger : null) },
                          title: pending ? t('trashConfirm') : t('trash'),
                          onClick: () => trashOne(row),
                        },
                        pending ? t('trashConfirm') : '×',
                      ),
                    )
                  }),
          ),
          folders !== null && folders.trash.length > 0
            ? h(
                'div',
                null,
                h(
                  'button',
                  { type: 'button', style: styles.trashToggle, onClick: () => setTrashOpen((value) => !value) },
                  `${t('trashTitle')} (${folders.trash.length})`,
                ),
                trashOpen
                  ? h(
                      'div',
                      { style: styles.trashList },
                      folders.trash.map((row) =>
                        h(
                          'div',
                          { key: row.entry, style: styles.trashRow },
                          h('span', { style: styles.trashName }, row.origin),
                          h('button', { type: 'button', style: styles.ghost, onClick: () => restoreOne(row) }, t('restore')),
                        ),
                      ),
                    )
                  : null,
              )
            : null,
        )

        const jobLine = job === null ? null : h(
          'div',
          { style: styles.card },
          h(
            'div',
            { style: styles.row },
            h(
              'span',
              { style: styles.meta },
              job.status === 'running'
                ? t('jobRunning', { label: job.label })
                : job.status === 'done'
                  ? t('jobDone', { label: job.label })
                  : t('jobFailed', { label: job.label }),
            ),
            h('button', { type: 'button', style: styles.ghost, onClick: () => setShowLog((value) => !value) }, showLog ? t('hideLog') : t('showLog')),
          ),
          showLog && job.log ? h('pre', { style: styles.log }, job.log) : null,
        )

        const loadDocs = async (name) => {
          setPreview(null)
          if (docsFor === name) {
            setDocsFor(null)
            return
          }
          setDocsFor(name)
          if (docs[name] !== undefined) return
          setDocsBusy(true)
          try {
            const response = await fetch(`${ENDPOINT}?docs=${encodeURIComponent(name)}&name=${encodeURIComponent(name)}`, {
              headers: { accept: 'application/json' },
              credentials: 'same-origin',
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
            if (!alive.current) return
            setDocs((previous) => ({ ...previous, [name]: Array.isArray(payload.docs) ? payload.docs : [] }))
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error))
            setDocs((previous) => ({ ...previous, [name]: [] }))
          } finally {
            if (alive.current) setDocsBusy(false)
          }
        }

        const openDoc = async (name, file) => {
          await post({ action: 'open', name, file })
        }

        const showDoc = async (name, doc) => {
          if (!doc.text) {
            await openDoc(name, doc.file)
            return
          }
          setNotice(null)
          try {
            const response = await fetch(`${ENDPOINT}?file=${encodeURIComponent(doc.file)}&name=${encodeURIComponent(name)}`, {
              headers: { accept: 'application/json' },
              credentials: 'same-origin',
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
            if (!alive.current) return
            setPreview(payload.doc)
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error))
          }
        }

        const formatBytes = (bytes) => {
          if (typeof bytes !== 'number') return ''
          if (bytes < 1024) return `${bytes} B`
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
          return `${(bytes / 1024 / 1024).toFixed(1)} MB`
        }

        const renderDocs = (item) => {
          if (docsFor !== item.name) return null
          const rows = docs[item.name]
          const list = rows === undefined
            ? h('p', { style: styles.meta }, t('docsLoading'))
            : rows.length === 0
              ? h('p', { style: styles.meta }, t('docsEmpty'))
              : rows.map((doc) =>
                  h(
                    'div',
                    { key: doc.file, style: styles.docRow },
                    h('span', { style: styles.docName }, doc.file),
                    h('span', { style: styles.meta }, formatBytes(doc.bytes)),
                    doc.text
                      ? h(
                          'button',
                          {
                            type: 'button',
                            style: styles.ghost,
                            onClick: () => showDoc(item.name, doc),
                          },
                          t('preview'),
                        )
                      : null,
                    h('button', { type: 'button', style: styles.ghost, onClick: () => openDoc(item.name, doc.file) }, t('openWithAppShort')),
                  ),
                )
          return h(
            'div',
            { style: styles.docPanel },
            h('div', { style: styles.meta }, t('docsTitle')),
            list,
            preview === null
              ? null
              : h(
                  'div',
                  { style: styles.previewBox },
                  h(
                    'div',
                    { style: styles.row },
                    h('span', { style: styles.docName }, preview.file),
                    h(
                      'div',
                      { style: styles.actions },
                      h('button', { type: 'button', style: styles.ghost, onClick: () => openDoc(item.name, preview.file) }, t('openWithApp')),
                      h('button', { type: 'button', style: styles.ghost, onClick: () => setPreview(null) }, t('close')),
                    ),
                  ),
                  preview.text
                    ? h('pre', { style: styles.previewText }, preview.text)
                    : h('p', { style: styles.meta }, t('binaryNote', { kind: String(preview.file).split('.').pop() })),
                  preview.truncated ? h('p', { style: styles.meta }, t('truncatedNote')) : null,
                ),
          )
        }

        const renderRow = (item, index) => {
          const isRenaming = renaming === item.name
          const isConfirming = confirming === item.name
          return h(
            'div',
            { key: item.name },
            h(
              'div',
              { style: { ...styles.row, ...(index === 0 ? styles.rowFirst : null) } },
            h(
              'div',
              { style: { minWidth: 0, flex: 1 } },
              isRenaming
                ? h('input', {
                    style: { ...styles.input, minWidth: 180 },
                    value: renameValue,
                    autoFocus: true,
                    onChange: (event) => setRenameValue(event.target.value),
                  })
                : h(
                    'div',
                    null,
                    h('span', { style: styles.name }, item.name),
                    item.isDefault ? h('span', { style: styles.badge }, t('isDefault')) : null,
                    h('span', { style: styles.badge }, item.status === 'empty' ? t('emptyBadge') : item.status),
                  ),
              h(
                'div',
                { style: styles.meta },
                item.docs === null || item.docs === undefined ? t('noDocs') : `${t('docs', { count: String(item.docs) })}${item.chunks ? ` · ${t('chunks', { count: String(item.chunks) })}` : ''}`,
                item.model ? ` · ${item.model}` : '',
              ),
              item.rawPath
                ? h('div', { style: styles.meta }, `${t('rawPathLabel')}: ${item.rawPath}`)
                : null,
            ),
            h(
              'div',
              { style: styles.actions },
              h(
                'button',
                {
                  key: 'review',
                  type: 'button',
                  style: styles.ghost,
                  disabled: working,
                  title: t('reviewHint', { kb: item.name }),
                  onClick: () => {
                    if (!item.docs) {
                      setNotice(t('reviewEmpty'))
                      return
                    }
                    const prompt = t('reviewPrompt', { kb: item.name })
                    try {
                      // The composer chip listens for this and drops the prompt
                      // straight into the input box.
                      window.dispatchEvent(new CustomEvent('dsh-study-review', { detail: { prompt, kb: item.name } }))
                    } catch {
                      /* fall through to the clipboard */
                    }
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt).catch(() => {})
                    } catch {
                      /* clipboard is optional */
                    }
                    setNotice(t('reviewHint', { kb: item.name }))
                  },
                },
                t('review'),
              ),
              item.status === 'empty' || item.docs === 0
                ? h(
                    'button',
                    {
                      key: 'reindex',
                      type: 'button',
                      style: styles.ghost,
                      disabled: working,
                      onClick: () => { post({ action: 'reindex', name: item.name }) },
                    },
                    t('reindex'),
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  style: {
                    ...styles.ghost,
                    ...(docsFor === item.name ? { borderColor: 'var(--dsw-alias-label-primary)', color: 'var(--dsw-alias-label-primary)' } : null),
                  },
                  disabled: docsBusy && docsFor !== item.name,
                  onClick: () => loadDocs(item.name),
                },
                t('docsButton'),
              ),
              h(
                'button',
                { type: 'button', style: styles.ghost, onClick: () => post({ action: 'openFolder', name: item.name }) },
                t('openFolder'),
              ),
              isRenaming
                ? [
                    h(
                      'button',
                      {
                        key: 'ok',
                        type: 'button',
                        style: styles.primary,
                        onClick: async () => {
                          const value = renameValue.trim()
                          if (value === '' || value === item.name) {
                            setRenaming(null)
                            return
                          }
                          const payload = await post({ action: 'rename', name: item.name, newName: value })
                          if (payload !== null) setRenaming(null)
                        },
                      },
                      t('renameConfirm'),
                    ),
                    h('button', { key: 'no', type: 'button', style: styles.ghost, onClick: () => setRenaming(null) }, t('cancel')),
                  ]
                : [
                    !item.isDefault
                      ? h(
                          'button',
                          {
                            key: 'default',
                            type: 'button',
                            style: styles.ghost,
                            disabled: working,
                            onClick: () => { post({ action: 'setDefault', name: item.name }) },
                          },
                          t('setDefault'),
                        )
                      : null,
                    h(
                      'button',
                      {
                        key: 'rename',
                        type: 'button',
                        style: styles.ghost,
                        disabled: working,
                        onClick: () => {
                          setRenaming(item.name)
                          setRenameValue(item.name)
                          setConfirming(null)
                        },
                      },
                      t('rename'),
                    ),
                    h(
                      'button',
                      {
                        key: 'remove',
                        type: 'button',
                        style: { ...styles.ghost, ...(isConfirming ? { borderColor: 'var(--dsw-alias-state-error-primary)', color: 'var(--dsw-alias-state-error-primary)' } : null) },
                        disabled: working,
                        onClick: () => {
                          if (!isConfirming) {
                            setConfirming(item.name)
                            setRenaming(null)
                            return
                          }
                          setConfirming(null)
                          post({ action: 'delete', name: item.name })
                        },
                      },
                      isConfirming ? t('removeConfirm') : t('remove'),
                    ),
                  ],
              ),
            ),
            renderDocs(item),
          )
        }

        const list = items.length === 0
          ? h('p', { style: styles.meta }, t('empty'))
          : h('div', { style: styles.card }, items.map(renderRow))

        const setupReady = setup !== null && setup.pythonOk === true && setup.deeptutorHomeReady === true
        const setupText =
          setupJob !== null && setupJob.status === 'running'
            ? t('setupRunning')
            : setupJob !== null && setupJob.status === 'done'
              ? t('setupDone')
              : setupJob !== null && setupJob.status === 'failed'
                ? t('setupFailed')
                : setupReady
                  ? t('setupReady')
                  : t('setupMissing')
        const setupBanner =
          setup === null
            ? null
            : h(
                'div',
                { style: styles.card },
                h(
                  'div',
                  { style: styles.row, paddingTop: 0, borderTop: 'none' },
                  h('span', { style: styles.meta }, `${t('setupTitle')} · ${setupText}`),
                  h(
                    'div',
                    { style: styles.actions },
                    setupReady
                      ? null
                      : h(
                          'button',
                          {
                            type: 'button',
                            style: styles.primary,
                            disabled: setupJob !== null && setupJob.status === 'running',
                            onClick: async () => {
                              setNotice(null)
                              try {
                                const response = await fetch(ENDPOINT.replace('/kb', '/setup'), {
                                  method: 'POST',
                                  headers: { 'content-type': 'application/json', accept: 'application/json' },
                                  credentials: 'same-origin',
                                  body: '{}',
                                })
                                const payload = await response.json()
                                if (!response.ok) throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
                                setSetupJob(payload.job)
                              } catch (error) {
                                setNotice(error instanceof Error ? error.message : String(error))
                              }
                            },
                          },
                          t('setupRun'),
                        ),
                    setupJob !== null && setupJob.log
                      ? h('button', { type: 'button', style: styles.ghost, onClick: () => setShowLog((value) => !value) }, showLog ? t('hideLog') : t('showLog'))
                      : null,
                  ),
                ),
                showLog && setupJob !== null && setupJob.log ? h('pre', { style: styles.log }, setupJob.log) : null,
              )

        return h(
          'div',
          { style: styles.page },
          header,
          h(
            'div',
            { style: styles.body },
            state.error ? h('div', { style: styles.error }, t('error', { message: state.error })) : null,
            notice ? h('div', { style: styles.error }, t('error', { message: notice })) : null,
            setupBanner,
            createRow,
            folderCard,
            jobLine,
            state.phase === 'loading' ? h('p', { style: styles.meta }, t('loading')) : list,
            h('p', { style: styles.hint }, t('hint')),
            state.home ? h('p', { style: styles.hint }, `${state.home}`) : null,
          ),
        )
      }
    }

    function KbIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('ellipse', { cx: 12, cy: 5.5, rx: 7, ry: 2.5 }),
        h('path', { d: 'M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6' }),
        h('path', { d: 'M5 11.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = service(ctx, 'locale')
        if (locale && typeof locale.register === 'function') {
          ctx.effect(() => locale.register(NS, MESSAGES))
        }
        const dictionary = () => {
          let language = 'en'
          try {
            const snapshot = locale && locale.getSnapshot && locale.getSnapshot()
            if (snapshot && typeof snapshot.active === 'string') language = snapshot.active
          } catch {
            /* keep the default language */
          }
          const key = String(language).toLowerCase().startsWith('zh') ? 'zh' : 'en'
          if (locale === undefined) {
            const preferred = typeof navigator === 'object' && navigator && typeof navigator.language === 'string' ? navigator.language : ''
            return preferred.toLowerCase().startsWith('zh') ? MESSAGES.zh : MESSAGES.en
          }
          return MESSAGES[key] || MESSAGES.en
        }
        const bound = locale && typeof locale.bind === 'function' ? locale.bind(NS) : undefined
        const raw = (key) => {
          if (typeof bound === 'function') {
            try {
              const value = bound(key)
              if (typeof value === 'string' && value !== key) return value
            } catch {
              /* fall through */
            }
          }
          const messages = dictionary()
          if (messages[key] !== undefined) return messages[key]
          if (MESSAGES.en[key] !== undefined) return MESSAGES.en[key]
          return key
        }
        const t = (key, params) => {
          const text = String(raw(key))
          if (params === undefined || params === null) return text
          return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])))
        }

        const Page = createPage(ctx, t)

        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: NS, locale: NS }, Page))
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: NS, order: SIDEBAR_ORDER, label: () => t('panel'), locale: NS },
            KbIcon,
          ),
        )

        const layout = service(ctx, 'layout')
        ctx.effect(() => () => {
          try {
            const snapshot = layout && layout.panelInfo && layout.panelInfo.getSnapshot && layout.panelInfo.getSnapshot()
            if (snapshot && snapshot.activePanelId === NS && typeof layout.selectPanel === 'function') layout.selectPanel(null)
          } catch {
            /* layout is gone */
          }
        })
      },
    }
    })(require)

    /**
     * Composer control: digest this conversation into a knowledge base.
     *
     * Sits in the composer's right-hand tool row next to the other host chips.
     * One click opens a small panel: pick a knowledge base (or create an empty
     * one), name the file, then the host runs the digest as a job.
     */
    const review = (function (require) {
      const React = require('react')
      const h = React.createElement

      const NS = 'dsh-deeptutor-study/review'
      const ENDPOINT = '/api/study/kb'
      const SIDEBAR_ORDER = 8

      const MESSAGES = {
        zh: {
          panel: '温习',
          title: '温习',
          intro: '选一个知识库，生成一段绑定了该库的温习请求；点开始后它会进入输入框（或按你的设置新开一个对话）。',
          loading: '正在读取知识库…',
          empty: '还没有知识库。先去「知识库管理」建一个并放入资料。',
          pick: '选择知识库',
          topic: '想聚焦的主题（可留空）',
          topicPlaceholder: '例如 回调组与执行器 / 标定流程',
          start: '开始温习',
          refresh: '刷新',
          docsCount: '{count} 篇文档',
          noDocs: '还没索引',
          sent: '已把温习请求送进输入框；面板已收起。',
          error: '出错了：{message}',
          prompt: '用「{kb}」知识库带我温习一次{topic}：先检索库里我最近学过的主题，挑一个最值得复习的点，按「讲解 → 出题 → 判分」的节奏来，题目用 GenUI quiz 卡片；判分后把错题写进错题本。开始前先问我这次想温习哪个方向。',
          topicPhrase: '，这次聚焦「{topic}」',
        },
        en: {
          panel: 'Review',
          title: 'Review',
          intro: 'Pick a knowledge base and this builds a review request bound to it; pressing start sends it to the composer (or to a new conversation, depending on your setting).',
          loading: 'Reading knowledge bases…',
          empty: 'No knowledge base yet — create one in Knowledge bases and index some documents first.',
          pick: 'Knowledge base',
          topic: 'Topic to focus on (optional)',
          topicPlaceholder: 'e.g. callback groups / calibration',
          start: 'Start review',
          refresh: 'Refresh',
          docsCount: '{count} documents',
          noDocs: 'Not indexed',
          sent: 'Review request sent to the composer; the panel is closed.',
          error: 'Failed: {message}',
          prompt: 'Quiz me on the “{kb}” knowledge base{topic}: first search it for what I studied recently, pick the most worthwhile point, then go explain → quiz → grade, rendering the quiz as GenUI cards and filing wrong answers into the notebook. Ask me which direction I want before starting.',
          topicPhrase: ', focusing on “{topic}”',
        },
      }

      const styles = {
        page: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
        column: { padding: '20px 24px 0' },
        body: { flex: 1, overflowY: 'auto', padding: '12px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 },
        titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
        title: { margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        intro: { margin: '6px 0 0', fontSize: 12.5, lineHeight: '19px', color: 'var(--dsw-alias-label-tertiary)' },
        card: {
          border: '0.5px solid var(--dsw-alias-border-l2)',
          borderRadius: 12,
          padding: '12px 14px',
          background: 'var(--dsw-alias-bg-layer-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        },
        label: { fontSize: 11.5, color: 'var(--dsw-alias-label-tertiary)' },
        chips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
        chip: {
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 12px',
          borderRadius: 10,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-3)',
          color: 'var(--dsw-alias-label-primary)',
          fontSize: 12.5,
          cursor: 'pointer',
          textAlign: 'left',
        },
        chipOn: { borderColor: 'var(--dsw-alias-label-primary)', boxShadow: '0 0 0 1px var(--dsw-alias-label-primary) inset' },
        chipMeta: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' },
        input: {
          width: '100%',
          padding: '7px 10px',
          borderRadius: 9,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-3)',
          color: 'var(--dsw-alias-label-primary)',
          fontSize: 13,
          boxSizing: 'border-box',
        },
        primary: {
          alignSelf: 'flex-start',
          padding: '8px 16px',
          borderRadius: 9,
          border: 'none',
          background: 'var(--dsw-alias-label-primary)',
          color: 'var(--dsw-alias-bg-layer-2)',
          fontSize: 13,
          cursor: 'pointer',
        },
        primaryOff: { opacity: 0.45, cursor: 'default' },
        ghost: {
          padding: '5px 12px',
          borderRadius: 8,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'transparent',
          color: 'var(--dsw-alias-label-secondary)',
          fontSize: 12.5,
          cursor: 'pointer',
        },
        note: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
        ok: { fontSize: 12.5, color: 'var(--dsw-alias-state-success-primary)' },
        error: { fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)' },
      }

      function service(ctx, name) {
        try {
          return ctx.get(name)
        } catch {
          return undefined
        }
      }

      function ReviewIcon(props) {
        const size = props && typeof props.size === 'number' ? props.size : 20
        return h(
          'svg',
          {
            viewBox: '0 0 24 24',
            width: size,
            height: size,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true,
            style: { display: 'block' },
          },
          h('path', { d: 'M4.5 4.75h9.5A2.25 2.25 0 0 1 16.25 7v11.5' }),
          h('path', { d: 'M4.5 4.75A1.75 1.75 0 0 0 2.75 6.5v13A1.75 1.75 0 0 0 4.5 21.25h9.5' }),
          h('path', { d: 'M7 9h6M7 12.5h4' }),
          h('path', { d: 'M17.5 15.5l2 2 3-3.25' }),
        )
      }

      function createPage(ctx, t) {
        return function ReviewPage() {
          const [items, setItems] = React.useState(null)
          const [error, setError] = React.useState(null)
          const [picked, setPicked] = React.useState('')
          const [topic, setTopic] = React.useState('')
          const [note, setNote] = React.useState(null)
          const alive = React.useRef(true)

          React.useEffect(() => () => { alive.current = false }, [])

          const load = React.useCallback(async () => {
            try {
              const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
              const payload = await response.json()
              if (!response.ok) throw new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
              if (!alive.current) return
              const rows = Array.isArray(payload.items) ? payload.items : []
              setItems(rows)
              setPicked((current) => {
                if (current !== '' && rows.some((row) => row.name === current)) return current
                return rows.length === 1 ? rows[0].name : ''
              })
              setError(null)
            } catch (reason) {
              if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
            }
          }, [])

          React.useEffect(() => { load() }, [load])

          const start = () => {
            if (picked === '') return
            const focus = topic.trim()
            const prompt = t('prompt', { kb: picked, topic: focus === '' ? '' : t('topicPhrase', { topic: focus }) })
            try {
              window.dispatchEvent(new CustomEvent('dsh-study-review', { detail: { prompt, kb: picked } }))
            } catch {
              /* the composer may be gone */
            }
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt).catch(() => {})
            } catch {
              /* clipboard is optional */
            }
            setNote(t('sent'))
            try {
              const layout = service(ctx, 'layout')
              if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
            } catch {
              /* layout is gone */
            }
          }

          const header = h(
            'div',
            { style: styles.column },
            h(
              'div',
              { style: styles.titleRow },
              h('div', null, h('h1', { style: styles.title }, t('title')), h('p', { style: styles.intro }, t('intro'))),
              h('button', { type: 'button', style: styles.ghost, onClick: load }, t('refresh')),
            ),
          )

          const rows = items === null
            ? h('p', { style: styles.note }, t('loading'))
            : items.length === 0
              ? h('p', { style: styles.note }, t('empty'))
              : h(
                  'div',
                  { style: styles.chips },
                  items.map((row) =>
                    h(
                      'button',
                      {
                        key: row.name,
                        type: 'button',
                        style: { ...styles.chip, ...(picked === row.name ? styles.chipOn : null) },
                        onClick: () => { setPicked(row.name); setNote(null) },
                      },
                      h('span', null, row.name),
                      h('span', { style: styles.chipMeta }, row.docs ? t('docsCount', { count: String(row.docs) }) : t('noDocs')),
                    ),
                  ),
                )

          return h(
            'div',
            { style: styles.page },
            header,
            h(
              'div',
              { style: styles.body },
              error !== null ? h('div', { style: styles.error }, t('error', { message: error })) : null,
              h(
                'div',
                { style: styles.card },
                h('div', { style: styles.label }, t('pick')),
                rows,
                h('div', { style: styles.label }, t('topic')),
                h('input', {
                  style: styles.input,
                  value: topic,
                  placeholder: t('topicPlaceholder'),
                  onChange: (event) => setTopic(event.target.value),
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    style: { ...styles.primary, ...(picked === '' ? styles.primaryOff : null) },
                    disabled: picked === '',
                    onClick: start,
                  },
                  t('start'),
                ),
              ),
              note !== null ? h('div', { style: styles.ok }, note) : null,
            ),
          )
        }
      }

      return {
        inject: ['slots'],
        apply(ctx) {
          const locale = service(ctx, 'locale')
          if (locale && typeof locale.register === 'function') ctx.effect(() => locale.register(NS, MESSAGES))
          const language = () => {
            try {
              const snapshot = locale && locale.getSnapshot && locale.getSnapshot()
              if (snapshot && typeof snapshot.active === 'string') return snapshot.active
            } catch {
              /* fall through */
            }
            const preferred = typeof navigator === 'object' && navigator && typeof navigator.language === 'string' ? navigator.language : ''
            return preferred.toLowerCase().startsWith('zh') ? 'zh' : 'en'
          }
          const bound = locale && typeof locale.bind === 'function' ? locale.bind(NS) : undefined
          const t = (key, params) => {
            let text
            if (typeof bound === 'function') {
              try {
                text = bound(key)
              } catch {
                text = undefined
              }
            }
            if (typeof text !== 'string' || text === key) {
              const table = MESSAGES[language()] || MESSAGES.en
              text = table[key] !== undefined ? table[key] : MESSAGES.en[key] !== undefined ? MESSAGES.en[key] : key
            }
            if (params === undefined || params === null) return String(text)
            return String(text).replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])))
          }

          const Page = createPage(ctx, t)
          ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: NS, locale: NS }, Page))
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: NS, order: SIDEBAR_ORDER, label: () => t('panel'), locale: NS },
              ReviewIcon,
            ),
          )
        },
      }
    })(require)


    /**
     * 「选段提问」：选中回复里的一段文字，浮条上只有「我有疑问」，可以合并进
     * 当前会话回答，也可以开一个旁路会话单独回答。
     *
     * 高亮沿用 dsh-markup 的做法：不改 DOM，写入 CSS Custom Highlight 注册表，
     * 重渲染后按「忽略空白」的文本匹配重建 Range。比 markup 多一步：记录这是
     * 同一段文字的第几次出现，避免在一行里重复出现的句子上标错地方。
     */
    const askselect = (function () {
      /** 消息行的行属性，用来把选区归到某一条回复。 */
      const ROW_ATTR = 'data-chat-flow-key'
      /** 已提问段落的 highlight 名。 */
      const HL_DONE = 'askq'
      /** 正在提问的那一段，用更醒目的颜色。 */
      const HL_PENDING = 'askq-pending'
      /** 标记本插件自己的 DOM，选择处理时跳过。 */
      const UI_ATTR = 'data-askq-ui'
      /** 最多保留多少条高亮，避免长会话里无限累积。 */
      const MAX_MARKED = 20

      const textOf = (blocks) =>
        (Array.isArray(blocks) ? blocks : [])
          .filter((b) => b && (b.kind === 'text' || b.type === 'text') && typeof b.text === 'string')
          .map((b) => b.text)
          .join('\n')

      const asElement = (node) => (node ? (node.nodeType === 1 ? node : node.parentElement) : null)

      const registry = () => {
        const css = globalThis.CSS
        return css && css.highlights && typeof Highlight !== 'undefined' ? css.highlights : null
      }

      const rowKeyOf = (node) => {
        const el = asElement(node)
        const row = el && el.closest('[' + ROW_ATTR + ']')
        return row ? row.getAttribute(ROW_ATTR) : null
      }

      const proseOf = (node) => {
        const el = asElement(node)
        return el ? el.closest('[class*="markdown"]') : null
      }

      const rowElement = (rowKey) => {
        if (!rowKey) return null
        try {
          return document.querySelector('[' + ROW_ATTR + '="' + CSS.escape(rowKey) + '"]')
        } catch {
          return null
        }
      }

      /** 把一行正文摊平成「无空白字符串 + 字符到节点的映射」。 */
      const flatten = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let flat = ''
        const map = []
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const parent = n.parentElement
          if (parent && parent.closest('script,style,[' + UI_ATTR + ']')) continue
          const text = n.data
          for (let i = 0; i < text.length; i++) {
            if (/\s/.test(text[i])) continue
            flat += text[i]
            map.push({ node: n, offset: i })
          }
        }
        return { flat, map }
      }

      /** 这段文字在摊平文本里的所有起点，从前往后。 */
      const startsOf = (flat, quote) => {
        const target = String(quote || '').replace(/\s+/g, '')
        if (!target) return []
        const out = []
        let at = flat.indexOf(target)
        while (at >= 0) {
          out.push(at)
          at = flat.indexOf(target, at + target.length)
        }
        return out
      }

      /** 选区的起点在摊平文本里的位置，用来判断它是第几次出现。 */
      const flatOffsetOf = (root, node, offset) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let count = 0
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (n === node) {
            for (let i = 0; i < offset && i < n.data.length; i++) if (!/\s/.test(n.data[i])) count += 1
            return count
          }
          for (let i = 0; i < n.data.length; i++) if (!/\s/.test(n.data[i])) count += 1
        }
        return -1
      }

      const rangeAt = (map, start, length) => {
        const from = map[start]
        const to = map[start + length - 1]
        if (!from || !to) return null
        const range = document.createRange()
        range.setStart(from.node, from.offset)
        range.setEnd(to.node, to.offset + 1)
        return range
      }

      /** 按「第 index 次出现」重建一条 Range。 */
      const rangeFor = (item) => {
        const row = rowElement(item.rowKey)
        if (!row) return null
        const { flat, map } = flatten(row)
        const target = String(item.quote || '').replace(/\s+/g, '')
        const starts = startsOf(flat, target)
        if (starts.length === 0) return null
        const at = starts[Math.min(item.index || 0, starts.length - 1)]
        return rangeAt(map, at, target.length)
      }

      const briefly = (text, max) => {
        const flat = String(text || '').replace(/\s+/g, ' ').trim()
        return flat.length > max ? flat.slice(0, max) + '…' : flat
      }

      const makeToken = () => '【疑问 ' + Math.random().toString(36).slice(2, 6) + '】'

      const composeQuestion = (quote, question) =>
        [
          '【我有疑问】',
          String(quote || '')
            .split('\n')
            .map((line) => '> ' + line)
            .join('\n'),
          '',
          question,
        ].join('\n')

      /** 取旁路会话里属于本次提问那一段的助手文字。 */
      const readAnswer = (target, token) => {
        if (!target) return ''
        const snap = target.getSnapshot()
        if (!snap) return ''
        const order = Array.isArray(snap.order) ? snap.order : []
        const nodes = order.map((key) => snap.nodes.get(key)).filter(Boolean)
        const at = nodes.findIndex((n) => n.kind === 'user' && textOf(n.data && n.data.content).includes(token))
        if (at < 0) return ''
        const parts = []
        for (let i = at + 1; i < nodes.length; i++) {
          const node = nodes[i]
          if (node.kind === 'user' || node.kind === 'turn-tail') break
          if (node.kind === 'assistant-step') {
            const text = textOf(node.data && node.data.blocks)
            if (text) parts.push(text)
          }
        }
        return parts.join('\n\n')
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      const STYLE = `
.askq-fab[hidden],.askq-panel[hidden],.askq-card[hidden]{display:none !important}
.askq-fab,.askq-panel,.askq-card{position:fixed;z-index:2147482000;box-sizing:border-box;
  font:13px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;
  color:var(--text-1,#e8eaf0);background:var(--surface-2,#20242c);
  border:1px solid rgba(255,255,255,.14);border-radius:10px;
  box-shadow:0 10px 30px rgba(0,0,0,.38)}
.askq-fab{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;cursor:pointer;
  border-color:rgba(126,140,255,.55);background:var(--surface-3,#252a34)}
.askq-fab:hover{border-color:rgba(126,140,255,.95)}
.askq-fab .dot{width:6px;height:6px;border-radius:50%;background:#8a90ff}
.askq-panel{width:380px;padding:12px}
.askq-quote{padding:8px 10px;margin-bottom:10px;border-radius:8px;max-height:96px;overflow:auto;
  background:rgba(255,198,10,.10);border-left:3px solid rgba(232,170,0,.75);
  color:var(--text-2,#b9bfcd)}
.askq-panel *,.askq-card *{box-sizing:border-box}
.askq-input{width:100%;max-width:100%;min-height:74px;resize:vertical;padding:8px 10px;border-radius:8px;
  border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.24);color:inherit;
  font:inherit;outline:none}
.askq-input:focus{border-color:rgba(126,140,255,.85)}
.askq-row{display:flex;align-items:center;gap:8px;margin-top:10px}
.askq-hint{flex:1;color:var(--text-3,#8b93a3);font-size:11px}
.askq-btn{padding:5px 11px;border-radius:7px;cursor:pointer;font:inherit;
  border:1px solid rgba(255,255,255,.18);background:transparent;color:inherit}
.askq-btn:hover{background:rgba(255,255,255,.08)}
.askq-btn.primary{border-color:rgba(126,140,255,.9);background:rgba(126,140,255,.18)}
.askq-err{margin-top:8px;color:#ff8b8b;font-size:12px;display:none}
.askq-card{right:20px;top:76px;width:420px;max-height:calc(100vh - 140px);display:flex;flex-direction:column}
.askq-card header{display:flex;align-items:center;gap:8px;padding:10px 12px;
  border-bottom:1px solid rgba(255,255,255,.10);font-weight:600}
.askq-card header .sub{flex:1;font-weight:400;font-size:11px;color:var(--text-3,#8b93a3)}
.askq-card header button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:16px;line-height:1}
.askq-card .quote{margin:10px 12px 0;padding:8px 10px;border-radius:8px;max-height:80px;overflow:auto;
  background:rgba(255,198,10,.10);border-left:3px solid rgba(232,170,0,.75);
  color:var(--text-2,#b9bfcd);font-size:12px}
.askq-card .body{flex:1;overflow:auto;padding:12px;white-space:pre-wrap;word-break:break-word}
.askq-card footer{display:flex;align-items:center;gap:8px;padding:8px 12px;
  border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:var(--text-3,#8b93a3)}
.askq-card footer .grow{flex:1}
::highlight(askq){background-color:rgba(126,140,255,.26);
  text-decoration:underline 2px rgba(126,140,255,.85);text-underline-offset:3px}
::highlight(askq-pending){background-color:rgba(255,198,10,.30);
  text-decoration:underline 2px rgba(232,170,0,.9);text-underline-offset:3px}
`

      function apply(ctx) {
        /**
         * 这三个服务来自 DSH 客户端运行时。用 ctx.inject 等它们就绪：万一某个服务
         * 没提供，只有「选段提问」不出现，不会把插件里其他面板一起拖下水。
         */
        if (typeof ctx.inject === 'function') {
          ctx.inject(['sessions', 'uiConversation', 'workspaces'], (scoped) => start(scoped))
          return
        }
        start(ctx)
      }

      function start(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.textContent = STYLE
          document.head.appendChild(style)
          return () => style.remove()
        }, 'ask-select: stylesheet')

        /** 已提问过的段落。 */
        const marked = []
        /** 正在提问、面板还开着的那一段。 */
        let pending = null
        let frame = 0

        const paint = () => {
          frame = 0
          const reg = registry()
          if (!reg) return
          const done = []
          for (const item of marked) {
            const range = rangeFor(item)
            if (range) done.push(range)
          }
          const active = pending ? rangeFor(pending) : null
          if (done.length) reg.set(HL_DONE, new Highlight(...done))
          else reg.delete(HL_DONE)
          if (active) reg.set(HL_PENDING, new Highlight(active))
          else reg.delete(HL_PENDING)
          if (!fab.hidden) refreshFab()
        }

        const schedulePaint = () => {
          if (frame) return
          frame = requestAnimationFrame(paint)
        }

        ctx.effect(() => {
          const observer = new MutationObserver(() => {
            if (!fab.hidden) refreshFab()
            schedulePaint()
          })
          observer.observe(document.body, { childList: true, subtree: true, characterData: true })
          window.addEventListener('resize', schedulePaint)
          return () => {
            observer.disconnect()
            window.removeEventListener('resize', schedulePaint)
            if (frame) cancelAnimationFrame(frame)
            const reg = registry()
            if (reg) {
              reg.delete(HL_DONE)
              reg.delete(HL_PENDING)
            }
          }
        }, 'ask-select: highlight tracking')

        /* ------------------------------------------------------------ UI */

        const fab = document.createElement('button')
        fab.type = 'button'
        fab.className = 'askq-fab'
        fab.setAttribute(UI_ATTR, 'fab')
        fab.innerHTML = '<span class="dot"></span>我有疑问'
        fab.title = '选中回复里的一段文字后提问（v2：按下即收、滚动跟随）'
        fab.hidden = true
        document.body.appendChild(fab)

        const panel = document.createElement('div')
        panel.className = 'askq-panel'
        panel.setAttribute(UI_ATTR, 'panel')
        panel.hidden = true
        panel.innerHTML =
          '<div class="askq-quote"></div>' +
          '<textarea class="askq-input" placeholder="你想问这一段什么？"></textarea>' +
          '<div class="askq-row">' +
          '<span class="askq-hint">Enter 发送 · Shift+Enter 换行 · Esc 取消</span>' +
          '<button type="button" class="askq-btn" data-act="cancel">取消</button>' +
          '<button type="button" class="askq-btn" data-act="merge">合并回答</button>' +
          '<button type="button" class="askq-btn primary" data-act="side">单独回答</button>' +
          '</div>' +
          '<div class="askq-err"></div>'
        document.body.appendChild(panel)

        const quoteBox = panel.querySelector('.askq-quote')
        const input = panel.querySelector('.askq-input')
        const errorBox = panel.querySelector('.askq-err')

        ctx.effect(
          () => () => {
            fab.remove()
            panel.remove()
          },
          'ask-select: dom',
        )

        /** 失败时把原因写在屏幕底部，别让用户只看到「没反应」。 */
        const diagnose = (text) => {
          let bar = document.getElementById('askq-diag')
          if (!bar) {
            bar = document.createElement('div')
            bar.id = 'askq-diag'
            bar.setAttribute(UI_ATTR, 'diag')
            bar.style.cssText =
              'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;padding:10px 12px;' +
              'border-radius:8px;border:1px solid #ff8b8b;background:#2a1d1f;color:#ffd7d7;' +
              'font:12px/1.5 system-ui,sans-serif;white-space:pre-wrap;box-shadow:0 8px 24px rgba(0,0,0,.4)'
            bar.addEventListener('click', () => bar.remove())
            document.body.appendChild(bar)
          }
          bar.textContent = '选段提问：' + text + '（点这条可关闭）'
        }

        /** 这一次按下是否落在浮条上。 */
        let fabPressed = false
        let pressedAt = 0
        /** 最近一次选好的那一段，点按钮时用它，不依赖 captured 是否还在。 */
        let lastPassage = null
        /** 待确认的那一段：只记「哪一行 + 原文 + 第几次出现」，不存 Range。 */
        let captured = null
        let sessionId = null
        let sideCard = null
        let sideChild = null
        /** 输入框操作句柄，来自 dock 槽位；合并回答优先走它。 */
        let inputActions = null
        /** 这次按下鼠标之后，选区变化了几次。为 0 说明只是点了一下。 */
        let changesSinceDown = 0
        let scrollFrame = 0

        /** 两个开关一起关：hidden 属性 + 内联 display，免得被别的样式盖回来。 */
        const hideFab = () => {
          fab.hidden = true
          fab.style.display = 'none'
          captured = null
        }

        const hidePanel = () => {
          const wasOpen = !panel.hidden
          panel.hidden = true
          panel.style.display = 'none'
          errorBox.style.display = 'none'
          errorBox.textContent = ''
          if (wasOpen) {
            pending = null
            schedulePaint()
          }
        }

        const hideAll = () => {
          hideFab()
          hidePanel()
        }

        const showError = (text) => {
          errorBox.textContent = text
          errorBox.style.display = 'block'
        }

        /**
         * 浮条放在选区末尾而不是开头：既贴着手停留的位置，也不会压在别的
         * 插件（例如 dsh-markup）的选区工具条上。
         */
        const place = (element, range) => {
          const rects = range.getClientRects()
          const last = rects[rects.length - 1] || range.getBoundingClientRect()
          const width = element.offsetWidth
          const height = element.offsetHeight
          const preferred = last.right - width
          const left = Math.min(Math.max(8, preferred), Math.max(8, window.innerWidth - width - 8))
          let top = last.top - height - 8
          if (top < 8) top = last.bottom + 8
          element.style.left = Math.round(left) + 'px'
          element.style.top = Math.round(top) + 'px'
        }

        /** 由「行 + 原文 + 序号」重新算一条活的 Range；那一行没了就返回 null。 */
        const anchorRange = () => (captured ? rangeFor(captured) : null)

        /** 浮条跟着锚点走；锚点没了、或者已经滚出视口，就收掉。 */
        const refreshFab = () => {
          if (fab.hidden) return
          const range = anchorRange()
          if (!range) {
            hideFab()
            return
          }
          const rect = range.getBoundingClientRect()
          if (rect.bottom < -40 || rect.top > window.innerHeight + 40) {
            hideFab()
            return
          }
          place(fab, range)
        }

        /** 选区落在正文里、节点还在文档里、且有内容，才算一次可以提问的选择。 */
        const capture = () => {
          const selection = window.getSelection()
          if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
          const range = selection.getRangeAt(0)
          if (!range.startContainer.isConnected || !range.endContainer.isConnected) return null
          if (!proseOf(range.startContainer) || !proseOf(range.endContainer)) return null
          const rowKey = rowKeyOf(range.startContainer)
          if (!rowKey) return null
          const quote = selection.toString().trim()
          if (!quote) return null
          const row = rowElement(rowKey)
          if (!row || !row.contains(range.commonAncestorContainer)) return null
          let index = 0
          const { flat } = flatten(row)
          const target = quote.replace(/\s+/g, '')
          const offset = flatOffsetOf(row, range.startContainer, range.startOffset)
          const starts = startsOf(flat, target)
          if (starts.length > 0 && offset >= 0) {
            let pick = 0
            for (let i = 0; i < starts.length; i++) if (starts[i] <= offset) pick = i
            index = pick
          }
          return { quote, rowKey, index }
        }

        /** 按下就收：空白处一点，浮条与面板立刻消失。 */
        /** 坐标是否落在浮条矩形内：覆盖层挡住时事件目标不是我们，但坐标仍然算数。 */
        const inFab = (event) => {
          if (fab.hidden) return false
          const box = fab.getBoundingClientRect()
          if (!box.width || !box.height) return false
          return (
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom
          )
        }

        const onMouseDown = (event) => {
          changesSinceDown = 0
          if (inFab(event)) {
            fabPressed = true
            pressedAt = Date.now()
            return
          }
          if (event.target instanceof Element && event.target.closest('[' + UI_ATTR + ']')) return
          fabPressed = false
          hideAll()
        }

        const onSelectionChange = () => {
          changesSinceDown += 1
          const selection = window.getSelection()
          if (!selection || selection.isCollapsed) hideFab()
        }

        /**
         * 只有「这次按下之后选区真的变过」才显示。点一下空白不动选区，
         * 浮条不会再冒出来——这是之前它一直挂着的主要原因。
         */
        const onMouseUp = (event) => {
          if (event.button !== 0) return
          if (fabPressed) {
            fabPressed = false
            if (inFab(event) || Date.now() - pressedAt < 1200) {
              openPanel(captured || lastPassage)
              return
            }
          }
          if (event.target instanceof Element && event.target.closest('[' + UI_ATTR + ']')) return
          const changes = changesSinceDown
          window.setTimeout(() => {
            if (changes === 0) {
              hideFab()
              return
            }
            askScope.setPreset(presetOf(sessionId))
            if (!askScope.allows()) {
              hideFab()
              return
            }
            const found = capture()
            if (!found) {
              hideFab()
              return
            }
            captured = found
            lastPassage = found
            const range = anchorRange()
            if (!range) {
              hideFab()
              return
            }
            place(fab, range)
            fab.hidden = false
            fab.style.display = ''
          }, 0)
        }

        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          hideAll()
        }

        /** 滚动时按帧重算位置，浮条跟着那段文字走，不再钉在视口上。 */
        /** 滚动时立刻重算：place() 只重算一条 Range 和两个样式，不必等下一帧。 */
        const followAnchor = () => {
          refreshFab()
        }

        document.addEventListener('mousedown', onMouseDown, true)
        document.addEventListener('mouseup', onMouseUp)
        document.addEventListener('selectionchange', onSelectionChange)
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('scroll', followAnchor, true)
        document.addEventListener('wheel', followAnchor, { passive: true, capture: true })
        document.addEventListener('touchmove', followAnchor, { passive: true, capture: true })
        window.addEventListener('resize', followAnchor)
        window.addEventListener('blur', hideAll)
        ctx.effect(
          () => () => {
            document.removeEventListener('mousedown', onMouseDown, true)
            document.removeEventListener('mouseup', onMouseUp)
            document.removeEventListener('selectionchange', onSelectionChange)
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('scroll', followAnchor, true)
            document.removeEventListener('wheel', followAnchor, true)
            document.removeEventListener('touchmove', followAnchor, true)
            window.removeEventListener('resize', followAnchor)
            window.removeEventListener('blur', hideAll)
            if (scrollFrame) cancelAnimationFrame(scrollFrame)
          },
          'ask-select: listeners',
        )

        fab.addEventListener('mousedown', (event) => event.preventDefault())
        let openedAt = 0
        /** 打开提问面板。所有失败都会在屏幕上留一条状态条，不再静默。 */
        const openPanel = (passage) => {
          if (!passage) {
            diagnose('没有拿到待提问的段落（选区可能在点击时被清掉了）')
            return
          }
          try {
            const range = rangeFor(passage)
            if (!panel.isConnected) document.body.appendChild(panel)
            quoteBox.textContent = briefly(passage.quote, 400)
            input.value = ''
            errorBox.style.display = 'none'
            panel.hidden = false
            panel.style.display = 'block'
            const width = panel.offsetWidth || 380
            const height = panel.offsetHeight || 220
            let left = Math.max(8, (window.innerWidth - width) / 2)
            let top = Math.max(8, (window.innerHeight - height) / 2)
            if (range) {
              const rects = range.getClientRects()
              const last = rects[rects.length - 1] || range.getBoundingClientRect()
              if (last && (last.width || last.height)) {
                left = Math.min(Math.max(8, last.left), Math.max(8, window.innerWidth - width - 8))
                top = Math.min(Math.max(8, last.bottom + 10), Math.max(8, window.innerHeight - height - 8))
              }
            }
            panel.style.left = Math.round(left) + 'px'
            panel.style.top = Math.round(top) + 'px'
            pending = passage
            schedulePaint()
            hideFab()
            const box = panel.getBoundingClientRect()
            const style = getComputedStyle(panel)
            if (box.width === 0 || box.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
              panel.style.left = '40px'
              panel.style.top = '40px'
              const again = panel.getBoundingClientRect()
              if (again.width === 0 || again.height === 0) {
                diagnose(
                  '面板已建立但量不出尺寸：display=' +
                    style.display +
                    '，尺寸=' +
                    Math.round(again.width) +
                    '×' +
                    Math.round(again.height) +
                    '，父节点=' +
                    (panel.parentNode && panel.parentNode.nodeName),
                )
              }
            }
            input.focus()
          } catch (error) {
            diagnose('打开面板时出错：' + (error && error.message ? error.message : String(error)))
          }
        
          openedAt = Date.now()
        }

        fab.addEventListener('mousedown', (event) => event.preventDefault())
        fab.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          // 松手时可能已经打开过，这里只做兜底
          if (Date.now() - openedAt < 500) return
          openPanel(captured || lastPassage)
        })

        panel.querySelector('[data-act="cancel"]').addEventListener('click', () => {
          hidePanel()
          window.getSelection()?.removeAllRanges()
        })

        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void submit('merge')
          }
        })

        panel.querySelector('[data-act="merge"]').addEventListener('click', () => void submit('merge'))
        panel.querySelector('[data-act="side"]').addEventListener('click', () => void submit('side'))

        /* ------------------------------------------------------ 两个去处 */

        const sessionBinding = (id) => (id ? ctx.sessions.binding(id) : null)

        async function askHere(text) {
          // 先走输入框：这是 dsh-markup 送批注的方式，消息由输入框正常发出。
          const actions = inputActions
          if (actions && typeof actions.setDraft === 'function' && typeof actions.submit === 'function') {
            actions.setDraft(text)
            actions.submit()
            return
          }
          const binding = sessionBinding(sessionId)
          const session = binding && binding.session
          if (!session || typeof session.prompt !== 'function') throw new Error('当前会话不可用')
          const result = await session.prompt([{ type: 'text', text }], 'queue')
          if (result && result.ok === false) throw new Error('发送失败：' + (result.error?.code || 'unknown'))
        }

        async function retire(child) {
          if (!child) return
          try {
            const session = sessionBinding(child)?.session
            if (session?.getSnapshot?.()?.running) {
              await Promise.race([Promise.resolve(session.cancel()), sleep(3000)]).catch(() => {})
              for (let i = 0; i < 20 && session.getSnapshot?.()?.running; i++) await sleep(150)
            }
          } catch {
            /* 会话可能已经没了 */
          }
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const result = await ctx.workspaces?.archiveSession?.(child)
              if (!(result && result.ok === false)) return
            } catch {
              /* 重试几次后放弃 */
            }
            await sleep(600 * (attempt + 1))
          }
        }

        function openCard(quote) {
          sideCard?.close()
          const card = document.createElement('div')
          card.className = 'askq-card'
          card.setAttribute(UI_ATTR, 'card')
          card.innerHTML =
            '<header><span>我有疑问 · 单独回答</span><span class="sub"></span>' +
            '<button type="button" data-act="close" title="关闭">×</button></header>' +
            '<div class="quote"></div><div class="body"></div>' +
            '<footer><span class="status">正在开一个旁路会话…</span><span class="grow"></span></footer>'
          card.querySelector('.quote').textContent = briefly(quote, 600)
          document.body.appendChild(card)
          const body = card.querySelector('.body')
          const status = card.querySelector('.status')
          const listeners = new Set()
          let disposed = false
          const handle = {
            onClose(fn) {
              listeners.add(fn)
            },
            text(value) {
              if (disposed) return
              body.textContent = value || ''
              body.scrollTop = body.scrollHeight
            },
            status(value) {
              if (disposed) return
              status.textContent = value
            },
            fail(value) {
              if (disposed) return
              status.textContent = value
              status.style.color = '#ff8b8b'
            },
            close() {
              if (disposed) return
              disposed = true
              for (const fn of listeners) {
                try {
                  fn()
                } catch {
                  /* 关闭回调不该互相影响 */
                }
              }
              listeners.clear()
              card.remove()
              if (sideCard === handle) sideCard = null
            },
          }
          card.querySelector('[data-act="close"]').addEventListener('click', () => handle.close())
          sideCard = handle
          return handle
        }

        async function askAside(text, quote) {
          const card = openCard(quote)
          try {
            if (!sessionId) throw new Error('当前会话不可用，无法开旁路会话')
            const child = await ctx.sessions.fork({ sessionId })
            if (!child) throw new Error('无法创建旁路会话')
            sideChild = child
            const retained = ctx.sessions.retain(child, { source: 'dsh-deeptutor-study' })
            try {
              await retained?.ready
            } catch {
              /* 就绪与否都不阻塞提问 */
            }
            const scope = ctx.sessions.scope(child)
            const session = scope ? ctx.sessions.sessionOf(scope) : null
            if (session && typeof session.open === 'function') await session.open()
            const binding = sessionBinding(child)
            Promise.resolve(binding?.session?.rename?.('疑问 · ' + briefly(quote, 18))).catch(() => {})
            const target = ctx.uiConversation.binding(child).target('chat')
            const token = makeToken()
            const unsubscribe = target.subscribe(() => card.text(readAnswer(target, token)))
            card.onClose(() => {
              try {
                unsubscribe?.()
              } catch {
                /* ignore */
              }
              void retire(child)
              if (sideChild === child) sideChild = null
            })
            if (!binding?.session?.prompt) throw new Error('旁路会话不可用')
            card.status('已提问，等待回答…')
            const result = await binding.session.prompt([{ type: 'text', text: token + '\n' + text }], 'queue')
            if (result && result.ok === false) throw new Error('发送失败：' + (result.error?.code || 'unknown'))
            card.text(readAnswer(target, token))
          } catch (error) {
            card.fail(error && error.message ? error.message : String(error))
          }
        }

        async function submit(mode) {
          // openPanel 里已经 hideFab()，captured 会是 null；这里读面板自己的锚点。
          const passage = pending || captured
          if (!passage) {
            showError('这一步没拿到选中的文字，请重新选一次。')
            return
          }
          const question = input.value.trim()
          if (!question) {
            input.focus()
            showError('先写一句你想问什么。')
            return
          }
          const { quote, rowKey, index } = passage
          const text = composeQuestion(quote, question)
          marked.push({ rowKey, quote, index })
          if (marked.length > MAX_MARKED) marked.splice(0, marked.length - MAX_MARKED)
          pending = null
          schedulePaint()
          hidePanel()
          window.getSelection()?.removeAllRanges()
          try {
            if (mode === 'side') await askAside(text, quote)
            else await askHere(text)
          } catch (error) {
            showError(error && error.message ? error.message : String(error))
            panel.hidden = false
          }
        }

        /**
         * 当前会话用的是哪个 Agent 预设。DSH 把预设放在会话投影
         * `agentPreset` 里；拿不到时返回 null，选择器会显示「未识别」，
         * 并按「全局可用」处理，避免功能静默失效。
         */
        const presetOf = (id) => {
          try {
            const binding = id ? ctx.sessions.binding(id) : null
            const session = binding && binding.session
            if (!session) return null
            // 预设不在 getSnapshot() 里，而在会话的投影存储上。
            const projections = session.projections
            if (projections) {
              if (typeof projections.get === 'function') {
                const value = projections.get('agentPreset')
                if (typeof value === 'string') return value
              }
              if (typeof projections.values === 'function') {
                const value = projections.values().agentPreset
                if (typeof value === 'string') return value
              }
            }
            const snap = typeof session.getSnapshot === 'function' ? session.getSnapshot() : null
            if (snap && typeof snap.agentPreset === 'string') return snap.agentPreset
          } catch {
            /* 读不到就算未知 */
          }
          return null
        }

        /* dock 槽位是拿到当前会话 id 的官方位置，顺便把模式同步给选择器。 */
        const SessionProbe = (props) => {
          if (props && props.inputActions) inputActions = props.inputActions
          return null
        }
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.dock',
              id: 'ask-select-session',
              order: 95,
              inject: (id) => {
                sessionId = id ? String(id) : null
                askScope.setPreset(presetOf(sessionId))
                return {}
              },
            },
            SessionProbe,
          ),
        )

        ctx.effect(
          () => () => {
            if (sideChild) void retire(sideChild)
          },
          'ask-select: side session',
        )
      }

      return { apply }
    })()

    const composer = (function (require) {
      const React = require('react')
      const h = React.createElement

      const KB_ENDPOINT = '/api/study/kb'
      const DIGEST_ENDPOINT = '/api/study/digest'
      const SETUP_ENDPOINT = '/api/study/setup'
      const VM_ENDPOINT = '/vm-ubuntu'

      // The VM chip from dsh-plugin-vm-ubuntu now lives inside this panel, so the
      // standalone one would just duplicate it. Remove this rule to bring it back.
      const HIDE_VM_CHIP = '.dsh-vm-wrap{display:none!important}'
      if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-deeptutor-study/hide-vm-chip"]') === null) {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-deeptutor-study'
        tag.dataset.pluginCss = 'dsh-deeptutor-study/hide-vm-chip'
        tag.textContent = HIDE_VM_CHIP
        document.head.appendChild(tag)
      }

      async function call(url, init) {
        const response = await fetch(url, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { accept: 'application/json', ...(init && init.body ? { 'content-type': 'application/json' } : {}) },
          ...init,
        })
        const text = await response.text()
        let payload = null
        try {
          payload = text ? JSON.parse(text) : null
        } catch {
          payload = { message: text.slice(0, 200) }
        }
        if (!response.ok) {
          const message = payload && (payload.message || payload.error)
          // A bare "not found" means the route itself is missing: the Host half
          // only picks up new routes on a full restart.
          const bare = message === undefined || message === 'not found' || message === 'Not Found'
          throw new Error(bare ? `接口不可用（HTTP ${response.status}）—— 宿主补丁还没生效，请完全重启 DSH` : String(message))
        }
        return payload
      }

      const styles = {
        wrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
        chip: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 26,
          padding: '0 9px',
          borderRadius: 999,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-interactive-bg-hover)',
          color: 'var(--dsw-alias-label-secondary)',
          fontSize: 12.5,
          lineHeight: '26px',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        },
        chipOn: { color: 'var(--dsw-alias-label-primary)', borderColor: 'var(--dsw-alias-label-primary)' },
        dot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--dsw-alias-label-tertiary)', flex: 'none' },
        dotBusy: { background: 'var(--dsw-alias-state-warn-primary)' },
        dotDone: { background: 'var(--dsw-alias-state-success-primary)' },
        panel: {
          position: 'fixed',
          width: 356,
          maxHeight: '58vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-1)',
          boxShadow: '0 18px 44px #00000033',
          overflow: 'hidden',
          zIndex: 60,
        },
        panelHead: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
          flex: '0 0 auto',
        },
        panelTitle: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        panelHint: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' },
        panelBody: {
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        },
        section: {
          // Never let the flex column shrink a section: it would clip the fields
          // inside instead of scrolling the body.
          flex: '0 0 auto',
          borderRadius: 10,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-2)',
          overflow: 'hidden',
        },
        sectionHead: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '9px 10px',
          border: 'none',
          background: 'transparent',
          color: 'var(--dsw-alias-label-primary)',
          fontSize: 12.5,
          fontWeight: 520,
          cursor: 'pointer',
          textAlign: 'left',
        },
        chevron: { fontSize: 10, opacity: 0.7, width: 10 },
        sectionTitle: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        sectionStatus: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'nowrap' },
        sectionBody: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '0 10px 10px',
          borderTop: '0.5px solid var(--dsw-alias-border-l2)',
          paddingTop: 10,
        },
        sectionHint: { padding: '0 10px 8px', fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' },
        label: { fontSize: 11.5, color: 'var(--dsw-alias-label-tertiary)' },
        select: {
          width: '100%',
          padding: '7px 9px',
          borderRadius: 9,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-3)',
          color: 'var(--dsw-alias-label-primary)',
          fontSize: 13,
        },
        input: {
          width: '100%',
          padding: '7px 9px',
          borderRadius: 9,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-3)',
          color: 'var(--dsw-alias-label-primary)',
          fontSize: 13,
          boxSizing: 'border-box',
        },
        row: { display: 'flex', gap: 8, alignItems: 'center' },
        primary: {
          flex: 1,
          padding: '8px 12px',
          borderRadius: 9,
          border: 'none',
          background: 'var(--dsw-alias-label-primary)',
          color: 'var(--dsw-alias-bg-layer-2)',
          fontSize: 12.5,
          cursor: 'pointer',
        },
        primaryOff: { opacity: 0.45, cursor: 'default' },
        ghost: {
          padding: '7px 10px',
          borderRadius: 9,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          background: 'transparent',
          color: 'var(--dsw-alias-label-secondary)',
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        },
        ghostOff: { opacity: 0.45, cursor: 'default' },
        toggleOn: { background: 'var(--dsw-alias-state-success-primary)', color: 'var(--dsw-alias-bg-layer-1)', borderColor: 'transparent' },
        note: { fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' },
        log: {
          maxHeight: 88,
          overflowY: 'auto',
          margin: 0,
          padding: '8px 10px',
          borderRadius: 9,
          background: 'var(--dsw-alias-bg-module-platform)',
          color: 'var(--dsw-alias-label-secondary)',
          fontSize: 11,
          lineHeight: '16px',
          whiteSpace: 'pre-wrap',
        },
        error: { fontSize: 11.5, color: 'var(--dsw-alias-state-error-primary)' },
        ok: { fontSize: 11.5, color: 'var(--dsw-alias-state-success-primary)' },
      }

      /** Collapsible block; every feature lives in one of these. */
      function Section(props) {
        const [open, setOpen] = React.useState(props.initial === true)
        return h(
          'div',
          { style: styles.section },
          h(
            'button',
            { type: 'button', style: styles.sectionHead, onClick: () => setOpen((value) => !value) },
            h('span', { style: styles.chevron }, open ? '▾' : '▸'),
            h('span', { style: styles.sectionTitle }, props.title),
            props.status ? h('span', { style: styles.sectionStatus }, props.status) : null,
          ),
          open ? h('div', { style: styles.sectionBody }, props.children) : null,
        )
      }

      /** 总结入库：把本对话整理成笔记写进知识库。 */
      function DigestSection() {
        const [kbs, setKbs] = React.useState(null)
        const [kb, setKb] = React.useState('')
        const [title, setTitle] = React.useState('')
        const [job, setJob] = React.useState(null)
        const [error, setError] = React.useState(null)
        const [creating, setCreating] = React.useState(false)
        const [newKb, setNewKb] = React.useState('')
        const alive = React.useRef(true)

        React.useEffect(() => {
          alive.current = true
          return () => {
            alive.current = false
          }
        }, [])

        const loadKbs = React.useCallback(async () => {
          try {
            const payload = await call(KB_ENDPOINT)
            if (!alive.current) return
            const names = (payload.items || []).map((row) => row.name)
            setKbs(names)
            setKb((current) => (current !== '' && names.includes(current) ? current : payload.default || names[0] || ''))
          } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
          }
        }, [])

        React.useEffect(() => {
          loadKbs()
        }, [loadKbs])

        React.useEffect(() => {
          if (job === null || job.status !== 'running') return undefined
          const timer = setInterval(async () => {
            try {
              const payload = await call(`${DIGEST_ENDPOINT}?job=${encodeURIComponent(job.id)}`)
              if (!alive.current) return
              setJob(payload.job)
              if (payload.job && payload.job.status !== 'running') loadKbs()
            } catch {
              /* keep polling */
            }
          }, 2000)
          return () => clearInterval(timer)
        }, [job, loadKbs])

        const start = async () => {
          if (kb === '') return
          setError(null)
          setJob(null)
          try {
            const payload = await call(DIGEST_ENDPOINT, { method: 'POST', body: JSON.stringify({ kb, title: title.trim() }) })
            if (alive.current) setJob(payload.job)
          } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
          }
        }

        const createKb = async () => {
          const name = newKb.trim()
          if (name === '') return
          setCreating(true)
          setError(null)
          try {
            await call(KB_ENDPOINT, { method: 'POST', body: JSON.stringify({ action: 'create', name, folderOnly: true }) })
            if (!alive.current) return
            setNewKb('')
            await loadKbs()
            setKb(name)
          } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
          } finally {
            if (alive.current) setCreating(false)
          }
        }

        const running = job !== null && job.status === 'running'
        const done = job !== null && job.status === 'done'
        const failed = job !== null && job.status === 'failed'
        const lines = job && job.log ? job.log.trim().split('\n').slice(-5) : []

        return h(
          Section,
          { title: '总结入库', status: running ? '进行中' : done ? '完成' : null, initial: true },
          h(
            'div',
            null,
            h('div', { style: styles.label }, '目标知识库'),
            h(
              'select',
              { style: styles.select, value: kb, disabled: running, onChange: (event) => setKb(event.target.value) },
              kbs === null
                ? h('option', { value: '' }, '正在读取…')
                : kbs.length === 0
                  ? h('option', { value: '' }, '还没有知识库，先在下面新建')
                  : kbs.map((name) => h('option', { key: name, value: name }, name)),
            ),
          ),
          h(
            'div',
            null,
            h('div', { style: styles.label }, '文件名（留空按日期自动命名）'),
            h('input', {
              style: styles.input,
              value: title,
              disabled: running,
              placeholder: '2026-11-19-知识库插件排障',
              onChange: (event) => setTitle(event.target.value),
            }),
          ),
          h(
            'div',
            { style: styles.row },
            h('input', {
              style: { ...styles.input, flex: 1 },
              value: newKb,
              disabled: running || creating,
              placeholder: '新建空知识库',
              onChange: (event) => setNewKb(event.target.value),
            }),
            h(
              'button',
              { type: 'button', style: styles.ghost, disabled: running || creating || newKb.trim() === '', onClick: createKb },
              creating ? '创建中…' : '新建',
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              style: { ...styles.primary, ...(running || kb === '' ? styles.primaryOff : null) },
              disabled: running || kb === '',
              onClick: start,
            },
            running ? '正在总结…' : '开始总结',
          ),
          lines.length > 0 ? h('pre', { style: styles.log }, lines.join('\n')) : null,
          failed ? h('div', { style: styles.error }, '失败，看上方日志') : null,
          done ? h('div', { style: styles.ok }, `已存入 ${kb}`) : null,
          error !== null ? h('div', { style: styles.error }, error) : null,
        )
      }

      /** Ubuntu VM：与 dsh-plugin-vm-ubuntu 的宿主路由对话。 */
      function VmSection() {
        const [vm, setVm] = React.useState(null)
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)
        const alive = React.useRef(true)

        React.useEffect(() => {
          alive.current = true
          return () => {
            alive.current = false
          }
        }, [])

        const refresh = React.useCallback(async () => {
          try {
            const payload = await call(`${VM_ENDPOINT}/state`)
            if (alive.current) {
              setVm(payload)
              setError(null)
            }
          } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
          }
        }, [])

        React.useEffect(() => {
          refresh()
          const timer = setInterval(refresh, 10000)
          return () => clearInterval(timer)
        }, [refresh])

        const act = async (run) => {
          setBusy(true)
          try {
            const next = await run()
            if (alive.current && next) setVm(next)
            if (alive.current) setError(null)
          } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
          } finally {
            if (alive.current) setBusy(false)
          }
        }

        if (vm === null) {
          return h(Section, { title: 'Ubuntu VM', status: error ? '不可用' : '读取中' },
            h('div', { style: styles.note }, error || '正在读取虚拟机状态…'))
        }

        const running = vm.power === 'running'
        const label = !vm.enabled ? '已停用' : running ? (vm.sshPortOpen ? '运行中' : '启动中') : '已关机'
        return h(
          Section,
          { title: 'Ubuntu VM', status: label },
          h(
            'div',
            { style: styles.row },
            h(
              'button',
              {
                type: 'button',
                style: { ...styles.ghost, ...(vm.enabled ? styles.toggleOn : null) },
                disabled: busy,
                onClick: () => act(() => call(`${VM_ENDPOINT}/access`, { method: 'POST', body: JSON.stringify({ enabled: !vm.enabled }) })),
              },
              vm.enabled ? '访问已开启' : '访问已停用',
            ),
            h(
              'button',
              {
                type: 'button',
                style: { ...styles.ghost, ...(vm.enabled ? null : styles.ghostOff) },
                disabled: busy || !vm.enabled,
                onClick: () => act(() => call(`${VM_ENDPOINT}/power`, { method: 'POST', body: JSON.stringify({ action: running ? 'stop' : 'start' }) })),
              },
              running ? '关机' : '开机',
            ),
          ),
          h('div', { style: styles.note }, vm.host ? `SSH ${vm.host}` : '未检测到 SSH 主机'),
          error !== null ? h('div', { style: styles.error }, error) : null,
        )
      }

      /** 学习环境：Python 依赖与本地向量服务是否就绪。 */
      function SetupSection() {
        const [status, setStatus] = React.useState(null)
        const [job, setJob] = React.useState(null)
        const [error, setError] = React.useState(null)
        const alive = React.useRef(true)

        React.useEffect(() => {
          alive.current = true
          return () => {
            alive.current = false
          }
        }, [])

        const load = React.useCallback(async () => {
          try {
            const payload = await call(SETUP_ENDPOINT)
            if (alive.current) setStatus(payload)
          } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
          }
        }, [])

        React.useEffect(() => {
          load()
        }, [load])

        React.useEffect(() => {
          if (job === null || job.status !== 'running') return undefined
          const timer = setInterval(async () => {
            try {
              const payload = await call(`${SETUP_ENDPOINT}?job=${encodeURIComponent(job.id)}`)
              if (!alive.current) return
              setJob(payload.job)
              if (payload.job && payload.job.status !== 'running') load()
            } catch {
              /* keep polling */
            }
          }, 2500)
          return () => clearInterval(timer)
        }, [job, load])

        const ready = status !== null && status.pythonOk === true && status.deeptutorHomeReady === true
        const running = job !== null && job.status === 'running'
        const lines = job && job.log ? job.log.trim().split('\n').slice(-4) : []

        return h(
          Section,
          { title: '学习环境', status: job === null ? (ready ? '已就绪' : status === null ? '读取中' : '未就绪') : running ? '准备中' : job.status === 'done' ? '已就绪' : '失败' },
          h('div', { style: styles.note }, ready ? 'Python 依赖与本地向量服务都可用。' : '缺 Python 依赖或向量服务没起来时，知识库索引会失败。'),
          h(
            'button',
            {
              type: 'button',
              style: { ...styles.primary, alignSelf: 'flex-start', flex: 'none', ...(running ? styles.primaryOff : null) },
              disabled: running,
              onClick: async () => {
                try {
                  const payload = await call(SETUP_ENDPOINT, { method: 'POST', body: '{}' })
                  if (alive.current) setJob(payload.job)
                } catch (reason) {
                  if (alive.current) setError(reason instanceof Error ? reason.message : String(reason))
                }
              },
            },
            running ? '准备中…' : '准备学习环境',
          ),
          lines.length > 0 ? h('pre', { style: styles.log }, lines.join('\n')) : null,
          error !== null ? h('div', { style: styles.error }, error) : null,
        )
      }

      /** 侧栏快捷入口（点了切到对应面板）。 */
      function ShortcutsSection({ ctx }) {
        const open = (id) => {
          try {
            const layout = ctx.get('layout')
            if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(id)
          } catch {
            /* ignore */
          }
        }
        return h(
          Section,
          { title: '打开面板' },
          h(
            'div',
            { style: styles.row },
            h('button', { type: 'button', style: styles.ghost, onClick: () => open('dsh-deeptutor-study/knowledge') }, '知识库管理'),
            h('button', { type: 'button', style: styles.ghost, onClick: () => open('dsh-deeptutor-study/wrongbook') }, '错题本'),
          ),
        )
      }

      const NEW_SESSION_KEY = 'dsh-deeptutor-study/review-new-session'

      function readNewSession() {
        try {
          return window.localStorage.getItem(NEW_SESSION_KEY) === '1'
        } catch {
          return false
        }
      }

      function writeNewSession(value) {
        try {
          window.localStorage.setItem(NEW_SESSION_KEY, value ? '1' : '0')
        } catch {
          /* storage may be unavailable */
        }
      }

      /** Best-effort lookup of the sidebar's new-conversation button. */
      function findNewChatButton() {
        const pattern = /新会话|新对话|新的对话|new chat|new conversation|new session/i
        const nodes = Array.from(document.querySelectorAll('button, [role="button"], a'))
        for (const node of nodes) {
          const text = (node.textContent || '').trim()
          const aria = (node.getAttribute('aria-label') || '').trim()
          const title = (node.getAttribute('title') || '').trim()
          if (!pattern.test(text) && !pattern.test(aria) && !pattern.test(title)) continue
          const rect = node.getBoundingClientRect()
          if (rect.width < 24 || rect.height < 16) continue
          if (rect.left > window.innerWidth * 0.5) continue
          return node
        }
        return null
      }

      function findComposerEditor() {
        const nodes = Array.from(document.querySelectorAll('[contenteditable="true"], textarea'))
        for (const node of nodes) {
          const rect = node.getBoundingClientRect()
          if (rect.width > 60 && rect.height > 12) return node
        }
        return null
      }

      /**
       * Experimental: click 「新会话」 then write the prompt into the fresh draft.
       *
       * DSH exposes no session-creation API to plugins, so this drives the DOM.
       * It throws when the button or the editor cannot be found, and the caller
       * falls back to the current composer.
       */
      async function startFreshSession(prompt) {
        const button = findNewChatButton()
        if (button === null) throw new Error('没找到「新会话」按钮')
        button.click()
        await new Promise((resolve) => setTimeout(resolve, 700))
        const editor = findComposerEditor()
        if (editor === null) throw new Error('新会话的输入框没出现')
        editor.focus()
        if (typeof HTMLTextAreaElement === 'function' && editor instanceof HTMLTextAreaElement) {
          editor.value = prompt
          editor.dispatchEvent(new Event('input', { bubbles: true }))
          return
        }
        const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, prompt)
        if (ok) return
        editor.textContent = prompt
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: prompt, inputType: 'insertText' }))
      }

      function AskScopeSection() {
        const [scope, setScope] = React.useState(() => askScope.get())
        const [preset, setPreset] = React.useState(() => askScope.preset())

        React.useEffect(
          () =>
            askScope.subscribe((next) => {
              setScope(next)
              setPreset(askScope.preset())
            }),
          [],
        )

        const pick = (value) => {
          askScope.set(value)
          setScope(value)
        }
        const option = (value, label) =>
          h(
            'button',
            {
              type: 'button',
              style: { ...styles.ghost, ...(scope === value ? styles.toggleOn : null), alignSelf: 'flex-start' },
              onClick: () => pick(value),
            },
            label,
          )
        const current = preset === null ? '未识别' : preset === 'study' ? '学习模式' : preset

        return h(
          Section,
          { title: '选段提问', status: scope === 'all' ? '所有会话' : '仅学习模式' },
          h(
            'div',
            { style: styles.note },
            '选中回复里的一段文字，浮条上会出现「我有疑问」，可以合并进当前会话回答，也可以开一个旁路会话单独回答。',
          ),
          h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            option('study', scope === 'study' ? '仅学习模式 · 已选' : '仅学习模式'),
            option('all', scope === 'all' ? '所有会话 · 已选' : '所有会话'),
          ),
          h(
            'div',
            { style: styles.note },
            '当前会话：' + current + (preset === null ? '（读不到预设时按所有会话处理）' : ''),
          ),
        )
      }

      function FeaturesPanel({ ctx, slotProps }) {
        const [open, setOpen] = React.useState(false)
        const [pos, setPos] = React.useState(null)
        const [newSession, setNewSession] = React.useState(() => readNewSession())
        const [panelNote, setPanelNote] = React.useState(null)
        const anchor = React.useRef(null)

        // A 「温习」 click in the knowledge-base page asks the composer to take a
        // prompt: either into the current draft (inputActions) or, when the
        // experimental switch is on, into a freshly created conversation.
        React.useEffect(() => {
          const insertHere = (prompt) => {
            const actions = slotProps && slotProps.inputActions
            if (!actions || typeof actions.insertText !== 'function') return false
            try {
              const span = typeof actions.captureInsertion === 'function' ? actions.captureInsertion() : undefined
              actions.insertText(prompt, span)
              return true
            } catch {
              return false
            }
          }
          const onReview = (event) => {
            const prompt = event && event.detail ? event.detail.prompt : undefined
            if (typeof prompt !== 'string' || prompt === '') return
            if (!readNewSession()) {
              insertHere(prompt)
              return
            }
            startFreshSession(prompt).then(
              () => setPanelNote('已在新对话里填入温习请求，回车开始。'),
              (reason) => {
                const message = reason instanceof Error ? reason.message : String(reason)
                setPanelNote(`新建对话失败：${message}；已退回当前输入框（提示词也在剪贴板）。`)
                insertHere(prompt)
              },
            )
          }
          window.addEventListener('dsh-study-review', onReview)
          return () => window.removeEventListener('dsh-study-review', onReview)
        }, [slotProps])

        const toggle = () => {
          if (open) {
            setOpen(false)
            return
          }
          try {
            const rect = anchor.current.getBoundingClientRect()
            setPos({ bottom: Math.max(12, window.innerHeight - rect.top + 8), right: Math.max(12, window.innerWidth - rect.right) })
          } catch {
            setPos({ bottom: 80, right: 24 })
          }
          setOpen(true)
        }

        React.useEffect(() => {
          if (!open) return undefined
          const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false)
          }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [open])

        return h(
          'span',
          { style: styles.wrap },
          h(
            'button',
            {
              type: 'button',
              ref: anchor,
              style: { ...styles.chip, ...(open ? styles.chipOn : null) },
              title: '功能面板：现有的与以后的开关都在这里',
              onClick: toggle,
            },
            h('span', { style: styles.dot }),
            h('span', null, '功能'),
          ),
          open
            ? h(
                'div',
                { style: { ...styles.panel, ...(pos ? { bottom: pos.bottom, right: pos.right } : { bottom: 80, right: 24 }) } },
                h(
                  'div',
                  { style: styles.panelHead },
                  h('span', { style: styles.panelTitle }, '功能'),
                  h('span', { style: styles.panelHint }, '点每一行展开'),
                  h('span', { style: { flex: 1 } }),
                  h('button', { type: 'button', style: styles.ghost, onClick: () => setOpen(false) }, '收起'),
                ),
                h(
                  'div',
                  { style: styles.panelBody },
                  h(DigestSection, null),
                  h(SetupSection, null),
                  h(
                    Section,
                    { title: '温习用新对话', status: newSession ? '已开启' : '已关闭' },
                    h(
                      'div',
                      { style: styles.note },
                      '开启后，点知识库列表里的「温习」会先模拟点击左侧「新会话」，再把提示词写进新对话的输入框。' +
                        'DSH 没给插件开放新建会话的接口，这一版靠 DOM 找按钮，改版可能失效；失败会自动退回当前输入框（提示词同时留在剪贴板）。',
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: { ...styles.ghost, ...(newSession ? styles.toggleOn : null), alignSelf: 'flex-start' },
                        onClick: () => {
                          const next = !newSession
                          setNewSession(next)
                          writeNewSession(next)
                        },
                      },
                      newSession ? '已开启 · 点击关闭' : '已关闭 · 点击开启',
                    ),
                  ),
                  h(AskScopeSection, null),
                  h(ShortcutsSection, { ctx }),
                  panelNote !== null ? h('div', { style: styles.ok, padding: '0 2px' }, panelNote) : null,
                  h('div', { style: styles.note }, '以后的新功能都会加到这个面板里。'),
                ),
              )
            : null,
        )
      }

      return {
        inject: ['slots'],
        apply(ctx) {
          const Chip = (props) => h(FeaturesPanel, { ctx, slotProps: props })
          ctx.slots.inject('conversation.input.right', () =>
            ctx.slots.register({ name: 'conversation.input.right', id: 'deeptutor-features', order: 60 }, Chip),
          )
        },
      }
    })(require)

    return {
      inject: ['slots', 'sessions', 'uiConversation', 'workspaces'],
      apply(ctx) {
        wrongbook.apply(ctx)
        knowledge.apply(ctx)
        review.apply(ctx)
        composer.apply(ctx)
        askselect.apply(ctx)
      },
    }
  },
})
