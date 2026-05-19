// ================================================================
// dwd-core.js
// Core data, color logic, and storage for DWD diary
// No DOM dependencies. Vanilla JavaScript.
// Uses simple loops for clarity and performance.
// ================================================================

// ================================================================
// 1. HSL COLOR CLASS
// Stores a color in HSL format (Hue, Saturation, Lightness)
// Provides conversion to CSS and RGB when needed
// ================================================================

class HslColor {
  // Constructor normalizes values to valid ranges
  // hue: 0-360 degrees (wraps around)
  // saturation: 0-100 percent
  // lightness: 0-100 percent
  constructor(hue, saturation, lightness) {
    // Normalize hue: keep in 0-359 range
    this._hue = Math.round(hue) % 360;
    // Clamp saturation and lightness to 0-100
    this._saturation = Math.min(100, Math.max(0, Math.round(saturation)));
    this._lightness = Math.min(100, Math.max(0, Math.round(lightness)));
  }

  // Getter methods - read-only access to internal values
  get hue() { return this._hue; }
  get saturation() { return this._saturation; }
  get lightness() { return this._lightness; }

  // Returns CSS-compatible string for background-color
  // Example: "hsl(210, 65%, 72%)"
  toCss() {
    return `hsl(${this._hue}, ${this._saturation}%, ${this._lightness}%)`;
  }

  // Converts HSL to RGB
  // Used for luminance calculation and for LAB/YUV conversions
  toRgb() {
    const h = this._hue / 360;
    const s = this._saturation / 100;
    const l = this._lightness / 100;

    let r, g, b;
    
    if (s === 0) {
      // Achromatic (gray)
      r = g = b = l;
    } else {
      // Helper function for hue to RGB conversion
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  // Calculate perceived luminance (brightness) of the color
  // Used to decide whether to use black or white text on this background
  // Returns value between 0 (darkest) and 1 (lightest)
  getLuminance() {
    const rgb = this.toRgb();
    // Convert to linear RGB
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    // Apply gamma correction
    const rLin = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLin = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLin = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    // Perceived luminance formula (human eye sensitivity)
    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }

  // Compare two colors for equality
  equals(other) {
    if (!(other instanceof HslColor)) return false;
    return this._hue === other._hue &&
           this._saturation === other._saturation &&
           this._lightness === other._lightness;
  }

  // Create a copy of this color
  clone() {
    return new HslColor(this._hue, this._saturation, this._lightness);
  }

  // Static factory method: create HslColor from RGB values
  // Used when converting from other color spaces to HSL
  static fromRgb(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    
    // Find min and max values
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    
    // Calculate lightness
    let l = (max + min) / 2;
    
    // Calculate saturation
    let s = 0;
    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    }
    
    // Calculate hue
    let h = 0;
    if (delta !== 0) {
      if (max === rn) {
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        h = (bn - rn) / delta + 2;
      } else {
        h = (rn - gn) / delta + 4;
      }
      h *= 60;
    }
    
    // Convert to percentages and integer values
    return new HslColor(h, s * 100, l * 100);
  }
}


// ================================================================
// 2. DIARY ENTRY CLASS
// Stores one day's word and its calculated color
// Immutable (cannot be changed after creation)
// ================================================================

class DiaryEntry {
  // date: string in YYYY-MM-DD format
  // word: the word the user wrote (any language)
  // hsl: HslColor instance
  constructor(date, word, hsl) {
    this._date = date;
    this._word = word;
    this._hsl = hsl;
  }

  get date() { return this._date; }
  get word() { return this._word; }
  get hsl() { return this._hsl; }

  // Convert to plain object for JSON storage
  toJSON() {
    return {
      date: this._date,
      word: this._word,
      hsl: [this._hsl.hue, this._hsl.saturation, this._hsl.lightness]
    };
  }

  // Recreate DiaryEntry from stored JSON
  static fromJSON(json) {
    const hsl = new HslColor(json.hsl[0], json.hsl[1], json.hsl[2]);
    return new DiaryEntry(json.date, json.word, hsl);
  }

  // Check if entry has valid data
  isValid() {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(this._date) && 
           this._word && 
           this._word.length > 0 &&
           this._hsl instanceof HslColor;
  }
}


// ================================================================
// 3. WORD GROUPER
// Splits a word into 3 groups of letters, based on word length
// Returns three sums (UTF code point totals) for each group
// ================================================================

class WordGrouper {
  
  // Main method: takes a word, returns object with three sums
  group(word) {
    // Convert to array of characters (handles Unicode properly)
    const chars = Array.from(word);
    const len = chars.length;
    
    // Build array of UTF code points for each character
    const utfValues = [];
    for (let i = 0; i < len; i++) {
      utfValues.push(chars[i].codePointAt(0));
    }
    
    // ================================================
    // CASE 1: Single letter word (length = 1)
    // All three groups get the same value
    // This will later force RGB mode and produce gray
    // ================================================
    if (len === 1) {
      const value = utfValues[0];
      return {
        sums: [value, value, value],
        rule: "single"
      };
    }
    
    // ================================================
    // CASE 2: Two letter word (length = 2)
    // Group1 = first letter
    // Group2 = second letter
    // Group3 = average (mean) of both letters
    // ================================================
    if (len === 2) {
      const sum1 = utfValues[0];
      const sum2 = utfValues[1];
      const sum3 = Math.floor((utfValues[0] + utfValues[1]) / 2);
      return {
        sums: [sum1, sum2, sum3],
        rule: "two_letter"
      };
    }
    
    // ================================================
    // CASE 3: Three or more letters
    // First, determine base group size N = ceil(length / 3)
    // ================================================
    const n = Math.ceil(len / 3);
    
    // ================================================
    // SUB-CASE A: Length divisible by 3
    // Split into three equal groups, no overlap
    // Example: length 6, n=2 → groups: [0,1], [2,3], [4,5]
    // ================================================
    if (len % 3 === 0) {
      // Calculate sum of first group (indices 0 to n-1)
      let sum1 = 0;
      for (let i = 0; i < n; i++) {
        sum1 += utfValues[i];
      }
      
      // Calculate sum of second group (indices n to 2n-1)
      let sum2 = 0;
      for (let i = n; i < n * 2; i++) {
        sum2 += utfValues[i];
      }
      
      // Calculate sum of third group (indices 2n to len-1)
      let sum3 = 0;
      for (let i = n * 2; i < len; i++) {
        sum3 += utfValues[i];
      }
      
      return {
        sums: [sum1, sum2, sum3],
        rule: "equal"
      };
    }
    
    // ================================================
    // SUB-CASE B: Length NOT divisible by 3
    // Overlap rule: groups share letters at boundaries
    // Example: length 7, n=3 → 
    //   Group1: indices 0,1,2
    //   Group3: indices 4,5,6
    //   Group2: indices 2,3,4 (overlaps with both)
    // ================================================
    
    // Group1: first N letters
    let sum1 = 0;
    for (let i = 0; i < n; i++) {
      sum1 += utfValues[i];
    }
    
    // Group3: last N letters
    let sum3 = 0;
    for (let i = len - n; i < len; i++) {
      sum3 += utfValues[i];
    }
    
    // Group2: from last letter of group1 to first letter of group3
    // This creates the overlap
    let sum2 = 0;
    const startIdx = n - 1;      // last index of group1
    const endIdx = len - n;       // first index of group3
    for (let i = startIdx; i <= endIdx; i++) {
      sum2 += utfValues[i];
    }
    
    return {
      sums: [sum1, sum2, sum3],
      rule: "overlap"
    };
  }
}


// ================================================================
// 4. COLOR SPACE STRATEGIES
// Each strategy knows how to convert three sums into an HSL color
// The strategy pattern allows adding new color spaces easily
// ================================================================

// ----------------------------------------------------------------
// Base class (not used directly, defines the interface)
// ----------------------------------------------------------------
class ColorSpaceStrategy {
  name() { return "Base"; }
  
  // Convert three sums to HSL color
  // Must be implemented by subclasses
  sumToHsl(sum1, sum2, sum3) {
    throw new Error("Must implement sumToHsl()");
  }
}

// ----------------------------------------------------------------
// RGB STRATEGY
// Maps sums to Red, Green, Blue channels (0-255 each)
// Then converts RGB to HSL for storage
// ----------------------------------------------------------------
class RgbStrategy extends ColorSpaceStrategy {
  name() { return "RGB"; }
  
  sumToHsl(sum1, sum2, sum3) {
    // Modulo 256 to keep values in 0-255 range
    const r = sum1 % 256;
    const g = sum2 % 256;
    const b = sum3 % 256;
    
    // Convert RGB to HSL and return
    return HslColor.fromRgb(r, g, b);
  }
}

// ----------------------------------------------------------------
// HSL STRATEGY
// Maps sums directly to Hue, Saturation, Lightness
// No conversion needed after mapping
// ----------------------------------------------------------------
class HslStrategy extends ColorSpaceStrategy {
  name() { return "HSL"; }
  
  sumToHsl(sum1, sum2, sum3) {
    // Hue: scramble to break clustering and get rainbow distribution
    const h = sum1 % 360;
    // Saturation and lightness: 50-100 range (no scrambler needed)
    const s = 50 + (sum2 % 51);
    const l = 50 + (sum3 % 51);
    return new HslColor(h, s, l);
  }
}

// ----------------------------------------------------------------
// LAB STRATEGY
// Maps sums to Lightness, a-channel, b-channel
// Then converts LAB to RGB to HSL
// LAB is a perceptually uniform color space
// ----------------------------------------------------------------
class LabStrategy extends ColorSpaceStrategy {
  name() { return "LAB"; }
  
  sumToHsl(sum1, sum2, sum3) {
    // L (lightness): 0-100 range
    const L = sum1 % 100;
    
    // a (green-red): -128 to 127 range
    const a = (sum2 % 256) - 128;
    
    // b (blue-yellow): -128 to 127 range
    const b = (sum3 % 256) - 128;
    
    // Convert LAB to RGB (simplified)
    // First, convert to XYZ color space
    let y = (L + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;
    
    // Helper: convert from XYZ to linear RGB
    const toLinear = (c) => {
      if (c > 0.206893) return Math.pow(c, 3);
      return (c - 16 / 116) / 7.787;
    };
    
    let rl = toLinear(x);
    let gl = toLinear(y);
    let bl = toLinear(z);
    
    // Convert to 0-255 RGB
    const r = Math.round(Math.min(255, Math.max(0, rl * 255)));
    const g = Math.round(Math.min(255, Math.max(0, gl * 255)));
    const bRgb = Math.round(Math.min(255, Math.max(0, bl * 255)));
    
    // Convert RGB to HSL and return
    return HslColor.fromRgb(r, g, bRgb);
  }
}

// ----------------------------------------------------------------
// YUV STRATEGY
// Maps sums to Y (luma), U (blue-difference), V (red-difference)
// Used in PAL video systems (Europe)
// Then converts YUV to RGB to HSL
// ----------------------------------------------------------------
class YuvStrategy extends ColorSpaceStrategy {
  name() { return "YUV"; }
  
  sumToHsl(sum1, sum2, sum3) {
    // Y (luma): 0-255 range, no scrambler needed for brightness
    const y = sum1 % 256;
    
    // U and V: scramble to break clustering and get rainbow distribution
    const u = (sum2 % 256) - 128;
    const v = (sum3 % 256) - 128;
    
    // Convert YUV to RGB
    let r = y + 1.13983 * v;
    let g = y - 0.39465 * u - 0.58060 * v;
    let b = y + 2.03211 * u;
    
    r = Math.round(Math.min(255, Math.max(0, r)));
    g = Math.round(Math.min(255, Math.max(0, g)));
    b = Math.round(Math.min(255, Math.max(0, b)));
    
    return HslColor.fromRgb(r, g, b);
  }
}

// ----------------------------------------------------------------
// YIQ STRATEGY
// Maps sums to Y (luma), I (in-phase), Q (quadrature)
// Used in NTSC video systems (North America, Japan)
// Similar to YUV but with different color axes
// ----------------------------------------------------------------
class YiqStrategy extends ColorSpaceStrategy {
  name() { return "YIQ"; }
  
  sumToHsl(sum1, sum2, sum3) {
    // Y (luma): 0-255 range, no scrambler needed
    const y = sum1 % 256;
    
    // I and Q: scramble to break clustering
    const i = (sum2 % 256) - 128;
    const q = (sum3 % 256) - 128;
    
    // Convert YIQ to RGB (NTSC matrix)
    let r = y + 0.9563 * i + 0.6210 * q;
    let g = y - 0.2721 * i - 0.6474 * q;
    let b = y - 1.1070 * i + 1.7046 * q;
    
    r = Math.round(Math.min(255, Math.max(0, r)));
    g = Math.round(Math.min(255, Math.max(0, g)));
    b = Math.round(Math.min(255, Math.max(0, b)));
    
    return HslColor.fromRgb(r, g, b);
  }
}

// ================================================================
// 5. COLOR CALCULATOR
// Orchestrates everything: groups word, picks random color space,
// calculates color, and returns HSL result
// ================================================================

class ColorCalculator {
  // strategies: array of ColorSpaceStrategy instances
  constructor(strategies) {
    this._strategies = strategies;
    this._grouper = new WordGrouper();
  }

  // Calculate color for a word
  // forceStrategy: optional specific strategy (for testing)
  calculate(word, forceStrategy = null) {
    // Step 1: Pick a color space
    let strategy;
    let forced = false;
    
    if (forceStrategy !== null) {
      strategy = forceStrategy;
      forced = true;
    } else {
      const randomIndex = Math.floor(Math.random() * this._strategies.length);
      strategy = this._strategies[randomIndex];
    }
    
    // Step 2: Group the word and get three sums
    const groupResult = this._grouper.group(word);
    const sums = groupResult.sums;
    const rule = groupResult.rule;
    const RGBcolors = sums;
    const randomizedSums = sums.map(s => 1 + Math.floor(Math.random() * s));
    
    // Step 3: Convert sums to HSL color
    let hsl;
    if (word.length === 1) {
      // Single letter: force RGB with exponent variation
      let rgbStrategy = null;
      for (let i = 0; i < this._strategies.length; i++) {
        if (this._strategies[i].name() === "RGB") {
          rgbStrategy = this._strategies[i];
          break;
        }
      }
      if (rgbStrategy) {
        // Use exponent to create variation between different letters
        hsl = rgbStrategy.sumToHsl(
          RGBcolors[0] ** 2.71828,
          RGBcolors[1] ** 2.71828,
          RGBcolors[2] ** 2.71828
        );
        strategy = rgbStrategy;
      } else {
        hsl = new HslColor(0, 0, 50);
      }
    } else {
      // Normal case: use selected strategy with randomized sums
      hsl = strategy.sumToHsl(randomizedSums[0], randomizedSums[1], randomizedSums[2]);
    }
    
    // Step 4: Return result
    return {
      hsl: hsl,                    // HslColor object
      spaceUsed: strategy.name(),  // name of color space used
      forced: forced,              // whether space was forced
      groups: {                    // grouping result
        sums: sums,                // original sums (not randomized)
        rule: rule                 // grouping rule: single, two_letter, equal, overlap
      },
      word: word                   // original word (for reference)
    };
  }
    
  // Convenience method: force a specific color space
  calculateWithSpace(word, strategy) {
    return this.calculate(word, strategy);
  }
}


// ================================================================
// 6. COLOR AVERAGING
// For history view backgrounds: average multiple HSL colors
// Uses simple loops, no fancy array methods
// ================================================================

class ColorAverager {
  
  // Calculate median (middle value) of an array of numbers
  _median(arr) {
    if (arr.length === 0) return 0;
    
    // Make a copy and sort numerically
    const sorted = [];
    for (let i = 0; i < arr.length; i++) {
      sorted.push(arr[i]);
    }
    sorted.sort((a, b) => a - b);
    
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      // Even number: average of two middle values
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      // Odd number: middle value
      return sorted[mid];
    }
  }
  
  // Median of HSL values (best for history background)
  // Preserves the "typical" color without blending everything to brown
  medianHsl(entries) {
    if (entries.length === 0) {
      return new HslColor(0, 0, 50); // neutral gray
    }
    
    // Collect all hue, saturation, lightness values
    const hues = [];
    const sats = [];
    const lights = [];
    
    for (let i = 0; i < entries.length; i++) {
      hues.push(entries[i].hsl.hue);
      sats.push(entries[i].hsl.saturation);
      lights.push(entries[i].hsl.lightness);
    }
    
    // Calculate median for each channel
    const medianHue = this._median(hues);
    const medianSat = this._median(sats);
    const medianLight = this._median(lights);
    
    return new HslColor(medianHue, medianSat, medianLight);
  }
  
  // Alternative: circular average for hue (more mathematically correct)
  // But median is simpler and works fine for most cases
  circularAverageHue(hues) {
    if (hues.length === 0) return 0;
    
    let x = 0, y = 0;
    for (let i = 0; i < hues.length; i++) {
      const rad = hues[i] * Math.PI / 180;
      x += Math.cos(rad);
      y += Math.sin(rad);
    }
    
    let avgRad = Math.atan2(y / hues.length, x / hues.length);
    if (avgRad < 0) avgRad += 2 * Math.PI;
    return avgRad * 180 / Math.PI;
  }
}


// ================================================================
// 7. DIARY STORAGE
// Handles saving to and loading from LocalStorage
// Also JSON export/import for backup
// ================================================================

class DiaryStorage {
  constructor(storageKey = "dwd_diary") {
    this._storageKey = storageKey;
  }
  
  // Load all entries from LocalStorage
  // Returns array of DiaryEntry objects (empty array if none)
  loadAll() {
    const data = localStorage.getItem(this._storageKey);
    if (!data) return [];
    
    try {
      const parsed = JSON.parse(data);
      const entries = [];
      for (let i = 0; i < parsed.length; i++) {
        entries.push(DiaryEntry.fromJSON(parsed[i]));
      }
      return entries;
    } catch (e) {
      console.error("Failed to load diary:", e);
      return [];
    }
  }
  
  // Save a single entry (adds or replaces if date exists)
  saveEntry(entry) {
    const entries = this.loadAll();
    
    // Check if entry with same date already exists
    let foundIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].date === entry.date) {
        foundIndex = i;
        break;
      }
    }
    
    if (foundIndex >= 0) {
      entries[foundIndex] = entry;  // replace (for import)
    } else {
      entries.push(entry);           // add new
    }
    
    this.saveAll(entries);
  }
  
  // Save all entries (overwrites everything)
  saveAll(entries) {
    const jsonArray = [];
    for (let i = 0; i < entries.length; i++) {
      jsonArray.push(entries[i].toJSON());
    }
    const data = JSON.stringify(jsonArray);
    localStorage.setItem(this._storageKey, data);
  }
  
  // Delete all entries (with confirmation)
  // Only used for testing/reset, not for normal operation
  clear() {
    if (confirm("This will DELETE ALL entries. Are you sure?")) {
      localStorage.removeItem(this._storageKey);
    }
  }
  
  // Export all entries as JSON string (for backup)
  exportToJson() {
    const entries = this.loadAll();
    const jsonArray = [];
    for (let i = 0; i < entries.length; i++) {
      jsonArray.push(entries[i].toJSON());
    }
    return JSON.stringify(jsonArray, null, 2);
  }
  
  // Import entries from JSON string (overwrites existing)
  importFromJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const entries = [];
      for (let i = 0; i < parsed.length; i++) {
        entries.push(DiaryEntry.fromJSON(parsed[i]));
      }
      this.saveAll(entries);
      return entries;
    } catch (e) {
      console.error("Failed to import JSON:", e);
      return [];
    }
  }
  
  // Check if an entry exists for a given date
  hasEntryForDate(date) {
    const entries = this.loadAll();
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].date === date) return true;
    }
    return false;
  }
  
  // Get entry for a specific date (or null if not found)
  getEntryForDate(date) {
    const entries = this.loadAll();
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].date === date) return entries[i];
    }
    return null;
  }
  
  // Get most recent N entries (newest first)
  getRecentEntries(count) {
    const entries = this.loadAll();
    
    // Sort by date descending (newest first)
    for (let i = 0; i < entries.length - 1; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].date < entries[j].date) {
          const temp = entries[i];
          entries[i] = entries[j];
          entries[j] = temp;
        }
      }
    }
    
    // Return first 'count' entries
    const result = [];
    const limit = Math.min(count, entries.length);
    for (let i = 0; i < limit; i++) {
      result.push(entries[i]);
    }
    return result;
  }
  
  // Get total number of entries
  getEntryCount() {
    return this.loadAll().length;
  }
  
  // Get the most recent entry (last written)
  getLastEntry() {
    const entries = this.loadAll();
    if (entries.length === 0) return null;
    
    // Find entry with maximum date
    let lastEntry = entries[0];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].date > lastEntry.date) {
        lastEntry = entries[i];
      }
    }
    return lastEntry;
  }
  
  // Get the next entry after a given date (for date picker)
  getNextEntryAfter(date) {
    const entries = this.loadAll();
    
    // Find the smallest date that is greater than given date
    let nextEntry = null;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].date > date) {
        if (nextEntry === null || entries[i].date < nextEntry.date) {
          nextEntry = entries[i];
        }
      }
    }
    return nextEntry;
  }
}

