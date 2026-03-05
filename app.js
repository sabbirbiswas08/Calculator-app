const SUPABASE_URL = "https://rebemzjhmzmlkvlgdjgs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VKAN8BYrRX2fITwZdxFEEg_Z4WW9EHD";
const SUPABASE_ANON_LEGACY_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYmVtempobXptbGt2bGdkamdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODU3ODAsImV4cCI6MjA4NjM2MTc4MH0.QJOE-fScnCy3Tkfp4ZXV6cA2BDiNAEQLDZnrBAeYEPs";

const expressionDisplay = document.getElementById("expressionDisplay");
const resultDisplay = document.getElementById("resultDisplay");
const historyList = document.getElementById("historyList");
const statusMessage = document.getElementById("statusMessage");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

const supabaseGlobal = window.supabase;
const hasSupabaseClient = !!supabaseGlobal?.createClient;
const db = hasSupabaseClient
  ? supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_LEGACY_KEY)
  : null;

let expression = "";
let justEvaluated = false;

function updateDisplay() {
  expressionDisplay.textContent = expression || "0";
}

function updateStatus(message) {
  statusMessage.textContent = message;
}

function formatForEval(rawExpression) {
  return rawExpression.replaceAll("%", "/100");
}

function evaluateExpression(rawExpression) {
  const safeExpression = formatForEval(rawExpression);
  if (!/^[0-9+\-*/.()\s]+$/.test(safeExpression)) {
    throw new Error("Invalid characters");
  }

  const computedValue = Function(`"use strict"; return (${safeExpression})`)();
  if (computedValue === undefined || Number.isNaN(computedValue) || !Number.isFinite(computedValue)) {
    throw new Error("Math error");
  }

  return Number(computedValue.toFixed(10)).toString();
}

function renderHistory(items) {
  historyList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = "<p class='expr'>No calculation history yet.</p>";
    historyList.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "history-item";

    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time";
    li.innerHTML = `
      <p class="expr">${item.expression}</p>
      <p class="res">= ${item.result}</p>
      <p class="time">${createdAt}</p>
    `;

    historyList.appendChild(li);
  }
}

async function loadHistory() {
  if (!db) {
    updateStatus("Supabase library failed to load.");
    renderHistory([]);
    return;
  }

  updateStatus("Loading history...");

  const { data, error } = await db
    .from("calculation_history")
    .select("id, expression, result, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    updateStatus("Cannot load history. Please enable SELECT policy in Supabase.");
    renderHistory([]);
    return;
  }

  renderHistory(data || []);
  updateStatus(`Showing ${(data || []).length} latest calculations.`);
}

async function saveHistory(inputExpression, outputResult) {
  if (!db) {
    return;
  }

  const { error } = await db.from("calculation_history").insert({
    expression: inputExpression,
    result: outputResult
  });

  if (error) {
    updateStatus("Result calculated, but could not save history (check INSERT policy).");
    return;
  }

  updateStatus("Saved successfully.");
}

async function calculate() {
  if (!expression.trim()) {
    return;
  }

  try {
    const result = evaluateExpression(expression);
    const expressionToStore = expression;

    resultDisplay.textContent = result;
    expression = result;
    justEvaluated = true;
    updateDisplay();

    await saveHistory(expressionToStore, result);
    await loadHistory();
  } catch {
    resultDisplay.textContent = "Error";
    updateStatus("Invalid expression. Please enter a valid calculation.");
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
  justEvaluated = false;
  resultDisplay.textContent = "0";
  updateDisplay();
}

function removeLastCharacter() {
  if (!expression.length) {
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

  const { action, value } = button.dataset;

  if (action === "clear") {
    clearAll();
    return;
  }

  if (action === "delete") {
    removeLastCharacter();
    return;
  }

  if (action === "calculate") {
    await calculate();
    return;
  }

  if (value) {
    appendValue(value);
  }
});

document.addEventListener("keydown", async (event) => {
  const key = event.key;

  if (/^[0-9]$/.test(key) || ["+", "-", "*", "/", ".", "%", "(", ")"].includes(key)) {
    appendValue(key);
    return;
  }

  if (key === "Backspace") {
    removeLastCharacter();
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    await calculate();
    return;
  }

  if (key.toLowerCase() === "c" || key === "Escape") {
    clearAll();
  }
});

refreshHistoryBtn.addEventListener("click", loadHistory);

updateDisplay();
loadHistory();
