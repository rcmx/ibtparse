"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IbtParser = void 0;
const buffer_1 = require("buffer");
const fs = require("fs");
const irSdk = require("./irSdk");
const datefns = require("date-fns");
const YAML = require("yamljs");
class IbtParser {
    constructor(fileName) {
        this.rawBuffer = null;
        this.sdkHeader = null;
        this.varHeaders = null;
        this.getLatestVarBuf = (varBufs) => varBufs.reduce((latest, curr) => (curr.tickCount > latest.tickCount ? curr : latest), varBufs[0]);
        this.fileName = fileName;
    }
    async parse() {
        this.rawBuffer = await this.readFile();
        this.sdkHeader = this.parseHeader(this.rawBuffer.buffer, 0);
        //		const diskSubHeader = this.parseDiskSubHeader(this.rawBuffer.buffer, irSdk.sizeof_irsdk_header);
        this.varHeaders = this.parseVarHeaders(this.rawBuffer.buffer, this.sdkHeader.varHeaderOffset, this.sdkHeader.numVars);
        //		const latestVarBuf = this.getLatestVarBuf(this.sdkHeader.varBuf);
        // NOTE: in ibt file, VarBuf's keep getting appended to the file, so we have to keep reading until EOF
        //		const varLines = this.parseAllVarBufLines(this.rawBuffer.buffer, varHeaders, this.sdkHeader.numVars, latestVarBuf, this.sdkHeader.bufLen);
    }
    getSessionInfo() {
        const sessionInfo = this.parseSessionInfo(this.rawBuffer.buffer, this.sdkHeader.sessionInfoOffset, this.sdkHeader.sessionInfoLen);
        return sessionInfo;
    }
    getVarValue(name) {
        const latestVarBuf = this.getLatestVarBuf(this.sdkHeader.varBuf);
        for (let i = 0; i < this.sdkHeader.numVars; i++) {
            if (this.varHeaders[i].name.toLowerCase() === name.toLowerCase()) {
                const varHeader = this.varHeaders[i];
                const varOffset = latestVarBuf.bufOffset + varHeader.offset;
                const varData = this.parseVar(this.rawBuffer.buffer, varOffset, varHeader.type);
                return varData;
            }
        }
        return -1;
    }
    // offset is the number of bytes from the start of the ArrayBuffer where this header starts
    parseHeader(buff, offset) {
        // note: for the offset, we INCREMENT first, THEN read
        const header = {
            ver: this.getInt32(buff, offset + 0),
            status: this.getInt32(buff, offset + 4),
            tickRate: this.getInt32(buff, offset + 8),
            sessionInfoUpdate: this.getInt32(buff, offset + 12),
            sessionInfoLen: this.getInt32(buff, offset + 16),
            sessionInfoOffset: this.getInt32(buff, offset + 20),
            numVars: this.getInt32(buff, offset + 24),
            varHeaderOffset: this.getInt32(buff, offset + 28),
            numBuf: this.getInt32(buff, offset + 32),
            bufLen: this.getInt32(buff, offset + 36),
            pad1_0: 'pad' + (offset + 40),
            pad1_1: 'pad' + (offset + 44),
        };
        // create varBuff array and fill it in
        const varBuffOffset = offset + 48;
        header.varBuf = new Array(header.numBuf);
        for (let i = 0; i < header.numBuf; i++) {
            header.varBuf[i] = this.getVarBuf(buff, varBuffOffset + i * irSdk.sizeOf_irsdk_varBuf);
        }
        return header;
    }
    // offset is the number of bytes from the start of the ArrayBuffer where this header starts
    parseDiskSubHeader(buff, offset) {
        // time_t is 64bits and secs since epoc - convert to number, then ms and then Date
        const sessionStartDate = new Date(Number(this.getInt64(buff, offset + 0)) * 1000);
        const diskSubHeader = {
            sessionStartDate,
            sessionStartTime: datefns.addSeconds(sessionStartDate, Number(this.getDouble(buff, offset + 8))),
            sessionEndTime: datefns.addSeconds(sessionStartDate, Number(this.getDouble(buff, offset + 16))),
            sessionLapCount: this.getInt32(buff, offset + 24),
            sessionRecordCount: this.getInt32(buff, offset + 28),
        };
        return diskSubHeader;
    }
    parseSessionInfo(buff, offset, len) {
        const yamlString = buffer_1.Buffer.from(buff, offset, len).toString();
        const sessInfo = YAML.parse(yamlString);
        return sessInfo;
    }
    parseVarHeaders(buff, offset, numVars) {
        const varHeaders = [];
        for (let i = 0; i < numVars; i++) {
            const varHeader = {
                //				type: irSdk.irsdk_VarType[this.getInt(buff, offset += 0)],
                type: this.getInt32(buff, offset + 0),
                offset: this.getInt32(buff, offset + 4),
                count: this.getInt32(buff, offset + 8),
                countAsTime: this.getBoolean(buff, offset + 12),
                pad: 'abc',
                name: this.getString(buff, offset + 16, irSdk.IRSDK_MAX_STRING),
                desc: this.getString(buff, offset + 16 + irSdk.IRSDK_MAX_STRING, irSdk.IRSDK_MAX_DESC),
                unit: this.getString(buff, offset + 16 + irSdk.IRSDK_MAX_STRING + irSdk.IRSDK_MAX_DESC, irSdk.IRSDK_MAX_STRING),
            };
            varHeaders.push(varHeader);
            // bump offset to start of next varBuf
            offset += irSdk.sizeOf_irsdk_varHeader;
        }
        return varHeaders;
    }
    // NOTE: in ibt files, VarBuf lines keep getting appended to the file, so we have to keep reading until EOF
    parseAllVarBufLines(buff, varHeaders, numVars, varBuf, lineBuffLen) {
        // const startTime = Date.now();
        const varLines = [];
        const eof = buff.byteLength;
        let varLineOffset = varBuf.bufOffset;
        let lineNum = 0;
        while (varLineOffset < eof) {
            const vars = this.parseSingleVarBufLine(buff, varLineOffset, varHeaders, numVars);
            varLines.push(vars);
            varLineOffset += lineBuffLen;
            lineNum++;
        }
        // const endTime = Date.now();
        // console.log(`parseAllVarBufLines() elapsed ${endTime-startTime}ms.    perLineBuf: ${(endTime-startTime)/lineNum}`);
        return varLines;
    }
    parseSingleVarBufLine(buff, varLineOffset, varHeaders, numVars) {
        const vars = [];
        for (let i = 0; i < numVars; i++) {
            const varHeader = varHeaders[i];
            const varOffset = varLineOffset + varHeader.offset;
            const varData = this.parseVar(buff, varOffset, varHeader.type);
            vars.push(varData);
        }
        return vars;
    }
    parseVar(buff, offset, type) {
        let dataValue;
        switch (type) {
            case irSdk.irsdk_VarType.irsdk_char: // 1 byte
                dataValue = this.getChar(buff, offset);
                break;
            case irSdk.irsdk_VarType.irsdk_bool: // 1 byte
                dataValue = this.getBoolean(buff, offset);
                break;
            case irSdk.irsdk_VarType.irsdk_int: // 4 bytes
                dataValue = this.getInt32(buff, offset);
                break;
            case irSdk.irsdk_VarType.irsdk_bitField: // 4 bytes
                dataValue = this.getInt32(buff, offset);
                break;
            case irSdk.irsdk_VarType.irsdk_float: // 4 bytes
                dataValue = this.getFloat(buff, offset);
                break;
            case irSdk.irsdk_VarType.irsdk_double: // 8 bytes
                dataValue = this.getDouble(buff, offset);
                break;
            default:
                throw new Error(`unknown varHeader type: ${type}`);
        }
        return dataValue;
    }
    getVarBuf(buff, offset) {
        const varBuf = {
            tickCount: this.getInt32(buff, offset + 0),
            bufOffset: this.getInt32(buff, offset + 4),
            pad: 'abcd', // (16 byte align)
        };
        return varBuf;
    }
    // countAsTime: this.getBooleanAsChar(buff, offset + 12),
    getBoolean(buffer, offset) {
        const bool = this.getChar(buffer, offset) !== 0;
        return bool;
    }
    getChar(buffer, offset) {
        const array = new Uint8Array(buffer, offset, 1);
        return array[0];
    }
    getInt32(buffer, offset) {
        const dv = new DataView(buffer, offset, Int32Array.BYTES_PER_ELEMENT);
        const val = dv.getInt32(0, true);
        return val;
    }
    getInt64(buffer, offset) {
        const array = new BigInt64Array(buffer, offset, 1);
        return array[0];
    }
    getFloat(buffer, offset) {
        const dv2 = new DataView(buffer, offset, Float32Array.BYTES_PER_ELEMENT);
        const val2 = dv2.getFloat32(0, true);
        return val2;
    }
    getDouble(buffer, offset) {
        const dv = new DataView(buffer, offset, Float64Array.BYTES_PER_ELEMENT);
        const val = dv.getFloat64(0, true);
        return val;
    }
    getString(buff, offset, maxChars) {
        const rawBytes = buffer_1.Buffer.from(buff, offset, maxChars);
        // find null terminator
        for (let i = 0; i < maxChars; i++) {
            if (rawBytes[i] === 0) {
                const str = rawBytes.slice(0, i).toString();
                return str;
            }
        }
        throw new Error('unable to find null terminator');
    }
    async readFile() {
        return new Promise((resolve, reject) => {
            fs.readFile(this.fileName, (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data);
            });
        });
    }
}
exports.IbtParser = IbtParser;
