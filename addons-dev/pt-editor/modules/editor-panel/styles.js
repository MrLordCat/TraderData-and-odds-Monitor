/**
 * PT Editor - CSS Styles
 */

function getLauncherStyles() {
  return `
.pt-editor-launcher {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  text-align: center;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  min-height: 200px;
}

.launcher-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.pt-editor-launcher h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
}

.launcher-desc {
  margin: 0 0 20px 0;
  font-size: 12px;
  color: #718096;
}

.btn-launch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  border: none;
  border-radius: 8px;
  color: #1a1a2e;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
}

.btn-launch:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(72, 187, 120, 0.4);
}

.btn-launch:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 18px;
}

.launcher-hint {
  margin: 12px 0 0 0;
  font-size: 11px;
  color: #4a5568;
}
`;
}

function getEditorStyles() {
  return `
.pt-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a2e;
  color: #e2e8f0;
  font-family: 'Segoe UI', sans-serif;
  font-size: 12px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #16213e;
  border-bottom: 1px solid #2d3748;
}

.editor-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.editor-actions {
  display: flex;
  gap: 6px;
}

.editor-actions button {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-save {
  background: #48bb78;
  color: #1a1a2e;
}

.btn-save:hover {
  background: #38a169;
}

.btn-reload {
  background: #4a5568;
  color: #e2e8f0;
}

.btn-reload:hover {
  background: #718096;
}

.editor-tabs {
  display: flex;
  background: #16213e;
  border-bottom: 1px solid #2d3748;
  padding: 0 8px;
}

.tab-btn {
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #718096;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #e2e8f0;
}

.tab-btn.active {
  color: #63b3ed;
  border-bottom-color: #63b3ed;
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.tab-panel {
  display: none;
}

.tab-panel.active {
  display: block;
}

.section {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.section h4 {
  margin: 0 0 10px 0;
  font-size: 12px;
  color: #63b3ed;
  border-bottom: 1px solid #2d3748;
  padding-bottom: 6px;
}

.field-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-group:last-child {
  margin-bottom: 0;
}

.field-group label {
  color: #a0aec0;
  font-size: 11px;
}

.field-group input {
  width: 80px;
  padding: 4px 8px;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 12px;
  text-align: right;
}

.field-group input:focus {
  outline: none;
  border-color: #63b3ed;
}

.field-group input::-webkit-inner-spin-button {
  opacity: 1;
}

/* Enemy List */
.enemy-card {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
}

.enemy-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d3748;
}

.enemy-emoji {
  font-size: 20px;
}

.enemy-name {
  font-weight: 600;
  color: #e2e8f0;
}

.enemy-type {
  color: #718096;
  font-size: 10px;
  margin-left: auto;
}

.enemy-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Tower Paths */
.tower-path-card {
  background: #16213e;
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
}

.tower-path-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #0f3460;
  cursor: pointer;
}

.tower-path-header:hover {
  background: #1a4a7a;
}

.tower-path-icon {
  font-size: 18px;
}

.tower-path-name {
  font-weight: 600;
}

.tower-path-toggle {
  margin-left: auto;
  color: #718096;
}

.tower-path-content {
  padding: 12px;
  display: none;
}

.tower-path-content.open {
  display: block;
}

.tier-card {
  background: #1a1a2e;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 8px;
}

.tier-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #63b3ed;
  font-size: 11px;
  font-weight: 600;
}

.tier-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.tier-stats .field-group {
  margin-bottom: 0;
}

.tier-stats .field-group label {
  font-size: 10px;
}

.tier-stats .field-group input {
  width: 60px;
  padding: 2px 6px;
  font-size: 11px;
}

/* Status */
.editor-status {
  padding: 6px 12px;
  background: #16213e;
  border-top: 1px solid #2d3748;
  font-size: 11px;
  color: #718096;
}

.editor-status.success {
  color: #48bb78;
}

.editor-status.error {
  color: #fc8181;
}

/* Color picker */
.color-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-field input[type="color"] {
  width: 30px;
  height: 24px;
  padding: 0;
  border: none;
  cursor: pointer;
}

.color-field input[type="text"] {
  width: 70px;
}

/* Fields Grid - 2-column layout */
.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.fields-grid .field-group {
  margin-bottom: 0;
}

/* Field hint - small description */
.field-hint {
  font-size: 9px;
  color: #4a5568;
  display: block;
  margin-top: 2px;
}

/* Energy Building Cards */
.energy-card {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
}

.energy-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d3748;
}

.energy-icon {
  font-size: 20px;
}

.energy-name {
  font-weight: 600;
  color: #e2e8f0;
}

.energy-category {
  color: #ffc107;
  font-size: 10px;
  margin-left: auto;
  background: rgba(255, 193, 7, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.energy-stats {
  display: block;
}

/* Editor Footer */
.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #16213e;
  border-top: 1px solid #2d3748;
  font-size: 10px;
}

.editor-path {
  color: #4a5568;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.editor-status.warning {
  color: #ffc107;
}

/* No data placeholder */
.no-data {
  color: #4a5568;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

/* Section hint */
.section-hint {
  margin: 0;
  font-size: 10px;
  color: #718096;
  font-style: italic;
}

/* Scrollbar styling */
.editor-content::-webkit-scrollbar {
  width: 6px;
}

.editor-content::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.editor-content::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 3px;
}

.editor-content::-webkit-scrollbar-thumb:hover {
  background: #718096;
}
`;
}

module.exports = { getLauncherStyles, getEditorStyles };
