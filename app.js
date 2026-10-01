(() => {
  "use strict";

  const DATA = window.ANALYTICAL_QUIZ_DATA;
  if (!DATA || !Array.isArray(DATA.questions)) {
    document.body.innerHTML = '<main class="app-shell"><div class="notice notice-error">問題データを読み込めませんでした。data.js が index.html と同じ階層にあるか確認してください。</div></main>';
    return;
  }

  const QUESTIONS = DATA.questions;
  const QUESTION_MAP = new Map(QUESTIONS.map((question) => [question.id, question]));
  const SOURCES = DATA.sources || {};
  const CATEGORY_META = DATA.categoryMeta || {};
  const STORAGE_KEY = "analytical-quiz-300-progress-v2";
  const SESSION_KEY = "analytical-quiz-300-active-session-v2";
  const PAGE_SIZE = 15;
  const LETTERS = ["A", "B", "C", "D"];

  const state = {
    progress: loadProgress(),
    session: loadActiveSession(),
    selectedCount: 20,
    currentResult: null,
    bankPage: 1,
    bankFiltered: [],
    toastTimer: null,
  };

  const el = {};
  const ids = [
    "brand-button", "theme-select", "resume-panel", "resume-description", "resume-button",
    "discard-session-button", "category-groups", "select-all-categories", "clear-categories",
    "case-related-toggle", "comparison-related-toggle", "count-buttons", "candidate-count",
    "start-button", "progress-text", "score-live", "progress-bar", "quiz-bookmark-button",
    "quit-quiz-button", "quiz-meta", "quiz-id", "quiz-question", "confidence-buttons",
    "quiz-choices", "skip-button", "feedback-panel", "feedback-title", "feedback-summary",
    "choice-explanations", "question-sources", "next-button", "result-percent",
    "result-fraction", "result-message", "result-category-table", "result-type-table",
    "result-confidence-table", "retry-wrong-button", "retry-unsure-button", "retry-same-button",
    "back-setup-button", "bank-search", "bank-category", "bank-difficulty", "bank-type",
    "bank-bookmarked-only", "bank-result-count", "bank-page-info", "bank-list", "bank-prev",
    "bank-next", "export-history", "import-history", "reset-history", "history-attempts",
    "history-accuracy", "history-covered", "history-bookmarks", "history-category-list",
    "weak-question-list", "recent-sessions", "toast", "stat-total", "stat-case", "stat-compare",
  ];
  ids.forEach((id) => { el[id] = document.getElementById(id); });

  const views = {
    setup: document.getElementById("view-setup"),
    quiz: document.getElementById("view-quiz"),
    result: document.getElementById("view-result"),
    bank: document.getElementById("view-bank"),
    history: document.getElementById("view-history"),
  };

  init();

  function init() {
    renderDatasetStats();
    applyTheme(state.progress.theme || "auto");
    renderCategoryGroups();
    populateBankCategories();
    bindEvents();
    updateCandidateCount();
    renderResumePanel();
    renderBank();
    renderHistory();
  }

  function bindEvents() {
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    el["brand-button"].addEventListener("click", () => showView("setup"));
    el["theme-select"].addEventListener("change", (event) => {
      state.progress.theme = event.target.value;
      saveProgress();
      applyTheme(event.target.value);
    });

    el["select-all-categories"].addEventListener("click", () => {
      document.querySelectorAll('input[name="category"]').forEach((input) => { input.checked = true; });
      updateCandidateCount();
    });
    el["clear-categories"].addEventListener("click", () => {
      document.querySelectorAll('input[name="category"]').forEach((input) => { input.checked = false; });
      updateCandidateCount();
    });

    document.querySelectorAll('input[name="difficulty"], input[name="primary-type"], input[name="study-mode"]').forEach((input) => {
      input.addEventListener("change", updateCandidateCount);
    });
    el["case-related-toggle"].addEventListener("change", updateCandidateCount);
    el["comparison-related-toggle"].addEventListener("change", updateCandidateCount);

    el["count-buttons"].addEventListener("click", (event) => {
      const button = event.target.closest("button[data-count]");
      if (!button) return;
      el["count-buttons"].querySelectorAll("button").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      state.selectedCount = button.dataset.count === "all" ? "all" : Number(button.dataset.count);
    });

    el["start-button"].addEventListener("click", () => startFromSetup());
    el["resume-button"].addEventListener("click", resumeSession);
    el["discard-session-button"].addEventListener("click", discardActiveSession);

    el["confidence-buttons"].addEventListener("click", (event) => {
      const button = event.target.closest("button[data-confidence]");
      if (!button || !state.session || currentAnswer()) return;
      setConfidence(button.dataset.confidence);
    });
    el["quiz-choices"].addEventListener("click", (event) => {
      const button = event.target.closest("button[data-display-index]");
      if (!button) return;
      answerCurrent(Number(button.dataset.displayIndex));
    });
    el["quiz-bookmark-button"].addEventListener("click", toggleCurrentBookmark);
    el["skip-button"].addEventListener("click", skipCurrentQuestion);
    el["next-button"].addEventListener("click", nextQuestion);
    el["quit-quiz-button"].addEventListener("click", quitQuiz);

    el["retry-wrong-button"].addEventListener("click", retryWrong);
    el["retry-unsure-button"].addEventListener("click", retryUnsure);
    el["retry-same-button"].addEventListener("click", retrySameConfig);
    el["back-setup-button"].addEventListener("click", () => showView("setup"));

    [el["bank-search"], el["bank-category"], el["bank-difficulty"], el["bank-type"], el["bank-bookmarked-only"]].forEach((control) => {
      control.addEventListener(control.tagName === "INPUT" && control.type === "search" ? "input" : "change", () => {
        state.bankPage = 1;
        renderBank();
      });
    });
    el["bank-prev"].addEventListener("click", () => {
      if (state.bankPage > 1) {
        state.bankPage -= 1;
        renderBankPage();
      }
    });
    el["bank-next"].addEventListener("click", () => {
      const maxPage = Math.max(1, Math.ceil(state.bankFiltered.length / PAGE_SIZE));
      if (state.bankPage < maxPage) {
        state.bankPage += 1;
        renderBankPage();
      }
    });
    el["bank-list"].addEventListener("click", handleBankClick);

    el["export-history"].addEventListener("click", exportHistory);
    el["import-history"].addEventListener("change", importHistory);
    el["reset-history"].addEventListener("click", resetHistory);
    el["weak-question-list"].addEventListener("click", handleWeakQuestionClick);

    document.addEventListener("keydown", handleKeyboard);
  }

  function renderDatasetStats() {
    el["stat-total"].textContent = QUESTIONS.length;
    el["stat-case"].textContent = QUESTIONS.filter((q) => q.caseRelated).length;
    el["stat-compare"].textContent = QUESTIONS.filter((q) => q.comparisonRelated).length;
  }

  function defaultProgress() {
    return {
      version: 2,
      theme: "auto",
      questions: {},
      sessions: [],
      lastConfig: null,
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      return normalizeProgress(parsed);
    } catch (error) {
      console.warn("学習履歴を読み込めませんでした", error);
      return defaultProgress();
    }
  }

  function normalizeProgress(value) {
    const base = defaultProgress();
    if (!value || typeof value !== "object") return base;
    return {
      version: 2,
      theme: ["auto", "light", "dark"].includes(value.theme) ? value.theme : "auto",
      questions: value.questions && typeof value.questions === "object" ? value.questions : {},
      sessions: Array.isArray(value.sessions) ? value.sessions.slice(0, 100) : [],
      lastConfig: value.lastConfig && typeof value.lastConfig === "object" ? value.lastConfig : null,
    };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch (error) {
      console.warn("学習履歴を保存できませんでした", error);
    }
  }

  function loadActiveSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.questionIds) || !parsed.questionIds.length) return null;
      if (parsed.questionIds.some((id) => !QUESTION_MAP.has(id))) return null;
      return parsed;
    } catch (error) {
      console.warn("途中セッションを読み込めませんでした", error);
      return null;
    }
  }

  function saveActiveSession() {
    try {
      if (state.session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      console.warn("途中セッションを保存できませんでした", error);
    }
  }

  function questionProgress(id) {
    if (!state.progress.questions[id]) {
      state.progress.questions[id] = {
        attempts: 0,
        correct: 0,
        wrong: 0,
        bookmarked: false,
        lastAnswered: null,
        confidences: { sure: 0, unsure: 0, guess: 0, none: 0 },
      };
    }
    return state.progress.questions[id];
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    el["theme-select"].value = theme;
  }

  function renderCategoryGroups() {
    const groupMap = new Map();
    QUESTIONS.forEach((question) => {
      if (!groupMap.has(question.group)) groupMap.set(question.group, []);
      if (!groupMap.get(question.group).includes(question.category)) groupMap.get(question.group).push(question.category);
    });

    el["category-groups"].innerHTML = Array.from(groupMap.entries()).map(([group, categories]) => {
      const cards = categories.map((category) => {
        const meta = CATEGORY_META[category] || {};
        const count = QUESTIONS.filter((q) => q.category === category).length;
        const inputId = `category-${slugify(category)}`;
        return `
          <label class="category-card" for="${escapeHtml(inputId)}">
            <input id="${escapeHtml(inputId)}" type="checkbox" name="category" value="${escapeHtml(category)}" checked>
            <span class="category-icon" aria-hidden="true">${escapeHtml(meta.icon || "🔬")}</span>
            <span class="category-name">${escapeHtml(category)}</span>
            <span class="category-count">${count}問</span>
          </label>`;
      }).join("");
      return `<section class="category-group"><h3>${escapeHtml(group)}</h3><div class="category-grid">${cards}</div></section>`;
    }).join("");

    el["category-groups"].querySelectorAll('input[name="category"]').forEach((input) => input.addEventListener("change", updateCandidateCount));
  }

  function populateBankCategories() {
    const categories = unique(QUESTIONS.map((q) => q.category));
    el["bank-category"].innerHTML = '<option value="all">すべて</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  }

  function selectedValues(selector) {
    return Array.from(document.querySelectorAll(selector)).filter((input) => input.checked).map((input) => input.value);
  }

  function setupConfig() {
    return {
      categories: selectedValues('input[name="category"]'),
      difficulties: selectedValues('input[name="difficulty"]'),
      primaryTypes: selectedValues('input[name="primary-type"]'),
      caseOnly: el["case-related-toggle"].checked,
      comparisonOnly: el["comparison-related-toggle"].checked,
      mode: document.querySelector('input[name="study-mode"]:checked')?.value || "random",
      count: state.selectedCount,
    };
  }

  function filterCandidates(config) {
    const categorySet = new Set(config.categories);
    const difficultySet = new Set(config.difficulties);
    const typeSet = new Set(config.primaryTypes);
    let candidates = QUESTIONS.filter((question) => {
      if (!categorySet.has(question.category)) return false;
      if (!difficultySet.has(question.difficulty)) return false;
      if (!typeSet.has(question.primaryType)) return false;
      if (config.caseOnly && !question.caseRelated) return false;
      if (config.comparisonOnly && !question.comparisonRelated) return false;
      if (config.mode === "bookmarked" && !questionProgress(question.id).bookmarked) return false;
      return true;
    });

    if (config.mode === "weak") {
      candidates = candidates.sort((a, b) => weakScore(b.id) - weakScore(a.id) || Math.random() - 0.5);
    } else if (config.mode === "unanswered") {
      candidates = candidates.sort((a, b) => {
        const aa = questionProgress(a.id).attempts;
        const ba = questionProgress(b.id).attempts;
        if ((aa === 0) !== (ba === 0)) return aa === 0 ? -1 : 1;
        return aa - ba || Math.random() - 0.5;
      });
    } else {
      candidates = shuffle(candidates);
    }
    return candidates;
  }

  function weakScore(id) {
    const progress = questionProgress(id);
    if (!progress.attempts) return 0.25;
    const errorRate = progress.wrong / progress.attempts;
    return errorRate * 0.8 + Math.min(progress.attempts, 8) / 40;
  }

  function updateCandidateCount() {
    const config = setupConfig();
    const count = filterCandidates(config).length;
    el["candidate-count"].textContent = `${count}問`;
    el["start-button"].disabled = count === 0;
  }

  function startFromSetup() {
    const config = setupConfig();
    if (!config.categories.length) return showToast("出題カテゴリを1つ以上選択してください。");
    if (!config.difficulties.length) return showToast("難易度を1つ以上選択してください。");
    if (!config.primaryTypes.length) return showToast("問題形式を1つ以上選択してください。");

    const candidates = filterCandidates(config);
    if (!candidates.length) return showToast("選択条件に一致する問題がありません。");
    const count = config.count === "all" ? candidates.length : Math.min(config.count, candidates.length);
    const selected = candidates.slice(0, count).map((q) => q.id);
    startSession(selected, config);
  }

  function startSession(questionIds, config, label = "") {
    const choiceOrders = {};
    questionIds.forEach((id) => { choiceOrders[id] = shuffle([0, 1, 2, 3]); });
    state.session = {
      version: 2,
      id: `session-${Date.now()}`,
      config: { ...config, label },
      questionIds: [...questionIds],
      choiceOrders,
      current: 0,
      answers: [],
      score: 0,
      currentConfidence: null,
      skippedIds: [],
      startedAt: new Date().toISOString(),
    };
    state.progress.lastConfig = { ...config };
    saveProgress();
    saveActiveSession();
    showView("quiz");
    renderQuestion();
  }

  function resumeSession() {
    if (!state.session) return;
    showView("quiz");
    renderQuestion();
  }

  function discardActiveSession() {
    if (!state.session || confirm("途中のセッションを破棄しますか？")) {
      state.session = null;
      saveActiveSession();
      renderResumePanel();
      showToast("途中セッションを破棄しました。");
    }
  }

  function renderResumePanel() {
    if (!state.session) {
      el["resume-panel"].classList.add("hidden");
      return;
    }
    const current = Math.min(state.session.current + 1, state.session.questionIds.length);
    el["resume-description"].textContent = `${current} / ${state.session.questionIds.length}問目、正解 ${state.session.score}問`;
    el["resume-panel"].classList.remove("hidden");
  }

  function currentQuestion() {
    if (!state.session) return null;
    return QUESTION_MAP.get(state.session.questionIds[state.session.current]) || null;
  }

  function currentAnswer() {
    const question = currentQuestion();
    if (!question || !state.session) return null;
    return state.session.answers.find((answer) => answer.qid === question.id) || null;
  }

  function renderQuestion() {
    const question = currentQuestion();
    if (!question || !state.session) return finishSession();
    const answer = currentAnswer();
    const total = state.session.questionIds.length;
    const index = state.session.current;
    el["progress-text"].textContent = `${index + 1} / ${total}`;
    el["score-live"].textContent = `正解 ${state.session.score}`;
    el["progress-bar"].style.width = `${((index + (answer ? 1 : 0)) / total) * 100}%`;
    el["quiz-id"].textContent = `${question.id} / ${question.topic}`;
    el["quiz-question"].textContent = question.question;
    el["quiz-meta"].innerHTML = renderBadges(question);
    state.session.currentConfidence = answer?.confidence || state.session.currentConfidence || null;
    renderConfidenceButtons(Boolean(answer));
    renderBookmarkButton(question.id);
    renderChoices(question, answer);
    el["skip-button"].disabled = Boolean(answer) || state.session.skippedIds.includes(question.id);
    if (answer) {
      renderFeedback(question, answer);
    } else {
      el["feedback-panel"].classList.add("hidden");
    }
    saveActiveSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderBadges(question) {
    const items = [
      { text: `${question.icon || "🔬"} ${question.category}`, cls: "" },
      { text: question.difficulty, cls: question.difficulty === "上級" ? "advanced" : "" },
      { text: question.primaryType, cls: question.primaryType === "ケーススタディ" ? "case" : "" },
    ];
    if (question.caseRelated && question.primaryType !== "ケーススタディ") items.push({ text: "ケース関連", cls: "case" });
    if (question.comparisonRelated && question.primaryType !== "装置比較") items.push({ text: "比較関連", cls: "" });
    return items.map((item) => `<span class="badge ${item.cls}">${escapeHtml(item.text)}</span>`).join("");
  }

  function renderConfidenceButtons(disabled) {
    el["confidence-buttons"].querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.confidence === state.session.currentConfidence);
      button.disabled = disabled;
    });
  }

  function setConfidence(confidence) {
    if (!state.session) return;
    state.session.currentConfidence = confidence;
    renderConfidenceButtons(false);
    saveActiveSession();
  }

  function renderBookmarkButton(id) {
    const bookmarked = Boolean(questionProgress(id).bookmarked);
    el["quiz-bookmark-button"].textContent = bookmarked ? "★" : "☆";
    el["quiz-bookmark-button"].setAttribute("aria-pressed", String(bookmarked));
  }

  function toggleCurrentBookmark() {
    const question = currentQuestion();
    if (!question) return;
    const progress = questionProgress(question.id);
    progress.bookmarked = !progress.bookmarked;
    saveProgress();
    renderBookmarkButton(question.id);
    showToast(progress.bookmarked ? "しおりに追加しました。" : "しおりを外しました。");
  }

  function renderChoices(question, answer) {
    const order = state.session.choiceOrders[question.id] || [0, 1, 2, 3];
    el["quiz-choices"].innerHTML = order.map((originalIndex, displayIndex) => {
      let cls = "quiz-choice";
      if (answer) {
        if (originalIndex === question.correctIndex) cls += " is-correct";
        else if (originalIndex === answer.selectedOriginal) cls += " is-wrong";
        else cls += " is-muted";
      }
      return `
        <button type="button" class="${cls}" data-display-index="${displayIndex}" ${answer ? "disabled" : ""}>
          <span class="choice-letter">${LETTERS[displayIndex]}</span>
          <span class="choice-text">${escapeHtml(question.choices[originalIndex])}</span>
        </button>`;
    }).join("");
  }

  function answerCurrent(displayIndex) {
    if (!state.session || currentAnswer()) return;
    const question = currentQuestion();
    const order = state.session.choiceOrders[question.id];
    const originalIndex = order[displayIndex];
    const correct = originalIndex === question.correctIndex;
    const confidence = state.session.currentConfidence || "none";
    const record = {
      qid: question.id,
      selectedOriginal: originalIndex,
      correct,
      confidence,
      answeredAt: new Date().toISOString(),
    };
    state.session.answers.push(record);
    if (correct) state.session.score += 1;

    const progress = questionProgress(question.id);
    progress.attempts += 1;
    if (correct) progress.correct += 1;
    else progress.wrong += 1;
    progress.lastAnswered = record.answeredAt;
    if (!progress.confidences) progress.confidences = { sure: 0, unsure: 0, guess: 0, none: 0 };
    progress.confidences[confidence] = (progress.confidences[confidence] || 0) + 1;

    saveProgress();
    saveActiveSession();
    renderQuestion();
  }

  function renderFeedback(question, answer) {
    const order = state.session.choiceOrders[question.id];
    el["feedback-title"].textContent = answer.correct ? "正解" : "不正解";
    el["feedback-title"].className = `feedback-title ${answer.correct ? "correct" : "wrong"}`;
    el["feedback-summary"].textContent = question.correctExplanation;
    el["choice-explanations"].innerHTML = order.map((originalIndex, displayIndex) => {
      const isCorrect = originalIndex === question.correctIndex;
      return `
        <div class="choice-explanation ${isCorrect ? "is-correct" : ""}">
          <strong>${LETTERS[displayIndex]}</strong>
          <div><strong>${escapeHtml(question.choices[originalIndex])}</strong><br>${escapeHtml(question.choiceExplanations[originalIndex])}</div>
        </div>`;
    }).join("");
    el["question-sources"].innerHTML = renderSources(question.sourceIds);
    el["next-button"].textContent = state.session.current >= state.session.questionIds.length - 1 ? "結果を見る" : "次の問題";
    el["feedback-panel"].classList.remove("hidden");
  }

  function renderSources(sourceIds) {
    if (!sourceIds || !sourceIds.length) return '<p class="empty-state">参考資料の登録はありません。</p>';
    return sourceIds.map((sourceId) => {
      const source = SOURCES[sourceId];
      if (!source) return "";
      return `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.org || "")} / ${escapeHtml(sourceId)}</small></a>`;
    }).join("");
  }

  function skipCurrentQuestion() {
    if (!state.session || currentAnswer()) return;
    const qid = state.session.questionIds[state.session.current];
    if (state.session.skippedIds.includes(qid)) return showToast("この問題はすでに後回しにしています。");
    state.session.skippedIds.push(qid);
    state.session.questionIds.splice(state.session.current, 1);
    state.session.questionIds.push(qid);
    state.session.currentConfidence = null;
    saveActiveSession();
    showToast("問題を末尾へ移動しました。");
    renderQuestion();
  }

  function nextQuestion() {
    if (!state.session || !currentAnswer()) return;
    if (state.session.current >= state.session.questionIds.length - 1) {
      finishSession();
      return;
    }
    state.session.current += 1;
    state.session.currentConfidence = null;
    saveActiveSession();
    renderQuestion();
  }

  function quitQuiz() {
    if (!state.session) return;
    if (!confirm("セッションを中断して学習設定へ戻りますか？\n途中の状態は保存されます。")) return;
    saveActiveSession();
    renderResumePanel();
    showView("setup");
  }

  function finishSession() {
    if (!state.session) return;
    const completed = state.session;
    const summary = {
      id: completed.id,
      startedAt: completed.startedAt,
      completedAt: new Date().toISOString(),
      total: completed.questionIds.length,
      score: completed.score,
      accuracy: completed.questionIds.length ? Math.round((completed.score / completed.questionIds.length) * 100) : 0,
      config: completed.config,
      answers: completed.answers,
      questionIds: completed.questionIds,
    };
    state.progress.sessions.unshift(summary);
    state.progress.sessions = state.progress.sessions.slice(0, 100);
    saveProgress();
    state.currentResult = summary;
    state.session = null;
    saveActiveSession();
    renderResumePanel();
    renderResult(summary);
    renderHistory();
    showView("result");
  }

  function renderResult(result) {
    el["result-percent"].textContent = `${result.accuracy}%`;
    el["result-fraction"].textContent = `${result.score} / ${result.total}`;
    el["result-message"].textContent = result.accuracy >= 85
      ? "高い精度です。迷い・勘で正解した問題も復習すると判断の再現性が上がります。"
      : result.accuracy >= 65
        ? "基礎判断は安定しています。誤答の原因を装置原理・前処理・情報深さに分けて見直しましょう。"
        : "誤答だけでなく、正解しても確信度が低かった問題を重点的に復習しましょう。";

    el["result-category-table"].innerHTML = renderResultMetrics(groupAnswers(result, (q) => q.category));
    el["result-type-table"].innerHTML = renderResultMetrics(groupAnswers(result, (q) => `${q.difficulty}・${q.primaryType}`));
    el["result-confidence-table"].innerHTML = renderResultMetrics(groupAnswers(result, (_q, answer) => confidenceLabel(answer.confidence)));

    const wrongIds = result.answers.filter((answer) => !answer.correct).map((answer) => answer.qid);
    const unsureIds = result.answers.filter((answer) => ["unsure", "guess", "none"].includes(answer.confidence)).map((answer) => answer.qid);
    el["retry-wrong-button"].disabled = wrongIds.length === 0;
    el["retry-unsure-button"].disabled = unsureIds.length === 0;
  }

  function groupAnswers(result, keyFn) {
    const groups = new Map();
    result.answers.forEach((answer) => {
      const question = QUESTION_MAP.get(answer.qid);
      if (!question) return;
      const key = keyFn(question, answer);
      if (!groups.has(key)) groups.set(key, { total: 0, correct: 0 });
      const group = groups.get(key);
      group.total += 1;
      if (answer.correct) group.correct += 1;
    });
    return Array.from(groups.entries()).map(([label, value]) => ({ label, ...value })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "ja"));
  }

  function renderResultMetrics(items) {
    if (!items.length) return '<p class="empty-state">集計対象がありません。</p>';
    return items.map((item) => {
      const percent = Math.round((item.correct / item.total) * 100);
      return `<div class="metric-row"><span>${escapeHtml(item.label)}</span><div class="metric-bar"><span style="width:${percent}%"></span></div><strong>${item.correct}/${item.total}</strong></div>`;
    }).join("");
  }

  function retryWrong() {
    if (!state.currentResult) return;
    const ids = unique(state.currentResult.answers.filter((answer) => !answer.correct).map((answer) => answer.qid));
    if (!ids.length) return;
    startSession(shuffle(ids), { ...state.currentResult.config, mode: "retry-wrong", count: ids.length }, "誤答復習");
  }

  function retryUnsure() {
    if (!state.currentResult) return;
    const ids = unique(state.currentResult.answers.filter((answer) => ["unsure", "guess", "none"].includes(answer.confidence)).map((answer) => answer.qid));
    if (!ids.length) return;
    startSession(shuffle(ids), { ...state.currentResult.config, mode: "retry-unsure", count: ids.length }, "迷い・勘の復習");
  }

  function retrySameConfig() {
    const config = state.currentResult?.config || state.progress.lastConfig;
    if (!config) return showView("setup");
    const candidates = filterCandidates(config);
    if (!candidates.length) return showToast("同じ条件で出題できる問題がありません。");
    const count = config.count === "all" ? candidates.length : Math.min(Number(config.count) || candidates.length, candidates.length);
    startSession(candidates.slice(0, count).map((q) => q.id), config, "同じ条件");
  }

  function renderBank() {
    const query = normalizeText(el["bank-search"].value);
    const category = el["bank-category"].value;
    const difficulty = el["bank-difficulty"].value;
    const type = el["bank-type"].value;
    const bookmarkedOnly = el["bank-bookmarked-only"].checked;

    state.bankFiltered = QUESTIONS.filter((question) => {
      if (category !== "all" && question.category !== category) return false;
      if (difficulty !== "all" && question.difficulty !== difficulty) return false;
      if (type !== "all" && question.primaryType !== type) return false;
      if (bookmarkedOnly && !questionProgress(question.id).bookmarked) return false;
      if (!query) return true;
      const haystack = normalizeText([
        question.id, question.category, question.group, question.topic, question.question,
        ...question.choices, ...question.choiceExplanations, ...(question.tags || []), ...(question.industries || []),
      ].join(" "));
      return haystack.includes(query);
    });
    const maxPage = Math.max(1, Math.ceil(state.bankFiltered.length / PAGE_SIZE));
    state.bankPage = Math.min(state.bankPage, maxPage);
    renderBankPage();
  }

  function renderBankPage() {
    const maxPage = Math.max(1, Math.ceil(state.bankFiltered.length / PAGE_SIZE));
    const start = (state.bankPage - 1) * PAGE_SIZE;
    const pageItems = state.bankFiltered.slice(start, start + PAGE_SIZE);
    el["bank-result-count"].textContent = `${state.bankFiltered.length}件`;
    el["bank-page-info"].textContent = `${state.bankPage} / ${maxPage}ページ`;
    el["bank-prev"].disabled = state.bankPage <= 1;
    el["bank-next"].disabled = state.bankPage >= maxPage;
    el["bank-list"].innerHTML = pageItems.length ? pageItems.map(renderBankCard).join("") : '<div class="empty-state">条件に一致する問題はありません。</div>';
  }

  function renderBankCard(question) {
    const bookmarked = questionProgress(question.id).bookmarked;
    const options = question.choices.map((choice, index) => `<li class="${index === question.correctIndex ? "correct" : ""}"><strong>${LETTERS[index]}.</strong> ${escapeHtml(choice)}<br><small>${escapeHtml(question.choiceExplanations[index])}</small></li>`).join("");
    return `
      <details class="bank-card" data-qid="${escapeHtml(question.id)}">
        <summary>
          <span class="bank-number">${escapeHtml(question.id)}</span>
          <span><h3>${escapeHtml(question.question)}</h3><span class="badge-row bank-meta">${renderBadges(question)}</span></span>
          <button class="bank-bookmark" type="button" data-bookmark-qid="${escapeHtml(question.id)}" aria-label="しおり">${bookmarked ? "★" : "☆"}</button>
        </summary>
        <div class="bank-card-body">
          <ul class="bank-option-list">${options}</ul>
          <p><strong>正解：</strong>${LETTERS[question.correctIndex]}　${escapeHtml(question.correctExplanation)}</p>
          <details class="source-details"><summary>参考資料</summary><div class="source-list">${renderSources(question.sourceIds)}</div></details>
          <div class="button-row" style="margin-top:12px"><button type="button" class="button secondary small" data-practice-qid="${escapeHtml(question.id)}">この問題に挑戦</button></div>
        </div>
      </details>`;
  }

  function handleBankClick(event) {
    const bookmark = event.target.closest("[data-bookmark-qid]");
    if (bookmark) {
      event.preventDefault();
      event.stopPropagation();
      const id = bookmark.dataset.bookmarkQid;
      const progress = questionProgress(id);
      progress.bookmarked = !progress.bookmarked;
      saveProgress();
      renderBankPage();
      renderHistory();
      return;
    }
    const practice = event.target.closest("[data-practice-qid]");
    if (practice) {
      const id = practice.dataset.practiceQid;
      startSession([id], { categories: [QUESTION_MAP.get(id).category], difficulties: [QUESTION_MAP.get(id).difficulty], primaryTypes: [QUESTION_MAP.get(id).primaryType], caseOnly: false, comparisonOnly: false, mode: "single", count: 1 }, "問題検索から出題");
    }
  }

  function renderHistory() {
    const entries = Object.entries(state.progress.questions).filter(([id]) => QUESTION_MAP.has(id));
    const attempts = entries.reduce((sum, [, p]) => sum + Number(p.attempts || 0), 0);
    const correct = entries.reduce((sum, [, p]) => sum + Number(p.correct || 0), 0);
    const covered = entries.filter(([, p]) => Number(p.attempts || 0) > 0).length;
    const bookmarks = entries.filter(([, p]) => Boolean(p.bookmarked)).length;
    el["history-attempts"].textContent = attempts;
    el["history-accuracy"].textContent = attempts ? `${Math.round((correct / attempts) * 100)}%` : "0%";
    el["history-covered"].textContent = `${covered} / ${QUESTIONS.length}`;
    el["history-bookmarks"].textContent = bookmarks;

    const categoryMetrics = unique(QUESTIONS.map((q) => q.category)).map((category) => {
      const ids = QUESTIONS.filter((q) => q.category === category).map((q) => q.id);
      let total = 0;
      let good = 0;
      ids.forEach((id) => {
        const p = state.progress.questions[id];
        if (!p) return;
        total += Number(p.attempts || 0);
        good += Number(p.correct || 0);
      });
      return { label: category, total, correct: good };
    }).filter((item) => item.total > 0).sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
    el["history-category-list"].innerHTML = categoryMetrics.length ? renderResultMetrics(categoryMetrics) : '<p class="empty-state">回答履歴はまだありません。</p>';

    const weak = QUESTIONS.map((question) => {
      const p = state.progress.questions[question.id];
      return { question, p, score: p ? weakScore(question.id) : 0 };
    }).filter((item) => item.p && item.p.wrong > 0).sort((a, b) => b.score - a.score || b.p.wrong - a.p.wrong).slice(0, 12);
    el["weak-question-list"].innerHTML = weak.length ? weak.map(({ question, p }) => `<div class="weak-item"><button type="button" data-weak-qid="${escapeHtml(question.id)}"><strong>${escapeHtml(question.id)}・${escapeHtml(question.category)}</strong><br><span>${escapeHtml(truncate(question.question, 82))}</span><br><small>誤答 ${p.wrong} / 回答 ${p.attempts}</small></button></div>`).join("") : '<p class="empty-state">誤答した問題はまだありません。</p>';

    const sessions = state.progress.sessions.slice(0, 12);
    el["recent-sessions"].innerHTML = sessions.length ? sessions.map((session) => {
      const date = formatDate(session.completedAt || session.startedAt);
      return `<div class="session-item"><strong>${date}</strong>　${session.score}/${session.total}問正解（${session.accuracy}%）<br><small>${escapeHtml(session.config?.label || modeLabel(session.config?.mode))}</small></div>`;
    }).join("") : '<p class="empty-state">完了したセッションはまだありません。</p>';
  }

  function handleWeakQuestionClick(event) {
    const button = event.target.closest("[data-weak-qid]");
    if (!button) return;
    const id = button.dataset.weakQid;
    const question = QUESTION_MAP.get(id);
    startSession([id], { categories: [question.category], difficulties: [question.difficulty], primaryTypes: [question.primaryType], caseOnly: false, comparisonOnly: false, mode: "weak-single", count: 1 }, "苦手問題から出題");
  }

  function exportHistory() {
    const payload = {
      app: "analytical-instrument-practical-quiz-300",
      exportedAt: new Date().toISOString(),
      progress: state.progress,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analytical-quiz-history-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importHistory(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = parsed.progress || parsed;
        state.progress = normalizeProgress(imported);
        saveProgress();
        applyTheme(state.progress.theme);
        updateCandidateCount();
        renderBank();
        renderHistory();
        showToast("学習履歴を読み込みました。");
      } catch (error) {
        showToast("JSONを読み込めませんでした。");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetHistory() {
    if (!confirm("学習履歴、しおり、セッション履歴を初期化しますか？\nこの操作は元に戻せません。")) return;
    const theme = state.progress.theme;
    state.progress = defaultProgress();
    state.progress.theme = theme;
    state.session = null;
    state.currentResult = null;
    saveProgress();
    saveActiveSession();
    renderResumePanel();
    updateCandidateCount();
    renderBank();
    renderHistory();
    showToast("学習履歴を初期化しました。");
  }

  function showView(name) {
    Object.entries(views).forEach(([key, view]) => view.classList.toggle("is-active", key === name));
    document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
    if (name === "setup") {
      updateCandidateCount();
      renderResumePanel();
    }
    if (name === "bank") renderBank();
    if (name === "history") renderHistory();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleKeyboard(event) {
    const tag = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
    if (!views.quiz.classList.contains("is-active") || !state.session) return;
    if (["1", "2", "3", "4"].includes(event.key) && !currentAnswer()) {
      answerCurrent(Number(event.key) - 1);
    } else if (event.key.toLowerCase() === "u" && !currentAnswer()) {
      setConfidence("unsure");
    } else if (event.key.toLowerCase() === "b") {
      toggleCurrentBookmark();
    } else if (event.key.toLowerCase() === "n" && currentAnswer()) {
      nextQuestion();
    }
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => el.toast.classList.remove("is-visible"), 2600);
  }

  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function unique(array) {
    return [...new Set(array)];
  }

  function slugify(value) {
    return String(value).normalize("NFKC").replace(/[^a-zA-Z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "");
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFKC").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function truncate(value, max) {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function formatDate(value) {
    if (!value) return "日時不明";
    try {
      return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    } catch (_error) {
      return value;
    }
  }

  function confidenceLabel(value) {
    return ({ sure: "自信あり", unsure: "迷い", guess: "勘", none: "未設定" })[value] || "未設定";
  }

  function modeLabel(value) {
    return ({ random: "ランダム", weak: "苦手優先", unanswered: "未回答優先", bookmarked: "しおり", "retry-wrong": "誤答復習", "retry-unsure": "迷い・勘の復習" })[value] || "学習セッション";
  }
})();
