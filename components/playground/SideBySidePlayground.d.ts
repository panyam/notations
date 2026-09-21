import { DockViewPlayground } from "../../../src/web/dockview";
import "dockview-core/dist/styles/dockview.css";
import "../../../styles/NotationView.scss";
export declare class SideBySidePlayground {
    private playground;
    private sampleSelect;
    constructor();
    private init;
    private setupToolbar;
    private loadSample;
    render(): boolean;
    resetLayout(): void;
    get source(): string;
    set source(value: string);
    log(message: string, level?: "info" | "error" | "warning"): void;
    clearConsole(): void;
    showConsole(): void;
    hideConsole(): void;
    toggleConsole(): boolean;
    isConsoleVisible(): boolean;
    getPlayground(): DockViewPlayground;
}
