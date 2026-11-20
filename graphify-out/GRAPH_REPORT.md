# Graph Report - .  (2026-11-19)

## Corpus Check
- Corpus is ~28,799 words - fits in a single context window. You may not need a graph.

## Summary
- 114 nodes · 196 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard Core & Cache
- Linktree Public Viewer
- Admin Core & Media
- Config, Templates & Docs
- Node Package Manifest
- Admin Live Preview
- Client Design Customizer
- Google Reviews Scraper
- Dashboard Charts & Filters
- Admin Commit & Sheets
- Dashboard Auth & Metrics
- Dashboard GitHub Sync
- Dashboard Business Loader
- Admin Form & Auto-Commit
- Multi-Repo URL Resolver

## God Nodes (most connected - your core abstractions)
1. `applyDashboardView()` - 9 edges
2. `runSingleBusinessCommit()` - 8 edges
3. `updateLivePreview()` - 7 edges
4. `initClientDesignEditor()` - 7 edges
5. `getFormData()` - 6 edges
6. `saveToGoogleSheets()` - 6 edges
7. `escapeHtml()` - 6 edges
8. `loadBusinessInfo()` - 6 edges
9. `loadBusinessProfile()` - 6 edges
10. `selectBusiness()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `runSingleBusinessCommit()` --references--> `GitHubSync`  [EXTRACTED]
  admin/admin.js → assets/github-sync.js
- `loadBusinessesData()` --references--> `GitHubSync`  [EXTRACTED]
  admin/admin.js → assets/github-sync.js
- `getResolvedRepoUrls()` --references--> `GitHubSync`  [EXTRACTED]
  admin/admin.js → assets/github-sync.js

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "Dashboard Core & Cache"
Cohesion: 0.18
Nodes (7): businessId, clientButtonOrder, mergeNumericMapsMax(), normalizeNumericMap(), params, renderDailyMetricsTable(), sumBtnAliases()

### Community 1 - "Linktree Public Viewer"
Cohesion: 0.29
Nodes (11): applyTheme(), decodeGitHubBase64Utf8(), fetchFreshBusinessFromGitHubApi(), fetchGitHubContentsJson(), fetchStaticFreshBusiness(), getBizTimestamp(), loadBusinessProfile(), pickNewestBusiness() (+3 more)

### Community 2 - "Admin Core & Media"
Cohesion: 0.22
Nodes (5): businesses, escapeHtml(), IMAGE_PRESETS, renderDynamicButtonsList(), renderPendingImagePreview()

### Community 3 - "Config, Templates & Docs"
Cohesion: 0.22
Nodes (6): CONFIG, INSTRUCCIONES_GOOGLE_SHEETS.md (Backend Apps Script), README.md (Arquitectura Multi-Repositorio), admin/index.html (Panel Administrativo), client/dashboard.html (Dashboard Privado del Cliente), p/index.html (Visor Público Linktree NFC)

### Community 4 - "Node Package Manifest"
Cohesion: 0.20
Nodes (9): dependencies, puppeteer, description, main, name, scripts, scrape, version (+1 more)

### Community 5 - "Admin Live Preview"
Cohesion: 0.29
Nodes (8): applyUploadedImageUrlToEditor(), loadStoredSettings(), renderThemeGrid(), selectBusiness(), selectThemeCard(), setupEventListeners(), updateConnectionBadges(), updateLivePreview()

### Community 6 - "Client Design Customizer"
Cohesion: 0.39
Nodes (8): escapeHtml(), initClientDesignEditor(), normalizeHexColor(), renderButtonsBreakdown(), renderClientButtonOrderList(), renderClientButtonStylesGrid(), renderClientThemesGrid(), updateActiveThemeBadge()

### Community 7 - "Google Reviews Scraper"
Cohesion: 0.29
Nodes (7): CONFIG_FILE, DATA_FILE, fs, main(), path, puppeteer, sleep()

### Community 8 - "Dashboard Charts & Filters"
Cohesion: 0.33
Nodes (7): aggregateFilteredMetrics(), applyDashboardView(), buildChannelsAnalytics(), filterLedgerByPeriod(), getTodayDateStr(), renderCharts(), updateFilterUiState()

### Community 9 - "Admin Commit & Sheets"
Cohesion: 0.53
Nodes (6): appendCommitLog(), initIdSelector(), runSingleBusinessCommit(), saveToGoogleSheets(), setModalCompleted(), showCommitModal()

### Community 10 - "Dashboard Auth & Metrics"
Cohesion: 0.40
Nodes (5): buildDailyLedger(), checkClientAuth(), loadMetrics(), refreshDashboardState(), stripButtonDateSuffix()

### Community 11 - "Dashboard GitHub Sync"
Cohesion: 0.40
Nodes (5): decodeGitHubBase64Utf8(), encodeGitHubBase64Utf8(), fetchFreshBusinessFromGitHubApi(), fetchGitHubContentsJson(), putGitHubJsonFile()

### Community 12 - "Dashboard Business Loader"
Cohesion: 0.67
Nodes (4): fetchStaticFreshBusinessForDashboard(), getBizTimestamp(), loadBusinessInfo(), pickNewestBusiness()

### Community 13 - "Admin Form & Auto-Commit"
Cohesion: 0.67
Nodes (3): autoCommitToGitHub(), getFormData(), getSelectedTheme()

### Community 14 - "Multi-Repo URL Resolver"
Cohesion: 1.00
Nodes (3): getResolvedRepoUrls(), loadBusinessesData(), GitHubSync

## Knowledge Gaps
- **17 isolated node(s):** `businesses`, `IMAGE_PRESETS`, `params`, `businessId`, `clientButtonOrder` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `client/dashboard.html (Dashboard Privado del Cliente)` connect `Config, Templates & Docs` to `Dashboard Core & Cache`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **Why does `admin/index.html (Panel Administrativo)` connect `Config, Templates & Docs` to `Admin Core & Media`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Why does `p/index.html (Visor Público Linktree NFC)` connect `Config, Templates & Docs` to `Linktree Public Viewer`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **What connects `businesses`, `IMAGE_PRESETS`, `params` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._