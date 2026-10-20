declare module "mammoth" {
  export function extractRawText(options: { buffer: Buffer }): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
}
