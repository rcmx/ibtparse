export declare const IRSDK_MAX_BUFS = 4;
export declare const IRSDK_MAX_STRING = 32;
export declare const IRSDK_MAX_DESC = 64;
export declare enum irsdk_VarType {
    irsdk_char = 0,
    irsdk_bool = 1,
    irsdk_int = 2,
    irsdk_bitField = 3,
    irsdk_float = 4,
    irsdk_double = 5,
    irsdk_ETCount = 6
}
export interface irsdk_diskSubHeader {
    sessionStartDate: Date;
    sessionStartTime: Date;
    sessionEndTime: Date;
    sessionLapCount: number;
    sessionRecordCount: number;
}
export declare const sizeOf_irsdk_diskSubHeader: number;
export interface irsdk_varHeader {
    type: irsdk_VarType;
    offset: number;
    count: number;
    countAsTime: boolean;
    pad: string;
    name: string;
    desc: string;
    unit: string;
}
export declare const sizeOf_irsdk_varHeader: number;
export interface irsdk_varBuf {
    tickCount: number;
    bufOffset: number;
    pad: string;
}
export declare const sizeOf_irsdk_varBuf: number;
export interface irsdk_header {
    ver: number;
    status: number;
    tickRate: number;
    sessionInfoUpdate: number;
    sessionInfoLen: number;
    sessionInfoOffset: number;
    numVars: number;
    varHeaderOffset: number;
    numBuf: number;
    bufLen: number;
    pad1: number;
    varBuf: irsdk_varBuf[];
}
export declare const sizeof_irsdk_header: number;
//# sourceMappingURL=irSdk.d.ts.map