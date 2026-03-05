const SUPABASE_URL = "https://rebemzjhmzmlkvlgdjgs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYmVtempobXptbGt2bGdkamdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODU3ODAsImV4cCI6MjA4NjM2MTc4MH0.QJOE-fScnCy3Tkfp4ZXV6cA2BDiNAEQLDZnrBAeYEPs";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const expressionDisplay = document.getElementById("expressionDisplay");
const resultDisplay = document.getElementById("resultDisplay");
const historyList = document.getElementById("historyList");
const statusMessage = document.getElementById("statusMessage");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

let expression = "";
let justEvaluated = false;

function updateDisplay() {
  expressionDisplay.textContent = expression || "0";
}

function formatForEval(rawExpression) {
  return rawExpression.replace(/%/g, "/100");
}

function evaluateExpression(rawExpression) {
  const safeExpression = formatForEval(rawExpression);
  if (!/^[0-9+\-*/.()\s]+$/.test(safeExpression)) {
    throw new Error("Invalid characters in expression.");
  }

  const value = Function(`"use strict"; return (${safeExpression})`)();
  if (value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error("Math error");
  }
  return Number(value.toFixed(10)).toString();
}

async function saveHistory(expr, result) {
  const { error } = await db.from("calculation_history").insert({
    expression: expr,
    result
  });

  if (error) {
    console.error("Error while saving history:", error.message);
    statusMessage.textContent =
      "Could not save to Supabase. Check table permissions (RLS/policies).";
    return;
  }

  statusMessage.textContent = "Saved to Supabase successfully.";
}

function renderHistory(items) {
  historyList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = "<p class='expr'>No history found.</p>";
    historyList.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "history-item";
    const timeText = new Date(item.created_at).toLocaleString();

    li.innerHTML = `
      <p class="expr">${item.expression}</p>
      <p class="res">= ${item.result}</p>
      <p class="time">${timeText}</p>
    `;

    historyList.appendChild(li);
  }
}

async function loadHistory() {
  statusMessage.textContent = "Loading history...";

  const { data, error } = await db
    .from("calculation_history")
    .select("id, expression, result, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error while loading history:", error.message);
    statusMessage.textContent =
      "Could not load history. Make sure SELECT policy is enabled.";
    renderHistory([]);
    return;
  }

  renderHistory(data || []);
  statusMessage.textContent = `Showing ${(data || []).length} latest records.`;
}

async function handleCalculate() {
  if (!expression.trim()) {
    return;
  }

  try {
    const result = evaluateExpression(expression);
    resultDisplay.textContent = result;

    const expressionToSave = expression;
    expression = result;
    justEvaluated = true;
    updateDisplay();

    await saveHistory(expressionToSave, result);
    await loadHistory();
  } catch (error) {
    resultDisplay.textContent = "Error";
    statusMessage.textContent = "Invalid expression.";
  }
}

function appendValue(value) {
  if (justEvaluated && /[0-9.]/.test(value)) {
    expression = value;
    justEvaluated = false;
    updateDisplay();
    return;
  }

  if (justEvaluated && /[+\-*/%]/.test(value)) {
    justEvaluated = false;
  }

  expression += value;
  updateDisplay();
}

function clearAll() {
  expression = "";
  resultDisplay.textContent = "0";
  justEvaluated = false;
  updateDisplay();
}

function deleteLast() {
  if (!expression) {
    return;
  }

  expression = expression.slice(0, -1);
  updateDisplay();
}

document.querySelector(".keypad").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const value = button.dataset.value;

  if (action === "clear") {
    clearAll();
    return;
  }

  if (action === "delete") {
    deleteLast();
    return;
  }

  if (action === "calculate") {
    await handleCalculate();
    return;
  }

  if (value) {
    appendValue(value);
  }
});

refreshHistoryBtn.addEventListener("click", loadHistory);

document.addEventListener("keydown", async (event) => {
  const key = event.key;

  if (/^[0-9]$/.test(key) || ["+", "-", "*", "/", ".", "%", "(", ")"].includes(key)) {
    appendValue(key);
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    await handleCalculate();
    return;
  }

  if (key === "Backspace") {
    deleteLast();
    return;
  }

  if (key.toLowerCase() === "c" || key === "Escape") {
    clearAll();
  }
});

updateDisplay();
loadHistory();
