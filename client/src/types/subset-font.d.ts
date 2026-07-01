declare module 'subset-font' {
  function subsetFont(
    originalFont: Buffer | ArrayBuffer | Uint8Array,
    text: string,
    options?: {
      targetFormat?: string;
      preserveNameIds?: string[];
      variationAxes?: string[];
      noLayoutClosure?: boolean;
    }
  ): Promise<Buffer>;
  export default subsetFont;
}
