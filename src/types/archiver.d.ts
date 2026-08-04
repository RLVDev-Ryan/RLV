/** Minimal typings for archiver 8 (ESM, named exports). */
declare module 'archiver' {
  export class ZipArchive {
    pipe(stream: NodeJS.WritableStream): void;
    directory(src: string, destPath: string): void;
    append(source: NodeJS.ReadableStream | Buffer | string, data: { name: string }): void;
    finalize(): Promise<void>;
  }
}
