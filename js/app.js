// ================================================================
// app.js
// DWD Diary - Initialization
// Depends on dwd-core.js and dwd-ui.js
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Create core dependencies
  const storage = new DiaryStorage();
  
  const strategies = [
    new RgbStrategy(),
    new HslStrategy(),
    new LabStrategy(),
    new YuvStrategy(),
    new YiqStrategy()
  ];
  
  const calculator = new ColorCalculator(strategies);
  const averager = new ColorAverager();
  
  // Create UI manager (orchestrates all UI components)
  const ui = new UIManager(storage, calculator, averager);
  ui.init();
});
