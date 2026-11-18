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
  id: 'dsh-deeptutor-study/wrongbook',
  factory(require) {
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
      group: { display: 'flex', flexDirection: 'column', gap: 8 },
      groupHead: { display: 'flex', alignItems: 'center', gap: 8 },
      groupTitle: { margin: 0, fontSize: 14, fontWeight: 500, lineHeight: '22px' },
      groupCount: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
      list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
      card: {
        borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
        padding: '10px 2px',
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
        padding: '0 7px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)',
        color: 'var(--dsw-alias-state-success-secondary, var(--dsw-alias-state-success-primary))',
      },
      actions: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
      actionButton: {
        height: 26,
        padding: '0 10px',
        borderRadius: 8,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12,
        lineHeight: '18px',
        cursor: 'pointer',
      },
      actionButtonDisabled: { opacity: 0.45, cursor: 'default' },
      details: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        margin: '4px 0 4px',
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-module-platform)',
      },
      detailLabel: { fontSize: 11.5, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      detailText: { fontSize: 13, lineHeight: '20px', margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
      yourAnswer: { color: 'var(--dsw-alias-state-error-primary)' },
      correctAnswer: { color: 'var(--dsw-alias-state-success-primary)' },
      empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        padding: '24px 0',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        lineHeight: '20px',
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

        const summary = h(
          'div',
          { style: styles.summary },
          h('span', { style: styles.summaryValue }, String(dueToday.length)),
          h('span', { style: styles.summaryLabel }, t('dueTodayCount')),
          h('span', { style: styles.summaryMeta }, t('summaryMeta', { total: String(items.length), mastered: String(masteredCount) })),
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
  },
})

/**
 * Client half of the DeepTutor knowledge-base manager.
 *
 * Registers one left-sidebar entry and its global `main` panel: every knowledge
 * base with its document count, plus create / rename / delete / set-default.
 */
window.__ModuleLoader__.load({
  id: 'dsh-deeptutor-study/knowledge',
  factory(require) {
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
        dirPlaceholder: '放文档的文件夹，例如 D:\\books\\ros2',
        create: '新建',
        creating: '正在建…',
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
        dirPlaceholder: 'Folder holding the documents, e.g. D:\\books\\ros2',
        create: 'Create',
        creating: 'Creating…',
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
            h('input', {
              style: styles.input,
              value: draft.dir,
              placeholder: t('dirPlaceholder'),
              onChange: (event) => setDraft((previous) => ({ ...previous, dir: event.target.value })),
            }),
            h(
              'button',
              {
                type: 'button',
                style: { ...styles.primary, ...(working || draft.name.trim() === '' || draft.dir.trim() === '' ? styles.disabled : null) },
                disabled: working || draft.name.trim() === '' || draft.dir.trim() === '',
                onClick: async () => {
                  const payload = await post({ action: 'create', name: draft.name.trim(), docsDir: draft.dir.trim() })
                  if (payload !== null) setDraft({ name: '', dir: '' })
                },
              },
              working ? t('creating') : t('create'),
            ),
          ),
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
                    h('span', { style: styles.badge }, item.status),
                  ),
              h(
                'div',
                { style: styles.meta },
                item.docs === null || item.docs === undefined ? t('noDocs') : `${t('docs', { count: String(item.docs) })}${item.chunks ? ` · ${t('chunks', { count: String(item.chunks) })}` : ''}`,
                item.model ? ` · ${item.model}` : '',
              ),
            ),
            h(
              'div',
              { style: styles.actions },
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
  },
})
