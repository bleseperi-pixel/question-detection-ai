(() => {
  "use strict";

  const form = document.getElementById("analyze-form");
  const submitBtn = document.getElementById("submit-btn");
  const errorEl = document.getElementById("form-error");
  const resultsEl = document.getElementById("results");
  const statsEl = document.getElementById("stats");
  const predictionsEl = document.getElementById("predictions");
  const paperSection = document.getElementById("paper-section");
  const paperEl = document.getElementById("paper");
  const warningsEl = document.getElementById("warnings");
  const thresholdInput = document.getElementById("threshold");
  const thresholdOut = document.getElementById("threshold-out");

  thresholdInput.addEventListener("input", () => {
    thresholdOut.textContent = Number(thresholdInput.value).toFixed(2);
  });

  document.getElementById("print-btn").addEventListener("click", () => window.print());

  /** Small helper that builds elements without innerHTML (safe for user text). */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? "Analyzing..." : "Analyze and generate paper";
  }

  function nonNegativeInt(input) {
    const value = parseInt(input.value, 10);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 50) : 0;
  }

  function buildSections() {
    const sections = [];
    const twos = nonNegativeInt(document.getElementById("two-count"));
    const fives = nonNegativeInt(document.getElementById("five-count"));
    if (twos > 0) sections.push({ marks: 2, count: twos });
    if (fives > 0) sections.push({ marks: 5, count: fives });
    return sections;
  }

  function renderStats(stats) {
    statsEl.replaceChildren(
      el("div", { class: "stat" }, [el("strong", {}, [String(stats.questions_read)]), el("span", {}, ["Questions read"])]),
      el("div", { class: "stat" }, [el("strong", {}, [String(stats.unique_questions)]), el("span", {}, ["Unique questions"])]),
      el("div", { class: "stat" }, [el("strong", {}, [String(stats.repeated_questions)]), el("span", {}, ["Repeated questions"])])
    );
  }

  function renderPredictions(predictions) {
    predictionsEl.replaceChildren();
    if (predictions.length === 0) {
      predictionsEl.append(el("li", {}, ["No questions found. Check the input format."]));
      return;
    }
    predictions.forEach((item, index) => {
      const badges = [
        el("span", { class: item.is_repeated ? "badge" : "badge neutral" }, [
          item.is_repeated ? `Asked ${item.frequency} times` : "Asked once",
        ]),
      ];
      if (item.marks) badges.push(el("span", { class: "badge neutral" }, [`${item.marks} marks`]));

      const children = [
        el("span", { class: "question" }, [`${index + 1}. ${item.question}`]),
        el("div", {}, badges),
      ];
      if (item.similar_wordings.length > 0) {
        children.push(
          el("ul", { class: "similar" }, item.similar_wordings.map((text) => el("li", {}, [text])))
        );
      }
      predictionsEl.append(el("li", { class: "prediction-item" }, children));
    });
  }

  function renderPaper(paper) {
    paperEl.replaceChildren();
    paperEl.append(el("h3", { class: "paper-title" }, [paper.title]));
    if (paper.subject) paperEl.append(el("p", { class: "paper-subject" }, [paper.subject]));
    paperEl.append(el("p", { class: "paper-meta" }, [`Total marks: ${paper.total_marks}`]));

    paper.sections.forEach((section) => {
      paperEl.append(el("h4", {}, [`${section.label}: ${section.marks}-mark questions`]));
      const list = el("ol", {});
      section.questions.forEach((q) => {
        list.append(
          el("li", { value: String(q.number) }, [
            q.question,
            el("span", { class: "q-marks" }, [` (${q.marks} marks)`]),
          ])
        );
      });
      if (section.questions.length === 0) {
        list.append(el("li", {}, ["No questions available for this section."]));
      }
      paperEl.append(list);
    });
  }

  function renderWarnings(warnings) {
    warningsEl.replaceChildren(...warnings.map((w) => el("p", { class: "warning" }, [w])));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const questions = document.getElementById("questions").value.trim();
    if (!questions) {
      showError("Paste at least one question before analyzing.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions,
          title: document.getElementById("title").value,
          subject: document.getElementById("subject").value,
          threshold: Number(thresholdInput.value),
          top_n: nonNegativeInt(document.getElementById("top-n")) || 10,
          sections: buildSections(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");

      renderStats(data.stats);
      renderPredictions(data.predictions);
      resultsEl.hidden = false;

      if (data.paper) {
        renderWarnings(data.paper.warnings);
        renderPaper(data.paper);
        paperSection.hidden = false;
      } else {
        paperSection.hidden = true;
        showError("Set at least one 2-mark or 5-mark count to generate a question paper.");
      }
      resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showError(err.message || "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  });
})();
