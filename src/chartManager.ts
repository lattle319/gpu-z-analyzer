/**
 * chartManager.ts
 * メインのチャート領域を管理します。
 * 有効化されたデータセットごとに1つのCanvasを垂直にスタックして描画します。
 * Chart.jsインスタンスの作成、ズーム/パンのインタラクション、およびUndo/Redoロジックを処理します。
 */

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns'; // We need this for the time scale
import { AppData } from './parser';
import { SidebarState } from './sidebarLeft';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  zoomPlugin
);

export type CanvasState = {
  minX?: number;
  maxX?: number;
  minY?: { [axisId: string]: number };
  maxY?: { [axisId: string]: number };
};

export class ChartManager {
  private container: HTMLElement;
  private appData: AppData = {};
  private chartInstances: Map<string, Chart> = new Map();
  private undoStacks: Map<string, CanvasState[]> = new Map();
  private redoStacks: Map<string, CanvasState[]> = new Map();
  private shareAxisStates: Map<string, boolean> = new Map();
  private enabledColumnsMap: Map<string, string[]> = new Map();

  // Callback for when visible range changes (pan/zoom) to update statistics
  private onRangeChange: (filename: string, dataname: string, minX: number, maxX: number) => void;

  // Colors for different columns to make them distinct
  private colorPalette = [
    '#569cd6', '#4ec9b0', '#ce9178', '#dcdcaa', '#c586c0',
    '#d16969', '#608b4e', '#b5cea8', '#4fc1ff', '#f48771'
  ];

  constructor(
    container: HTMLElement,
    onRangeChange: (filename: string, dataname: string, minX: number, maxX: number) => void
  ) {
    this.container = container;
    this.onRangeChange = onRangeChange;
  }

  updateData(appData: AppData) {
    this.appData = appData;
  }

  updateState(state: SidebarState) {
    // Determine which datasets need to be shown
    const requiredDatasets = new Set(
      state.enabledDatasets.map(ds => `${ds.filename}::${ds.dataname}`)
    );

    // Remove charts that are no longer enabled
    for (const [key, chart] of this.chartInstances.entries()) {
      if (!requiredDatasets.has(key)) {
        chart.destroy();
        this.chartInstances.delete(key);
        this.undoStacks.delete(key);
        this.redoStacks.delete(key);
        this.shareAxisStates.delete(key);
        this.enabledColumnsMap.delete(key);

        const wrapper = document.getElementById(`chart-wrapper-${key}`);
        if (wrapper) wrapper.remove();
      }
    }

    // Create or update charts
    state.enabledDatasets.forEach(ds => {
      const key = `${ds.filename}::${ds.dataname}`;
      const data = this.appData[ds.filename]?.[ds.dataname];

      if (!data) return;

      const enabledColsForThisDataset = state.enabledColumns.filter(
        col => data[col] !== undefined
      );

      if (enabledColsForThisDataset.length === 0) {
        // If dataset is enabled but no columns are selected, hide/destroy chart
        if (this.chartInstances.has(key)) {
          this.chartInstances.get(key)!.destroy();
          this.chartInstances.delete(key);
          this.shareAxisStates.delete(key);
          this.enabledColumnsMap.delete(key);
          const wrapper = document.getElementById(`chart-wrapper-${key}`);
          if (wrapper) wrapper.remove();
        }
        return;
      }

      if (this.chartInstances.has(key)) {
        this.updateChart(key, data, enabledColsForThisDataset);
      } else {
        this.createChart(ds.filename, ds.dataname, key, data, enabledColsForThisDataset);
      }
    });
  }

  private createChart(
    filename: string,
    dataname: string,
    key: string,
    data: any,
    enabledColumns: string[]
  ) {
    this.enabledColumnsMap.set(key, enabledColumns);

    const wrapper = document.createElement('div');
    wrapper.id = `chart-wrapper-${key}`;
    wrapper.style.marginBottom = '20px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.height = '400px';
    wrapper.style.border = '1px solid #3c3c3c';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.padding = '5px';
    toolbar.style.backgroundColor = '#2d2d2d';
    toolbar.style.borderBottom = '1px solid #3c3c3c';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '10px';

    const title = document.createElement('span');
    title.innerText = `${filename} > ${dataname}`;
    title.style.fontWeight = 'bold';
    title.style.marginRight = 'auto';

    const btnReset = document.createElement('button');
    btnReset.innerText = 'Reset';

    const btnUndo = document.createElement('button');
    btnUndo.innerText = 'Undo';

    const btnRedo = document.createElement('button');
    btnRedo.innerText = 'Redo';

    const btnAutoFitLocal = document.createElement('button');
    btnAutoFitLocal.innerText = 'AutoFit (Local)';

    const btnAutoFitAll = document.createElement('button');
    btnAutoFitAll.innerText = 'AutoFit (All)';

    const labelShareAxis = document.createElement('label');
    labelShareAxis.style.display = 'flex';
    labelShareAxis.style.alignItems = 'center';
    labelShareAxis.style.gap = '5px';
    labelShareAxis.style.color = '#cccccc';
    labelShareAxis.style.cursor = 'pointer';

    const checkboxShareAxis = document.createElement('input');
    checkboxShareAxis.type = 'checkbox';
    checkboxShareAxis.checked = false;

    const spanShareAxis = document.createElement('span');
    spanShareAxis.innerText = 'Share Axis';

    labelShareAxis.appendChild(checkboxShareAxis);
    labelShareAxis.appendChild(spanShareAxis);

    toolbar.appendChild(title);
    toolbar.appendChild(btnReset);
    toolbar.appendChild(btnUndo);
    toolbar.appendChild(btnRedo);
    toolbar.appendChild(btnAutoFitLocal);
    toolbar.appendChild(btnAutoFitAll);
    toolbar.appendChild(labelShareAxis);

    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.flex = '1';
    canvasContainer.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);

    wrapper.appendChild(toolbar);
    wrapper.appendChild(canvasContainer);
    this.container.appendChild(wrapper);

    // Initialize stacks
    this.undoStacks.set(key, []);
    this.redoStacks.set(key, []);

    // Create Chart
    const chartData = this.buildChartData(key, data, enabledColumns);
    const chartOptions = this.buildChartOptions(key, filename, dataname, enabledColumns);

    const chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions as any
    });

    this.chartInstances.set(key, chart);

    // Setup buttons
    btnReset.addEventListener('click', () => {
      chart.resetZoom();
      this.undoStacks.set(key, []);
      this.redoStacks.set(key, []);
      this.notifyRangeChange(filename, dataname, chart);
    });

    btnUndo.addEventListener('click', () => {
      this.undoZoom(key);
    });

    btnRedo.addEventListener('click', () => {
      this.redoZoom(key);
    });

    btnAutoFitLocal.addEventListener('click', () => {
      this.autoFitLocal(key);
    });

    btnAutoFitAll.addEventListener('click', () => {
      this.autoFitAll(key);
    });

    checkboxShareAxis.addEventListener('change', () => {
      this.shareAxisStates.set(key, checkboxShareAxis.checked);
      this.updateChart(key, data, this.enabledColumnsMap.get(key) || []);
    });

    // Initial notify
    setTimeout(() => {
        this.notifyRangeChange(filename, dataname, chart);
    }, 100);
  }

  private updateChart(key: string, data: any, enabledColumns: string[]) {
    this.enabledColumnsMap.set(key, enabledColumns);

    const chart = this.chartInstances.get(key);
    if (!chart) return;

    chart.data = this.buildChartData(key, data, enabledColumns);
    chart.options = this.buildChartOptions(
      key,
      key.split('::')[0],
      key.split('::')[1],
      enabledColumns
    ) as any;

    chart.update();
  }

  private buildChartData(key: string, data: any, enabledColumns: string[]): ChartData<'line'> {
    const dates = data.DATE as Date[];
    const isShared = this.shareAxisStates.get(key) === true;

    const datasets = enabledColumns.map((colName, idx) => {
      const colData = data[colName] as number[];
      let yAxisID = `y-${idx}`;

      if (isShared) {
        const match = colName.match(/\[(.*?)\]\s*$/);
        const unit = match ? match[1].trim() : 'none';
        yAxisID = `y-shared-${unit}`;
      }

      return {
        label: colName,
        data: dates.map((date, i) => ({ x: date.getTime(), y: colData[i] })),
        borderColor: this.colorPalette[idx % this.colorPalette.length],
        borderWidth: 1,
        pointRadius: 0, // hide points for better performance
        pointHitRadius: 5,
        yAxisID: yAxisID,
        animation: false,
        parsing: false // Performance boost
      };
    });

    return { datasets };
  }

  private buildChartOptions(
    key: string,
    filename: string,
    dataname: string,
    enabledColumns: string[]
  ): ChartOptions<'line'> {
    const scales: any = {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            millisecond: 'HH:mm:ss.SSS',
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm'
          }
        },
        ticks: { color: '#cccccc' },
        grid: { color: '#3c3c3c' }
      }
    };

    const isShared = this.shareAxisStates.get(key) === true;

    if (isShared) {
      const units = new Set<string>();
      enabledColumns.forEach(colName => {
        const match = colName.match(/\[(.*?)\]\s*$/);
        const unit = match ? match[1].trim() : 'none';
        units.add(unit);
      });

      let isFirstScale = true;
      Array.from(units).forEach((unit, idx) => {
        const yAxisID = `y-shared-${unit}`;
        scales[yAxisID] = {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: unit === 'none' ? 'No Unit' : unit,
            color: this.colorPalette[idx % this.colorPalette.length]
          },
          ticks: {
            color: this.colorPalette[idx % this.colorPalette.length]
          },
          grid: {
            drawOnChartArea: isFirstScale,
            color: '#3c3c3c'
          }
        };
        isFirstScale = false;
      });
    } else {
      enabledColumns.forEach((colName, idx) => {
        scales[`y-${idx}`] = {
          type: 'linear',
          display: true,
          position: 'right', // Right side Y-axis
          title: {
            display: true,
            text: colName,
            color: this.colorPalette[idx % this.colorPalette.length]
          },
          ticks: {
            color: this.colorPalette[idx % this.colorPalette.length]
          },
          grid: {
            drawOnChartArea: idx === 0, // only draw grid for the first y-axis to avoid clutter
            color: '#3c3c3c'
          }
        };
      });
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      plugins: {
        legend: {
          labels: { color: '#cccccc' }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            onPanStart: () => {
              this.saveZoomState(key);
            },
            onPanComplete: ({ chart }) => {
              this.notifyRangeChange(filename, dataname, chart);
            }
          },
          zoom: {
            wheel: {
              enabled: true
            },
            mode: (context: any) => {
               const event = context.event;
               if (event && event.shiftKey) {
                 return 'y';
               }
               return 'x';
            },
            onZoomStart: () => {
              this.saveZoomState(key);
            },
            onZoomComplete: ({ chart }) => {
               this.notifyRangeChange(filename, dataname, chart);
            }
          }
        }
      },
      scales
    };
  }

  private notifyRangeChange(filename: string, dataname: string, chart: Chart) {
      const xScale = chart.scales['x'];
      if(xScale) {
          this.onRangeChange(filename, dataname, xScale.min, xScale.max);
      }
  }

  // Undo/Redo logic
  private saveZoomState(key: string) {
    const chart = this.chartInstances.get(key);
    if (!chart) return;

    const state: CanvasState = {
      minX: chart.scales['x']?.min,
      maxX: chart.scales['x']?.max,
      minY: {},
      maxY: {}
    };

    Object.keys(chart.scales).forEach(scaleId => {
      if (scaleId.startsWith('y-')) {
        state.minY![scaleId] = chart.scales[scaleId].min;
        state.maxY![scaleId] = chart.scales[scaleId].max;
      }
    });

    const stack = this.undoStacks.get(key) || [];
    stack.push(state);
    this.undoStacks.set(key, stack);
    this.redoStacks.set(key, []); // clear redo stack on new action
  }

  private undoZoom(key: string) {
    const chart = this.chartInstances.get(key);
    const stack = this.undoStacks.get(key);
    if (!chart || !stack || stack.length === 0) return;

    // Save current state to redo
    const currentState: CanvasState = {
      minX: chart.scales['x']?.min,
      maxX: chart.scales['x']?.max,
      minY: {},
      maxY: {}
    };
    Object.keys(chart.scales).forEach(scaleId => {
      if (scaleId.startsWith('y-')) {
        currentState.minY![scaleId] = chart.scales[scaleId].min;
        currentState.maxY![scaleId] = chart.scales[scaleId].max;
      }
    });
    this.redoStacks.get(key)?.push(currentState);

    // Pop state from undo and apply
    const prevState = stack.pop()!;
    this.applyZoomState(chart, prevState);

    const parts = key.split('::');
    this.notifyRangeChange(parts[0], parts[1], chart);
  }

  private redoZoom(key: string) {
    const chart = this.chartInstances.get(key);
    const stack = this.redoStacks.get(key);
    if (!chart || !stack || stack.length === 0) return;

    // Save current state to undo
    const currentState: CanvasState = {
      minX: chart.scales['x']?.min,
      maxX: chart.scales['x']?.max,
      minY: {},
      maxY: {}
    };
    Object.keys(chart.scales).forEach(scaleId => {
      if (scaleId.startsWith('y-')) {
        currentState.minY![scaleId] = chart.scales[scaleId].min;
        currentState.maxY![scaleId] = chart.scales[scaleId].max;
      }
    });
    this.undoStacks.get(key)?.push(currentState);

    // Pop state from redo and apply
    const nextState = stack.pop()!;
    this.applyZoomState(chart, nextState);

    const parts = key.split('::');
    this.notifyRangeChange(parts[0], parts[1], chart);
  }

  private applyZoomState(chart: Chart, state: CanvasState) {
    if (state.minX !== undefined) chart.options.scales!['x']!.min = state.minX;
    if (state.maxX !== undefined) chart.options.scales!['x']!.max = state.maxX;

    if (state.minY && state.maxY) {
      Object.keys(state.minY).forEach(scaleId => {
        if (chart.options.scales![scaleId]) {
          chart.options.scales![scaleId]!.min = state.minY![scaleId];
          chart.options.scales![scaleId]!.max = state.maxY![scaleId];
        }
      });
    }

    chart.update('none');
  }

  // AutoFit
  private autoFitLocal(key: string) {
    const chart = this.chartInstances.get(key);
    if (!chart) return;

    this.saveZoomState(key);

    const minX = chart.scales['x'].min;
    const maxX = chart.scales['x'].max;

    const scaleRanges: { [yAxisID: string]: { min: number, max: number } } = {};

    chart.data.datasets.forEach(dataset => {
      const yAxisID = dataset.yAxisID as string;
      const data = dataset.data as { x: number; y: number }[];

      let min = Infinity;
      let max = -Infinity;

      for (const pt of data) {
        if (pt.x >= minX && pt.x <= maxX) {
          if (pt.y < min) min = pt.y;
          if (pt.y > max) max = pt.y;
        }
      }

      if (min !== Infinity && max !== -Infinity) {
        if (!scaleRanges[yAxisID]) {
          scaleRanges[yAxisID] = { min, max };
        } else {
          scaleRanges[yAxisID].min = Math.min(scaleRanges[yAxisID].min, min);
          scaleRanges[yAxisID].max = Math.max(scaleRanges[yAxisID].max, max);
        }
      }
    });

    Object.keys(scaleRanges).forEach(yAxisID => {
      const { min, max } = scaleRanges[yAxisID];
      if (chart.options.scales![yAxisID]) {
        // Add 5% padding
        const padding = (max - min) * 0.05;
        chart.options.scales![yAxisID]!.min = min - padding;
        chart.options.scales![yAxisID]!.max = max + padding;
      }
    });

    chart.update('none');
  }

  private autoFitAll(key: string) {
    const chart = this.chartInstances.get(key);
    if (!chart) return;

    this.saveZoomState(key);

    const scaleRanges: { [yAxisID: string]: { min: number, max: number } } = {};

    chart.data.datasets.forEach(dataset => {
      const yAxisID = dataset.yAxisID as string;
      const data = dataset.data as { x: number; y: number }[];

      let min = Infinity;
      let max = -Infinity;

      for (const pt of data) {
        if (pt.y < min) min = pt.y;
        if (pt.y > max) max = pt.y;
      }

      if (min !== Infinity && max !== -Infinity) {
        if (!scaleRanges[yAxisID]) {
          scaleRanges[yAxisID] = { min, max };
        } else {
          scaleRanges[yAxisID].min = Math.min(scaleRanges[yAxisID].min, min);
          scaleRanges[yAxisID].max = Math.max(scaleRanges[yAxisID].max, max);
        }
      }
    });

    Object.keys(scaleRanges).forEach(yAxisID => {
      const { min, max } = scaleRanges[yAxisID];
      if (chart.options.scales![yAxisID]) {
        const padding = (max - min) * 0.05;
        chart.options.scales![yAxisID]!.min = min - padding;
        chart.options.scales![yAxisID]!.max = max + padding;
      }
    });

    chart.update('none');
  }
}
