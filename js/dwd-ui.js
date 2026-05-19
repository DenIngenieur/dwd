// ================================================================
// dwd-ui.js
// UI modules for DWD Diary - SOLID compliant
// Each class has one responsibility
// Depends on dwd-core.js
// ================================================================

// ================================================================
// 1. ANIMATION HELPER - Pure visual effects
// ================================================================

class AnimationHelper {
  
  // Red flash on invalid input (3 quick flashes)
  static redFlash(element) {
    if (!element) return;
    
    const originalBg = element.style.backgroundColor;
    let flashes = 0;
    const maxFlashes = 3;
    const flashInterval = 150;
    
    const flash = () => {
      if (flashes >= maxFlashes) {
        element.style.backgroundColor = originalBg;
        return;
      }
      
      element.style.backgroundColor = (flashes % 2 === 0) ? "#ffcccc" : originalBg;
      flashes++;
      setTimeout(flash, flashInterval);
    };
    
    flash();
  }
  
  // Rainbow reward animation (3 seconds hue sweep)
  // This is a pure visual effect, no logic about when to trigger it
  static rainbowReward(durationMs = 3000) {
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      if (elapsed >= durationMs) {
        document.body.style.backgroundColor = "";
        document.body.style.background = "";
        return;
      }
      
      const progress = elapsed / durationMs;
      const hue = Math.floor(progress * 360);
      document.body.style.backgroundColor = "";
      document.body.style.background = `hsl(${hue}, 70%, 50%)`;
      
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }
}


// ================================================================
// 2. BOTTOM BAR RENDERER - Last 5 entries
// ================================================================

class BottomBarRenderer {
  constructor(storage, onEntryClick) {
    this._storage = storage;
    this._onEntryClick = onEntryClick;
    this._container = document.getElementById("bottom-bar");
  }
  
  render() {
    if (!this._container) return;
    
    const entries = this._storage.getRecentEntries(5);
    
    if (entries.length === 0) {
      this._container.innerHTML = "";
      return;
    }
    
    let html = "";
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const hsl = entry.hsl;
      html += `
        <div class="bottom-entry" data-date="${entry.date}">
          <div class="bottom-color" style="background: hsl(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%);"></div>
          <div class="bottom-word">${this._escapeHtml(entry.word)}</div>
        </div>
      `;
    }
    this._container.innerHTML = html;
    
    // Attach click handlers
    const items = document.querySelectorAll(".bottom-entry");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const date = item.getAttribute("data-date");
      item.addEventListener("click", () => this._onEntryClick(date));
    }
  }
  
  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}


// ================================================================
// 3. VIEW RENDERER - Input mode / View mode (single entry)
// ================================================================

class ViewRenderer {
  constructor() {
    this._inputMode = document.getElementById("input-mode");
    this._viewMode = document.getElementById("view-mode");
    this._wordDisplay = document.getElementById("word-display");
    this._dateDisplay = document.getElementById("date-display");
    this._wordInput = document.getElementById("word-input");
    this._submitBtn = document.getElementById("submit-btn");
  }
  
  // Show input mode (white background, input field active)
  showInputMode() {
    // Make sure card is visible
    const card = document.querySelector(".card");
    if (card) card.style.display = "block";
    
    if (this._inputMode) this._inputMode.style.display = "flex";
    if (this._viewMode) this._viewMode.style.display = "none";
    
    // Clear background
    document.body.style.backgroundColor = "";
    document.body.style.background = "white";
    
    // Focus input
    if (this._wordInput) {
      this._wordInput.value = "";
      this._wordInput.focus();
    }
  }
  
  // Show view mode for a specific entry
  showViewMode(entry) {
    // Make sure card is visible
    const card = document.querySelector(".card");
    if (card) card.style.display = "block";
    
    if (this._inputMode) this._inputMode.style.display = "none";
    if (this._viewMode) this._viewMode.style.display = "flex";
    
    if (this._wordDisplay) this._wordDisplay.textContent = entry.word;
    if (this._dateDisplay) this._dateDisplay.textContent = entry.date;
    
    // Set background to entry's color
    const hsl = entry.hsl;
    document.body.style.backgroundColor = "";
    document.body.style.background = `hsl(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%)`;
  }
  
  clear() {
    // No persistent state to clear
  }
}


// ================================================================
// 4. HISTORY RENDERER - Stripe + list of entries
// ================================================================

class HistoryRenderer {
  constructor(storage, averager, onEntryClick) {
    this._storage = storage;
    this._averager = averager;
    this._onEntryClick = onEntryClick;
    this._container = null;
  }
  
  // Render history view for given entries
  render(entries) {
    if (!entries || entries.length === 0) return;
    
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return;
    
    // Remove existing history container if any
    this.destroy();
    
    // Create new container
    this._container = document.createElement("div");
    this._container.id = "history-container";
    this._container.className = "history-view";
    
    // Build stripe and list
    const stripeHtml = this._buildStripe(entries);
    const listHtml = this._buildList(entries);
    
    this._container.innerHTML = stripeHtml + listHtml;
    mainContent.appendChild(this._container);
    
    // Attach click handlers to list items
    const items = document.querySelectorAll(".history-item");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const date = item.getAttribute("data-date");
      item.addEventListener("click", () => this._onEntryClick(date));
    }
  }
  
  // Remove history view
  destroy() {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
  
  // Build stripe (rows of 500 slices)
  _buildStripe(entries) {
    if (entries.length === 0) return "";
    
    const sliceWidth = 3;
    const rowSize = 500;
    
    let html = '<div class="history-stripe-container">';
    
    for (let rowStart = 0; rowStart < entries.length; rowStart += rowSize) {
      const rowEnd = Math.min(rowStart + rowSize, entries.length);
      html += '<div class="history-stripe-row">';
      
      for (let i = rowStart; i < rowEnd; i++) {
        const entry = entries[i];
        const hsl = entry.hsl;
        html += `<div class="history-slice" style="background: hsl(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%); width: ${sliceWidth}px;"></div>`;
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }
  
  // Build scrollable list of entries (newest first)
  _buildList(entries) {
    let html = '<div class="history-list">';
    
    // Newest first for list
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const hsl = entry.hsl;
      html += `
        <div class="history-item" data-date="${entry.date}">
          <div class="history-color" style="background: hsl(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%);"></div>
          <div class="history-word">${this._escapeHtml(entry.word)}</div>
          <div class="history-date">${entry.date}</div>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }
  
  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}


// ================================================================
// 5. HELP MODAL MANAGER
// ================================================================

class HelpModalManager {
  constructor() {
    this._modal = document.getElementById("help-modal");
    this._closeBtn = document.getElementById("close-modal-btn");
    this._languageSelect = document.getElementById("language-select");
    this._contentContainer = document.getElementById("help-content");
  }
  
  init() {
    if (!this._modal) return;
    
    // Close on X button
    if (this._closeBtn) {
      this._closeBtn.addEventListener("click", () => this.close());
    }
    
    // Close on backdrop click
    this._modal.addEventListener("click", (e) => {
      if (e.target === this._modal) this.close();
    });
    
    // Load languages and content
    this._loadLanguages();
  }
  
  open() {
    if (this._modal) this._modal.showModal();
  }
  
  close() {
    if (this._modal) this._modal.close();
  }
  
  _loadLanguages() {
    fetch("help/help.json")
      .then(response => response.json())
      .then(data => {
        const languages = data.languages;
        let optionsHtml = "";
        for (const [code, name] of Object.entries(languages)) {
          optionsHtml += `<option value="${code}">${name}</option>`;
        }
        if (this._languageSelect) this._languageSelect.innerHTML = optionsHtml;
        
        let defaultLang = "en";
        const browserLang = navigator.language.substring(0, 2);
        if (languages[browserLang]) defaultLang = browserLang;
        if (this._languageSelect) this._languageSelect.value = defaultLang;
        
        this._loadContent(defaultLang);
        
        if (this._languageSelect) {
          this._languageSelect.addEventListener("change", () => {
            this._loadContent(this._languageSelect.value);
          });
        }
      })
      .catch(() => {
        if (this._languageSelect) this._languageSelect.innerHTML = '<option value="en">English</option>';
        this._loadContent("en");
      });
  }
  
  _loadContent(lang) {
    if (!this._contentContainer) return;
    
    fetch(`help/help.${lang}.txt`)
      .then(response => response.text())
      .then(text => {
        this._contentContainer.textContent = text;
      })
      .catch(() => {
        this._contentContainer.textContent = "Help content not available.";
      });
  }
}


// ================================================================
// 6. BUTTON MANAGER - Handles all button clicks and navigation
// ================================================================

class ButtonManager {
  constructor(
    onCalendar,
    onImport,
    onExport,
    onToday,
    onHelp,
    onHistoryClick,
    onSubmit,
    onDatePickerResult
  ) {
    this._onCalendar = onCalendar;
    this._onImport = onImport;
    this._onExport = onExport;
    this._onToday = onToday;
    this._onHelp = onHelp;
    this._onHistoryClick = onHistoryClick;
    this._onSubmit = onSubmit;
    this._onDatePickerResult = onDatePickerResult;
    
    this._entryCount = 0;
  }
  
  // Update which history buttons are visible based on entry count
  // Buttons appear when entry count reaches threshold
  // Thresholds: 10, 20, 50, 100, 200, 210 (for ∞)
  updateHistoryButtons(entryCount) {
    this._entryCount = entryCount;
    const buttons = document.querySelectorAll(".history-btn");
    
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const range = btn.getAttribute("data-range");
      
      if (range === "all") {
        if (entryCount >= 210) {
          btn.classList.add("visible");
        } else {
          btn.classList.remove("visible");
        }
      } else {
        const rangeValue = parseInt(range, 10);
        if (entryCount >= rangeValue) {
          btn.classList.add("visible");
        } else {
          btn.classList.remove("visible");
        }
      }
    }
  }
  
  // Bind all event listeners to DOM elements
  bind() {
    const calendarBtn = document.getElementById("calendar-btn");
    if (calendarBtn) {
      calendarBtn.addEventListener("click", () => this._onCalendar());
    }
    
    const importBtn = document.getElementById("import-btn");
    if (importBtn) {
      importBtn.addEventListener("click", () => this._onImport());
    }
    
    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this._onExport());
    }
    
    const todayBtn = document.getElementById("today-btn");
    if (todayBtn) {
      todayBtn.addEventListener("click", () => this._onToday());
    }
    
    const helpBtn = document.getElementById("help-btn");
    if (helpBtn) {
      helpBtn.addEventListener("click", () => this._onHelp());
    }
    
    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this._onSubmit());
    }
    
    const wordInput = document.getElementById("word-input");
    if (wordInput) {
      wordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this._onSubmit();
      });
    }
    
    const historyBtns = document.querySelectorAll(".history-btn");
    for (let i = 0; i < historyBtns.length; i++) {
      const btn = historyBtns[i];
      const range = btn.getAttribute("data-range");
      btn.addEventListener("click", () => this._onHistoryClick(range));
    }
  }
}


// ================================================================
// 7. DATE PICKER MANAGER
// ================================================================

class DatePickerManager {
  constructor(storage, onDateSelected) {
    this._storage = storage;
    this._onDateSelected = onDateSelected;
  }
  
  open() {
    const today = this._getTodayDate();
    const dateStr = prompt("Enter date (YYYY-MM-DD):", today);
    if (!dateStr) return;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return;
    
    const result = this._findTargetEntry(dateStr);
    if (result) {
      this._onDateSelected(result);
    }
  }
  
  _getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  _findTargetEntry(dateStr) {
    // Exact match first
    let entry = this._storage.getEntryForDate(dateStr);
    if (entry) return entry;
    
    // Past date with no entry: find next entry after
    const nextEntry = this._storage.getNextEntryAfter(dateStr);
    if (nextEntry) return nextEntry;
    
    // No entry after, or future date: return most recent
    return this._storage.getLastEntry();
  }
}


// ================================================================
// 8. HISTORY DATA HELPER
// ================================================================

class HistoryDataHelper {
  constructor(storage) {
    this._storage = storage;
  }
  
  // Get entries for a specific range
  // rangeType: "last" or "all"
  // rangeValue: number for "last", ignored for "all"
  getEntries(rangeType, rangeValue) {
    const allEntries = this._storage.loadAll();
    
    if (allEntries.length === 0) return [];
    
    // Sort chronologically for stripe (oldest first)
    const sortedByDate = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
    
    if (rangeType === "all") {
      return sortedByDate;
    } else {
      // Last N entries: get most recent N, then sort chronologically
      const reversed = [...allEntries].sort((a, b) => b.date.localeCompare(a.date));
      const lastN = reversed.slice(0, rangeValue);
      return lastN.sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  
  // Get the key used for tracking rainbow rewards
  getRewardKey(rangeType, rangeValue) {
    return rangeType === "all" ? "all" : `last${rangeValue}`;
  }
  
  // Get the threshold for a range (number of entries needed to unlock)
  getThreshold(rangeType, rangeValue) {
    if (rangeType === "all") return 210;
    return parseInt(rangeValue, 10);
  }
}


// ================================================================
// 9. CELEBRATION TRACKER - Manages rainbow reward state
// ================================================================

class CelebrationTracker {
  constructor() {
    this._storageKey = "dwd_celebrated_ranges";
    this._celebratedRanges = this._load();
  }
  
  // Load celebrated ranges from localStorage
  _load() {
    const saved = localStorage.getItem(this._storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch(e) {
        return {};
      }
    }
    return {};
  }
  
  // Save celebrated ranges to localStorage
  _save() {
    localStorage.setItem(this._storageKey, JSON.stringify(this._celebratedRanges));
  }
  
  // Check if a range has already been celebrated
  isCelebrated(rangeKey) {
    return !!this._celebratedRanges[rangeKey];
  }
  
  // Mark a range as celebrated
  markCelebrated(rangeKey) {
    if (!this._celebratedRanges[rangeKey]) {
      this._celebratedRanges[rangeKey] = Date.now();
      this._save();
    }
  }
  
  // Reset celebration state for a range (used for testing)
  resetCelebration(rangeKey) {
    delete this._celebratedRanges[rangeKey];
    this._save();
  }
  
  // Clear all celebrations (used for testing)
  clearAll() {
    this._celebratedRanges = {};
    this._save();
  }
}


// ================================================================
// 10. UI MANAGER - Main orchestrator
// ================================================================

class UIManager {
  constructor(storage, calculator, averager) {
    this._storage = storage;
    this._calculator = calculator;
    this._averager = averager;
    this._card = null;  // Store card for restoration
    
    // UI components
    this._viewRenderer = new ViewRenderer();
    this._bottomBarRenderer = new BottomBarRenderer(storage, (date) => this._onBottomBarClick(date));
    this._historyRenderer = new HistoryRenderer(storage, averager, (date) => this._onHistoryItemClick(date));
    this._helpModal = new HelpModalManager();
    this._datePicker = new DatePickerManager(storage, (entry) => this._onDateSelected(entry));
    this._historyData = new HistoryDataHelper(storage);
    this._celebrationTracker = new CelebrationTracker();
    
    this._buttonManager = new ButtonManager(
      () => this._onCalendar(),
      () => this._onImport(),
      () => this._onExport(),
      () => this._onToday(),
      () => this._onHelp(),
      (range) => this._onHistoryClick(range),
      () => this._onSubmit(),
      null
    );
  }
  
  // ========== Helper methods ==========
  
  _getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  _hasTodayEntry() {
    return this._storage.hasEntryForDate(this._getTodayDate());
  }
  
  _getTodayEntry() {
    return this._storage.getEntryForDate(this._getTodayDate());
  }
  
  _updateAll() {
    this._bottomBarRenderer.render();
    this._buttonManager.updateHistoryButtons(this._storage.getEntryCount());
  }
  
  // ========== Card management ==========
  
  _removeCard() {
    const card = document.querySelector(".card");
    if (card) {
      this._card = card;
      card.remove();
    }
  }
  
  _restoreCard() {
    if (this._card && !document.querySelector(".card")) {
      const mainContent = document.querySelector(".main-content");
      if (mainContent) {
        mainContent.insertBefore(this._card, mainContent.firstChild);
      }
      this._card = null;
    }
  }
  
  // ========== Navigation methods ==========
  
  // Show input mode (writing a new word for today)
  showInputMode() {
    this._historyRenderer.destroy();
    this._restoreCard();
    this._viewRenderer.showInputMode();
    this._updateAll();
  }
  
  // Show view mode (viewing a specific entry)
  showViewMode(entry) {
    this._historyRenderer.destroy();
    this._restoreCard();
    this._viewRenderer.showViewMode(entry);
    this._updateAll();
  }
  
  // Show history view (list of entries for a range)
  // celebrate: whether to show rainbow reward if this range is newly unlocked
  showHistoryView(rangeType, rangeValue, celebrate = false) {
    const entries = this._historyData.getEntries(rangeType, rangeValue);
    if (entries.length === 0) return;
    
    const rangeKey = this._historyData.getRewardKey(rangeType, rangeValue);
    const threshold = this._historyData.getThreshold(rangeType, rangeValue);
    const currentCount = this._storage.getEntryCount();
    
    // Calculate average background color
    const avgColor = this._averager.medianHsl(entries);
    document.body.style.backgroundColor = "";
    document.body.style.background = `hsl(${avgColor.hue}, ${avgColor.saturation}%, ${avgColor.lightness}%)`;
    
    // Remove card and show history
    this._removeCard();
    
    const inputMode = document.getElementById("input-mode");
    const viewMode = document.getElementById("view-mode");
    if (inputMode) inputMode.style.display = "none";
    if (viewMode) viewMode.style.display = "none";
    
    this._historyRenderer.render(entries);
    this._updateAll();
    
    // Show rainbow reward only if:
    // 1. celebrate flag is true (user clicked the button, not system)
    // 2. Current entry count meets the threshold for this range
    // 3. This range has not been celebrated before
    if (celebrate && currentCount >= threshold && !this._celebrationTracker.isCelebrated(rangeKey)) {
      this._celebrationTracker.markCelebrated(rangeKey);
      AnimationHelper.rainbowReward();
    }
  }
  
  // ========== Event handlers ==========
  
  _onBottomBarClick(date) {
    const entry = this._storage.getEntryForDate(date);
    if (entry) this.showViewMode(entry);
  }
  
  _onHistoryItemClick(date) {
    const entry = this._storage.getEntryForDate(date);
    if (entry) this.showViewMode(entry);
  }
  
  _onDateSelected(entry) {
    if (entry) this.showViewMode(entry);
  }
  
  _onCalendar() {
    this._datePicker.open();
  }
  
  _onImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const json = e.target.result;
        this._storage.importFromJson(json);
        
        this._updateAll();
        
        // After import, show the most recent entry without celebration
        const lastEntry = this._storage.getLastEntry();
        if (lastEntry) {
          this.showViewMode(lastEntry);
        } else {
          this.showInputMode();
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  
  _onExport() {
    const json = this._storage.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dwd_export_${this._getTodayDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  _onToday() {
    const todayEntry = this._getTodayEntry();
    if (todayEntry) {
      this.showViewMode(todayEntry);
    } else {
      this.showInputMode();
    }
  }
  
  _onHelp() {
    this._helpModal.open();
  }
  
  _onHistoryClick(range) {
    // User clicked a history button - celebrate if newly unlocked
    if (range === "all") {
      this.showHistoryView("all", 0, true);
    } else {
      const num = parseInt(range, 10);
      this.showHistoryView("last", num, true);
    }
  }
  
  _onSubmit() {
    const input = document.getElementById("word-input");
    if (!input) return;
    
    let word = input.value.trim();
    
    if (word.length === 0 || word.indexOf(" ") !== -1) {
      const card = document.querySelector(".card");
      AnimationHelper.redFlash(card);
      return;
    }
    
    if (this._hasTodayEntry()) return;
    
    const result = this._calculator.calculate(word);
    const entry = new DiaryEntry(this._getTodayDate(), word, result.hsl);
    this._storage.saveEntry(entry);
    
    this.showViewMode(entry);
  }
  
  // ========== Initialization ==========
  
  init() {
    this._buttonManager.bind();
    this._helpModal.init();
    
    const todayEntry = this._getTodayEntry();
    if (todayEntry) {
      this.showViewMode(todayEntry);
    } else {
      this.showInputMode();
    }
  }
}
