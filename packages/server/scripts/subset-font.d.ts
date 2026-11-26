declare module "subset-font" {
  interface SubsetOptions {
    readonly targetFormat?: "sfnt" | "woff" | "woff2" | "truetype";
  }
  export default function subsetFont(font: Buffer, text: string, options?: SubsetOptions): Promise<Buffer>;
}
