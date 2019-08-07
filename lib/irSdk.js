"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeof_irsdk_header = exports.sizeOf_irsdk_varBuf = exports.sizeOf_irsdk_varHeader = exports.sizeOf_irsdk_diskSubHeader = exports.irsdk_VarType = exports.IRSDK_MAX_DESC = exports.IRSDK_MAX_STRING = exports.IRSDK_MAX_BUFS = void 0;
exports.IRSDK_MAX_BUFS = 4;
exports.IRSDK_MAX_STRING = 32;
exports.IRSDK_MAX_DESC = 64;
var irsdk_VarType;
(function (irsdk_VarType) {
    // 1 byte
    irsdk_VarType[irsdk_VarType["irsdk_char"] = 0] = "irsdk_char";
    irsdk_VarType[irsdk_VarType["irsdk_bool"] = 1] = "irsdk_bool";
    // 4 bytes
    irsdk_VarType[irsdk_VarType["irsdk_int"] = 2] = "irsdk_int";
    irsdk_VarType[irsdk_VarType["irsdk_bitField"] = 3] = "irsdk_bitField";
    irsdk_VarType[irsdk_VarType["irsdk_float"] = 4] = "irsdk_float";
    // 8 bytes
    irsdk_VarType[irsdk_VarType["irsdk_double"] = 5] = "irsdk_double";
    //index, don't use
    irsdk_VarType[irsdk_VarType["irsdk_ETCount"] = 6] = "irsdk_ETCount";
})(irsdk_VarType = exports.irsdk_VarType || (exports.irsdk_VarType = {}));
exports.sizeOf_irsdk_diskSubHeader = 8 + 8 + 8 + 4 + 4; // size of original C struct in bytes
exports.sizeOf_irsdk_varHeader = 4 + 4 + 4 + 1 + 1 * 3 + 32 + 64 + 32; // size of original C struct in bytes
exports.sizeOf_irsdk_varBuf = 4 + 4 + 4 * 2; // size of original C struct in bytes
exports.sizeof_irsdk_header = 4 * 10 + 4 * 2 + exports.sizeOf_irsdk_varBuf * exports.IRSDK_MAX_BUFS; // size of original C struct in bytes
