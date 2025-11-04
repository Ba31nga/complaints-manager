declare module "pdfkit/js/pdfkit.js" {
  // Minimal typing to satisfy TS; full types are not required for our usage
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export default class PDFDocument {
    constructor(options?: Record<string, unknown>);
    text: (...args: any[]) => any;
    image: (...args: any[]) => any;
    moveTo: (...args: any[]) => any;
    lineTo: (...args: any[]) => any;
    strokeColor: (...args: any[]) => any;
    lineWidth: (...args: any[]) => any;
    stroke: (...args: any[]) => any;
    fillColor: (...args: any[]) => any;
    font: (...args: any[]) => any;
    fontSize: (...args: any[]) => any;
    roundedRect: (...args: any[]) => any;
    moveDown: (...args: any[]) => any;
    registerFont: (...args: any[]) => any;
    end: () => any;
    on: (...args: any[]) => any;
    page: any;
  }
}

declare module "pdfkit";
