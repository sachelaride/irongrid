declare module 'screenshot-desktop' {
    interface ScreenshotOptions {
        format?: 'png' | 'jpg';
        screen?: string | number;
        filename?: string;
    }
    function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    export default screenshot;
}
declare module 'node-notifier';
declare module 'systray2';
