/**
 * statistics.ts
 * 統計情報を計算するための数学関数と、右サイドバー用のUIフックを提供します。
 */

import { AppData } from './parser';
import { SidebarState } from './sidebarLeft';

export function calcMax(arr: number[]): number {
  if (arr.length === 0) return NaN;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

export function calcMin(arr: number[]): number {
  if (arr.length === 0) return NaN;
  let min = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}

export function calcMean(arr: number[]): number {
  if (arr.length === 0) return NaN;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

export function calcMedian(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

export class StatisticsManager {
  private container: HTMLElement;
  private appData: AppData = {};
  private sidebarState: SidebarState = { enabledDatasets: [], enabledColumns: [] };

  // Track visible range per dataset. Key is "filename::dataname"
  private visibleRanges: Map<string, { minX: number; maxX: number }> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  updateData(appData: AppData) {
    this.appData = appData;
    this.render();
  }

  updateState(state: SidebarState) {
    this.sidebarState = state;
    this.render();
  }

  updateRange(filename: string, dataname: string, minX: number, maxX: number) {
    this.visibleRanges.set(`${filename}::${dataname}`, { minX, maxX });
    this.render();
  }

  private render() {
    this.container.innerHTML = '';

    const title = document.createElement('h3');
    title.innerText = 'Statistics (Visible Range)';
    title.style.marginTop = '0';
    title.style.marginBottom = '10px';
    this.container.appendChild(title);

    if (this.sidebarState.enabledDatasets.length === 0) {
      const msg = document.createElement('div');
      msg.innerText = 'No datasets enabled';
      msg.style.color = '#888';
      this.container.appendChild(msg);
      return;
    }

    if (this.sidebarState.enabledColumns.length === 0) {
      const msg = document.createElement('div');
      msg.innerText = 'No columns enabled';
      msg.style.color = '#888';
      this.container.appendChild(msg);
      return;
    }

    // Group by filename
    const fileGroups = new Map<string, { dataname: string }[]>();
    this.sidebarState.enabledDatasets.forEach(ds => {
      const list = fileGroups.get(ds.filename) || [];
      list.push({ dataname: ds.dataname });
      fileGroups.set(ds.filename, list);
    });

    fileGroups.forEach((datasets, filename) => {
      const fileHeader = document.createElement('div');
      fileHeader.innerText = `📄 ${filename}`;
      fileHeader.style.fontWeight = 'bold';
      fileHeader.style.marginTop = '15px';
      fileHeader.style.marginBottom = '5px';
      this.container.appendChild(fileHeader);

      datasets.forEach(ds => {
        const dsHeader = document.createElement('div');
        dsHeader.innerText = `  ↳ ${ds.dataname}`;
        dsHeader.style.marginLeft = '10px';
        dsHeader.style.color = '#4ec9b0';
        dsHeader.style.marginBottom = '5px';
        this.container.appendChild(dsHeader);

        const data = this.appData[filename]?.[ds.dataname];
        if (!data) return;

        const range = this.visibleRanges.get(`${filename}::${ds.dataname}`);

        // Build table
        const table = document.createElement('table');
        table.style.width = 'max-content';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '12px';
        table.style.marginBottom = '10px';
        table.style.marginLeft = '15px';

        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        const thStat = document.createElement('th');
        thStat.innerText = 'Stat';
        thStat.style.textAlign = 'left';
        thStat.style.borderBottom = '1px solid #3c3c3c';
        trHead.appendChild(thStat);

        const enabledColsForThisDataset = this.sidebarState.enabledColumns.filter(
            col => data[col] !== undefined
        );

        enabledColsForThisDataset.forEach(col => {
          const th = document.createElement('th');
          th.innerText = col;
          th.style.textAlign = 'right';
          th.style.borderBottom = '1px solid #3c3c3c';
          trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const stats = ['Max', 'Min', 'Mean', 'Median'];

        stats.forEach(statName => {
          const tr = document.createElement('tr');
          const tdStat = document.createElement('td');
          tdStat.innerText = statName;
          tdStat.style.borderBottom = '1px solid #2d2d2d';
          tr.appendChild(tdStat);

          enabledColsForThisDataset.forEach(col => {
            const td = document.createElement('td');
            td.style.textAlign = 'right';
            td.style.borderBottom = '1px solid #2d2d2d';

            const colData = data[col] as number[];
            const dates = data.DATE as Date[];

            // Filter by range
            let filteredData = colData;
            if (range) {
              filteredData = [];
              for (let i = 0; i < dates.length; i++) {
                const t = dates[i].getTime();
                if (t >= range.minX && t <= range.maxX) {
                  filteredData.push(colData[i]);
                }
              }
            }

            let val = NaN;
            if (filteredData.length > 0) {
                switch (statName) {
                    case 'Max': val = calcMax(filteredData); break;
                    case 'Min': val = calcMin(filteredData); break;
                    case 'Mean': val = calcMean(filteredData); break;
                    case 'Median': val = calcMedian(filteredData); break;
                }
            }

            td.innerText = isNaN(val) ? '-' : val.toFixed(2);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        this.container.appendChild(table);
      });
    });
  }
}
