
const $ = (selector) => document.querySelector(selector);

const elements = {
  taskList: $("#taskList"),
  emptyState: $("#emptyState"),
  modal: $("#taskModal"),
  form: $("#taskForm"),
  title: $("#taskTitle"),
  description: $("#taskDescription"),
  priority: $("#taskPriority"),
  dueDate: $("#taskDue"),
  modalTitle: $("#modalTitle"),
  saveButton: $("#saveTask"),
  search: $("#searchInput"),
  priorityFilter: $("#priorityFilter"),
  toast: $("#toast")
};

const STORAGE_KEY = "taskflow-tasks-v1";
const THEME_KEY = "taskflow-theme-v1";

let tasks = loadTasks();
let currentFilter = "all";
let editingId = null;
let toastTimeout;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(saved)) return [];

    return saved.filter(task =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean"
    ).map(task => ({
      id: task.id,
      title: task.title.slice(0, 100),
      description: typeof task.description === "string"
        ? task.description.slice(0, 300) : "",
      priority: ["High", "Medium", "Low"].includes(task.priority)
        ? task.priority : "Medium",
      dueDate: typeof task.dueDate === "string"
        ? task.dueDate : "",
      completed: task.completed,
      createdAt: typeof task.createdAt === "string"
        ? task.createdAt : new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    showToast("Could not save data. Check your browser storage.");
    return false;
  }
}

function makeId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  return task.dueDate < localToday;
}

function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

function getVisibleTasks() {
  const query = elements.search.value.trim().toLowerCase();
  const priority = elements.priorityFilter.value;

  return tasks.filter(task => {
    const matchesStatus =
      currentFilter === "all" ||
      (currentFilter === "active" && !task.completed) ||
      (currentFilter === "completed" && task.completed);

    const matchesSearch =
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query);

    const matchesPriority =
      priority === "all" || task.priority === priority;

    return matchesStatus && matchesSearch && matchesPriority;
  }).sort((a, b) => {
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    const priorityOrder = { High: 0, Medium: 1, Low: 2 };

    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const active = total - completed;
  const rate = total ? Math.round((completed / total) * 100) : 0;

  $("#totalStat").textContent = total;
  $("#activeStat").textContent = active;
  $("#completedStat").textContent = completed;
  $("#rateStat").textContent = `${rate}%`;
  $("#allCount").textContent = total;

  $("#progressLabel").textContent = `${rate}%`;
  $("#progressFill").style.width = `${rate}%`;

  $("#progressMessage").textContent =
    total === 0 ? "Let's make today productive!" :
    rate === 100 ? "Amazing! You've completed everything!" :
    `${completed} of ${total} tasks completed. Keep going!`;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();

  elements.taskList.innerHTML = visibleTasks.map(task => {
    const dueDate = formatDate(task.dueDate);

    const priorityClass = {
      High: "priority-high",
      Medium: "priority-medium",
      Low: "priority-low"
    }[task.priority];

    return `
      <article class="task-card ${task.completed ? "is-completed" : ""}"
        data-id="${escapeHTML(task.id)}">

        <button class="task-check" data-action="toggle"
          aria-label="${task.completed ? "Mark as active" : "Mark as completed"}"
          aria-pressed="${task.completed}">
          ${task.completed ? "✓" : ""}
        </button>

        <div class="task-main">
          <h3 class="task-title">${escapeHTML(task.title)}</h3>

          ${task.description ? `
            <p class="task-description">${escapeHTML(task.description)}</p>
          ` : ""}

          <div class="task-meta">
            <span class="priority ${priorityClass}">
              ${escapeHTML(task.priority)} Priority
            </span>

            <span class="status-badge ${task.completed ? "done" : ""}">
              ${task.completed ? "Completed" : "In Progress"}
            </span>

            ${dueDate ? `
              <span class="due-badge ${isOverdue(task) ? "overdue" : ""}">
                ${isOverdue(task) ? "Overdue · " : "Due · "}
                ${escapeHTML(dueDate)}
              </span>
            ` : ""}
          </div>
        </div>

        <div class="task-actions">
          <button class="icon-button" data-action="edit"
            aria-label="Edit ${escapeHTML(task.title)}"
            title="Edit task">✎</button>

          <button class="icon-button delete" data-action="delete"
            aria-label="Delete ${escapeHTML(task.title)}"
            title="Delete task">⌫</button>
        </div>
      </article>
    `;
  }).join("");

  elements.emptyState.hidden = visibleTasks.length !== 0;
  elements.taskList.hidden = visibleTasks.length === 0;

  $("#resultsCount").textContent =
    `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

  renderStats();
}

function setFilter(filter) {
  currentFilter = filter;

  document.querySelectorAll("[data-filter]").forEach(button => {
    const active = button.dataset.filter === filter;

    button.classList.toggle("active", active);

    if (button.classList.contains("nav-item")) {
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  });

  renderTasks();
}

function openModal(task = null) {
  editingId = task ? task.id : null;

  elements.form.reset();

  elements.modalTitle.textContent =
    task ? "Edit Task" : "Create a Task";

  elements.saveButton.textContent =
    task ? "Save Changes" : "Create Task";

  if (task) {
    elements.title.value = task.title;
    elements.description.value = task.description;
    elements.priority.value = task.priority;
    elements.dueDate.value = task.dueDate;
  }

  elements.modal.hidden = false;
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => elements.title.focus());
}

function closeModal() {
  elements.modal.hidden = true;
  document.body.style.overflow = "";
  editingId = null;
}

function handleFormSubmit(event) {
  event.preventDefault();

  const title = elements.title.value.trim();
  const description = elements.description.value.trim();
  const priority = elements.priority.value;
  const dueDate = elements.dueDate.value;

  if (!title) {
    elements.title.focus();
    showToast("Please enter a task title.");
    return;
  }

  if (title.length > 100 || description.length > 300) {
    showToast("Please shorten your task details.");
    return;
  }

  const oldTasks = tasks;
  const now = new Date().toISOString();

  if (editingId) {
    tasks = tasks.map(task => task.id === editingId ? {
      ...task,
      title,
      description,
      priority,
      dueDate
    } : task);
  } else {
    tasks = [{
      id: makeId(),
      title,
      description,
      priority,
      dueDate,
      completed: false,
      createdAt: now
    }, ...tasks];
  }

  if (!saveTasks()) {
    tasks = oldTasks;
    return;
  }

  closeModal();
  renderTasks();
  showToast(editingId ? "Task updated successfully!" : "Task created successfully!");
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const card = button.closest("[data-id]");
  if (!card) return;

  const task = tasks.find(item => item.id === card.dataset.id);
  if (!task) return;

  const action = button.dataset.action;

  if (action === "toggle") {
    const oldTasks = tasks;

    tasks = tasks.map(item =>
      item.id === task.id
        ? { ...item, completed: !item.completed }
        : item
    );

    if (!saveTasks()) {
      tasks = oldTasks;
      return;
    }

    renderTasks();

    showToast(task.completed
      ? "Task moved back to active!"
      : "Great work! Task completed.");
  }

  if (action === "edit") {
    openModal(task);
  }

  if (action === "delete") {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    const oldTasks = tasks;
    tasks = tasks.filter(item => item.id !== task.id);

    if (!saveTasks()) {
      tasks = oldTasks;
      return;
    }

    renderTasks();
    showToast("Task deleted.");
  }
}

function applyTheme(theme) {
  const isLight = theme === "light";

  document.body.classList.toggle("light-theme", isLight);
  $("#themeIcon").textContent = isLight ? "☾" : "☀";
  $("#themeText").textContent = isLight ? "Switch to dark" : "Switch to light";
  $("#themeToggle").setAttribute("aria-pressed", String(isLight));

  try {
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
  } catch {
    // Theme still works for the current page session.
  }
}

function initTheme() {
  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  } catch {
    // Use dark theme if browser storage is unavailable.
  }

  applyTheme(savedTheme);
}

function initDate() {
  const today = new Date();

  $("#todayDate").textContent = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).toUpperCase();

  $("#year").textContent = today.getFullYear();
}

// Add task buttons
$("#topAdd").addEventListener("click", () => openModal());
$("#emptyAdd").addEventListener("click", () => openModal());

// Modal controls
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
elements.form.addEventListener("submit", handleFormSubmit);

elements.modal.addEventListener("click", event => {
  if (event.target === elements.modal) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !elements.modal.hidden) {
    closeModal();
  }
});

// Filters in sidebar and task tabs
document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    setFilter(button.dataset.filter);
  });
});

// Search and priority filtering
elements.search.addEventListener("input", renderTasks);
elements.priorityFilter.addEventListener("change", renderTasks);

// Task actions use event delegation
elements.taskList.addEventListener("click", handleTaskAction);

// Theme toggle
$("#themeToggle").addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-theme");
  applyTheme(isLight ? "dark" : "light");
});

// Start application
initTheme();
initDate();
setFilter("all");
