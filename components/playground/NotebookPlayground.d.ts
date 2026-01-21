import "../../../styles/NotationView.scss";
export declare class NotebookPlayground {
    private container;
    private consoleOutput;
    private sampleSelect;
    private currentSample;
    private cells;
    private editingCellId;
    private draggedCellId;
    constructor();
    private init;
    private loadSample;
    private buildFullSource;
    private render;
    private renderCellStructure;
    private renderCellNotation;
    private startEdit;
    private applyEdit;
    private cancelEdit;
    private deleteCell;
    private addCell;
    private onDragStart;
    private onDragOver;
    private onDrop;
    private onDragEnd;
    private log;
    private openViewAll;
}
