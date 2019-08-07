export declare class IbtParser {
    private fileName;
    private rawBuffer;
    private sdkHeader;
    private varHeaders;
    constructor(fileName: string);
    parse(): Promise<void>;
    getSessionInfo(): any;
    getVarValue(name: string): any;
    private getLatestVarBuf;
    private parseHeader;
    private parseDiskSubHeader;
    private parseSessionInfo;
    private parseVarHeaders;
    private parseAllVarBufLines;
    private parseSingleVarBufLine;
    private parseVar;
    private getVarBuf;
    private getBoolean;
    private getChar;
    private getInt32;
    private getInt64;
    private getFloat;
    private getDouble;
    private getString;
    private readFile;
}
//# sourceMappingURL=ibtParser.d.ts.map