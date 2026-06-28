/**
 * sidebarLeft.ts
 * 左サイドバーを管理します。
 *
 * 上部セクション: データセットセレクタ（ファイルごとのタブ、データセットごとのチェックボックス）
 * 下部セクション: カラムセレクタ（有効化されたデータセットに基づいてリアクティブに更新されます）
 */

import { AppData } from './parser';

export type SidebarState = {
  enabledDatasets: { filename: string; dataname: string }[];
  enabledColumns: string[];
};

export class SidebarLeft {
  private container: HTMLElement;
  private datasetSection: HTMLElement;
  private columnSection: HTMLElement;

  private appData: AppData = {};
  private state: SidebarState = {
    enabledDatasets: [],
    enabledColumns: []
  };

  private onStateChange: (state: SidebarState) => void;

  constructor(container: HTMLElement, onStateChange: (state: SidebarState) => void) {
    this.container = container;
    this.onStateChange = onStateChange;

    // Build UI
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.height = '100%';

    this.datasetSection = document.createElement('div');
    this.datasetSection.style.flex = '1';
    this.datasetSection.style.overflowY = 'auto';
    this.datasetSection.style.borderBottom = '1px solid #3c3c3c';
    this.datasetSection.style.padding = '10px';

    this.columnSection = document.createElement('div');
    this.columnSection.style.flex = '1';
    this.columnSection.style.overflowY = 'auto';
    this.columnSection.style.padding = '10px';

    const dsTitle = document.createElement('h3');
    dsTitle.innerText = 'Datasets';
    dsTitle.style.marginTop = '0';
    dsTitle.style.marginBottom = '10px';
    this.datasetSection.appendChild(dsTitle);

    const colTitle = document.createElement('h3');
    colTitle.innerText = 'Columns';
    colTitle.style.marginTop = '0';
    colTitle.style.marginBottom = '10px';
    this.columnSection.appendChild(colTitle);

    this.container.appendChild(this.datasetSection);
    this.container.appendChild(this.columnSection);
  }

  updateData(newData: AppData) {
    this.appData = { ...this.appData, ...newData };
    this.renderDatasetSection();
    this.renderColumnSection();
  }

  private renderDatasetSection() {
    // Clear existing (keep title)
    while (this.datasetSection.childNodes.length > 1) {
      this.datasetSection.removeChild(this.datasetSection.lastChild!);
    }

    const fileNames = Object.keys(this.appData);
    if (fileNames.length === 0) return;

    const tabHeaderContainer = document.createElement('div');
    tabHeaderContainer.style.display = 'flex';
    tabHeaderContainer.style.borderBottom = '1px solid #3c3c3c';
    tabHeaderContainer.style.marginBottom = '10px';
    tabHeaderContainer.style.overflowX = 'auto';

    const tabContentContainer = document.createElement('div');

    let activeTabFilename = fileNames[0];

    const renderTabs = () => {
      tabHeaderContainer.innerHTML = '';
      tabContentContainer.innerHTML = '';

      fileNames.forEach(filename => {
        const tabBtn = document.createElement('button');
        tabBtn.innerText = filename;
        tabBtn.style.padding = '5px 10px';
        tabBtn.style.cursor = 'pointer';
        tabBtn.style.background = activeTabFilename === filename ? '#1e1e1e' : '#252526';
        tabBtn.style.border = 'none';
        tabBtn.style.borderTop = activeTabFilename === filename ? '2px solid #007acc' : '2px solid transparent';
        tabBtn.style.borderRight = '1px solid #3c3c3c';
        tabBtn.style.borderLeft = '1px solid #3c3c3c';
        tabBtn.style.color = '#cccccc';
        tabBtn.style.outline = 'none';

        tabBtn.addEventListener('click', () => {
          activeTabFilename = filename;
          renderTabs();
        });

        tabHeaderContainer.appendChild(tabBtn);

        // Render content only for active tab
        if (activeTabFilename === filename) {
          const fileData = this.appData[filename];
          Object.keys(fileData).forEach(dataname => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.marginLeft = '5px';
            item.style.marginBottom = '3px';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `ds-${filename}-${dataname}`;

            // Restore state if it was enabled
            const isEnabled = this.state.enabledDatasets.some(
              ds => ds.filename === filename && ds.dataname === dataname
            );
            cb.checked = isEnabled;

            cb.addEventListener('change', () => {
              if (cb.checked) {
                this.state.enabledDatasets.push({ filename, dataname });
              } else {
                this.state.enabledDatasets = this.state.enabledDatasets.filter(
                  ds => !(ds.filename === filename && ds.dataname === dataname)
                );
              }
              this.renderColumnSection();
              this.onStateChange(this.state);
            });

            const label = document.createElement('label');
            label.htmlFor = cb.id;
            label.innerText = dataname;
            label.style.marginLeft = '5px';
            label.style.cursor = 'pointer';

            item.appendChild(cb);
            item.appendChild(label);
            tabContentContainer.appendChild(item);
          });
        }
      });
    };

    renderTabs();

    this.datasetSection.appendChild(tabHeaderContainer);
    this.datasetSection.appendChild(tabContentContainer);
  }

  private renderColumnSection() {
    // Clear existing (keep title)
    while (this.columnSection.childNodes.length > 1) {
      this.columnSection.removeChild(this.columnSection.lastChild!);
    }

    // Determine available columns based on enabled datasets
    const availableColumns = new Set<string>();

    this.state.enabledDatasets.forEach(ds => {
      if (this.appData[ds.filename] && this.appData[ds.filename][ds.dataname]) {
        const dataset = this.appData[ds.filename][ds.dataname];
        Object.keys(dataset).forEach(col => {
          if (col !== 'DATE') {
            availableColumns.add(col);
          }
        });
      }
    });

    if (availableColumns.size === 0) {
      const msg = document.createElement('div');
      msg.innerText = 'Select a dataset first';
      msg.style.color = '#888';
      msg.style.fontStyle = 'italic';
      this.columnSection.appendChild(msg);
      return;
    }

    // Clean up enabledColumns (remove ones that are no longer available)
    this.state.enabledColumns = this.state.enabledColumns.filter(col => availableColumns.has(col));

    Array.from(availableColumns).sort().forEach(colName => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.marginBottom = '3px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `col-${colName}`;
      cb.checked = this.state.enabledColumns.includes(colName);

      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!this.state.enabledColumns.includes(colName)) {
            this.state.enabledColumns.push(colName);
          }
        } else {
          this.state.enabledColumns = this.state.enabledColumns.filter(c => c !== colName);
        }
        this.onStateChange(this.state);
      });

      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.innerText = colName;
      label.style.marginLeft = '5px';
      label.style.cursor = 'pointer';

      item.appendChild(cb);
      item.appendChild(label);
      this.columnSection.appendChild(item);
    });
  }
}
